"""MARIANO Core Skill — Generate Image using free public API (Flux)."""
from __future__ import annotations
import asyncio
import time
import urllib.request
import urllib.parse
from pathlib import Path
from mariano.config import get_settings
from mariano.skills._base import BaseSkill, SkillResult

class GenerateImageSkill(BaseSkill):
    name = "generate_image"
    description = (
        "Generate a new image based on a detailed text prompt using Flux. "
        "Returns the path to the saved generated image."
    )
    version = "1.0.0"
    tags = ["image", "generation", "draw", "flux", "create"]

    def get_parameters_schema(self) -> dict:
        return {
            "Prompt": {
                "type": "string",
                "description": "Detailed text description of the image you want to generate.",
                "required": True
            },
            "ImageName": {
                "type": "string",
                "description": "Descriptive, short, snake_case filename (without extension).",
                "default": "generated_image"
            }
        }

    async def execute(self, Prompt: str, ImageName: str = "generated_image") -> SkillResult:
        try:
            settings = get_settings()
            
            # Define output path in workspace Exports folder
            exports_dir = settings.mariano_data_dir / "workspace" / "Exports"
            exports_dir.mkdir(parents=True, exist_ok=True)
            
            filename = f"{ImageName}_{int(time.time())}.png"
            output_path = exports_dir / filename

            # Construct pollinations.ai URL with url-encoded prompt
            encoded_prompt = urllib.parse.quote(Prompt)
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"

            def download_image():
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                )
                with urllib.request.urlopen(req, timeout=45) as response:
                    img_bytes = response.read()
                
                if not img_bytes:
                    raise RuntimeError("Received empty response from image generation API.")
                
                output_path.write_bytes(img_bytes)
                return str(output_path.resolve())

            # Run in executor
            loop = asyncio.get_running_loop()
            resolved_path = await loop.run_in_executor(None, download_image)

            # Return success with markdown link showing the file URL
            relative_path = f"Exports/{filename}"
            md_link = f"![Generated Image](file:///{resolved_path.replace('\\', '/')})"
            
            return SkillResult(
                success=True,
                data=f"Successfully generated image and saved to:\n{md_link}\n\nPath: {resolved_path}",
                metadata={
                    "image_path": resolved_path,
                    "relative_path": relative_path,
                    "prompt": Prompt,
                    "filename": filename
                }
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=str(exc))
