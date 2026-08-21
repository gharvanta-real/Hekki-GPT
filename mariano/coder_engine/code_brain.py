"""
code_brain.py — Hekki Code Brain Engine
Direct streaming to Google Gemini API — NO agy dependency.
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

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

# Model routing table — Strictly 3.5 Flash Lite and 3.1 Flash Lite
MODEL_MAP = {
    "gemini-3.5-flash-lite":   ("gemini", "gemini-3.5-flash-lite"),
    "gemini-3.1-flash-lite":   ("gemini", "gemini-3.1-flash-lite"),
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
                    except Exception as e:
                        logger.warning("Failed to parse gemini chunk: %s", e)


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
        except OSError as e:
            logger.warning("Failed to read .env file: %s", e)
    return ""


async def stream_brain(
    prompt: str,
    model_key: str = "gemini-3.1-flash-lite",
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Main entry. Routes to Gemini based on model_key.
    Yields text chunks for SSE streaming.
    """
    provider, model_id = MODEL_MAP.get(model_key, ("gemini", "gemini-3.1-flash-lite"))

    messages = (history or []) + [{"role": "user", "content": prompt}]

    try:
        api_key = _get_env_key("GEMINI_API_KEY")
        if not api_key:
            yield "[Error: GEMINI_API_KEY not set in .env]\n"
            return
        async for chunk in stream_gemini(model_id, messages, api_key):
            yield chunk

    except Exception as e:
        logger.error(f"[CodeBrain] Stream error: {e}")
        yield f"\n[Stream error: {e}]\n"

