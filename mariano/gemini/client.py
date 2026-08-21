"""MARIANO — Gemini API async client integrated with TCMM Neuromodulator."""
from __future__ import annotations

import asyncio
import json
import re
import base64
from pathlib import Path
from typing import Any, Callable

import structlog
from google import genai
from google.genai import types

from mariano.config import get_settings, MAX_OUTPUT_TOKENS, SYSTEM_PROMPT
from mariano.config.api_limits import CODER_TEMPERATURE
from .tool_schema import build_gemini_tools
from .prompt_builder import build_system_instruction
from .ollama_adapter import call_ollama

log = structlog.get_logger(__name__)

_MODEL_FALLBACK_CHAIN: list[str] = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
_MAX_RETRIES = 4
_RETRY_BASE_DELAY = 2


class GeminiClient:
    """Async wrapper around google.genai with TCMM neuromodulatory control & Ollama offline support."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._client = None
        self._last_key = None
        self._tool_declarations: list[dict] = []
        from mariano.core.neuromodulator import Neuromodulator
        self._nm = Neuromodulator.get_instance()
        from mariano.core.cognitive_profiler import CognitiveProfiler
        self._cp = CognitiveProfiler.get_instance()

    def _get_client(self) -> genai.Client:
        current_key = self._settings.active_gemini_api_key
        if self._client is None or current_key != self._last_key:
            self._client = genai.Client(api_key=current_key)
            self._last_key = current_key
        return self._client

    def configure_tools(self, manifests: list[dict]) -> None:
        """Register tool schemas for Gemini function calling."""
        self._tool_declarations = manifests

    def _build_tools(self) -> list[types.Tool] | None:
        return build_gemini_tools(
            self._tool_declarations,
            self._settings.active_reasoning_mode,
        )

    async def _call_ollama(
        self,
        history: list[dict],
        message: str,
        system_override: str | None = None,
        on_chunk: Callable[[str], None] | None = None,
    ) -> dict:
        return await call_ollama(
            settings=self._settings,
            nm=self._nm,
            cp=self._cp,
            tool_declarations=self._tool_declarations,
            history=history,
            message=message,
            system_override=system_override,
            on_chunk=on_chunk,
        )

    async def chat(self, history: list[dict], message: str, on_chunk: Callable[[str], None] | None = None) -> dict:
        """Send message with history. Routes to Ollama if configured, otherwise Gemini."""
        if self._settings.active_use_ollama:
            return await self._call_ollama(history, message, on_chunk=on_chunk)

        if not self._settings.active_gemini_api_key:
            return {
                "text": "Gemini API Key is not configured. Please enter your API Key in the **Settings** tab to start chatting with MARIANO.",
                "tool_calls": []
            }

        from mariano.core.rate_limiter import GeminiRateLimiter, estimate_tokens_from_text
        reasoning_mode_pre = self._settings.active_reasoning_mode
        _max_history = 8 if reasoning_mode_pre == "fast" else 14
        if len(history) > _max_history:
            trimmed = history[-_max_history:]
            first_user_idx = 0
            for idx, m in enumerate(trimmed):
                if m.get("role") == "user" and not m.get("tool_response"):
                    first_user_idx = idx
                    break
            else:
                first_user_idx = len(trimmed)
            history = trimmed[first_user_idx:]

        estimated_tokens = estimate_tokens_from_text(message, history)
        limiter = GeminiRateLimiter.get_instance()
        await limiter.acquire(estimated_tokens)
        contents = self._build_contents(history, message)
        tools = self._build_tools()

        current_temp = self._nm.get_temperature()
        dynamic_system_instruction = build_system_instruction(self._settings, self._nm, self._cp)
        reasoning_mode = self._settings.active_reasoning_mode

        config_kwargs: dict[str, Any] = {
            "system_instruction": dynamic_system_instruction,
            "temperature": current_temp,
            "max_output_tokens": MAX_OUTPUT_TOKENS,
        }
        if hasattr(types, "ThinkingConfig"):
            try:
                if reasoning_mode == "fast":
                    config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=1024)
                elif reasoning_mode == "pro":
                    config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=8192)
                elif reasoning_mode == "thinking":
                    config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=32768)
            except Exception as _tc_err:
                log.debug("gemini.thinking_config_note", error=str(_tc_err))

        if tools:
            config_kwargs["tools"] = tools
            config_kwargs["tool_config"] = types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="AUTO")
            )
        config = types.GenerateContentConfig(**config_kwargs)

        try:
            return await self._call_with_retry(
                contents=contents,
                config=config,
                label="chat",
                on_chunk=on_chunk,
            )
        except asyncio.CancelledError:
            # Task was cancelled (user pressed Stop) AFTER we already acquired a rate limit slot.
            # Give the slot back so it doesn't count against our quota budget.
            limiter.release_slot()
            raise


    async def complete(self, prompt: str, system_override: str | None = None) -> str:
        """Single-turn completion with retry on 429."""
        if self._settings.active_use_ollama:
            res = await self._call_ollama([], prompt, system_override)
            return res.get("text") or ""

        if not self._settings.active_gemini_api_key:
            return "Gemini API Key is not configured. Please configure it in the Settings."

        from mariano.core.rate_limiter import GeminiRateLimiter
        estimated_tokens = int(len(prompt) / 4) + 500
        await GeminiRateLimiter.get_instance().acquire(estimated_tokens)
        config = types.GenerateContentConfig(
            system_instruction=system_override or SYSTEM_PROMPT,
            temperature=CODER_TEMPERATURE,
        )
        result = await self._call_with_retry(
            contents=prompt,
            config=config,
            label="complete",
        )
        return result.get("text") or ""

    async def _call_with_retry(
        self,
        contents: Any,
        config: types.GenerateContentConfig,
        label: str = "call",
        on_chunk: Callable[[str], None] | None = None,
    ) -> dict:
        """Calls Gemini with exponential backoff and candidate model fallback chain."""
        primary_model = self._settings.active_model
        candidates = [primary_model] + [m for m in _MODEL_FALLBACK_CHAIN if m != primary_model]

        last_exc: Exception | None = None
        for model in candidates:
            for attempt in range(_MAX_RETRIES):
                try:
                    log.debug("gemini.call", label=label, model=model, attempt=attempt + 1)
                    loop = asyncio.get_event_loop()
                    def thread_safe_on_chunk(c):
                        if on_chunk:
                            loop.call_soon_threadsafe(on_chunk, c)

                    if on_chunk:
                        response_stream = await asyncio.to_thread(
                            self._get_client().models.generate_content_stream,
                            model=model,
                            contents=contents,
                            config=config,
                        )
                        def iterate_stream():
                            full_text = ""
                            tool_calls = []
                            for chunk in response_stream:
                                try:
                                    text = chunk.text
                                except Exception:
                                    text = None
                                if text:
                                    full_text += text
                                    thread_safe_on_chunk(text)
                                
                                if chunk.candidates:
                                    candidate = chunk.candidates[0]
                                    if candidate.content and candidate.content.parts:
                                        for part in candidate.content.parts:
                                            if hasattr(part, "function_call") and part.function_call:
                                                fc = part.function_call
                                                tool_calls.append({
                                                    "name": fc.name,
                                                    "args": dict(fc.args) if fc.args else {},
                                                })
                            return {"text": full_text, "tool_calls": tool_calls}
                        
                        stream_dict = await asyncio.to_thread(iterate_stream)
                        return {"text": stream_dict["text"], "tool_calls": stream_dict["tool_calls"]}
                    else:
                        response = await asyncio.to_thread(
                            self._get_client().models.generate_content,
                            model=model,
                            contents=contents,
                            config=config,
                        )
                        return self._parse_response(response)

                except Exception as exc:
                    err_str = str(exc)
                    is_429 = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
                    is_404 = "404" in err_str or "NOT_FOUND" in err_str

                    if is_404:
                        last_exc = exc
                        log.warning("gemini.model_not_found", model=model, error=err_str)
                        break
                    elif is_429:
                        delay = _RETRY_BASE_DELAY * (2 ** attempt)
                        ms_match = re.search(r'retry in ([\d\.]+)ms', err_str, re.IGNORECASE)
                        s_match = re.search(r'retry in ([\d\.]+)s', err_str, re.IGNORECASE)
                        if ms_match:
                            try:
                                delay = max(1.5, (float(ms_match.group(1)) / 1000.0) + 0.5)
                            except Exception:
                                pass
                        elif s_match:
                            try:
                                delay = max(2.0, float(s_match.group(1)) + 0.5)
                            except Exception:
                                pass

                        log.warning("gemini.rate_limited", model=model, attempt=attempt + 1, retry_in=round(delay, 2))

                        if delay > 6.0 and model != candidates[-1]:
                            last_exc = exc
                            next_model = candidates[candidates.index(model) + 1]
                            log.warning("gemini.long_delay_fast_switching", model=model, switching_to=next_model, delay=delay)
                            break

                        if attempt < _MAX_RETRIES - 1:
                            sleep_time = min(delay, 12.0)
                            log.info("gemini.waiting_for_cooldown", model=model, sleep_time=sleep_time)
                            await asyncio.sleep(sleep_time)
                        else:
                            if model == candidates[-1] and delay <= 15.0:
                                log.info("gemini.final_cooldown_wait", model=model, delay=delay)
                                await asyncio.sleep(delay)
                                try:
                                    if on_chunk:
                                        response_stream = await asyncio.to_thread(
                                            self._get_client().models.generate_content_stream,
                                            model=model,
                                            contents=contents,
                                            config=config,
                                        )
                                        stream_dict = await asyncio.to_thread(iterate_stream)
                                        return {"text": stream_dict["text"], "tool_calls": stream_dict["tool_calls"]}
                                    else:
                                        response = await asyncio.to_thread(
                                            self._get_client().models.generate_content,
                                            model=model,
                                            contents=contents,
                                            config=config,
                                        )
                                        return self._parse_response(response)
                                except Exception as final_exc:
                                    last_exc = final_exc

                            last_exc = exc
                            next_model = candidates[candidates.index(model) + 1] if model != candidates[-1] else "none"
                            log.warning("gemini.model_exhausted", model=model, switching_to=next_model)
                            await asyncio.sleep(1.0)
                            break
                    else:
                        raise

        raise RuntimeError(
            f"All models quota-exhausted after {_MAX_RETRIES} retries each. Last error: {last_exc}"
        )

    def _build_contents(self, history: list[dict], message: str) -> list[types.Content]:
        """Convert chat history to Gemini Content objects with orphan validation."""
        contents: list[types.Content] = []
        turns = []
        for msg in history:
            role = msg.get("role", "")
            if msg.get("tool_calls"):
                content = msg.get("content", "")
                turns.append({"kind": "call", "tool_calls": msg["tool_calls"], "content": content})
            elif msg.get("tool_response"):
                turns.append({"kind": "resp", "tool_response": msg["tool_response"]})
            elif role in ("user", "assistant"):
                c = msg.get("content", "")
                if c:
                    turns.append({"kind": "text", "role": role, "content": c})

        first_user_idx = -1
        for idx, t in enumerate(turns):
            if t["kind"] == "text" and t["role"] == "user":
                first_user_idx = idx
                break
        turns = [] if first_user_idx == -1 else turns[first_user_idx:]

        validated: list[dict] = []
        i = 0
        while i < len(turns):
            t = turns[i]
            if t["kind"] == "call":
                responses = []
                j = i + 1
                while j < len(turns) and turns[j]["kind"] == "resp":
                    responses.append(turns[j])
                    j += 1
                if responses:
                    validated.append(t)
                    validated.extend(responses)
                    i = j
                else:
                    i += 1
            elif t["kind"] == "resp":
                i += 1
            else:
                validated.append(t)
                i += 1

        pending_response_parts: list[types.Part] = []

        def flush_pending():
            nonlocal pending_response_parts
            if pending_response_parts:
                contents.append(types.Content(role="tool", parts=pending_response_parts))
                pending_response_parts = []

        def build_user_parts(text_str: str) -> list[types.Part]:
            parts = []
            img_matches = re.findall(r'\[Attached Image:[^\]]*saved at ([^\]\)]+)\)', text_str)
            if img_matches:
                for img_path_str in img_matches:
                    img_path_str = img_path_str.strip()
                    try:
                        if img_path_str.startswith("data:image/"):
                            header, b64data = img_path_str.split(",", 1)
                            mime = "image/png"
                            if "image/jpeg" in header or "image/jpg" in header:
                                mime = "image/jpeg"
                            elif "image/webp" in header:
                                mime = "image/webp"
                            img_bytes = base64.b64decode(b64data)
                            parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
                        else:
                            p = Path(img_path_str)
                            # Fallback: if path doesn't exist (packaged app path mismatch or timestamp prefix),
                            # search by filename in writable attachments dir with globbing
                            if not p.exists() or not p.is_file():
                                try:
                                    from mariano.config import get_settings as _gs
                                    settings = _gs()
                                    search_dirs = [
                                        settings.mariano_data_dir / "workspace" / "attachments",
                                        settings.mariano_data_dir / "workspace",
                                        Path.cwd() / "data" / "workspace" / "attachments",
                                        Path.cwd() / "data" / "workspace",
                                    ]
                                    for d in search_dirs:
                                        if not d.exists():
                                            continue
                                        cand = d / p.name
                                        if cand.exists() and cand.is_file():
                                            p = cand
                                            break
                                        matches = list(d.glob(f"*{p.name}"))
                                        if matches and matches[0].is_file():
                                            p = matches[0]
                                            break
                                except Exception:
                                    pass
                            if p.exists() and p.is_file():
                                img_bytes = p.read_bytes()
                                ext = p.suffix.lower()
                                mime = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else "image/jpeg")
                                parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
                            else:
                                log.warn("gemini.image_file_not_found", path=img_path_str[:120])
                    except Exception as err:
                        log.warn("gemini.image_part_load_failed", path=img_path_str[:60], error=str(err))

            clean_text = re.sub(r'data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+', '', text_str)
            clean_text = re.sub(r'\[Attached Image:\s*([^\(]+)\s*\(saved at [^\]]+\)\]', r'[Attached Image: \1]', clean_text).strip()
            parts.append(types.Part(text=clean_text or text_str))
            return parts

        for t in validated:
            if t["kind"] == "text":
                flush_pending()
                r = "model" if t["role"] == "assistant" else "user"
                content_clean = re.sub(r'data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+', '', t["content"])
                content_clean = re.sub(r'\[Attached Image:\s*([^\(]+)\s*\(saved at [^\]]+\)\]', r'[Attached Image: \1]', content_clean).strip()
                parts = [types.Part(text=content_clean or t["content"])]
                if contents and contents[-1].role == r:
                    contents[-1].parts.extend(parts)
                else:
                    contents.append(types.Content(role=r, parts=parts))

            elif t["kind"] == "call":
                flush_pending()
                parts = []
                if t.get("content"):
                    parts.append(types.Part(text=t["content"]))
                parts.extend([
                    types.Part(function_call=types.FunctionCall(name=tc["name"], args=tc["args"]))
                    for tc in t["tool_calls"]
                ])
                if contents and contents[-1].role == "model":
                    contents[-1].parts.extend(parts)
                else:
                    contents.append(types.Content(role="model", parts=parts))

            elif t["kind"] == "resp":
                tr = t["tool_response"]
                pending_response_parts.append(
                    types.Part.from_function_response(
                        name=tr["name"],
                        response={"result": tr["result"]}
                    )
                )

        flush_pending()

        final_parts = build_user_parts(message)
        if contents and contents[-1].role == "user":
            contents[-1].parts.extend(final_parts)
        else:
            contents.append(types.Content(role="user", parts=final_parts))

        return contents

    def _parse_response(self, response) -> dict:
        result: dict[str, Any] = {"text": None, "tool_calls": []}
        if not response.candidates:
            return result

        candidate = response.candidates[0]
        if not candidate.content or not candidate.content.parts:
            return result

        for part in candidate.content.parts:
            if hasattr(part, "text") and part.text:
                result["text"] = part.text
            elif hasattr(part, "function_call") and part.function_call:
                fc = part.function_call
                result["tool_calls"].append({
                    "name": fc.name,
                    "args": dict(fc.args) if fc.args else {},
                })

        return result
