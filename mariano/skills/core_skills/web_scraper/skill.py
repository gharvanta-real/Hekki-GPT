"""MARIANO Core Skill — Web page content reader with anonymized requests."""
from __future__ import annotations
import asyncio
import re
from typing import Any
import httpx
from mariano.skills._base import BaseSkill, SkillResult
from mariano.core.anonymizer import NetworkAnonymizer


class WebScraperSkill(BaseSkill):
    name = "web_scrape"
    description = "Read the full content of a webpage URL. Extracts clean text, removing HTML tags."
    version = "1.1.0"
    tags = ["web", "scrape", "read", "content"]

    def get_parameters_schema(self) -> dict:
        return {
            "url": {"type": "string", "description": "Full URL to scrape", "required": True},
            "max_chars": {"type": "integer", "description": "Max characters to return", "default": 3000},
        }

    async def execute(self, url: str, max_chars: int = 3000) -> SkillResult:
        try:
            # Dynamic header spoofing
            headers = NetworkAnonymizer.get_headers()
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                text = self._extract_text(resp.text)
                return SkillResult(
                    success=True,
                    data=text[:max_chars],
                    metadata={"url": url, "status": resp.status_code, "chars": len(text)},
                )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=str(exc))

    def _extract_text(self, html: str) -> str:
        # Remove head, scripts, and styles first to avoid indexing internal code
        html = re.sub(r'<head[^>]*>.*?</head>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)

        # Convert headers, paragraphs, lists, links, and tables to markdown syntax
        html = re.sub(r'<h[1-6][^>]*>(.*?)</h[1-6]>', r'\n\n# \1\n', html, flags=re.IGNORECASE)
        html = re.sub(r'<p[^>]*>(.*?)</p>', r'\n\n\1\n', html, flags=re.IGNORECASE)
        html = re.sub(r'<li[^>]*>(.*?)</li>', r'\n* \1', html, flags=re.IGNORECASE)
        html = re.sub(r'<a[^>]*href=["\'](.*?)["\'][^>]*>(.*?)</a>', r' [\2](\1) ', html, flags=re.IGNORECASE)
        html = re.sub(r'<tr[^>]*>', r'\n| ', html, flags=re.IGNORECASE)
        html = re.sub(r'<td[^>]*>(.*?)</td>', r'\1 | ', html, flags=re.IGNORECASE)

        # Strip remaining HTML tags
        html = re.sub(r'<[^>]+>', ' ', html)

        # Decode common HTML entities
        html = re.sub(r'&nbsp;', ' ', html, flags=re.IGNORECASE)
        html = re.sub(r'&lt;', '<', html, flags=re.IGNORECASE)
        html = re.sub(r'&gt;', '>', html, flags=re.IGNORECASE)
        html = re.sub(r'&amp;', '&', html, flags=re.IGNORECASE)

        # Compact whitespace and uniform spacing
        html = re.sub(r'[ \t]+', ' ', html)
        html = re.sub(r'\n\s*\n', '\n\n', html)
        return html.strip()
