"""MARIANO TUI — System status sidebar widget with live Brain HUD, Employee Card, and Notification Ticker."""
from __future__ import annotations

from textual.app import ComposeResult
from textual.widget import Widget
from textual.widgets import Label, Static
from textual.reactive import reactive


class StatusPanel(Widget):
    """Shows MARIANO system status: skills, memory, session, TCMM Brain Chemistry, Employee Card, and Live Alerts."""

    skill_count: reactive[int] = reactive(0)
    memory_count: reactive[int] = reactive(0)
    session_turns: reactive[int] = reactive(0)
    model_name: reactive[str] = reactive("gemini-3.1-flash-lite")

    def compose(self) -> ComposeResult:
        yield Static("◆ EMPLOYEE IDENTITY", classes="section-title")
        yield Label("", id="status-emp-id")
        yield Label("", id="status-emp-role")
        yield Label("", id="status-emp-success")
        
        yield Static("\n◆ SYSTEM STATUS", classes="section-title")
        yield Label("", id="status-model")
        yield Label("", id="status-skills")
        yield Label("", id="status-memory")
        yield Label("", id="status-turns")
        yield Label("", id="status-engine")
        
        yield Static("\n🧠 COGNITIVE MIND (TCMM)", classes="section-title")
        yield Label("", id="status-brain-state")

        yield Static("\n🔔 NOTIFICATION CENTER", classes="section-title")
        yield Label("", id="status-notifications")

    def on_mount(self) -> None:
        self.update_labels()
        self.update_brain_state()
        self.update_employee_card()
        self.update_notifications()
        # Periodically refresh Brain HUD, Employee metrics, and alerts ticker
        self.set_interval(1.0, self.update_brain_state)
        self.set_interval(1.0, self.update_notifications)
        self.set_interval(5.0, self.update_employee_card)

    def watch_skill_count(self, val: int) -> None:
        self.update_labels()

    def watch_memory_count(self, val: int) -> None:
        self.update_labels()

    def watch_session_turns(self, val: int) -> None:
        self.update_labels()

    def update_labels(self) -> None:
        self.query_one("#status-model", Label).update(
            f"[#445566]Model:[/] [#00d4ff]{self.model_name}[/]"
        )
        self.query_one("#status-skills", Label).update(
            f"[#445566]Skills:[/] [#00ff88]{self.skill_count} active[/]"
        )
        self.query_one("#status-memory", Label).update(
            f"[#445566]Memory:[/] [#a0d0ff]{self.memory_count} facts[/]"
        )
        self.query_one("#status-turns", Label).update(
            f"[#445566]Session:[/] [#ffaa00]{self.session_turns} turns[/]"
        )
        self.query_one("#status-engine", Label).update(
            "[#445566]Engine:[/] [#00ff88]● ONLINE[/]"
        )

    def update_brain_state(self) -> None:
        """Fetch and render the latest TCMM neurotransmitter HUD state."""
        from mariano.core.neuromodulator import Neuromodulator
        nm = Neuromodulator.get_instance()
        self.query_one("#status-brain-state", Label).update(nm.format_hud())

    def update_employee_card(self) -> None:
        """Fetch and render the latest performance metrics from CognitiveProfiler."""
        from mariano.core.cognitive_profiler import CognitiveProfiler
        cp = CognitiveProfiler.get_instance()
        stats = cp.employee.get_performance_stats()
        
        self.query_one("#status-emp-id", Label).update(
            f"[#445566]ID:[/] [#ffaa00]{stats['id']}[/]"
        )
        self.query_one("#status-emp-role", Label).update(
            f"[#445566]Role:[/] [#00d4ff]{stats['role']}[/]"
        )
        self.query_one("#status-emp-success", Label).update(
            f"[#445566]Stats:[/] [#00ff88]{stats['success_rate']}% success[/] ({stats['total_calls']} calls)"
        )

    def update_notifications(self) -> None:
        """Fetch and display the latest ticker alert from the NotificationCenter."""
        from mariano.core.notifications import NotificationCenter
        nc = NotificationCenter.get_instance()
        notif = nc.get_latest()
        if notif:
            color = "#00d4ff" if notif.severity == "info" else "#ffaa00" if notif.severity == "warning" else "#ff4444"
            self.query_one("#status-notifications", Label).update(
                f"[#445566]{notif.timestamp}[/] [{color}]{notif.title}[/]\n"
                f"[#8899aa]{notif.message[:65]}...[/]"
            )
        else:
            self.query_one("#status-notifications", Label).update("[#445566]No active alerts.[/]")
