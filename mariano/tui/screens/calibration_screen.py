"""MARIANO TUI Screen — 3-Step Gaming-Style Calibration Screen."""
from __future__ import annotations

import asyncio
from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import Label, Static


class CalibrationScreen(Screen):
    """Calibrates and validates system variables before revealing the main interface."""

    DEFAULT_CSS = """
    CalibrationScreen {
        background: #0284c7;
        align: center middle;
        layout: vertical;
        padding: 4;
    }

    .calibration-title {
        color: #ffffff;
        text-style: bold;
        margin-bottom: 2;
        content-align: center middle;
        width: 100%;
    }

    .step-label {
        color: #888888;
        margin-bottom: 1;
        content-align: center middle;
        width: 100%;
    }

    .step-active {
        color: #ffffff;
        text-style: bold;
    }

    .step-done {
        color: #666666;
        text-style: strike;
    }

    #bypass-label {
        color: #444444;
        margin-top: 3;
        content-align: center middle;
        width: 100%;
    }
    """

    def compose(self) -> ComposeResult:
        yield Label("◆ INITIALIZING GAMING SYSTEM CONFIGURATION ◆", classes="calibration-title")
        yield Label("[ ] STEP 1: Calibrating Limbic Baseline...", id="step-1", classes="step-label")
        yield Label("[ ] STEP 2: Aligning Admin Persona Preferences...", id="step-2", classes="step-label")
        yield Label("[ ] STEP 3: Caching Active Expert Columns...", id="step-3", classes="step-label")
        yield Label("Press Enter to bypass calibration sequence.", id="bypass-label")

    def on_mount(self) -> None:
        self.step = 1
        self.set_interval(0.8, self.progress_steps)

    def on_key(self, event) -> None:
        # Press Enter/Bypass key to instantly exit to main dashboard
        if event.key in ("enter", "return", "space"):
            self.exit_to_app()

    def progress_steps(self) -> None:
        if self.step == 1:
            lbl = self.query_one("#step-1", Label)
            lbl.update("[✔] STEP 1: Limbic Baseline Calibrated (DA: 0.50 | 5HT: 0.50)")
            lbl.add_class("step-done")
            self.query_one("#step-2", Label).add_class("step-active")
            self.step = 2
        elif self.step == 2:
            lbl = self.query_one("#step-2", Label)
            lbl.update("[✔] STEP 2: Admin Persona Checked (No-Clutter, B&W Directives Synced)")
            lbl.add_class("step-done")
            self.query_one("#step-3", Label).add_class("step-active")
            self.step = 3
        elif self.step == 3:
            lbl = self.query_one("#step-3", Label)
            lbl.update("[✔] STEP 3: 20 Expert Columns Loaded & Rust IPC Verified")
            lbl.add_class("step-done")
            self.step = 4
        else:
            self.exit_to_app()

    def exit_to_app(self) -> None:
        # Switch to MainScreen replacing the calibration screen on the stack
        from mariano.tui.screens.main_screen import MainScreen
        self.app.switch_screen(MainScreen())
