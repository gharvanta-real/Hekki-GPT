"""
MARIANO Core Skill — Dual-Agent Expert Debate Engine
===================================================
Runs an internet-powered, multi-round technical debate between 
Tony Stark (Applied Physics/Hardware) and Bruce Banner/Shuri (Biophysics/CS).
Synthesizes the arguments into a single, concrete, joint solution path.
"""
from __future__ import annotations
import asyncio
from typing import Any
import structlog

from mariano.skills._base import BaseSkill, SkillResult
from mariano.config import get_settings
from mariano.core.debate.debate_orchestrator import DebateOrchestrator

log = structlog.get_logger(__name__)


class ExpertDebateSkill(BaseSkill):
    name = "expert_debate"
    description = (
        "Run an internet-powered Dual-Agent Expert Debate (Tony Stark vs Shuri/Bruce Banner) "
        "on any scientific, engineering, architectural, or technical topic to reach empirical "
        "consensus and generate a single joint solution."
    )
    parameters = {
        "type": "object",
        "properties": {
            "topic": {
                "type": "string",
                "description": "The exact technical topic, problem, or decision to debate."
            },
            "rounds": {
                "type": "integer",
                "description": "Number of debate rounds (default 2)."
            }
        },
        "required": ["topic"]
    }

    async def execute(self, topic: str, rounds: int = 2, **kwargs: Any) -> SkillResult:
        try:
            settings = get_settings()
            api_key = settings.active_gemini_api_key

            from mariano.core.debate.debate_config import ALPHA_MODEL, BETA_MODEL
            model_alpha = kwargs.get("model_alpha") or ALPHA_MODEL
            model_beta = kwargs.get("model_beta") or BETA_MODEL

            orchestrator = DebateOrchestrator(
                api_key=api_key,
                model_alpha=model_alpha,
                model_beta=model_beta,
                max_rounds=rounds
            )

            synthesis_output = []

            async def _event_handler(event_dict):
                if event_dict.get("type") == "synthesis_chunk":
                    synthesis_output.append(event_dict.get("text", ""))

            await orchestrator.run_debate(topic=topic, send_event=_event_handler)
            final_text = "".join(synthesis_output).strip()

            if not final_text:
                final_text = f"Expert debate completed for topic '{topic}' across {rounds} rounds."

            return SkillResult(
                success=True,
                data={
                    "topic": topic,
                    "rounds": rounds,
                    "synthesis": final_text
                },
                summary=f"Completed Dual-Agent Expert Debate on '{topic}'."
            )
        except Exception as e:
            log.error("expert_debate_skill_failed", topic=topic, error=str(e))
            return SkillResult(
                success=False,
                error=f"Expert debate failed: {str(e)}"
            )
