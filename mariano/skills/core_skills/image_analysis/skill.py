"""MARIANO Core Skill — Image analysis using Gemini Vision."""
from __future__ import annotations
import asyncio
from pathlib import Path
from typing import Any
from mariano.skills._base import BaseSkill, SkillResult

class ImageAnalysisSkill(BaseSkill):
    name = "image_analysis"
    description = "Analyze images using Gemini Vision AI. Describe contents, extract text (OCR), identify objects, read charts, or analyze screenshots."
    version = "1.0.0"
    tags = ["image", "vision", "ocr", "screenshot", "analyze"]

    def get_parameters_schema(self) -> dict:
        return {
            "image_path": {"type": "string", "description": "Path to image file (jpg, png, gif, webp)", "required": True},
            "prompt": {"type": "string", "description": "What to analyze e.g. describe, extract text, read chart", "default": "Describe this image in detail."},
        }

    async def execute(self, image_path: str, prompt: str = "Describe this image in detail.") -> SkillResult:
        try:
            from mariano.config import get_settings
            from google import genai
            from google.genai import types
            import base64

            path = Path(image_path)
            if not path.exists():
                return SkillResult(success=False, data=None, error=f"Image not found: {image_path}")

            settings = get_settings()
            client = genai.Client(api_key=settings.active_gemini_api_key)

            ext = path.suffix.lower().lstrip(".")
            mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}
            mime = mime_map.get(ext, "image/png")

            image_bytes = path.read_bytes()

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
