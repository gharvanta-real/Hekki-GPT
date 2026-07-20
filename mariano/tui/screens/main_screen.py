"""MARIANO TUI — Main screen. The primary interface with Telemetry Wave & Voice Control."""
from __future__ import annotations

import asyncio
from pathlib import Path
from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import Header, Footer, Input, Static
from textual.containers import Horizontal, Vertical

from mariano.tui.widgets.chat_panel import ChatPanel
from mariano.tui.widgets.status_bar import StatusPanel
from mariano.tui.widgets.tool_trace import ToolTracePanel
from mariano.tui.widgets.wave_widget import TelemetryWaveWidget
from mariano.core.voice_control import VoiceController
from mariano.core.notifications import NotificationCenter


class MainScreen(Screen):
    """Primary MARIANO interface screen."""

    BINDINGS = [
        ("ctrl+c", "quit", "Quit"),
        ("ctrl+l", "clear", "Clear"),
        ("ctrl+v", "toggle_voice", "Voice Command"),
    ]

    def compose(self) -> ComposeResult:
        with Vertical():
            with Horizontal(id="header"):
                yield Static("◆ MARIANO", id="header-title", classes="label-primary")
                yield Static("LEAD COGNITIVE SENTINEL [M-001]", id="header-status", classes="label-dim")
            
            # Stippled waveform telemetry spanning full width (Stark look)
            yield TelemetryWaveWidget()

            with Horizontal(id="main-layout"):
                yield ChatPanel(id="chat-panel")
                with Vertical(id="side-panel"):
                    yield StatusPanel(id="status-panel")
                    yield ToolTracePanel(id="tool-trace-panel")
            
            with Horizontal(id="input-bar"):
                yield Input(
                    placeholder="Ask MARIANO... [Ctrl+V for Voice Command]",
                    id="user-input",
                )

    def on_mount(self) -> None:
        self.query_one("#user-input", Input).focus()
        chat = self.query_one("#chat-panel", ChatPanel)
        chat.add_assistant_message(
            "MARIANO online. All systems active.\n"
            "Press [Ctrl+V] to speak your command, or type below."
        )

    async def action_toggle_voice(self) -> None:
        """Toggles audio recording state and pushes transcription to input."""
        vc = VoiceController.get_instance()
        input_widget = self.query_one("#user-input", Input)
        nc = NotificationCenter.get_instance()

        if not vc.is_recording():
            # Start Recording
            vc.start_recording()
            input_widget.placeholder = "🔴 [LISTENING... Speak command. Press Ctrl+V to finish]"
            input_widget.disabled = True
            nc.push_notification("Voice Control", "Microphone active. Recording command...", "info")
        else:
            # Stop Recording and Transcribe
            input_widget.placeholder = "⏳ [TRANSCRIBING AUDIO COMMAND...]"
            wav_path = vc.stop_recording()
            
            if wav_path:
                transcript = await vc.transcribe_audio(wav_path)
                if transcript:
                    input_widget.value = transcript
                    nc.push_notification("Voice Control", f"Transcribed: '{transcript}'", "info")
                else:
                    nc.push_notification("Voice Control", "Speech transcription returned empty.", "warning")
            
            # Restore state
            input_widget.placeholder = "Ask MARIANO... [Ctrl+V for Voice Command]"
            input_widget.disabled = False
            input_widget.focus()

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        text = event.value.strip()
        if not text:
            return
        event.input.clear()
        await self.process_input(text)

    async def process_input(self, text: str) -> None:
        chat = self.query_one("#chat-panel", ChatPanel)
        trace = self.query_one("#tool-trace-panel", ToolTracePanel)
        status = self.query_one("#status-panel", StatusPanel)

        chat.add_user_message(text)
        chat.add_separator()
        status.session_turns += 1

        agent = self.app.agent
        full_response = ""

        async for event in agent.run(text):
            if event.kind == "thinking":
                chat.add_thinking(event.data)
            elif event.kind == "tool_call":
                chat.add_tool_call(event.data, event.metadata.get("args", {}))
                trace.log_call(event.data, event.metadata.get("args", {}))
            elif event.kind == "tool_result":
                tool = event.metadata.get("tool", "?")
                success = event.metadata.get("success", True)
                time_ms = event.metadata.get("time_ms", 0)
                chat.add_tool_result(tool, event.data, success, time_ms)
                trace.log_result(tool, success, time_ms)
            elif event.kind == "response":
                full_response = event.data
                chat.add_assistant_message(event.data)
            elif event.kind == "error":
                chat.add_error(event.data)
                trace.log_error(event.data)

        chat.add_separator()

    def action_clear(self) -> None:
        self.query_one("#chat-panel", ChatPanel).query_one("#chat-log").clear()
        self.query_one("#tool-trace-panel", ToolTracePanel).query_one("#trace-log").clear()
