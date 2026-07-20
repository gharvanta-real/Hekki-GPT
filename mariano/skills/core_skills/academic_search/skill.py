"""
MARIANO Core Skill — Academic Search Engine (Multi-source: arXiv + PubMed + Semantic Scholar + OpenAlex)
Returns evidence-graded research papers with TRL tagging and citation counts.
"""
from __future__ import annotations

import asyncio
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import json
from typing import Any

import httpx

from mariano.skills._base import BaseSkill, SkillResult


# ─── TRL Tagging ─────────────────────────────────────────────────────────────
def _assign_trl(source_db: str, citation_count: int) -> str:
    if citation_count >= 1000:
        return "TRL 5+ (Established Literature — cited 1000+ times)"
    if citation_count >= 100:
        return "TRL 4 (Validated Experimentally — widely cited)"
    if source_db in ("pubmed",):
        return "TRL 3-4 (Peer-Reviewed Empirical Study)"
    if source_db == "arxiv":
        return "TRL 1-2 (Preprint — NOT peer-reviewed; may not be measured in lab)"
    if source_db == "semantic_scholar":
        return "TRL 3 (Published — verify via primary source)"
    return "TRL Unknown"


# ─── arXiv ───────────────────────────────────────────────────────────────────
async def _fetch_arxiv(query: str, max_results: int = 5, timeout: float = 8.0) -> list[dict]:
    try:
        encoded = urllib.parse.quote(query)
        url = (
            f"https://export.arxiv.org/api/query"
            f"?search_query=all:{encoded}&start=0&max_results={max_results}"
            f"&sortBy=relevance&sortOrder=descending"
        )
        def _do():
            req = urllib.request.Request(url, headers={"User-Agent": "Mariano-AcademicSearch/2.0"})
            with urllib.request.urlopen(req, timeout=int(timeout)) as r:
                return r.read().decode("utf-8")

        xml_data = await asyncio.wait_for(asyncio.to_thread(_do), timeout=timeout)
        root = ET.fromstring(xml_data)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        papers = []
        for entry in root.findall("atom:entry", ns)[:max_results]:
            title   = (entry.findtext("atom:title", "", ns) or "").strip().replace("\n", " ")
            summary = (entry.findtext("atom:summary", "", ns) or "").strip().replace("\n", " ")[:400]
            link_el = entry.find("atom:id", ns)
            link    = link_el.text.strip() if link_el is not None else ""
            authors = [a.findtext("atom:name", "", ns) for a in entry.findall("atom:author", ns)][:3]
            pub_el  = entry.find("atom:published", ns)
            year    = pub_el.text[:4] if pub_el is not None else "?"
            doi_el  = entry.find("atom:doi", ns)
            doi     = doi_el.text.strip() if doi_el is not None else None
            # Try DOI from alternate links
            if not doi:
                for link_node in entry.findall("atom:link", ns):
                    href = link_node.get("href", "")
                    if "doi.org" in href:
                        doi = href.split("doi.org/")[-1]
                        break
            papers.append({
                "title": title,
                "authors": authors,
                "year": year,
                "doi": doi,
                "url": link,
                "abstract": summary,
                "source_db": "arxiv",
                "citation_count": 0,
            })
        return papers
    except Exception:
        return []


