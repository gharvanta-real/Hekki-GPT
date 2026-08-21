# mariano/providers/__init__.py
"""
AI Provider & Model Registries
===============================
Modular, separated architecture for AI providers:

- gemini_models.py      → Google Gemini model catalogue + limits
- rate_limiter.py       → Persistent restart-safe rate limiter (RPM & RPD)
- model_manager.py      → Unified model dispatcher
"""

from mariano.providers.gemini_models import GEMINI_MODELS, GeminiModelDef
from mariano.providers.rate_limiter import PersistentRateLimiter
from mariano.providers.model_manager import ModelManager, get_model_manager

__all__ = [
    "GEMINI_MODELS",
    "GeminiModelDef",
    "PersistentRateLimiter",
    "ModelManager",
    "get_model_manager",
]

