"""MARIANO Core Skill — Automated morning briefing."""
from __future__ import annotations
import asyncio
from datetime import datetime
from mariano.skills._base import BaseSkill, SkillResult

class MorningBriefingSkill(BaseSkill):
    name = "morning_briefing"
    description = "Generate a complete morning briefing: date/time, weather, top news, market summary, and personalized notes from memory. Perfect for daily startup."
    version = "1.0.0"
    tags = ["briefing", "morning", "daily", "summary", "proactive"]

    def get_parameters_schema(self) -> dict:
        return {
            "city": {"type": "string", "description": "Your city for weather", "default": "Mumbai"},
            "stocks": {"type": "string", "description": "Comma-separated tickers to check e.g. RELIANCE.NS,NIFTY=F", "default": "RELIANCE.NS"},
        }

    async def execute(self, city: str = "Mumbai", stocks: str = "RELIANCE.NS") -> SkillResult:
        from mariano.skills._registry.registry import SkillRegistry
        registry = SkillRegistry.get_instance()
        now = datetime.now()
        lines = [
            f"# 🌅 Good Morning! MARIANO Daily Briefing",
            f"**Date:** {now.strftime('%A, %d %B %Y')} | **Time:** {now.strftime('%I:%M %p')}\n",
        ]

        # Run all concurrently
        weather_task = registry.execute("weather", city=city)
        news_task = registry.execute("news_fetch", category="india", max_items=5)
        tech_news_task = registry.execute("news_fetch", category="tech", max_items=3)
        memory_task = registry.execute("memory_ops", action="list_recent")

        results = await asyncio.gather(weather_task, news_task, tech_news_task, memory_task, return_exceptions=True)
        weather_r, news_r, tech_r, memory_r = results

        if hasattr(weather_r, 'to_text') and weather_r.success:
            lines.append("## 🌤️ Weather")
            lines.append(weather_r.to_text()[:400])

        if hasattr(news_r, 'to_text') and news_r.success:
            lines.append("\n## 📰 Top News")
            lines.append(news_r.to_text()[:600])

        if hasattr(tech_r, 'to_text') and tech_r.success:
            lines.append("\n## 💻 Tech")
            lines.append(tech_r.to_text()[:400])

        # Stock check
        ticker_list = [t.strip() for t in stocks.split(",") if t.strip()]
        lines.append("\n## 📈 Markets")
        for ticker in ticker_list[:3]:
            stock_r = await registry.execute("stock_data", ticker=ticker, period="1d")
            if stock_r.success:
                lines.append(stock_r.to_text()[:200])

        if hasattr(memory_r, 'to_text') and memory_r.success:
            lines.append("\n## 🧠 From Your Memory")
            lines.append(memory_r.to_text()[:300])

        lines.append("\n---\n*Briefing complete. What shall we work on today?*")
        return SkillResult(success=True, data="\n".join(lines))
