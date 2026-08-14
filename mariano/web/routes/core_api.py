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
        settings_obj = get_settings()

        from mariano.core.computer_use import ComputerUseEngine
        cu_result = await ComputerUseEngine.execute_intent(req.text.strip())
        if cu_result.get("success"):
            return {"response_text": cu_result.get("message", "Done!")}

        system_prompt = (
            "You are Hekki, an advanced Computer Vision & Autonomous Desktop AI Assistant running natively on Windows OS. "
            "You have full visual intelligence to capture the desktop screen, click buttons by name, type text into active apps, "
            "focus window applications, and automate desktop goals for the user. "
            "Explain clearly to the user how they can use your Computer Vision & Windows Desktop Automation features "
            "(e.g., asking you to click buttons, type text, capture screen, open apps, or guide their desktop workflow). "
            "Keep your responses warm, intelligent, concise (1-3 natural sentences), and conversational. "
            "Do NOT use markdown formatting, bullet points, numbered lists, or headers."
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
                img = Image.frombytes(
                    mode="RGBA",
                    size=(sct_img.width, sct_img.height),
                    data=bytes(sct_img.raw),
                    decoder_name="raw",
                    args=["BGRA"]
                ).convert("RGB")
        except Exception as mss_err:
            capture_error = str(mss_err)
            try:
                import pyautogui
                img = pyautogui.screenshot().convert("RGB")
                capture_error = ""
            except Exception as pg_err:
                return {
                    "success": False,
                    "analysis": f"Screen capture unavailable. mss: {capture_error} | pyautogui: {pg_err}"
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

        analysis = response.text.strip() if (response and response.text) else "Screen captured but Gemini returned no analysis."
        return {"success": True, "analysis": analysis}

    except Exception as e:
        log.error("web.screen_capture_failed", error=str(e))
        return {"success": False, "analysis": f"Vision analysis failed: {str(e)[:300]}"}
