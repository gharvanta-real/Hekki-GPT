"""MARIANO Core Skill — Image analysis using Gemini Vision."""
from __future__ import annotations
import asyncio
import base64
import re
from pathlib import Path
from typing import Any
from mariano.skills._base import BaseSkill, SkillResult

def _find_image_file(image_path: str) -> tuple[bytes | None, str]:
    """Resolve image bytes and mime type from path, filename, or data URL."""
    if not image_path:
        return None, "image/png"

    # 1. Base64 data URL
    if image_path.startswith("data:image/"):
        try:
            header, b64data = image_path.split(",", 1)
            ext = "png"
            if "jpeg" in header or "jpg" in header:
                ext = "jpeg"
            elif "webp" in header:
                ext = "webp"
            elif "gif" in header:
                ext = "gif"
            return base64.b64decode(b64data), f"image/{ext}"
        except Exception:
            return None, "image/png"

    raw_p = Path(image_path.strip().strip("'\""))
    target_p: Path | None = None

    if raw_p.exists() and raw_p.is_file():
        target_p = raw_p
    else:
        from mariano.config import get_settings
        settings = get_settings()
        clean_name = raw_p.name

        search_dirs = [
            settings.mariano_data_dir / "workspace" / "attachments",
            settings.mariano_data_dir / "workspace",
            settings.mariano_data_dir,
            Path.cwd() / "data" / "workspace" / "attachments",
            Path.cwd() / "data" / "workspace",
            Path.cwd(),
        ]

        for d in search_dirs:
            if not d.exists():
                continue
            cand = d / clean_name
            if cand.exists() and cand.is_file():
                target_p = cand
                break
            # Match timestamp prefix e.g. 1787328676591_Pasted_Image_...
            matches = list(d.glob(f"*{clean_name}"))
            if matches and matches[0].is_file():
                target_p = matches[0]
                break
            # Case-insensitive / substring match
            lower_name = clean_name.lower()
            for f in d.glob("*"):
                if f.is_file() and lower_name in f.name.lower():
                    target_p = f
                    break
            if target_p:
                break

    if target_p and target_p.is_file():
        ext = target_p.suffix.lower().lstrip(".")
        mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}
        mime = mime_map.get(ext, "image/png")
        try:
            return target_p.read_bytes(), mime
        except Exception:
            return None, mime

    return None, "image/png"


class ImageAnalysisSkill(BaseSkill):
    name = "image_analysis"
    description = "Analyze images using Gemini Vision AI. Describe contents, extract text (OCR), identify objects, read charts, or analyze screenshots."
    version = "1.1.0"
    tags = ["image", "vision", "ocr", "screenshot", "analyze"]

    def get_parameters_schema(self) -> dict:
        return {
            "image_path": {"type": "string", "description": "Path or filename of image (e.g. screenshot.png, Pasted_Image_...)", "required": True},
            "prompt": {"type": "string", "description": "What to analyze e.g. describe, extract text, read chart", "default": "Describe this image in detail and answer the user's prompt."},
        }

    async def execute(self, image_path: str, prompt: str = "Describe this image in detail and answer the user's prompt.") -> SkillResult:
        try:
            from mariano.config import get_settings
            from google import genai
            from google.genai import types

            image_bytes, mime = _find_image_file(image_path)
            if not image_bytes:
                return SkillResult(success=False, data=None, error=f"Image not found: {image_path}. Please check filename or attach image again.")

            settings = get_settings()
            client = genai.Client(api_key=settings.active_gemini_api_key)

            from mariano.core.rate_limiter import GeminiRateLimiter
            await GeminiRateLimiter.get_instance().acquire(token_count=2000)

            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-3.1-flash-lite",
                contents=[
                    types.Content(parts=[
                        types.Part(text=prompt),
                        types.Part(inline_data=types.Blob(mime_type=mime, data=image_bytes)),
                    ])
                ]
            )
            return SkillResult(
                success=True,
                data=response.text or "No analysis returned",
                metadata={"image": image_path, "prompt": prompt},
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=str(exc))

