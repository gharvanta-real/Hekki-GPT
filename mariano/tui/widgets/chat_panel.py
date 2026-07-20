"""MARIANO TUI — Chat display widget."""
from __future__ import annotations

from textual.app import ComposeResult
from textual.widget import Widget
from textual.widgets import RichLog
from rich.text import Text
from rich.panel import Panel
from rich.markdown import Markdown


class ChatPanel(Widget):
    """Displays the full conversation with MARIANO."""

    DEFAULT_CSS = ""

    def compose(self) -> ComposeResult:
        yield RichLog(id="chat-log", markup=True, highlight=True, wrap=True)

    def _log(self) -> RichLog:
        return self.query_one("#chat-log", RichLog)

    def add_user_message(self, text: str) -> None:
        log = self._log()
        log.write(Text.from_markup(f"[bold #a0d0ff]YOU ❯[/] {text}"))
        log.write("")

    def add_assistant_message(self, text: str) -> None:
        log = self._log()
        log.write(Text.from_markup("[bold #00d4ff]MARIANO ◆[/]"))
        log.write(Markdown(text))
        log.write("")

    def add_thinking(self, text: str) -> None:
        log = self._log()
        log.write(Text.from_markup(f"[#445566 italic]  ⟳ {text}[/]"))

    def add_tool_call(self, tool: str, args: dict) -> None:
        log = self._log()
        arg_str = " | ".join(f"{k}={str(v)[:40]}" for k, v in args.items())
        log.write(Text.from_markup(f"[#ffaa00]  ⚡ {tool}[/] [#445566]{arg_str}[/]"))

    def add_tool_result(self, tool: str, result: str, success: bool, time_ms: float) -> None:
        log = self._log()
        icon = "✓" if success else "✗"
        color = "#00ff88" if success else "#ff4444"
        preview = result[:120].replace("\n", " ")
        log.write(Text.from_markup(f"  [{color}]{icon} {tool}[/] [#445566]({time_ms:.0f}ms) {preview}...[/]"))

    def add_error(self, text: str) -> None:
        log = self._log()
        log.write(Text.from_markup(f"[bold #ff4444]  ✗ ERROR:[/] {text}"))
        log.write("")

    def add_separator(self) -> None:
        self._log().write(Text.from_markup("[#1a2a3a]" + "─" * 60 + "[/]"))