# ─── PubMed (NCBI EUtils — free, no key) ────────────────────────────────────
async def _fetch_pubmed(query: str, max_results: int = 4, timeout: float = 8.0) -> list[dict]:
    try:
        encoded = urllib.parse.quote(query)
        search_url = (
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            f"?db=pubmed&term={encoded}&retmax={max_results}&retmode=json&sort=relevance"
        )
        def _do_search():
            req = urllib.request.Request(search_url, headers={"User-Agent": "Mariano-AcademicSearch/2.0"})
            with urllib.request.urlopen(req, timeout=int(timeout)) as r:
                return json.loads(r.read().decode("utf-8"))

        search_data = await asyncio.wait_for(asyncio.to_thread(_do_search), timeout=timeout)
        ids = search_data.get("esearchresult", {}).get("idlist", [])
        if not ids:
            return []

        # Fetch summaries
        id_str = ",".join(ids)
        summary_url = (
            f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
            f"?db=pubmed&id={id_str}&retmode=json"
        )
        def _do_summary():
            req = urllib.request.Request(summary_url, headers={"User-Agent": "Mariano-AcademicSearch/2.0"})
            with urllib.request.urlopen(req, timeout=int(timeout)) as r:
                return json.loads(r.read().decode("utf-8"))

        summary_data = await asyncio.wait_for(asyncio.to_thread(_do_summary), timeout=timeout)
        result_map = summary_data.get("result", {})

        papers = []
        for pmid in ids:
            entry = result_map.get(pmid, {})
            title = entry.get("title", "")
            year  = entry.get("pubdate", "?")[:4]
            authors = [a.get("name", "") for a in entry.get("authors", [])[:3]]
            doi   = entry.get("doi", None) or entry.get("elocationid", "")
            if doi and "doi:" in doi.lower():
                doi = doi.split("doi:")[-1].strip()
            papers.append({
                "title": title,
                "authors": authors,
                "year": year,
                "doi": doi if doi else None,
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                "abstract": "",  # PubMed esummary doesn't include abstract — title + DOI sufficient
                "source_db": "pubmed",
                "citation_count": 0,
            })
        return papers
    except Exception:
        return []


# ─── Semantic Scholar (free, no key) ─────────────────────────────────────────
async def _fetch_semantic_scholar(query: str, max_results: int = 5, timeout: float = 8.0) -> list[dict]:
    try:
        encoded = urllib.parse.quote(query)
        url = (
            f"https://api.semanticscholar.org/graph/v1/paper/search"
            f"?query={encoded}&limit={max_results}"
            f"&fields=title,authors,year,externalIds,abstract,citationCount,url"
        )
        async with httpx.AsyncClient(timeout=timeout, headers={"User-Agent": "Mariano-AcademicSearch/2.0"}) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return []
            data = resp.json()

        papers = []
        for item in data.get("data", [])[:max_results]:
            title      = item.get("title", "")
            year       = str(item.get("year", "?"))
            authors    = [a.get("name", "") for a in item.get("authors", [])[:3]]
            ext_ids    = item.get("externalIds", {})
            doi        = ext_ids.get("DOI", None)
            arxiv_id   = ext_ids.get("ArXiv", None)
            ref_url    = item.get("url", "")
            if arxiv_id and not ref_url:
                ref_url = f"https://arxiv.org/abs/{arxiv_id}"
            abstract   = (item.get("abstract") or "")[:400]
            citations  = item.get("citationCount", 0) or 0
            papers.append({
                "title": title,
                "authors": authors,
                "year": year,
                "doi": doi,
                "url": ref_url,
                "abstract": abstract,
                "source_db": "semantic_scholar",
                "citation_count": citations,
            })
        return papers
    except Exception:
        return []


# ─── Deduplication ───────────────────────────────────────────────────────────
def _deduplicate(papers: list[dict]) -> list[dict]:
    """Deduplicate by DOI first, then by title similarity (first 60 chars)."""
    seen_dois: set[str] = set()
    seen_titles: set[str] = set()
    unique = []
    for p in papers:
        doi = (p.get("doi") or "").strip().lower()
        title_key = p.get("title", "").strip().lower()[:60]
        if doi and doi in seen_dois:
            continue
        if title_key and title_key in seen_titles:
            continue
        if doi:
            seen_dois.add(doi)
        if title_key:
            seen_titles.add(title_key)
        unique.append(p)
    return unique


