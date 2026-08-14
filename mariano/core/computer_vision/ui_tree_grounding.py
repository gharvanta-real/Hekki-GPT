"""mariano.core.computer_vision.ui_tree_grounding
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Native Windows UIAutomation accessibility tree inspector and window manager.
Allows 100% reliable UI element targeting by name/role without token consumption.
"""
from __future__ import annotations

import time
from typing import Dict, List, Optional, Tuple

try:
    import uiautomation as auto
except ImportError:
    auto = None

try:
    import pygetwindow as gw
except ImportError:
    gw = None


class UITreeGroundingEngine:
    """Inspects native OS accessibility tree to locate and interact with desktop UI controls."""

    def __init__(self, search_depth: int = 6):
        self.search_depth = search_depth

    def list_open_windows(self) -> List[Dict[str, any]]:
        """Returns a list of all visible desktop application windows."""
        windows_info = []
        if gw:
            for win in gw.getAllWindows():
                if win.title and win.visible:
                    windows_info.append({
                        "title": win.title,
                        "left": win.left,
                        "top": win.top,
                        "width": win.width,
                        "height": win.height,
                        "is_active": win.isActive,
                        "is_minimized": win.isMinimized
                    })
        return windows_info

    def focus_window(self, title_query: str) -> Dict[str, any]:
        """Brings the matching window to foreground and restores it if minimized."""
        if not gw:
            return {"status": "error", "message": "pygetwindow is not installed"}

        matches = gw.getWindowsWithTitle(title_query)
        if not matches:
            return {"status": "not_found", "message": f"No window matching '{title_query}'"}

        target_win = matches[0]
        try:
            if target_win.isMinimized:
                target_win.restore()
            target_win.activate()
            time.sleep(0.15)
            return {
                "status": "success",
                "title": target_win.title,
                "bounds": {
                    "left": target_win.left,
                    "top": target_win.top,
                    "width": target_win.width,
                    "height": target_win.height
                }
            }
        except Exception as e:
            return {"status": "error", "message": f"Failed to focus window: {e}"}

    def find_element_bounds(
        self,
        element_name: str,
        control_type: Optional[str] = None,
        timeout_seconds: float = 2.0
    ) -> Optional[Dict[str, any]]:
        """Searches Windows Accessibility Tree for matching element and returns its exact bounds."""
        if not auto:
            return None

        try:
            kwargs = {"searchDepth": self.search_depth, "Name": element_name}
            if control_type:
                kwargs["ControlType"] = getattr(auto.ControlType, control_type, None)

            control = auto.Control(**kwargs)
            if control.Exists(maxSearchSeconds=timeout_seconds):
                rect = control.BoundingRectangle
                cx = (rect.left + rect.right) // 2
                cy = (rect.top + rect.bottom) // 2
                return {
                    "found": True,
                    "name": element_name,
                    "center_x": cx,
                    "center_y": cy,
                    "bounding_box": {
                        "left": rect.left,
                        "top": rect.top,
                        "right": rect.right,
                        "bottom": rect.bottom,
                        "width": rect.width(),
                        "height": rect.height()
                    },
                    "control_type": control.ControlTypeName
                }
        except Exception:
            pass
        return None

    def click_element_by_name(
        self,
        element_name: str,
        control_type: Optional[str] = None,
        timeout: float = 2.0
    ) -> Dict[str, any]:
        """Finds control in accessibility tree and executes native click."""
        info = self.find_element_bounds(element_name, control_type, timeout_seconds=timeout)
        if not info or not info.get("found"):
            return {
                "status": "not_found",
                "message": f"Element '{element_name}' not found in accessibility tree."
            }

        if auto:
            try:
                kwargs = {"searchDepth": self.search_depth, "Name": element_name}
                control = auto.Control(**kwargs)
                if control.Exists(maxSearchSeconds=0.5):
                    control.Click()
                    return {
                        "status": "success",
                        "method": "native_uiautomation_click",
                        "target": element_name,
                        "center": (info["center_x"], info["center_y"])
                    }
            except Exception as e:
                pass

        return {
            "status": "partial",
            "message": "Element located; requires cursor navigation to center coordinates.",
            "center_x": info["center_x"],
            "center_y": info["center_y"]
        }
