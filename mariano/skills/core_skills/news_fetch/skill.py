"""MARIANO Core Skill — News fetcher via RSS feeds."""
from __future__ import annotations
import asyncio
from typing import Any
import httpx
import xml.etree.ElementTree as ET
from mariano.skills._base import BaseSkill, SkillResult

FEEDS = {
    "india": "https://feeds.feedburner.com/ndtvnews-top-stories",
    "tech": "https://feeds.feedburner.com/TechCrunch",
    "business": "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
    "world": "https://rss.cnn.com/rss/edition.rss",
    "science": "https://feeds.newscientist.com/full-rss-feed",
    "crypto": "https://cointelegraph.com/rss",
}


class NewsFetchSkill(BaseSkill):
    name = "news_fetch"
    description = "Fetch latest news headlines by category. Categories: india, tech, business, world, science, crypto"
    version = "1.0.0"
    tags = ["news", "media", "headlines", "current-events"]

    def get_parameters_schema(self) -> dict:
        return {
            "category": {
                "type": "string",
                "description": "News category",
                "enum": list(FEEDS.keys()),
                "default": "india",
            },
            "max_items": {"type": "integer", "description": "Max headlines", "default": 8},
        }

    async def execute(self, category: str = "india", max_items: int = 8) -> SkillResult:
        feed_url = FEEDS.get(category, FEEDS["india"])
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                resp = await client.get(feed_url, headers={"User-Agent": "MARIANO/1.0"})
                resp.raise_for_status()
                items = self._parse_rss(resp.text, max_items)
            if not items:
                return SkillResult(success=False, data=None, error="No news items found")
            lines = [f"**{category.upper()} NEWS**\n"]
            for i, item in enumerate(items, 1):
                lines.append(f"{i}. {item['title']}")
                if item.get("desc"):
                    lines.append(f"   {item['desc'][:120]}...")
                lines.append(f"   {item.get('link', '')}\n")
            return SkillResult(success=True, data="\n".join(lines), metadata={"category": category, "count": len(items)})
        except Exception as exc:
            return SkillResult(success=False, data=None, error=str(exc))

    def _parse_rss(self, xml_text: str, max_items: int) -> list[dict]:
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            return []
        ns = {}
        items = []
        for item in root.iter("item"):
            title = item.findtext("title", "").strip()
            link = item.findtext("link", "").strip()
            desc = item.findtext("description", "").strip()
            desc = ET.fromstring(f"<r>{desc}</r>").text or desc if "<" in desc else desc
            if title:
                items.append({"title": title, "link": link, "desc": desc[:200]})
            if len(items) >= max_items:
                break
        return items
