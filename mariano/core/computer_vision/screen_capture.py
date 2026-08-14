"""mariano.core.computer_vision.screen_capture
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
High-performance screen capture, cropping, DPI scaling, and encoding engine.
"""
from __future__ import annotations

import base64
import io
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

try:
    from PIL import Image, ImageGrab
except ImportError:
    Image = None
    ImageGrab = None

try:
    import pyautogui
except ImportError:
    pyautogui = None


@dataclass
class ScreenMetadata:
    width: int
    height: int
    scale_factor: float
    is_multimonitor: bool
    display_count: int


class ScreenCaptureManager:
    """Manages high-performance desktop screenshot capture, compression, and region cropping."""

    def __init__(self, storage_dir: str = "data/screenshots"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def get_screen_dimensions() -> ScreenMetadata:
        """Returns primary display resolution and scaling metadata."""
        if pyautogui:
            w, h = pyautogui.size()
        elif ImageGrab:
            bbox = ImageGrab.grab().size
            w, h = bbox[0], bbox[1]
        else:
            w, h = 1920, 1080

        return ScreenMetadata(
            width=w,
            height=h,
            scale_factor=1.0,
            is_multimonitor=False,
            display_count=1
        )

    def capture_full_screen(
        self,
        save_file: bool = True,
        filename: Optional[str] = None,
        max_dimension: int = 1920,
        quality: int = 85
    ) -> Tuple[Image.Image, Optional[Path]]:
        """Captures the full desktop screen with aspect-ratio preserving downscaling."""
        if not ImageGrab:
            raise RuntimeError("PIL (Pillow) is required for screen capture. Install with `pip install pillow`.")

        screenshot = ImageGrab.grab(all_screens=False)
        
        # Scale if dimensions exceed max_dimension (reduces Vision AI token usage)
        orig_w, orig_h = screenshot.size
        if max(orig_w, orig_h) > max_dimension:
            scale = max_dimension / max(orig_w, orig_h)
            new_size = (int(orig_w * scale), int(orig_h * scale))
            screenshot = screenshot.resize(new_size, Image.Resampling.LANCZOS)

        saved_path = None
        if save_file:
            target_name = filename or "latest_desktop_screen.jpg"
            saved_path = self.storage_dir / target_name
            screenshot.convert("RGB").save(str(saved_path), format="JPEG", quality=quality, optimize=True)

        return screenshot, saved_path

    def capture_window_region(
        self,
        bbox: Tuple[int, int, int, int],
        save_file: bool = True,
        filename: Optional[str] = None
    ) -> Tuple[Image.Image, Optional[Path]]:
        """Captures a specific (left, top, right, bottom) bounding box region."""
        if not ImageGrab:
            raise RuntimeError("PIL (Pillow) is required for screen capture.")

        cropped = ImageGrab.grab(bbox=bbox)
        saved_path = None
        if save_file:
            target_name = filename or "region_crop.jpg"
            saved_path = self.storage_dir / target_name
            cropped.convert("RGB").save(str(saved_path), format="JPEG", quality=90)

        return cropped, saved_path

    @staticmethod
    def encode_image_to_base64(image: Image.Image, format_type: str = "JPEG", quality: int = 80) -> str:
        """Converts PIL Image to base64 string for direct Vision LLM consumption."""
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format=format_type, quality=quality, optimize=True)
        raw_bytes = buffer.getvalue()
        return base64.b64encode(raw_bytes).decode("utf-8")

    def get_latest_vision_payload(self, max_dim: int = 1600) -> dict:
        """Captures current screen and returns structured payload for Vision API."""
        img, path = self.capture_full_screen(save_file=True, max_dimension=max_dim)
        b64_str = self.encode_image_to_base64(img)
        w, h = img.size
        return {
            "mime_type": "image/jpeg",
            "base64_data": b64_str,
            "width": w,
            "height": h,
            "file_path": str(path) if path else ""
        }
