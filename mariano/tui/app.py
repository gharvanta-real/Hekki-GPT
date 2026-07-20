"""MARIANO TUI — Main Textual application with Boot & Calibration transitions."""
from __future__ import annotations

from textual.app import App

from mariano.tui.screens.main_screen import MainScreen
from mariano.core.agent import MarianoAgent


class MarianoApp(App):
    """MARIANO Textual application."""

    CSS_PATH = "styles/hekki.tcss"
    TITLE = "MARIANO — Lead Cognitive Sentinel"

    def __init__(self, agent: MarianoAgent) -> None:
        super().__init__()
        self.agent = agent

    def on_mount(self) -> None:
        # Start directly with the Apple-style Boot Screen
        from mariano.tui.screens.boot_screen import BootScreen
        self.push_screen(BootScreen())
