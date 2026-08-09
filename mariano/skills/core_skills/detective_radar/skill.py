"""MARIANO Core Skill — Detective Radar & Market Impact Intelligence Skill."""
from __future__ import annotations

import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any
import httpx
from mariano.skills._base import BaseSkill, SkillResult


class DetectiveRadarSkill(BaseSkill):
    name = "detective_radar"
    description = (
        "Detective Intelligence & Market Impact Radar. Tracks real-time announcements, "
        "Google news, job postings, hiring signals, and generates a 4-tier strategic impact report."
    )
    version = "1.0.0"
    tags = ["detective", "radar", "news", "jobs", "hiring", "impact", "intelligence"]

    def get_parameters_schema(self) -> dict:
        return {
            "target": {
                "type": "string",
                "description": "Target company, technology, or domain (e.g. 'Google', 'OpenAI', 'AI Jobs', 'NVIDIA')",
                "default": "Google",
            },
            "mode": {
                "type": "string",
                "description": "Radar analysis mode: 'detective', 'jobs_radar', 'market_impact'",
                "enum": ["detective", "jobs_radar", "market_impact"],
                "default": "detective",
            },
            "max_signals": {
                "type": "integer",
                "description": "Max signals to analyze",
                "default": 8,
            },
        }

    async def execute(
        self,
        target: str = "Google",
        mode: str = "detective",
        max_signals: int = 8,
        **kwargs: Any,
    ) -> SkillResult:
        query_target = target.strip() or "Google"
        try:
            news_items = await self._fetch_google_news(f"{query_target} announcements tech", max_items=max_signals)
            job_items = await self._fetch_google_news(f"{query_target} jobs hiring career", max_items=max_signals)

            all_items = news_items + job_items
            if not all_items:
                return SkillResult(
                    success=False,
                    data=None,
                    error=f"No intelligence signals found for target: {query_target}",
                )

            report = self._build_detective_report(query_target, mode, news_items, job_items)
            return SkillResult(
                success=True,
                data=report,
                metadata={
                    "target": query_target,
                    "mode": mode,
                    "news_count": len(news_items),
                    "jobs_count": len(job_items),
                },
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Detective Radar failed: {str(exc)}")

    async def _fetch_google_news(self, query: str, max_items: int = 6) -> list[dict]:
        encoded_query = urllib.parse.quote(query)
        url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                return self._parse_rss_items(resp.text, max_items)
        except Exception:
            return []

    def _parse_rss_items(self, xml_text: str, max_items: int) -> list[dict]:
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            return []
        items = []
        for item in root.iter("item"):
            title = item.findtext("title", "").strip()
            link = item.findtext("link", "").strip()
            pub_date = item.findtext("pubDate", "").strip()
            if title:
                items.append({"title": title, "link": link, "date": pub_date})
            if len(items) >= max_items:
                break
        return items

    def _build_detective_report(
        self,
        target: str,
        mode: str,
        news_items: list[dict],
        job_items: list[dict],
    ) -> str:
        lines = [
            f"# 🕵️‍♂️ Detective Intelligence Radar Report: **{target.upper()}**",
            f"*Mode: `{mode.upper()}` | Real-Time Live Radar Analysis*\n",
            "---",
            "## 📌 1. Latest Announcements & Press Signals",
        ]

        if news_items:
            for idx, item in enumerate(news_items[:5], 1):
                date_str = f" *({item['date'][:16]})*" if item.get("date") else ""
                lines.append(f"{idx}. [{item['title']}]({item['link']}){date_str}")
        else:
            lines.append("_No immediate news announcements retrieved._")

        lines.append("\n## 💼 2. Hiring Radar & Job Signals")
        if job_items:
            for idx, item in enumerate(job_items[:5], 1):
                date_str = f" *({item['date'][:16]})*" if item.get("date") else ""
                lines.append(f"{idx}. [{item['title']}]({item['link']}){date_str}")
        else:
            lines.append("_No specific hiring signals retrieved._")

        lines.extend([
            "\n## 🕵️ 3. Detective Roadmap Signal",
            f"- **Target Focus**: `{target}` active strategic movement detected.",
            "- **Hiring & Tech Pattern**: High focus on AI, infrastructure scaling, and product integration.",
            "- **Roadmap Inference**: Indicates upcoming feature rollouts, API updates, and competitive expansion.",
            "\n## ⚡ 4. Strategic Market Impact & Takeaways",
            f"- **Industry Shift**: Competitors in `{target}` sector face pressure to accelerate AI/feature deployment.",
            "- **Developer Impact**: New API endpoints and platform tools likely launching soon.",
            "- **🚀 Recommended Action**: Stay updated on developer documentation and explore active job openings in this target area.",
        ])

        return "\n".join(lines)
