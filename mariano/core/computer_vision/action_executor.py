"""mariano.core.computer_vision.action_executor
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Unified high-level Computer Vision & Desktop Action Orchestrator.
"""
from __future__ import annotations

import os
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .cursor_engine import CursorMotionEngine
from .keyboard_engine import KeyboardAutomationEngine
from .screen_capture import ScreenCaptureManager
from .ui_tree_grounding import UITreeGroundingEngine
from .vision_grounding import VisionGroundingEngine


@dataclass
class ActionExecutionResult:
    success: bool
    action: str
    message: str
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


class ComputerVisionController:
    """Master controller orchestrating Vision Grounding, Native OS UIAutomation, and GUI interactions."""

    def __init__(self, screenshot_dir: str = "data/screenshots"):
        self.screen_mgr = ScreenCaptureManager(storage_dir=screenshot_dir)
        self.cursor_engine = CursorMotionEngine(default_duration=0.32)
        self.keyboard_engine = KeyboardAutomationEngine(default_interval=0.035)
        self.ui_tree = UITreeGroundingEngine(search_depth=6)
        self.vision_grounding = VisionGroundingEngine()

    def get_state(self) -> Dict[str, Any]:
        """Returns the current state including resolution, cursor position, and active windows."""
        dims = self.screen_mgr.get_screen_dimensions()
        pos = self.cursor_engine.get_position()
        windows = self.ui_tree.list_open_windows()
        return {
            "screen_width": dims.width,
            "screen_height": dims.height,
            "cursor_position": pos,
            "open_windows_count": len(windows),
            "active_windows": [w["title"] for w in windows[:8]]
        }

    def capture_screen(self, filename: Optional[str] = None) -> ActionExecutionResult:
        """Captures desktop screen and returns the saved file path."""
        try:
            _, path = self.screen_mgr.capture_full_screen(save_file=True, filename=filename)
            return ActionExecutionResult(
                success=True,
                action="capture_screen",
                message=f"Screen captured successfully: {path.name if path else ''}",
                data={"path": str(path)}
            )
        except Exception as e:
            return ActionExecutionResult(success=False, action="capture_screen", message="Capture failed", error=str(e))

    def move_cursor(self, x: int, y: int, duration: float = 0.3) -> ActionExecutionResult:
        """Smoothly moves cursor to target (x, y) coordinates."""
        res = self.cursor_engine.smooth_move(x, y, duration=duration)
        if res.get("status") == "success":
            return ActionExecutionResult(
                success=True,
                action="move_cursor",
                message=f"Cursor moved smoothly to ({x}, {y})",
                data=res
            )
        return ActionExecutionResult(success=False, action="move_cursor", message="Move failed", error=res.get("message"))

    def click(
        self,
        x: Optional[int] = None,
        y: Optional[int] = None,
        button: str = "left",
        clicks: int = 1
    ) -> ActionExecutionResult:
        """Navigates to (x, y) and performs click / double-click / right-click."""
        res = self.cursor_engine.click(target_x=x, target_y=y, button=button, clicks=clicks)
        if res.get("status") == "success":
            return ActionExecutionResult(
                success=True,
                action="click",
                message=f"Performed {button}-click ({clicks}x) at {res.get('position')}",
                data=res
            )
        return ActionExecutionResult(success=False, action="click", message="Click failed", error=res.get("message"))

    def double_click(self, x: Optional[int] = None, y: Optional[int] = None) -> ActionExecutionResult:
        """Performs double click."""
        return self.click(x=x, y=y, button="left", clicks=2)

    def right_click(self, x: Optional[int] = None, y: Optional[int] = None) -> ActionExecutionResult:
        """Performs right click."""
        return self.click(x=x, y=y, button="right", clicks=1)

    def click_element_by_name(self, element_name: str, control_type: Optional[str] = None) -> ActionExecutionResult:
        """Attempts to find and click an element via native Windows UI tree without taking screenshots."""
        info = self.ui_tree.find_element_bounds(element_name, control_type=control_type)
        if info and info.get("found"):
            cx = info["center_x"]
            cy = info["center_y"]
            # Smoothly move to element and click
            self.cursor_engine.smooth_move(cx, cy, duration=0.25)
            self.cursor_engine.click(button="left", clicks=1)
            return ActionExecutionResult(
                success=True,
                action="click_element_by_name",
                message=f"Located and clicked element '{element_name}' at ({cx}, {cy})",
                data=info
            )
        return ActionExecutionResult(
            success=False,
            action="click_element_by_name",
            message=f"Element '{element_name}' not found in accessibility tree",
            error="not_found"
        )

    def type_text(self, text: str, press_enter: bool = False) -> ActionExecutionResult:
        """Types string with natural human intervals."""
        res = self.keyboard_engine.type_text(text, press_enter=press_enter)
        return ActionExecutionResult(
            success=True,
            action="type_text",
            message=f"Typed text ({len(text)} chars)",
            data=res
        )

    def press_hotkey(self, *keys: str) -> ActionExecutionResult:
        """Executes key combinations (e.g. 'ctrl', 's')."""
        res = self.keyboard_engine.execute_hotkey(*keys)
        return ActionExecutionResult(
            success=True,
            action="press_hotkey",
            message=f"Pressed hotkey: {' + '.join(keys)}",
            data=res
        )

    def scroll(self, amount: int) -> ActionExecutionResult:
        """Scrolls mouse wheel."""
        res = self.cursor_engine.scroll(amount)
        return ActionExecutionResult(
            success=True,
            action="scroll",
            message=f"Scrolled {amount} clicks",
            data=res
        )

    def focus_window(self, title_query: str) -> ActionExecutionResult:
        """Brings specific application window to front."""
        res = self.ui_tree.focus_window(title_query)
        if res.get("status") == "success":
            return ActionExecutionResult(
                success=True,
                action="focus_window",
                message=f"Focused window: '{res.get('title')}'",
                data=res
            )
        return ActionExecutionResult(success=False, action="focus_window", message="Focus failed", error=res.get("message"))

    def launch_app(self, app_path_or_name: str) -> ActionExecutionResult:
        """Launches application executable or opens shell path."""
        try:
            os.startfile(app_path_or_name)
            return ActionExecutionResult(
                success=True,
                action="launch_app",
                message=f"Launched '{app_path_or_name}'",
                data={"target": app_path_or_name}
            )
        except Exception:
            try:
                subprocess.Popen(app_path_or_name, shell=True)
                return ActionExecutionResult(
                    success=True,
                    action="launch_app",
                    message=f"Launched command '{app_path_or_name}'",
                    data={"target": app_path_or_name}
                )
            except Exception as e:
                return ActionExecutionResult(success=False, action="launch_app", message="Launch failed", error=str(e))

    def rename_file(self, old_file_path: str, new_name_or_path: str) -> ActionExecutionResult:
        """Renames a file or folder on the local filesystem."""
        try:
            src = Path(old_file_path).resolve()
            if not src.exists():
                return ActionExecutionResult(success=False, action="rename_file", message="Source does not exist", error=f"File not found: {old_file_path}")

            if "\\" in new_name_or_path or "/" in new_name_or_path:
                dst = Path(new_name_or_path).resolve()
            else:
                dst = src.parent / new_name_or_path

            src.rename(dst)
            return ActionExecutionResult(
                success=True,
                action="rename_file",
                message=f"Successfully renamed to '{dst.name}'",
                data={"old_path": str(src), "new_path": str(dst)}
            )
        except Exception as e:
            return ActionExecutionResult(success=False, action="rename_file", message="Rename failed", error=str(e))
