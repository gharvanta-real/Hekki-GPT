"""MARIANO TUI Screen — Stealth Apple-style Boot Screen."""
from __future__ import annotations

import asyncio
from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import Label, ProgressBar, Static


class BootScreen(Screen):
    """Initial loading screen representing a clean, hardware-style bootstrap sequence."""

    DEFAULT_CSS = """
    BootScreen {
        background: #0284c7;
        align: center middle;
        layout: vertical;
        padding: 4;
    }

    #boot-logo {
        color: #ffffff;
        text-style: bold;
        content-align: center middle;
        margin-bottom: 2;
        height: 6;
        width: 100%;
    }

    #boot-progress {
        width: 60%;
        height: auto;
        color: #ffffff;
        background: #000000;
        margin-bottom: 2;
    }

    #boot-log {
        color: #888888;
        content-align: center middle;
        width: 100%;
        height: 3;
    }
    """

    def compose(self) -> ComposeResult:
        ascii_logo = (
            "  __  __    _    ____  ___    _    _   _  ___\n"
            " |  \\/  |  / \\  |  _ \\|_ _|  / \\  | \\ | |/ _ \\\n"
            " | |\\/| | / _ \\ | |_) || |  / _ \\ |  \\| | | | |\n"
            " | |  | |/ ___ \\|  _ < | | / ___ \\| |\\  | |_| |\n"
            " |_|  |_/_/   \\_\\_| \\_\\___/_/   \\_\\_| \\_|\\___/\n"
        )
        yield Static(ascii_logo, id="boot-logo")
        yield ProgressBar(id="boot-progress", total=100, show_bar=True, show_percentage=True)
        yield Label("BOOT SEQUENCE INITIATED...", id="boot-log")

    def on_mount(self) -> None:
        self.progress_val = 0
        self.log_widget = self.query_one("#boot-log", Label)
        self.bar_widget = self.query_one("#boot-progress", ProgressBar)
        self.set_interval(0.04, self.tick_progress)

    async def tick_progress(self) -> None:
        if self.progress_val >= 100:
            self.progress_val = 100
            # Deactivate timer and trigger transition
            self.log_widget.update("COGNITIVE VAULT SYNCHRONIZED. INITIATING CALIBRATION...")
            await asyncio.sleep(0.5)
            
            # Transition to CalibrationScreen
            from mariano.tui.screens.calibration_screen import CalibrationScreen
            self.app.push_screen(CalibrationScreen())
            return

        self.progress_val += 2
        self.bar_widget.progress = self.progress_val

        # Process log statements mapping to progress values
        if self.progress_val < 20:
            self.log_widget.update("Loading TCMM synaptic baselines...")
        elif self.progress_val < 40:
            self.log_widget.update("Establishing connection to Rust core (TCP 57312)...")
        elif self.progress_val < 60:
            self.log_widget.update("Scanning local package registry and dependency paths...")
        elif self.progress_val < 80:
            self.log_widget.update("Retrieving user profile and historical preferences...")
        elif self.progress_val < 95:
            self.log_widget.update("Compiling dynamic modules & sanitizing pipelines...")
        else:
            self.log_widget.update("Gating neural routes...")
