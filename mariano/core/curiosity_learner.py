"""MARIANO Core — Curiosity-Driven Autonomous Self-Learning Engine."""
from __future__ import annotations

import asyncio
import os
from datetime import datetime
from typing import Any

import httpx
import structlog
from google import genai

from mariano.config import get_settings
from mariano.memory.memory_manager import MemoryManager
from mariano.skills.core_skills.web_search.skill import WebSearchSkill
from mariano.skills.core_skills.web_scraper.skill import WebScraperSkill

log = structlog.get_logger(__name__)


class CuriosityLearner:
    """Spawns background threads on tool failures to query, scrape, resolve, and cache fixes in memory."""

    _instance: CuriosityLearner | None = None

    def __init__(self) -> None:
        self.settings = get_settings()
        self.ledger_path = self.settings.mariano_data_dir / "logs" / "evolution_ledger.md"
        self.token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        allowed_id = os.getenv("TELEGRAM_ALLOWED_USER_ID", "")
        self.chat_id = int(allowed_id) if allowed_id.isdigit() else None

    @property
    def client(self) -> genai.Client:
        current_key = self.settings.active_gemini_api_key or self.settings.gemini_api_key
        if getattr(self, "_cached_client", None) is None or current_key != getattr(self, "_cached_key", None):
            self._cached_client = genai.Client(api_key=current_key)
            self._cached_key = current_key
        return self._cached_client

    @classmethod
    def get_instance(cls) -> CuriosityLearner:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def trigger_learning(self, failed_query: str, error_message: str) -> None:
        """Starts the learning task in a non-blocking background task."""
        asyncio.create_task(self._learn_process(failed_query, error_message))

    async def _learn_process(self, query: str, error: str) -> None:
        log.info("curiosity.learning_start", query=query, error=error)
        
        # 1. Search the web for the error
        search_skill = WebSearchSkill()
        search_query = f"fix python {query} {error}"[:100]
        search_res = await search_skill.execute(query=search_query, max_results=3)
        
        if not search_res.success:
            log.warning("curiosity.search_failed", query=search_query)
            return

        # 2. Scrape top URLs
        scraper = WebScraperSkill()
        urls = []
        for line in search_res.data.split("\n"):
            if "URL: http" in line:
                url = line.split("URL: ")[1].strip()
                urls.append(url)

        scraped_texts = []
        for url in urls[:2]:
            scrap_res = await scraper.execute(url=url, max_chars=2000)
            if scrap_res.success:
                scraped_texts.append(scrap_res.data)

        if not scraped_texts:
            log.warning("curiosity.scraping_failed")
            return

        # 3. Summarize and Distill solution using Gemini
        scraped_combined = "\n---\n".join(scraped_texts)
        prompt = (
            f"You are a cognitive self-learning compiler analyzer. A task failed with the following parameters:\n"
            f"Failed Action: {query}\n"
            f"Error Message: {error}\n\n"
            f"Below is scraped internet research data regarding this error:\n"
            f"{scraped_combined}\n\n"
            f"Synthesize a clear, highly precise technical solution note. "
            f"Specify exactly what code syntax, library package, or configuration resolves this error. "
            f"Be concise, direct, and output only the solution note:\n"
        )

        try:
            from mariano.core.rate_limiter import GeminiRateLimiter
            await GeminiRateLimiter.get_instance().acquire(token_count=1000)

            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.settings.mariano_model,
                contents=prompt,
            )
            solution = response.text or ""
            if not solution.strip():
                return

            # 4. Save solution note to Semantic Memory (SQLite memories)
            mem_mgr = MemoryManager.get_instance()
            await mem_mgr.store(
                content=f"[RESOLVED FAILURE LOG]\nQuery: {query}\nError: {error}\nFix: {solution}",
                category="curiosity_learned_fix",
                metadata={"failed_query": query, "error": error}
            )

            # 5. Log to evolution ledger
            self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ledger_entry = (
                f"\n### 🧠 [{timestamp}] Curiosity Self-Learning Success\n"
                f"- **Triggered by failure:** `{query}` -> `{error}`\n"
                f"- **Search Query:** `{search_query}`\n"
                f"- **Resolved Fix:** {solution.strip()[:350]}...\n"
                f"- Solution successfully registered to Semantic Memory.\n"
                f"──────────────────────────────────────────────────\n"
            )
            with open(self.ledger_path, "a", encoding="utf-8") as ledger:
                ledger.write(ledger_entry)

            # 6. Push Telegram Notification
            if self.token and self.chat_id:
                async with httpx.AsyncClient(timeout=10) as http_client:
                    url = f"https://api.telegram.org/bot{self.token}/sendMessage"
                    msg_text = (
                        f"🧠 **Curiosity Self-Learning Complete!**\n"
                        f"- Trigger: `{query}`\n"
                        f"- Error: `{error[:150]}`\n"
                        f"- Solution distilled and cached in SQLite memories."
                    )
                    await http_client.post(url, json={
                        "chat_id": self.chat_id,
                        "text": msg_text,
                        "parse_mode": "Markdown",
                    })

            log.info("curiosity.learning_success", query=query)
        except Exception as exc:
            log.error("curiosity.learning_failed", error=str(exc))
