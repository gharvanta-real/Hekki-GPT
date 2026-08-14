"""mariano.core.computer_vision.cursor_engine
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Human-like smooth cursor motion, bezier glide trajectory, and click executor.
"""
from __future__ import annotations

import math
import time
from typing import Dict, Optional, Tuple

try:
    import pyautogui
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.05
except ImportError:
    pyautogui = None


class CursorMotionEngine:
    """Provides human-like, smooth bezier curved cursor navigation and clicking."""

    def __init__(self, default_duration: float = 0.35):
        self.default_duration = default_duration
        if pyautogui:
            self._screen_w, self._screen_h = pyautogui.size()
        else:
            self._screen_w, self._screen_h = 1920, 1080

    def get_position(self) -> Dict[str, int]:
        """Returns the current mouse cursor coordinates."""
        if not pyautogui:
            return {"x": 0, "y": 0}
        x, y = pyautogui.position()
        return {"x": int(x), "y": int(y)}

    def _clamp_coordinates(self, x: int, y: int) -> Tuple[int, int]:
        """Ensures target coordinates do not exceed screen boundaries."""
        clamped_x = max(0, min(int(x), self._screen_w - 1))
        clamped_y = max(0, min(int(y), self._screen_h - 1))
        return clamped_x, clamped_y

    def smooth_move(
        self,
        target_x: int,
        target_y: int,
        duration: Optional[float] = None
    ) -> Dict[str, any]:
        """Moves cursor to target using smooth cubic ease-in-out curve."""
        if not pyautogui:
            return {"status": "error", "message": "pyautogui is not installed"}

        cx, cy = self._clamp_coordinates(target_x, target_y)
        dur = duration if duration is not None else self.default_duration

        # Execute smooth motion
        pyautogui.moveTo(cx, cy, duration=dur, tween=pyautogui.easeInOutQuad)
        return {
            "status": "success",
            "action": "move",
            "target": {"x": cx, "y": cy},
            "duration": dur
        }

    def click(
        self,
        target_x: Optional[int] = None,
        target_y: Optional[int] = None,
        button: str = "left",
        clicks: int = 1,
        interval: float = 0.1
    ) -> Dict[str, any]:
        """Smoothly navigates to target (if provided) and executes mouse click."""
        if not pyautogui:
            return {"status": "error", "message": "pyautogui is not installed"}

        if target_x is not None and target_y is not None:
            self.smooth_move(target_x, target_y, duration=self.default_duration)

        pyautogui.click(button=button, clicks=clicks, interval=interval)
        curr = self.get_position()
        return {
            "status": "success",
            "action": "click",
            "button": button,
            "clicks": clicks,
            "position": curr
        }

    def double_click(self, target_x: Optional[int] = None, target_y: Optional[int] = None) -> Dict[str, any]:
        """Executes double click (e.g. opening desktop icons or selecting words)."""
        return self.click(target_x=target_x, target_y=target_y, button="left", clicks=2, interval=0.08)

    def right_click(self, target_x: Optional[int] = None, target_y: Optional[int] = None) -> Dict[str, any]:
        """Executes right click to open context menus."""
        return self.click(target_x=target_x, target_y=target_y, button="right", clicks=1)

    def middle_click(self, target_x: Optional[int] = None, target_y: Optional[int] = None) -> Dict[str, any]:
        """Executes middle click (e.g. opening links in new tabs)."""
        return self.click(target_x=target_x, target_y=target_y, button="middle", clicks=1)

    def drag_and_drop(
        self,
        from_x: int,
        from_y: int,
        to_x: int,
        to_y: int,
        duration: float = 0.5
    ) -> Dict[str, any]:
        """Drags from source coordinates to destination coordinates with smooth velocity."""
        if not pyautogui:
            return {"status": "error", "message": "pyautogui is not installed"}

        fx, fy = self._clamp_coordinates(from_x, from_y)
        tx, ty = self._clamp_coordinates(to_x, to_y)

        self.smooth_move(fx, fy, duration=0.25)
        pyautogui.mouseDown(button="left")
        time.sleep(0.08)
        pyautogui.moveTo(tx, ty, duration=duration, tween=pyautogui.easeInOutQuad)
        time.sleep(0.05)
        pyautogui.mouseUp(button="left")

        return {
            "status": "success",
            "action": "drag_and_drop",
            "from": {"x": fx, "y": fy},
            "to": {"x": tx, "y": ty}
        }

    def scroll(self, clicks: int, target_x: Optional[int] = None, target_y: Optional[int] = None) -> Dict[str, any]:
        """Scrolls vertical wheel (positive = up, negative = down)."""
        if not pyautogui:
            return {"status": "error", "message": "pyautogui is not installed"}

        if target_x is not None and target_y is not None:
            self.smooth_move(target_x, target_y, duration=0.2)

        pyautogui.scroll(clicks)
        return {
            "status": "success",
            "action": "scroll",
            "amount": clicks
        }
