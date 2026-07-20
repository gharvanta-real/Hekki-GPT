"""MARIANO Core Skill — Web Search via DuckDuckGo with anonymized headers."""
from __future__ import annotations
import asyncio
import re
import urllib.parse
from typing import Any
import httpx
from duckduckgo_search import DDGS
from mariano.skills._base import BaseSkill, SkillResult
from mariano.core.anonymizer import NetworkAnonymizer
import structlog

log = structlog.get_logger(__name__)

class WebSearchSkill(BaseSkill):
    name = "web_search"
    description = "Search the internet using DuckDuckGo. Returns top results with titles, URLs, and snippets."
    version = "1.2.0"
    tags = ["web", "search", "research", "internet"]

    def get_parameters_schema(self) -> dict:
        return {
            "query": {"type": "string", "description": "Search query", "required": True},
            "max_results": {"type": "integer", "description": "Max results to return", "default": 5},
            "region": {"type": "string", "description": "Region code e.g. in-en, us-en", "default": "in-en"},
        }

    async def execute(self, query: str, max_results: int = 5, region: str = "in-en") -> SkillResult:
        # Step 1: Attempt standard DDGS package search
        try:
            results = await asyncio.to_thread(self._search, query, max_results, region)
            if results:
                return self._format_results(results, query)
        except Exception as exc:
            log.warning("web_search.ddgs_failed", error=str(exc))

        # Step 2: Fallback to direct HTML-scraping of DuckDuckGo Lite / HTML page
        try:
            log.info("web_search.trying_html_fallback", query=query)
            results = await self._html_fallback_search(query, max_results)
            if results:
                return self._format_results(results, query)
        except Exception as exc:
            log.warning("web_search.html_fallback_failed", error=str(exc))

        # Step 3: Fallback to Wikipedia API Search
        try:
            log.info("web_search.trying_wikipedia_fallback", query=query)
            results = await self._wikipedia_fallback_search(query, max_results)
            if results:
                return self._format_results(results, query)
        except Exception as exc:
            log.error("web_search.all_search_fallbacks_failed", error=str(exc))

        return SkillResult(success=False, data=None, error="Search failed: All primary and fallback search engines were unreachable.")

    def _search(self, query: str, max_results: int, region: str) -> list[dict]:
        headers = NetworkAnonymizer.get_headers()
        with DDGS(headers=headers) as ddgs:
            return list(ddgs.text(query, region=region, max_results=max_results))

    async def _html_fallback_search(self, query: str, max_results: int) -> list[dict]:
        """Queries the raw DuckDuckGo HTML endpoint as a scraping fallback."""
        url = "https://html.duckduckgo.com/html/"
        headers = NetworkAnonymizer.get_headers()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        data = {"q": query}
        
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(url, data=data, headers=headers)
            if resp.status_code != 200:
                return []
            
            html = resp.text
            # Order-independent anchor matching
            pattern_anchor = re.compile(r'<a\s+([^>]+)>(.*?)</a>', re.DOTALL)
            pattern_snippet = re.compile(r'<a class="result__snippet"[^>]*>(.*?)</a>', re.DOTALL)
            
            anchors = pattern_anchor.findall(html)
            matches_snippet = pattern_snippet.findall(html)
            
            matches_a = []
            for attrs, content in anchors:
                if 'class="result__a"' in attrs:
                    href_match = re.search(r'href="([^"]+)"', attrs)
                    if href_match:
                        matches_a.append((href_match.group(1), content))
            
            results = []
            for idx, (href, title) in enumerate(matches_a[:max_results]):
                clean_title = re.sub(r'<[^>]+>', '', title).strip()
                clean_href = href
                if "uddg=" in href:
                    parsed = urllib.parse.urlparse(href)
                    qs = urllib.parse.parse_qs(parsed.query)
                    if qs.get("uddg"):
                        clean_href = qs["uddg"][0]
                
                snippet = ""
                if idx < len(matches_snippet):
                    snippet = re.sub(r'<[^>]+>', '', matches_snippet[idx]).strip()
                
                results.append({
                    "title": clean_title,
                    "href": clean_href,
                    "body": snippet
                })
            return results

    async def _wikipedia_fallback_search(self, query: str, max_results: int) -> list[dict]:
        """Queries Wikipedia Search API as a high-reliability fallback."""
        encoded = urllib.parse.quote(query)
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded}&format=json"
        headers = {
            "User-Agent": "HekkiSearchAgent/1.0 (https://hekki.ai; contact@hekki.ai)"
        }
        
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return []
                
            data = resp.json()
            search_items = data.get("query", {}).get("search", [])
            results = []
            for item in search_items[:max_results]:
                title = item.get("title", "")
                pageid = item.get("pageid", "")
                snippet = re.sub(r'<[^>]+>', '', item.get("snippet", "")).strip()
                results.append({
                    "title": f"Wikipedia: {title}",
                    "href": f"https://en.wikipedia.org/?curid={pageid}",
                    "body": snippet
                })
            return results

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
