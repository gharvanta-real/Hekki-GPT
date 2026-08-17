"""MARIANO Core API Routes — Quick Voice and Screen Capture endpoints."""
from __future__ import annotations

import io
import asyncio
import structlog
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, FileResponse, Response
from pydantic import BaseModel
from pathlib import Path

from mariano.config import get_settings

log = structlog.get_logger(__name__)
router = APIRouter(tags=["core_api"])

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


class QuickVoiceRequest(BaseModel):
    text: str


@router.post("/api/quick-voice")
async def quick_voice(req: QuickVoiceRequest):
    """Processes a short voice/text query from the mini overlay."""
    from mariano.core.rate_limiter import GeminiRateLimiter
    from google import genai as genai_sdk

    try:
        lower_text = req.text.strip().lower()
        if any(kw in lower_text for kw in ["screenshot", "screen capture", "capture screen", "snip", "dekho screen", "screen dekho", "what is on my screen"]):
            capture_res = await screen_capture()
            if capture_res.get("success"):
                return {
                    "response_text": capture_res.get("analysis", "Screen captured successfully."),
                    "image_url": capture_res.get("image_url")
                }

        settings_obj = get_settings()

        from mariano.core.computer_use import ComputerUseEngine
        cu_result = await ComputerUseEngine.execute_intent(req.text.strip())
        if cu_result.get("success"):
            return {"response_text": cu_result.get("message", "Done!")}

        system_prompt = (
            "CRITICAL SYSTEM IDENTITY: You are Hekki, the ultimate Computer Vision & Autonomous Windows Desktop AI Assistant. "
            "YOUR CORE SPECIALTY AND PRIMARY SKILLS ARE COMPUTER VISION AND DESKTOP AUTOMATION. "
            "Whenever the user asks what you can do, what your skills are, or how to use you (such as 'KONSE KAAM', 'SKILLS KYA HAI', 'WHAT CAN YOU DO'), "
            "you MUST ALWAYS proudly highlight your Computer Vision capabilities: capturing desktop screens, seeing and clicking UI buttons/elements on screen by name, "
            "typing text into active Windows software, switching app windows, and automating desktop tasks for them. "
            "Respond in warm, natural conversational Hinglish/Hindi or English (matching the user's language). "
            "Keep it short (1-3 conversational sentences). Do NOT use markdown symbols (*, #, -, numbers)."
        )

        client_sdk = genai_sdk.Client(api_key=settings_obj.active_gemini_api_key)
        loop = asyncio.get_running_loop()
        await GeminiRateLimiter.get_instance().acquire(token_count=500)

        response = await loop.run_in_executor(
            None,
            lambda: client_sdk.models.generate_content(
                model=settings_obj.active_model,
                contents=[{"role": "user", "parts": [{"text": f"{system_prompt}\n\nUser: {req.text.strip()}"}]}]
            )
        )

        answer = response.text.strip() if response.text else "I'm not sure. Try asking in the main Hekki window."
        return {"response_text": answer}

    except Exception as e:
        log.error("web.quick_voice_failed", error=str(e))
        return {"response_text": "Something went wrong. Please try again."}


