"""MARIANO Core Skill — Wikipedia deep search and article reader."""
from __future__ import annotations
import asyncio
import httpx
from mariano.skills._base import BaseSkill, SkillResult

class WikipediaSearchSkill(BaseSkill):
    name = "wikipedia_search"
    description = "Search Wikipedia for any topic and get detailed article summaries, full content, or specific sections."
    version = "1.0.0"
    tags = ["wikipedia", "knowledge", "research", "encyclopedia"]

    def get_parameters_schema(self) -> dict:
        return {
            "query": {"type": "string", "description": "Topic to search", "required": True},
            "full_article": {"type": "boolean", "description": "Get full article (True) or summary only (False)", "default": False},
            "language": {"type": "string", "description": "Wikipedia language code: en, hi, fr, de etc.", "default": "en"},
        }

    async def execute(self, query: str, full_article: bool = False, language: str = "en") -> SkillResult:
        try:
            base = f"https://{language}.wikipedia.org/api/rest_v1"
            search_url = f"https://{language}.wikipedia.org/w/api.php"
            async with httpx.AsyncClient(timeout=15) as client:
                # Search for page
                search_resp = await client.get(search_url, params={
                    "action": "query", "list": "search", "srsearch": query,
                    "format": "json", "srlimit": 3,
                })
                search_data = search_resp.json()
                results = search_data.get("query", {}).get("search", [])
                if not results:
                    return SkillResult(success=False, data=None, error=f"No Wikipedia results for: {query}")

                title = results[0]["title"]
                if full_article:
                    # Get full content
                    content_resp = await client.get(search_url, params={
                        "action": "query", "titles": title, "prop": "extracts",
                        "format": "json", "explaintext": True,
                    })
                    pages = content_resp.json().get("query", {}).get("pages", {})
                    page = next(iter(pages.values()))
                    extract = page.get("extract", "No content")
                    return SkillResult(
                        success=True,
                        data=f"**{title}**\n\n{extract[:6000]}",
                        metadata={"title": title, "url": f"https://{language}.wikipedia.org/wiki/{title.replace(' ', '_')}"}
                    )
                else:
                    # Get summary
                    safe_title = title.replace(" ", "_")
                    sum_resp = await client.get(f"{base}/page/summary/{safe_title}")
                    if sum_resp.status_code == 200:
                        data = sum_resp.json()
                        summary = data.get("extract", "No summary")
                        url = data.get("content_urls", {}).get("desktop", {}).get("page", "")
                        return SkillResult(
                            success=True,
                            data=f"**{title}**\n\n{summary}\n\nRead more: {url}",
                            metadata={"title": title, "url": url}
                        )
                    return SkillResult(success=False, data=None, error="Could not fetch summary")
        except Exception as exc:
            return SkillResult(success=False, data=None, error=str(exc))
