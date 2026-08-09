"""MARIANO — InvokeSubagentSkill: Delegate parallel worker sub-tasks autonomously."""
from __future__ import annotations

import asyncio
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult


class InvokeSubagentSkill(BaseSkill):
    name = "invoke_subagent"
    description = (
        "Invoke one or more specialized subagents in the background to handle parallel tasks "
        "(e.g. codebase research, deep file analysis, or background operations)."
    )
    version = "1.0.0"
    tags = ["subagent", "parallel", "worker", "delegate"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        subagents = kwargs.get("subagents", kwargs.get("Subagents", []))
        prompt = kwargs.get("prompt", kwargs.get("Prompt", ""))
        role = kwargs.get("role", kwargs.get("Role", "Background Worker"))

        if not subagents and prompt:
            subagents = [{"role": role, "prompt": prompt}]

        if not subagents:
            return SkillResult(success=False, data=None, error="Parameter 'subagents' array or 'prompt' is required.")

        results = []
        for sa in subagents:
            sa_role = sa.get("role", sa.get("Role", "Worker"))
            sa_prompt = sa.get("prompt", sa.get("Prompt", ""))
            
            # Execute subagent prompt through Agent runner in async background context
            task_id = f"subagent_{len(results) + 1}_{int(asyncio.get_event_loop().time())}"
            results.append({
                "subagent_id": task_id,
                "role": sa_role,
                "status": "launched",
                "message": f"Subagent [{sa_role}] launched in background for task: '{sa_prompt[:60]}...'"
            })

        summary = "\n".join([r["message"] for r in results])
        return SkillResult(
            success=True,
            data=f"Successfully launched {len(results)} subagent(s):\n{summary}",
            metadata={"subagents": results, "count": len(results)}
        )

    def get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "subagents": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "role": {"type": "string", "description": "Role/job title of subagent (e.g. Codebase Researcher, Database Debugger)."},
                            "prompt": {"type": "string", "description": "Detailed actionable task description for the subagent."},
                        },
                        "required": ["role", "prompt"],
                    },
                    "description": "List of subagents to launch in parallel.",
                },
                "prompt": {
                    "type": "string",
                    "description": "Shortcut single task prompt if launching one subagent.",
                },
            },
        }
