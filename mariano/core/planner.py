"""MARIANO — Task decomposition planner."""
from __future__ import annotations

import json

import structlog

from mariano.gemini.client import GeminiClient
from mariano.config import PLANNER_PROMPT

log = structlog.get_logger(__name__)


class TaskPlan:
    def __init__(self, goal: str, steps: list[str], tools: list[str], complexity: str) -> None:
        self.goal = goal
        self.steps = steps
        self.tools = tools
        self.complexity = complexity

    def __str__(self) -> str:
        steps_str = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(self.steps))
        return f"Goal: {self.goal}\nComplexity: {self.complexity}\nSteps:\n{steps_str}\nTools: {', '.join(self.tools)}"


class Planner:
    """Decomposes complex tasks into executable steps."""

    def __init__(self, gemini: GeminiClient) -> None:
        self._gemini = gemini

    async def plan(self, user_input: str, available_tools: list[str]) -> TaskPlan:
        prompt = (
            f"User request: {user_input}\n"
            f"Available tools: {', '.join(available_tools)}\n"
            "Output JSON: {{\"goal\": str, \"steps\": [str], \"tools\": [str], \"complexity\": \"LOW|MEDIUM|HIGH\"}}"
        )
        try:
            raw = await self._gemini.complete(prompt=prompt, system_override=PLANNER_PROMPT)
            # Extract JSON from response
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(raw[start:end])
            else:
                raise ValueError("No JSON in response")
            return TaskPlan(
                goal=data.get("goal", user_input),
                steps=data.get("steps", ["Execute the request"]),
                tools=data.get("tools", []),
                complexity=data.get("complexity", "MEDIUM"),
            )
        except Exception as exc:
            log.warning("planner.failed", error=str(exc))
            return TaskPlan(
                goal=user_input,
                steps=["Execute the request directly"],
                tools=[],
                complexity="LOW",
            )