@router.post("/api/screen-capture")
async def screen_capture():
    """Captures the primary monitor and analyzes active screen content with Gemini Vision."""
    from PIL import Image
    from mariano.core.rate_limiter import GeminiRateLimiter
    from google import genai as genai_sdk
    from google.genai import types as genai_types

    try:
        settings_obj = get_settings()
        client_sdk = genai_sdk.Client(api_key=settings_obj.active_gemini_api_key)

        img: Image.Image | None = None
        capture_error: str = ""

        try:
            import mss
            with mss.mss() as sct:
                mon = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                sct_img = sct.grab(mon)
                img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
        except Exception as mss_err:
            try:
                from PIL import ImageGrab
                img = ImageGrab.grab().convert("RGB")
            except Exception as ig_err:
                try:
                    import pyautogui
                    img = pyautogui.screenshot().convert("RGB")
                except Exception as pg_err:
                    return {
                        "success": False,
                        "analysis": f"Screen capture unavailable: {mss_err} | {ig_err} | {pg_err}"
                    }

        img.thumbnail((1280, 800), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88)
        img_bytes = buf.getvalue()

        vision_prompt = (
            "You are Hekki, an intelligent desktop assistant. "
            "Analyze this screenshot of the user's active screen. "
            "Extract and summarize in plain conversational language (no markdown):\n"
            "1. What application or window is open and what the user is currently doing.\n"
            "2. Any visible text — notes, documents, code, messages, tasks, reminders, calendar events, or to-do items.\n"
            "3. Any errors, warnings, or important notifications visible on screen.\n"
            "4. One helpful observation or reminder based on what is visible (e.g. unsaved work, a pending task, or useful insight).\n"
            "Keep total response under 4 conversational sentences. Be warm and direct."
        )

        loop = asyncio.get_running_loop()
        await GeminiRateLimiter.get_instance().acquire(token_count=1200)

        response = await loop.run_in_executor(
            None,
            lambda: client_sdk.models.generate_content(
                model=settings_obj.active_model,
                contents=[
                    genai_types.Content(
                        role="user",
                        parts=[
                            genai_types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                            genai_types.Part.from_text(text=vision_prompt),
                        ]
                    )
                ]
            )
        )

        analysis_text = response.text.strip() if (response and response.text) else "Screen captured successfully."
        import base64
        img_b64 = f"data:image/jpeg;base64,{base64.b64encode(img_bytes).decode('utf-8')}"
        return {"success": True, "analysis": analysis_text, "image_url": img_b64}

    except Exception as e:
        log.error("web.screen_capture_failed", error=str(e))
        return {"success": False, "analysis": f"Vision analysis failed: {str(e)[:300]}"}


@router.get("/api/rate-limits/usage")
async def get_rate_limits_usage():
    """Returns real-time usage metrics and remaining quota percentages for active Gemini models."""
    import time
    from mariano.core.rate_limiter import GeminiRateLimiter
    from mariano.config import get_settings
    settings = get_settings()
    limiter = GeminiRateLimiter.get_instance()
    
    current_time = time.time()
    active_m = settings.active_model or "gemini-3.5-flash-lite"
    
    is_lite = "lite" in active_m.lower()
    rpm_cap = 15 if is_lite else 5
    rpd_cap = 500 if is_lite else 20
    tpm_cap = 250000
    
    recent_reqs_60s = len([t for t in limiter._timestamps if t >= current_time - 60.0])
    recent_tokens_60s = sum(tok for t, tok in limiter._token_timestamps if t >= current_time - 60.0)
    day_reqs_24h = len([t for t in limiter._day_timestamps if t >= current_time - 86400.0])
    
    daily_rem_pct = max(0, min(100, int((rpd_cap - day_reqs_24h) / rpd_cap * 100)))
    minute_rem_pct = max(0, min(100, int((rpm_cap - recent_reqs_60s) / rpm_cap * 100)))
    
    return {
        "model": active_m,
        "is_lite": is_lite,
        "daily": {
            "used": day_reqs_24h,
            "limit": rpd_cap,
            "remaining": max(0, rpd_cap - day_reqs_24h),
            "remaining_pct": daily_rem_pct,
            "desc": f"You have {max(0, rpd_cap - day_reqs_24h)} of {rpd_cap} daily requests remaining"
        },
        "minute": {
            "used": recent_reqs_60s,
            "limit": rpm_cap,
            "remaining": max(0, rpm_cap - recent_reqs_60s),
            "remaining_pct": minute_rem_pct,
            "desc": f"Active sliding window: {max(0, rpm_cap - recent_reqs_60s)}/{rpm_cap} RPM remaining"
        },
        "tokens": {
            "used": recent_tokens_60s,
            "limit": tpm_cap,
            "remaining": max(0, tpm_cap - recent_tokens_60s),
            "remaining_pct": max(0, min(100, int((tpm_cap - recent_tokens_60s) / tpm_cap * 100)))
        }
    }
