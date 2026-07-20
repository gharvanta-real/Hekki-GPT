"""MARIANO Core Skill — Reminders stored in memory and listed."""
from __future__ import annotations
import asyncio
from datetime import datetime
from mariano.skills._base import BaseSkill, SkillResult

class ReminderSkill(BaseSkill):
    name = "reminder"
    description = "Set, list, and check reminders. Stores reminders in MARIANO's memory with timestamps."
    version = "1.0.0"
    tags = ["reminder", "schedule", "todo", "task"]

    def get_parameters_schema(self) -> dict:
        return {
            "action": {"type": "string", "enum": ["set", "list", "clear_all"], "required": True},
            "text": {"type": "string", "description": "Reminder text", "default": ""},
            "when": {"type": "string", "description": "When e.g. '5pm', 'tomorrow', '2026-07-07 18:00'", "default": ""},
        }

    async def execute(self, action: str, text: str = "", when: str = "") -> SkillResult:
        from mariano.memory.memory_manager import MemoryManager
        mem = MemoryManager.get_instance()
        now = datetime.now().strftime("%Y-%m-%d %H:%M")

        if action == "set":
            if not text: return SkillResult(success=False, data=None, error="Reminder text required")
            content = f"REMINDER | When: {when or 'unspecified'} | Set at: {now} | {text}"
            await mem.store(content=content, category="reminder")
            return SkillResult(success=True, data=f"✅ Reminder set: '{text}' for {when or 'unspecified time'}")

        elif action == "list":
            results = await mem.search(query="REMINDER", limit=10)
            if not results: return SkillResult(success=True, data="No reminders set.")
            lines = ["**Your Reminders:**\n"]
            for i, r in enumerate(results, 1):
                lines.append(f"{i}. {r['content'].replace('REMINDER | ', '')}")
            return SkillResult(success=True, data="\n".join(lines))

        elif action == "clear_all":
            return SkillResult(success=True, data="(Use memory_ops to manage reminders in detail)")

        return SkillResult(success=False, data=None, error=f"Unknown action: {action}")
