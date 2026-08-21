"""
Model Manager — Unified Model Dispatcher
=========================================
Interface for routing inference queries to Google Gemini Provider (AI Studio SDK).

Features:
  - Centralized rate limit checks and health status
  - Fallback orchestration
"""
from __future__ import annotations

from typing import Any, AsyncGenerator
import structlog

from mariano.providers.gemini_models import GEMINI_MODELS
from mariano.providers.rate_limiter import PersistentRateLimiter

log = structlog.get_logger(__name__)


class ModelManager:
    """Unified dispatcher for Gemini LLM models."""

    def __init__(self) -> None:
        self.rate_limiter = PersistentRateLimiter.get_instance()

    def get_all_available_models(self) -> list[dict[str, Any]]:
        """Returns consolidated list of all registered Gemini models."""
        models: list[dict[str, Any]] = []

        for k, gm in GEMINI_MODELS.items():
            models.append({
                "id": k,
                "provider": "gemini",
                "display": gm.display,
                "safe_rpm": gm.safe_rpm,
                "safe_rpd": gm.safe_rpd,
                "is_free": not gm.paid_tier,
                "supports_tools": True,
            })

        return models

    async def get_usage_status(self) -> dict[str, Any]:
        """Returns live rate limit tracking stats across all active models."""
        return self.rate_limiter.get_all_usage()

    async def generate(
        self,
        model_name: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        system_instruction: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> dict[str, Any]:
        """Route generation request to Gemini provider."""
        from mariano.gemini.client import GeminiClient
        gemini = GeminiClient()
        history = [{"role": m.get("role"), "content": m.get("content")} for m in messages[:-1]]
        last_message = messages[-1].get("content", "") if messages else ""
        return await gemini.generate_content_async(
            message=last_message,
            history=history,
            model=model_name,
            system_instruction=system_instruction,
            tools=tools,
        )

    async def stream(
        self,
        model_name: str,
        messages: list[dict[str, Any]],
        system_instruction: str | None = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Route streaming request to Gemini provider."""
        from mariano.gemini.client import GeminiClient
        gemini = GeminiClient()
        history = [{"role": m.get("role"), "content": m.get("content")} for m in messages[:-1]]
        last_message = messages[-1].get("content", "") if messages else ""
        async for chunk in gemini.stream_generate_content_async(
            message=last_message,
            history=history,
            model=model_name,
            system_instruction=system_instruction,
        ):
            yield chunk



_GLOBAL_MANAGER: ModelManager | None = None


def get_model_manager() -> ModelManager:
    """Singleton getter for ModelManager."""
    global _GLOBAL_MANAGER
    if _GLOBAL_MANAGER is None:
        _GLOBAL_MANAGER = ModelManager()
    return _GLOBAL_MANAGER
