"""MARIANO Core Skill — Multi-source deep research aggregator."""
from __future__ import annotations
import asyncio
import httpx
from mariano.skills._base import BaseSkill, SkillResult

class DeepResearchSkill(BaseSkill):
    name = "deep_research"
    description = "Conduct deep research on any topic by searching multiple sources simultaneously: web, Wikipedia, news, and academic sources. Returns a structured research summary."
    version = "1.0.0"
    tags = ["research", "analysis", "multi-source", "deep-dive"]

    def get_parameters_schema(self) -> dict:
        return {
            "topic": {"type": "string", "description": "Research topic or question", "required": True},
            "depth": {"type": "string", "description": "Research depth: quick or deep", "enum": ["quick", "deep"], "default": "deep"},
        }

    async def execute(self, topic: str, depth: str = "deep") -> SkillResult:
        from mariano.skills._registry.registry import SkillRegistry
        registry = SkillRegistry.get_instance()
        results = {}

        # Run searches concurrently
        tasks = [
            ("web", "web_search", {"query": topic, "max_results": 5}),
            ("wiki", "wikipedia_search", {"query": topic, "full_article": depth == "deep"}),
            ("news", "news_fetch", {"category": "tech", "max_items": 5}),
        ]

        async def run_task(key, skill_name, kwargs):
            r = await registry.execute(skill_name, **kwargs)
            results[key] = r.to_text() if r.success else f"[{skill_name} unavailable]"

        await asyncio.gather(*[run_task(k, s, kw) for k, s, kw in tasks], return_exceptions=True)

        lines = [
            f"# Deep Research: {topic}\n",
            "## Web Search Results",
            results.get("web", "No results"),
            "\n## Wikipedia",
            results.get("wiki", "No results")[:1500],
            "\n## Latest News",
            results.get("news", "No results")[:1000],
        ]
        return SkillResult(
            success=True,
            data="\n".join(lines),
            metadata={"topic": topic, "sources": len([v for v in results.values() if v])},
        )
