"""MARIANO Core Skill — Resilient Multi-Engine Web Search (Google News, DuckDuckGo & Wikipedia)."""
from __future__ import annotations
import asyncio
import html
import re
import urllib.parse
from typing import Any
import httpx
import xml.etree.ElementTree as ET
from mariano.skills._base import BaseSkill, SkillResult
import structlog

log = structlog.get_logger(__name__)


def _clean_text(text: str) -> str:
    """Safely strip HTML markup and unescape HTML/XML entities."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = html.unescape(clean)
    return re.sub(r"\s+", " ", clean).strip()


class WebSearchSkill(BaseSkill):
    name = "web_search"
    description = "Search the internet for live real-time information, news, websites, jobs, and facts. Returns top search results with titles, URLs, and snippets."
    version = "2.0.0"
    tags = ["web", "search", "research", "internet", "live-data", "google", "ddg"]

    def get_parameters_schema(self) -> dict:
        return {
            "query": {"type": "string", "description": "Search query", "required": True},
            "max_results": {"type": "integer", "description": "Max results to return", "default": 5},
            "region": {"type": "string", "description": "Region code e.g. in-en, us-en", "default": "in-en"},
        }

    async def execute(self, query: str, max_results: int = 5, region: str = "in-en") -> SkillResult:
        if not query or not query.strip():
            return SkillResult(success=False, data=None, error="Search query cannot be empty.")

        q_clean = query.strip()
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "*/*"
        }

        results: list[dict] = []

        async with httpx.AsyncClient(timeout=7, follow_redirects=True, headers=headers) as client:
            # 1. Primary Provider: Google Live Web Search / News RSS (Fast, High Uptime, Fresh 2026 data)
            try:
                g_results = await self._search_google_rss(client, q_clean, max_results)
                if g_results:
                    results.extend(g_results)
            except Exception as exc:
                log.warning("web_search.google_rss_failed", error=str(exc))

            # 2. Secondary Provider: DuckDuckGo Instant Knowledge API (Definitions, Facts, Deep Links)
            if len(results) < max_results:
                try:
                    ddg_results = await self._search_ddg_api(client, q_clean, max_results - len(results))
                    if ddg_results:
                        results.extend(ddg_results)
                except Exception as exc:
                    log.warning("web_search.ddg_api_failed", error=str(exc))

            # 3. Tertiary Provider: Wikipedia Knowledge API
            if len(results) < max_results:
                try:
                    wiki_results = await self._search_wikipedia(client, q_clean, max_results - len(results))
                    if wiki_results:
                        results.extend(wiki_results)
                except Exception as exc:
                    log.warning("web_search.wikipedia_failed", error=str(exc))

        if not results:
            return SkillResult(
                success=False,
                data=None,
                error=f"No search results found for query: '{q_clean}'"
            )

        return self._format_results(results[:max_results], q_clean)

    async def _search_google_rss(self, client: httpx.AsyncClient, query: str, max_results: int) -> list[dict]:
        encoded = urllib.parse.quote(query)
        url = f"https://news.google.com/rss/search?q={encoded}&hl=en-IN&gl=IN&ceid=IN:en"
        resp = await client.get(url)
        if resp.status_code != 200:
            return []

        xml_text = resp.text
        sanitized_xml = re.sub(r"&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[a-fA-F0-9]+);)", "&amp;", xml_text)
        
        items: list[dict] = []
        try:
            root = ET.fromstring(sanitized_xml)
            for item in root.iter("item"):
                title = _clean_text(item.findtext("title", ""))
                link = (item.findtext("link") or "").strip()
                desc = _clean_text(item.findtext("description", ""))
                if title:
                    items.append({"title": title, "href": link, "body": desc[:250]})
                if len(items) >= max_results:
                    break
        except Exception:
            item_blocks = re.findall(r"<item\b[^>]*>([\s\S]*?)</item>", xml_text, re.IGNORECASE)
            for block in item_blocks:
                t_match = re.search(r"<title\b[^>]*>([\s\S]*?)</title>", block, re.IGNORECASE)
                l_match = re.search(r"<link\b[^>]*>([\s\S]*?)</link>", block, re.IGNORECASE)
                d_match = re.search(r"<description\b[^>]*>([\s\S]*?)</description>", block, re.IGNORECASE)
                title = _clean_text(t_match.group(1)) if t_match else ""
                link = (l_match.group(1).strip() if l_match else "")
                desc = _clean_text(d_match.group(1)) if d_match else ""
                if title:
                    items.append({"title": title, "href": link, "body": desc[:250]})
                if len(items) >= max_results:
                    break

        return items

    async def _search_ddg_api(self, client: httpx.AsyncClient, query: str, max_results: int) -> list[dict]:
        encoded = urllib.parse.quote(query)
        url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
        resp = await client.get(url)
        if resp.status_code != 200:
            return []

        data = resp.json()
        items: list[dict] = []

        if data.get("AbstractText") and data.get("AbstractURL"):
            items.append({
                "title": data.get("Heading") or query,
                "href": data.get("AbstractURL"),
                "body": _clean_text(data.get("AbstractText"))[:250]
            })

        for topic in data.get("RelatedTopics", []):
            if isinstance(topic, dict) and topic.get("Text") and topic.get("FirstURL"):
                text = _clean_text(topic.get("Text"))
                items.append({
                    "title": text[:60] + "...",
                    "href": topic.get("FirstURL"),
                    "body": text[:250]
                })
            if len(items) >= max_results:
                break

        return items

    async def _search_wikipedia(self, client: httpx.AsyncClient, query: str, max_results: int) -> list[dict]:
        encoded = urllib.parse.quote(query)
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded}&format=json"
        resp = await client.get(url)
        if resp.status_code != 200:
            return []

        data = resp.json()
        search_items = data.get("query", {}).get("search", [])
        items: list[dict] = []

        for it in search_items:
            title = it.get("title", "")
            pageid = it.get("pageid", "")
            snippet = _clean_text(it.get("snippet", ""))
            items.append({
                "title": f"Wikipedia: {title}",
                "href": f"https://en.wikipedia.org/?curid={pageid}",
                "body": snippet[:250]
            })
            if len(items) >= max_results:
                break

        return items

    def _format_results(self, results: list[dict], query: str) -> SkillResult:
        formatted = []
        for i, r in enumerate(results, 1):
            formatted.append(
                f"{i}. **{r.get('title', 'No title')}**\n"
                f"   URL: {r.get('href', '')}\n"
                f"   {r.get('body', '')[:250]}\n"
            )
        return SkillResult(
            success=True,
            data="\n".join(formatted),
            metadata={"count": len(results), "query": query},
        )
