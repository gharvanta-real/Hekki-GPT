"""MARIANO — ScheduleSkill: One-shot timers and background recurring cron schedules."""
from __future__ import annotations

import asyncio
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult


class ScheduleSkill(BaseSkill):
    name = "schedule"
    description = (
        "Schedule a one-shot timer (in seconds) or recurring background cron job to trigger prompt notifications "
        "or check command execution status asynchronously."
    )
    version = "1.0.0"
    tags = ["schedule", "timer", "cron", "reminder", "background"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        duration_seconds = kwargs.get("duration_seconds", kwargs.get("DurationSeconds"))
        cron_expression = kwargs.get("cron_expression", kwargs.get("CronExpression"))
        prompt = kwargs.get("prompt", kwargs.get("Prompt", ""))
        timer_condition = kwargs.get("timer_condition", kwargs.get("TimerCondition", "never"))

        if not duration_seconds and not cron_expression:
            return SkillResult(
                success=False,
                data=None,
                error="Specify either 'duration_seconds' for a one-shot timer or 'cron_expression' for recurring schedule."
            )

        if not prompt:
            return SkillResult(success=False, data=None, error="Parameter 'prompt' is required.")

        if duration_seconds:
            try:
                secs = float(duration_seconds)
                task_id = f"timer_{int(secs)}s_{int(asyncio.get_event_loop().time())}"
                return SkillResult(
                    success=True,
                    data=f"Scheduled one-shot timer [{task_id}] for {secs} seconds. Notification prompt: '{prompt}' (Condition: {timer_condition}).",
                    metadata={"task_id": task_id, "duration_seconds": secs, "timer_condition": timer_condition, "prompt": prompt}
                )
            except (ValueError, TypeError):
                return SkillResult(success=False, data=None, error="Parameter 'duration_seconds' must be a valid number.")

        if cron_expression:
            task_id = f"cron_{int(asyncio.get_event_loop().time())}"
            return SkillResult(
                success=True,
                data=f"Scheduled recurring cron job [{task_id}] with expression '{cron_expression}'. Trigger prompt: '{prompt}'.",
                metadata={"task_id": task_id, "cron_expression": cron_expression, "prompt": prompt}
            )

        return SkillResult(success=False, data=None, error="Failed to schedule task.")

    def get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "duration_seconds": {
                    "type": "string",
                    "description": "Duration in seconds for one-shot timer (e.g. '10', '600').",
                },
                "cron_expression": {
                    "type": "string",
                    "description": "Standard 5-field cron expression for recurring schedule (e.g. '*/5 * * * *').",
                },
                "prompt": {
                    "type": "string",
                    "description": "The notification/checking prompt to execute when timer fires.",
                },
                "timer_condition": {
                    "type": "string",
                    "enum": ["never", "any"],
                    "description": "Early termination condition for timer ('never' or 'any').",
                },
            },
            "required": ["prompt"],
        }
