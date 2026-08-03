"""
code_brain.py — Hekki Code Brain Engine
Direct streaming to Google Gemini API or OpenRouter — NO agy dependency.
agy is used ONLY as a tools/action executor via AgyToolRunner.
Under 200 lines.
"""

from __future__ import annotations
import os
import json
import logging
import httpx
from typing import AsyncGenerator

logger = logging.getLogger("Hekki.CodeBrain")

GEMINI_BASE  = "https://generativelanguage.googleapis.com/v1beta"
OPENROUTER_BASE = "https://openrouter.ai/api/v1"

from mariano.providers.openrouter_models import OPENROUTER_MODELS

# Model routing table
MODEL_MAP = {
    # Hekki Gemini modes
    "gemini-3.1-flash-lite":   ("gemini", "gemini-2.0-flash-lite"),
    "gemini-3.1-flash":        ("gemini", "gemini-2.0-flash"),
    "gemini-2.5-flash":        ("gemini", "gemini-2.5-flash"),
    # Hekki OpenRouter modes (sync with OPENROUTER_MODELS)
    "openrouter":              ("openrouter", OPENROUTER_MODELS["openrouter"].model_id),
    "openrouter_gpt":          ("openrouter", OPENROUTER_MODELS["openrouter"].model_id),
    "openrouter_nemotron":     ("openrouter", OPENROUTER_MODELS["openrouter_nemotron"].model_id),
}

SYSTEM_PROMPT = (
    "You are Hekki, an expert AI coding assistant. "
    "You help users build, debug, and understand code. "
    "Be concise, clear, and practical. Use markdown formatting."
)


async def stream_gemini(
    model_id: str,
    messages: list[dict],
    api_key: str,
) -> AsyncGenerator[str, None]:
    """Stream from Google Gemini API directly."""
    contents = [
        {"role": m["role"], "parts": [{"text": m["content"]}]}
        for m in messages
    ]
    url = f"{GEMINI_BASE}/models/{model_id}:streamGenerateContent?alt=sse&key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 8192},
    }
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json=payload) as resp:
            if resp.status_code != 200:
                err_body = await resp.aread()
                err_text = err_body.decode('utf-8', errors='ignore')
                yield f"[Gemini API Error ({resp.status_code}): {err_text[:300]}]\n"
                return
            async for line in resp.aiter_lines():
                if line.startswith("data:"):
                    raw = line[5:].strip()
                    if raw == "[DONE]" or not raw:
                        continue
                    try:
                        data = json.loads(raw)
                        text = (
                            data.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        )
                        if text:
                            yield text
                    except Exception:
                        pass


async def stream_openrouter(
    model_id: str,
    messages: list[dict],
    api_key: str,
) -> AsyncGenerator[str, None]:
    """Stream from OpenRouter API (OpenAI-compatible)."""
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
    url = f"{OPENROUTER_BASE}/chat/completions"
    payload = {
        "model": model_id,
        "messages": full_messages,
        "stream": True,
        "temperature": 0.7,
        "max_tokens": 8192,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://hekki.app",
        "X-Title": "Hekki Assistant",
    }
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            if resp.status_code != 200:
                err_body = await resp.aread()
                err_text = err_body.decode('utf-8', errors='ignore')
                yield f"[OpenRouter API Error ({resp.status_code}): {err_text[:300]}]\n"
                return
            async for line in resp.aiter_lines():
                if line.startswith("data:"):
                    raw = line[5:].strip()
                    if raw == "[DONE]" or not raw:
                        continue
                    try:
                        data = json.loads(raw)
                        delta = (
                            data.get("choices", [{}])[0]
                            .get("delta", {})
                            .get("content", "")
                        )
                        if delta:
                            yield delta
                    except Exception:
                        pass


def _get_env_key(key: str) -> str:
    val = os.getenv(key, "").strip()
    if val:
        return val
    # Fallback to reading .env file directly
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith(f"{key}="):
                        return line.split("=", 1)[1].strip().strip('"').strip("'")
        except Exception:
            pass
    return ""


async def stream_brain(
    prompt: str,
    model_key: str = "gemini-3.1-flash-lite",
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Main entry. Routes to Gemini or OpenRouter based on model_key.
    Yields text chunks for SSE streaming.
    """
    provider, model_id = MODEL_MAP.get(model_key, ("gemini", "gemini-2.0-flash-lite"))

    messages = (history or []) + [{"role": "user", "content": prompt}]

    try:
        if provider == "gemini":
            api_key = _get_env_key("GEMINI_API_KEY")
            if not api_key:
                yield "[Error: GEMINI_API_KEY not set in .env]\n"
                return
            async for chunk in stream_gemini(model_id, messages, api_key):
                yield chunk

        elif provider == "openrouter":
            api_key = _get_env_key("OPENROUTER_API_KEY")
            if not api_key:
                yield "[Error: OPENROUTER_API_KEY not set in .env]\n"
                return
            async for chunk in stream_openrouter(model_id, messages, api_key):
                yield chunk

    except Exception as e:
        logger.error(f"[CodeBrain] Stream error: {e}")
        yield f"\n[Stream error: {e}]\n"