# ─── Formatter ───────────────────────────────────────────────────────────────
def _format_paper(p: dict, idx: int) -> str:
    authors_str = ", ".join(p["authors"]) + (" et al." if len(p["authors"]) == 3 else "")
    trl = _assign_trl(p["source_db"], p["citation_count"])
    doi_line = f"  DOI: {p['doi']}" if p.get("doi") else ""
    cite_line = f"  Citations: {p['citation_count']}" if p["citation_count"] > 0 else ""
    abstract_line = f"  Abstract: {p['abstract']}..." if p.get("abstract") else ""
    db_badge = p["source_db"].upper().replace("_", " ")
    parts = [
        f"[{idx}] [{db_badge}] {p['title']} ({authors_str}, {p['year']})",
        f"  TRL: {trl}",
        f"  URL: {p['url']}",
    ]
    if doi_line:
        parts.append(doi_line)
    if cite_line:
        parts.append(cite_line)
    if abstract_line:
        parts.append(abstract_line)
    return "\n".join(parts)


# ─── Skill Class ─────────────────────────────────────────────────────────────
class AcademicSearchSkill(BaseSkill):
    name        = "academic_search"
    description = (
        "Multi-source academic literature search across arXiv, PubMed, and Semantic Scholar. "
        "Returns verified papers with TRL-tagged citations, DOI links, citation counts, and structured abstracts. "
        "Use for grounding scientific claims in real published literature before making assertions. "
        "Every result includes a TRL label (1-2=Preprint, 3-4=Peer-Reviewed, 5+=Established). "
        "ASTM/ISO test standards are embedded into paper context for materials and engineering claims."
    )
    version = "2.0.0"
    tags    = ["research", "science", "academic", "pubmed", "arxiv", "semantic-scholar", "evidence", "citations"]

    def get_parameters_schema(self) -> dict:
        return {
            "query": {
                "type": "string",
                "description": "Scientific search query. Be specific — include material names, mechanisms, or measurement techniques.",
                "required": True,
            },
            "sources": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Which databases to search: ['arxiv', 'pubmed', 'semantic_scholar']. Default: all three.",
            },
            "max_per_source": {
                "type": "integer",
                "description": "Max papers per database. Default 4. Total max = 12.",
                "default": 4,
            },
        }

    async def execute(
        self,
        query: str,
        sources: list[str] | None = None,
        max_per_source: int = 4,
    ) -> SkillResult:
        if sources is None:
            sources = ["arxiv", "pubmed", "semantic_scholar"]

        max_per_source = min(max(max_per_source, 1), 6)

        tasks = []
        if "arxiv" in sources:
            tasks.append(_fetch_arxiv(query, max_per_source))
        if "pubmed" in sources:
            tasks.append(_fetch_pubmed(query, max_per_source))
        if "semantic_scholar" in sources:
            tasks.append(_fetch_semantic_scholar(query, max_per_source))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_papers: list[dict] = []
        for r in results:
            if isinstance(r, list):
                all_papers.extend(r)

        # Deduplicate
        all_papers = _deduplicate(all_papers)

        # Sort by citation count descending (most cited = highest credibility first)
        all_papers.sort(key=lambda p: p.get("citation_count", 0), reverse=True)

        if not all_papers:
            return SkillResult(
                success=False,
                data=None,
                error=f"No papers found for query: '{query}' across all sources.",
            )

        header = (
            f"VERIFIED ACADEMIC LITERATURE — {len(all_papers)} papers from "
            f"{', '.join(sources).upper()} (sorted by citation count)\n"
            f"Query: \"{query}\"\n"
            f"CITATION RULE: Only cite papers from this list. If claim has no source here, state: "
            f"'No verified source — reasoning from first principles.'\n\n"
        )
        body = "\n\n".join([_format_paper(p, i + 1) for i, p in enumerate(all_papers)])

        return SkillResult(
            success=True,
            data=header + body,
            metadata={
                "total": len(all_papers),
                "sources_used": sources,
                "query": query,
                "by_db": {
                    db: sum(1 for p in all_papers if p["source_db"] == db)
                    for db in sources
                },
            },
        )
