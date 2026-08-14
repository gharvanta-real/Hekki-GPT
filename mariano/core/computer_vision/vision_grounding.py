"""mariano.core.computer_vision.vision_grounding
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Multimodal Vision coordinate extraction, Set-of-Mark grounding, and normalization.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class GroundedElement:
    label: str
    center_x: int
    center_y: int
    bounding_box: Optional[Tuple[int, int, int, int]] = None
    confidence: float = 1.0


class VisionGroundingEngine:
    """Parses visual coordinates, scales bounding boxes, and formats Multimodal prompts."""

    @staticmethod
    def normalize_to_screen_pixels(
        norm_x: float,
        norm_y: float,
        screen_width: int,
        screen_height: int,
        source_scale: int = 1000
    ) -> Tuple[int, int]:
        """Converts normalized (0-1000 or 0-1) coordinates into exact screen pixel locations."""
        if norm_x <= 1.0 and norm_y <= 1.0:
            pixel_x = int(norm_x * screen_width)
            pixel_y = int(norm_y * screen_height)
        else:
            pixel_x = int((norm_x / source_scale) * screen_width)
            pixel_y = int((norm_y / source_scale) * screen_height)

        return max(0, min(pixel_x, screen_width - 1)), max(0, min(pixel_y, screen_height - 1))

    @staticmethod
    def parse_vision_llm_response(response_text: str, screen_w: int, screen_h: int) -> Optional[GroundedElement]:
        """Extracts coordinate actions from Vision LLM text output."""
        # Pattern 1: JSON format {"action": "click", "x": 520, "y": 340} or {"point": [x, y]}
        json_match = re.search(r'\{[^{}]*"x"\s*:\s*(\d+)[^{}]*"y"\s*:\s*(\d+)[^{}]*\}', response_text)
        if json_match:
            gx = int(json_match.group(1))
            gy = int(json_match.group(2))
            px, py = VisionGroundingEngine.normalize_to_screen_pixels(gx, gy, screen_w, screen_h)
            return GroundedElement(label="json_coord", center_x=px, center_y=py)

        # Pattern 2: (x, y) or [x, y] coordinates e.g. click at [450, 600]
        coord_match = re.search(r'[\[\(]\s*(\d{1,4})\s*,\s*(\d{1,4})\s*[\]\)]', response_text)
        if coord_match:
            gx = int(coord_match.group(1))
            gy = int(coord_match.group(2))
            px, py = VisionGroundingEngine.normalize_to_screen_pixels(gx, gy, screen_w, screen_h)
            return GroundedElement(label="tuple_coord", center_x=px, center_y=py)

        # Pattern 3: Bounding box [ymin, xmin, ymax, xmax] standard format
        box_match = re.search(r'\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]', response_text)
        if box_match:
            ymin = int(box_match.group(1))
            xmin = int(box_match.group(2))
            ymax = int(box_match.group(3))
            xmax = int(box_match.group(4))
            mid_x = (xmin + xmax) / 2
            mid_y = (ymin + ymax) / 2
            px, py = VisionGroundingEngine.normalize_to_screen_pixels(mid_x, mid_y, screen_w, screen_h)
            return GroundedElement(
                label="bbox_center",
                center_x=px,
                center_y=py,
                bounding_box=(xmin, ymin, xmax, ymax)
            )

        return None

    @staticmethod
    def build_vision_grounding_prompt(goal_instruction: str, screen_w: int, screen_h: int) -> str:
        """Constructs high-precision multimodal grounding instructions for LLM."""
        return (
            f"You are an expert GUI Computer Control Vision Agent.\n"
            f"Desktop Resolution: {screen_w}x{screen_h}\n"
            f"Target Goal: {goal_instruction}\n\n"
            f"Analyze the attached desktop screenshot carefully and identify the exact UI element to interact with.\n"
            f"Output your response strictly in the following JSON format:\n"
            f"{{\n"
            f'  "thought": "Reasoning about where the element is located",\n'
            f'  "action": "click" | "double_click" | "right_click" | "type" | "hotkey" | "scroll",\n'
            f'  "x": <integer_pixel_x_0_to_{screen_w}>,\n'
            f'  "y": <integer_pixel_y_0_to_{screen_h}>,\n'
            f'  "text_to_type": "<text_if_typing_action>",\n'
            f'  "keys": ["ctrl", "c"]\n'
            f"}}"
        )
