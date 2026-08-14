"""mariano.core.computer_vision.keyboard_engine
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Human-cadence keystroke typing, hotkey combinations, and clipboard injection.
"""
from __future__ import annotations

import random
import time
from typing import Dict, List, Optional, Union

try:
    import pyautogui
except ImportError:
    pyautogui = None


class KeyboardAutomationEngine:
    """Manages keyboard typing, hotkey sequences, and fast text insertion."""

    def __init__(self, default_interval: float = 0.035):
        self.default_interval = default_interval

    def type_text(
        self,
        text: str,
        press_enter: bool = False,
        interval: Optional[float] = None,
        use_human_jitter: bool = True
    ) -> Dict[str, any]:
        """Types string with realistic human keystroke intervals."""
        if not pyautogui:
            return {"status": "error", "message": "pyautogui is not installed"}

        base_int = interval if interval is not None else self.default_interval

        if not use_human_jitter:
            pyautogui.write(text, interval=base_int)
        else:
            for char in text:
                pyautogui.write(char)
                # Subtle human jitter between 20ms and 60ms
                jitter = random.uniform(0.015, 0.055)
                time.sleep(jitter)

        if press_enter:
            time.sleep(0.1)
            pyautogui.press("enter")

        return {
            "status": "success",
            "action": "type_text",
            "length": len(text),
            "press_enter": press_enter
        }

    def press_key(self, key_name: str, presses: int = 1, interval: float = 0.05) -> Dict[str, any]:
        """Presses a single key (e.g. 'enter', 'tab', 'esc', 'backspace', 'up', 'down')."""
        if not pyautogui:
            return {"status": "error", "message": "pyautogui is not installed"}

        pyautogui.press(key_name, presses=presses, interval=interval)
        return {
            "status": "success",
            "action": "press_key",
            "key": key_name,
            "presses": presses
        }

    def execute_hotkey(self, *keys: str) -> Dict[str, any]:
        """Executes a key combination (e.g. ['ctrl', 'c'], ['alt', 'tab'], ['win', 'r'])."""
        if not pyautogui:
            return {"status": "error", "message": "pyautogui is not installed"}

        normalized_keys = [str(k).lower().strip() for k in keys if str(k).strip()]
        if not normalized_keys:
            return {"status": "error", "message": "No keys specified"}

        pyautogui.hotkey(*normalized_keys)
        return {
            "status": "success",
            "action": "hotkey",
            "keys": normalized_keys
        }

    def paste_long_text(self, text: str, press_enter: bool = False) -> Dict[str, any]:
        """Pastes large blocks of text instantly via clipboard (much faster than typing 1000 characters)."""
        if not pyautogui:
            return {"status": "error", "message": "pyautogui is not installed"}

        try:
            import pyperclip
            pyperclip.copy(text)
            time.sleep(0.05)
            pyautogui.hotkey("ctrl", "v")
            if press_enter:
                time.sleep(0.05)
                pyautogui.press("enter")
            return {
                "status": "success",
                "action": "paste_text",
                "length": len(text)
            }
        except ImportError:
            # Fallback to standard typing if pyperclip is not installed
            return self.type_text(text, press_enter=press_enter)
