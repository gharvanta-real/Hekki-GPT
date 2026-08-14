"""Debate Search — DuckDuckGo web search and arXiv API integration for Debate engine."""
from __future__ import annotations

import asyncio
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import structlog

from mariano.core.debate.debate_config import SEARCH_MAX_RESULTS, SEARCH_SNIPPET_LEN

log = structlog.get_logger(__name__)


async def _web_search(query: str) -> str:
    """Standalone DuckDuckGo search — isolated, no MARIANO skill registry dependency."""
    try:
        from duckduckgo_search import DDGS

        def _do_search():
            with DDGS() as ddgs:
                results = list(ddgs.text(query, region="wt-wt", max_results=SEARCH_MAX_RESULTS))
            if not results:
                return ""
            lines = []
            for r in results:
                title = r.get("title", "")
                link  = r.get("href", "")
                body  = r.get("body", "")[:SEARCH_SNIPPET_LEN]
                lines.append(f"• {title} ({link}): {body}")
            return "\n".join(lines)

        return await asyncio.to_thread(_do_search)
    except Exception as e:
        log.warning("debate.web_search_failed", error=str(e))
        return ""


async def _fetch_arxiv_papers(topic: str, max_results: int = 5) -> str:
    """Fetch real, verified papers from arXiv API before the debate starts."""
    try:
        words = topic.replace('"', '').split()
        query_words = ' '.join(words[:6])
        encoded = urllib.parse.quote(query_words)
        url = (
            f"https://export.arxiv.org/api/query"
            f"?search_query=all:{encoded}"
            f"&start=0&max_results={max_results}"
            f"&sortBy=relevance&sortOrder=descending"
        )

        def _do_fetch():
            req = urllib.request.Request(url, headers={'User-Agent': 'Mariano-Debate/1.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                return resp.read().decode('utf-8')

        xml_data = await asyncio.to_thread(_do_fetch)
        root = ET.fromstring(xml_data)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}

        papers = []
        for entry in root.findall('atom:entry', ns)[:max_results]:
            title   = (entry.findtext('atom:title', '', ns) or '').strip().replace('\n', ' ')
            summary = (entry.findtext('atom:summary', '', ns) or '').strip().replace('\n', ' ')[:300]
            link_el = entry.find('atom:id', ns)
            link    = link_el.text.strip() if link_el is not None else ''
            authors = [a.findtext('atom:name', '', ns) for a in entry.findall('atom:author', ns)][:3]
            pub_el  = entry.find('atom:published', ns)
            year    = pub_el.text[:4] if pub_el is not None else ''
            author_str = ', '.join(authors) + (' et al.' if len(authors) == 3 else '')
            papers.append(
                f"[VERIFIED] {title} ({author_str}, {year})\n"
                f"  Abstract: {summary}...\n"
                f"  URL: {link}"
            )

        if not papers:
            return ""
        return "VERIFIED RESEARCH PAPERS (arXiv — cite these, do not invent others):\n\n" + "\n\n".join(papers)

    except Exception as e:
        log.warning("debate.arxiv_fetch_failed", error=str(e))
        return ""
