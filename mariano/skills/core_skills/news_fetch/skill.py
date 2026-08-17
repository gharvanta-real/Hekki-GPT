"""MARIANO Core Skill — Multi-Source News & Live Headlines Aggregator."""
from __future__ import annotations
import asyncio
import html
import re
from typing import Any
import httpx
import xml.etree.ElementTree as ET
from mariano.skills._base import BaseSkill, SkillResult

FEED_CATALOG: dict[str, list[dict[str, str]]] = {
    "india": [
        {"name": "NDTV", "url": "https://feeds.feedburner.com/ndtvnews-top-stories"},
        {"name": "Google News India", "url": "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"},
        {"name": "Times of India", "url": "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"},
        {"name": "The Hindu", "url": "https://www.thehindu.com/news/national/feeder/default.rss"},
        {"name": "Hindustan Times", "url": "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"},
        {"name": "Indian Express", "url": "https://indianexpress.com/feed/"}
    ],
    "world": [
        {"name": "BBC World", "url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
        {"name": "Google News World", "url": "https://news.google.com/rss/headlines/section/topic/WORLD"},
        {"name": "Al Jazeera", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
        {"name": "The Guardian", "url": "https://www.theguardian.com/world/rss"}
    ],
    "tech": [
        {"name": "TechCrunch", "url": "https://feeds.feedburner.com/TechCrunch"},
        {"name": "Wired", "url": "https://www.wired.com/feed/rss"},
        {"name": "Ars Technica", "url": "https://feeds.arstechnica.com/arstechnica/index"},
        {"name": "Hacker News", "url": "https://news.ycombinator.com/rss"}
    ],
    "business": [
        {"name": "Economic Times", "url": "https://economictimes.indiatimes.com/rssfeedstopstories.cms"},
        {"name": "Moneycontrol", "url": "https://www.moneycontrol.com/rss/MCtopnews.xml"},
        {"name": "Google Business", "url": "https://news.google.com/rss/headlines/section/topic/BUSINESS"}
    ],
    "sports": [
        {"name": "ESPN Cricinfo", "url": "https://www.espncricinfo.com/rss/content/story/feeds/0.xml"},
        {"name": "BBC Sport", "url": "https://feeds.bbci.co.uk/sport/rss.xml"}
    ],
    "science": [
        {"name": "ScienceDaily", "url": "https://www.sciencedaily.com/rss/top/science.xml"},
        {"name": "Nature News", "url": "https://www.nature.com/nature.rss"},
        {"name": "NASA", "url": "https://www.nasa.gov/rss/dyn/breaking_news.rss"}
    ],
    "crypto": [
        {"name": "Cointelegraph", "url": "https://cointelegraph.com/rss"},
        {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/"}
    ]
}


def _clean_text(text: str) -> str:
    """Safely strip HTML markup and unescape HTML/XML entities."""
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = html.unescape(clean)
    return re.sub(r"\s+", " ", clean).strip()


class NewsFetchSkill(BaseSkill):
    name = "news_fetch"
    description = "Fetch live news headlines across Indian, World, Tech, Business, Sports, Science, and Crypto channels. Categories: india, world, tech, business, sports, science, crypto"
    version = "2.0.0"
    tags = ["news", "media", "headlines", "india", "world", "current-events", "rss"]

    def get_parameters_schema(self) -> dict:
        return {
            "category": {
                "type": "string",
                "description": "News category: india, world, tech, business, sports, science, crypto",
                "enum": list(FEED_CATALOG.keys()),
                "default": "india",
            },
            "source": {
                "type": "string",
                "description": "Optional specific news source/channel (e.g. 'ndtv', 'bbc', 'thehindu', 'toi', 'aljazeera', 'guardian', 'techcrunch', 'cricinfo', 'wired')",
                "default": "",
            },
            "max_items": {"type": "integer", "description": "Max number of headlines to return", "default": 8},
        }

    async def execute(self, category: str = "india", source: str = "", max_items: int = 8) -> SkillResult:
        cat_key = (category or "india").lower().strip()
        feeds = FEED_CATALOG.get(cat_key, FEED_CATALOG["india"])

        if source:
            s_query = source.lower().strip()
            filtered = [f for f in feeds if s_query in f["name"].lower() or s_query in f["url"].lower()]
            if not filtered:
                for c_feeds in FEED_CATALOG.values():
                    match = [f for f in c_feeds if s_query in f["name"].lower() or s_query in f["url"].lower()]
                    if match:
                        filtered = match
                        break
            if filtered:
                feeds = filtered

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml, */*"
        }

        all_items: list[dict] = []
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers=headers) as client:
            tasks = [self._fetch_feed(client, f["name"], f["url"]) for f in feeds]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for res in results:
                if isinstance(res, list):
                    all_items.extend(res)

        if not all_items:
            return SkillResult(success=False, data=None, error=f"No news headlines could be fetched for '{cat_key}'")

        # Deduplicate headlines by title similarity
        seen_titles = set()
        unique_items = []
        for item in all_items:
            norm_title = re.sub(r"[^\w\s]", "", item["title"].lower())[:40]
            if norm_title and norm_title not in seen_titles:
                seen_titles.add(norm_title)
                unique_items.append(item)

        final_items = unique_items[:max_items]

        lines = [f"### 📰 {cat_key.upper()} NEWS HEADLINES\n"]
        for i, item in enumerate(final_items, 1):
            src_tag = f"`{item['source']}`" if item.get("source") else ""
            lines.append(f"{i}. {src_tag} **{item['title']}**")
            if item.get("desc"):
                lines.append(f"   {item['desc'][:160]}...")
            if item.get("link"):
                lines.append(f"   {item.get('link')}\n")

        return SkillResult(
            success=True,
            data="\n".join(lines),
            metadata={"category": cat_key, "count": len(final_items), "sources": [f["name"] for f in feeds]}
        )

    async def _fetch_feed(self, client: httpx.AsyncClient, source_name: str, feed_url: str) -> list[dict]:
        try:
            resp = await client.get(feed_url)
            if resp.status_code != 200:
                return []
            return self._parse_rss(resp.text, source_name)
        except Exception:
            return []

    def _parse_rss(self, xml_text: str, source_name: str) -> list[dict]:
        items: list[dict] = []

        # 1. ElementTree with entity pre-sanitization
        try:
            sanitized_xml = re.sub(r"&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[a-fA-F0-9]+);)", "&amp;", xml_text)
            root = ET.fromstring(sanitized_xml)
            for item in root.iter("item"):
                title = _clean_text(item.findtext("title", ""))
                link = (item.findtext("link") or "").strip()
                desc = _clean_text(item.findtext("description", ""))
                if title:
                    items.append({"source": source_name, "title": title, "link": link, "desc": desc[:250]})
            if items:
                return items
        except Exception:
            pass

        # 2. Resilient Regex Fallback
        item_blocks = re.findall(r"<item\b[^>]*>([\s\S]*?)</item>", xml_text, re.IGNORECASE)
        for block in item_blocks:
            title_match = re.search(r"<title\b[^>]*>([\s\S]*?)</title>", block, re.IGNORECASE)
            link_match = re.search(r"<link\b[^>]*>([\s\S]*?)</link>", block, re.IGNORECASE)
            desc_match = re.search(r"<description\b[^>]*>([\s\S]*?)</description>", block, re.IGNORECASE)

            title = _clean_text(title_match.group(1)) if title_match else ""
            raw_link = link_match.group(1).strip() if link_match else ""
            raw_link = re.sub(r"^<!\[CDATA\[(.*)\]\]>$", r"\1", raw_link, flags=re.DOTALL).strip()
            desc = _clean_text(desc_match.group(1)) if desc_match else ""

            if title:
                items.append({"source": source_name, "title": title, "link": raw_link, "desc": desc[:250]})

        return items
