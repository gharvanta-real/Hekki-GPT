"""MARIANO TUI — Live tool execution trace widget."""
from __future__ import annotations

from textual.app import ComposeResult
from textual.widget import Widget
from textual.widgets import RichLog, Static
from rich.text import Text


class ToolTracePanel(Widget):
    """Real-time trace of tool calls and results."""

    def compose(self) -> ComposeResult:
        yield Static("⚡ TOOL TRACE", classes="section-title")
        yield RichLog(id="trace-log", markup=True, highlight=False, wrap=True)

    def _log(self) -> RichLog:
        return self.query_one("#trace-log", RichLog)

    def log_call(self, tool: str, args: dict) -> None:
        arg_str = str(args)[:80]
        self._log().write(Text.from_markup(f"[#ffaa00]→ {tool}[/] [#333]({arg_str})[/]"))

    def log_result(self, tool: str, success: bool, time_ms: float) -> None:
        icon = "✓" if success else "✗"
        color = "#00ff88" if success else "#ff4444"
        self._log().write(Text.from_markup(f"  [{color}]{icon}[/] [#445566]{tool} {time_ms:.0f}ms[/]"))

    def log_error(self, msg: str) -> None:
        self._log().write(Text.from_markup(f"[#ff4444]✗ {msg}[/]"))
