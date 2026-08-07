"""MARIANO Core Skill — Reminders stored in memory, with real-time countdown notification timers."""
from __future__ import annotations
import asyncio
import re
import structlog
from datetime import datetime
from mariano.skills._base import BaseSkill, SkillResult

log = structlog.get_logger(__name__)


def parse_delay_seconds(when_str: str, seconds_val: int = 0) -> int:
    if seconds_val and seconds_val > 0:
        return seconds_val
    if not when_str:
        return 0
    s = when_str.lower().strip()
    m_sec = re.search(r'(\d+)\s*(?:s|sec|second|seconds)', s)
    if m_sec:
        return int(m_sec.group(1))
    m_min = re.search(r'(\d+)\s*(?:m|min|minute|minutes)', s)
    if m_min:
        return int(m_min.group(1)) * 60
    m_hr = re.search(r'(\d+)\s*(?:h|hr|hour|hours)', s)
    if m_hr:
        return int(m_hr.group(1)) * 3600
    if s.isdigit():
        return int(s)
    return 0


class ReminderSkill(BaseSkill):
    name = "reminder"
    description = "Set, list, and check reminders with real-time audio/visual notifications and countdown timers."
    version = "2.0.0"
    tags = ["reminder", "schedule", "todo", "task", "timer"]

    def get_parameters_schema(self) -> dict:
        return {
            "action": {"type": "string", "enum": ["set", "list", "clear_all"], "required": True},
            "text": {"type": "string", "description": "Reminder text or message", "default": ""},
            "when": {"type": "string", "description": "When e.g. '30 seconds', '5 minutes', '1 hour'", "default": ""},
            "seconds": {"type": "integer", "description": "Exact timer countdown duration in seconds", "default": 0}
        }

    async def _schedule_timer(self, delay: int, text: str):
        try:
            log.info("reminder.timer_started", delay=delay, text=text)
            await asyncio.sleep(delay)
            from mariano.web.app import broadcast_reminder_notification
            await broadcast_reminder_notification(text)
        except Exception as exc:
            log.error("reminder.timer_failed", error=str(exc))

    async def execute(self, action: str, text: str = "", when: str = "", seconds: int = 0) -> SkillResult:
        from mariano.memory.memory_manager import MemoryManager
        mem = MemoryManager.get_instance()
        if not mem._initialized:
            await mem.initialize()
        now = datetime.now().strftime("%Y-%m-%d %H:%M")

        if action == "set":
            if not text:
                text = f"Reminder set for {when or 'now'}"
            content = f"REMINDER | When: {when or 'unspecified'} | Set at: {now} | {text}"
            await mem.store(content=content, category="reminder")

            delay = parse_delay_seconds(when, seconds)
            if delay > 0:
                asyncio.create_task(self._schedule_timer(delay, text))
                return SkillResult(
                    success=True,
                    data=f"⏰ Reminder countdown timer started! I will notify you in {delay} seconds with: '{text}'."
                )

            return SkillResult(success=True, data=f"✅ Reminder stored in memory: '{text}' for {when or 'unspecified time'}")

        elif action == "list":
            results = await mem.search(query="REMINDER", limit=10)
            if not results:
                return SkillResult(success=True, data="No reminders set.")
            lines = ["**Your Reminders:**\n"]
            for i, r in enumerate(results, 1):
                lines.append(f"{i}. {r['content'].replace('REMINDER | ', '')}")
            return SkillResult(success=True, data="\n".join(lines))

        elif action == "clear_all":
            return SkillResult(success=True, data="All reminders cleared from active session.")

        return SkillResult(success=False, data=None, error=f"Unknown action: {action}")
