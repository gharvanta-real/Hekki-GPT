"""desktop_vision_control — Autonomous GUI & Computer Vision Control Skill.

Enables Hekki Assistant to inspect the screen, smoothly glide the cursor,
click elements by coordinates or accessibility names, type text, execute hotkeys,
open applications, manage windows, and rename files.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict

from mariano.skills._base.skill_interface import BaseSkill, SkillResult
from mariano.core.computer_vision import ComputerVisionController


class DesktopVisionControlSkill(BaseSkill):
    name = "desktop_vision_control"
    description = (
        "Autonomous Computer Use & Vision GUI Controller. Use this to control the desktop: "
        "smoothly move cursor, click, double-click, right-click, type text, press keyboard shortcuts, "
        "click UI buttons by name, focus windows, launch apps, capture screen, and rename files."
    )
    version = "1.0.0"
    tags = ["computer_use", "vision", "gui", "cursor", "keyboard", "automation", "desktop"]
    enabled = False  # Temporarily disabled per user request without removing any code

    def __init__(self):
        super().__init__()
        self._controller = ComputerVisionController()

    async def execute(self, **kwargs: Any) -> SkillResult:
        if not getattr(self, "enabled", True):
            return SkillResult(
                success=False,
                data="Desktop Vision Control is temporarily disabled.",
                error="Computer Vision is currently disabled."
            )

        action = kwargs.get("action", "").lower().strip()
        if not action:
            return SkillResult(
                success=False,
                data=None,
                error="Parameter 'action' is required (e.g. 'click', 'type_text', 'hotkey', 'launch_app', 'capture_screen')."
            )

        try:
            # ── 1. Screen Capture & State ─────────────────────────────────────
            if action in ("capture_screen", "screenshot"):
                filename = kwargs.get("filename")
                res = self._controller.capture_screen(filename=filename)
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            if action in ("get_state", "status", "info"):
                state = self._controller.get_state()
                return SkillResult(success=True, data=state, metadata=state)

            # ── 2. Cursor Actions ─────────────────────────────────────────────
            if action == "move_cursor":
                x = int(kwargs.get("x", 0))
                y = int(kwargs.get("y", 0))
                res = self._controller.move_cursor(x, y)
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            if action in ("click", "left_click"):
                x = kwargs.get("x")
                y = kwargs.get("y")
                clicks = int(kwargs.get("clicks", 1))
                res = self._controller.click(
                    x=int(x) if x is not None else None,
                    y=int(y) if y is not None else None,
                    button="left",
                    clicks=clicks
                )
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            if action == "double_click":
                x = kwargs.get("x")
                y = kwargs.get("y")
                res = self._controller.double_click(
                    x=int(x) if x is not None else None,
                    y=int(y) if y is not None else None
                )
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            if action in ("right_click", "context_menu"):
                x = kwargs.get("x")
                y = kwargs.get("y")
                res = self._controller.right_click(
                    x=int(x) if x is not None else None,
                    y=int(y) if y is not None else None
                )
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            if action == "scroll":
                amount = int(kwargs.get("amount", -300))
                res = self._controller.scroll(amount)
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            # ── 3. Keyboard Actions ───────────────────────────────────────────
            if action in ("type_text", "type", "write"):
                text = kwargs.get("text", "")
                press_enter = bool(kwargs.get("press_enter", False))
                res = self._controller.type_text(text, press_enter=press_enter)
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            if action in ("hotkey", "press_keys", "shortcut"):
                keys = kwargs.get("keys", [])
                if isinstance(keys, str):
                    keys = [k.strip() for k in keys.split("+")]
                res = self._controller.press_hotkey(*keys)
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            # ── 4. Native Accessibility Tree & Window Actions ─────────────────
            if action in ("click_by_name", "click_element"):
                name = kwargs.get("element_name", kwargs.get("name", ""))
                ctrl_type = kwargs.get("control_type")
                res = self._controller.click_element_by_name(name, control_type=ctrl_type)
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            if action in ("focus_window", "switch_window"):
                title = kwargs.get("window_title", kwargs.get("title", ""))
                res = self._controller.focus_window(title)
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            # ── 5. OS Apps & File Actions ─────────────────────────────────────
            if action in ("launch_app", "open_app", "run_app"):
                app_target = kwargs.get("app_path", kwargs.get("target", ""))
                res = self._controller.launch_app(app_target)
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            if action in ("rename_file", "rename"):
                old_path = kwargs.get("old_path", "")
                new_name = kwargs.get("new_name", "")
                res = self._controller.rename_file(old_path, new_name)
                return SkillResult(success=res.success, data=res.message, metadata=res.data, error=res.error)

            return SkillResult(
                success=False,
                data=None,
                error=f"Unsupported computer control action: '{action}'"
            )

        except Exception as e:
            return SkillResult(
                success=False,
                data=None,
                error=f"Error executing computer vision action '{action}': {e}"
            )

    def get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": [
                        "click",
                        "double_click",
                        "right_click",
                        "move_cursor",
                        "type_text",
                        "hotkey",
                        "scroll",
                        "click_by_name",
                        "focus_window",
                        "launch_app",
                        "rename_file",
                        "capture_screen",
                        "get_state"
                    ],
                    "description": "The atomic computer use action to perform."
                },
                "x": {"type": "integer", "description": "Target X screen coordinate."},
                "y": {"type": "integer", "description": "Target Y screen coordinate."},
                "text": {"type": "string", "description": "Text to type via keyboard."},
                "press_enter": {"type": "boolean", "description": "Whether to press Enter after typing text."},
                "keys": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of key names for hotkey combinations, e.g. ['ctrl', 'c'] or ['alt', 'tab']."
                },
                "element_name": {"type": "string", "description": "Name/title of UI element to click via accessibility tree."},
                "window_title": {"type": "string", "description": "Title keyword of application window to focus."},
                "app_path": {"type": "string", "description": "Application executable name or file path to open."},
                "old_path": {"type": "string", "description": "Current file path for renaming."},
                "new_name": {"type": "string", "description": "New filename or target path for renaming."},
                "clicks": {"type": "integer", "description": "Number of mouse clicks (1 or 2)."},
                "amount": {"type": "integer", "description": "Scroll wheel click amount (positive=up, negative=down)."}
            },
            "required": ["action"]
        }
