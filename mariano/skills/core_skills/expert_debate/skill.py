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
    def get_parameters_schema(self) -> dict:
        return {
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

    def __init__(self) -> None:
        super().__init__()
        self._last_stream_result: SkillResult | None = None

    async def stream_execute(self, topic: str, rounds: int = 2, **kwargs: Any):
        self._last_stream_result = None
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
            queue: asyncio.Queue = asyncio.Queue()

            async def _event_handler(event_dict):
                await queue.put(event_dict)

            debate_task = asyncio.create_task(
                orchestrator.run_debate(topic=topic, send_event=_event_handler)
            )

            yield ("log", f"[Debate] Target: {topic} (Total Rounds: {rounds})")

            while not debate_task.done() or not queue.empty():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.1)
                    ev_type = event.get("type")
                    agent_name = event.get("agent", "Expert")
                    rnd = event.get("round", 1)

                    if ev_type == "turn_start":
                        yield ("log", f"[Round {rnd}/{rounds}] [{agent_name}] Initiating technical analysis...")
                    elif ev_type == "searching":
                        q = event.get("query", "")
                        yield ("log", f"  [Search] Round {rnd}/{rounds} [{agent_name}] Searching web for '{q}'")
                    elif ev_type == "search_results":
                        cnt = len(event.get("results", []))
                        yield ("log", f"  [Results] Round {rnd}/{rounds} [{agent_name}] Retrieved {cnt} empirical sources.")
                    elif ev_type == "turn_complete":
                        yield ("log", f"[Round {rnd}/{rounds}] [{agent_name}] Formulated technical stance & evidence.")
                    elif ev_type == "round_complete":
                        yield ("log", f"[Round {rnd}/{rounds} Done] Consensus checkpoint reached.")
                    elif ev_type == "synthesis_start":
                        yield ("log", f"[Synthesis] Formulating Joint Synthesis & Consensus Summary...")
                    elif ev_type == "synthesis_chunk":
                        synthesis_output.append(event.get("text", ""))

                    queue.task_done()
                except asyncio.TimeoutError:
                    continue

            await debate_task
            final_text = "".join(synthesis_output).strip()
            if not final_text:
                final_text = f"Expert debate completed for topic '{topic}' across {rounds} rounds."

            yield ("log", "[Synthesis Done] Expert debate completed.")
            yield ("done", 0)

            self._last_stream_result = SkillResult(
                success=True,
                data={
                    "topic": topic,
                    "rounds": rounds,
                    "synthesis": final_text
                },
                metadata={"summary": f"Completed Dual-Agent Expert Debate on '{topic}'."}
            )

        except Exception as e:
            log.error("expert_debate_skill_failed", topic=topic, error=str(e))
            yield ("log", f"[Error] Expert debate failed: {str(e)}")
            yield ("done", 1)
            self._last_stream_result = SkillResult(
                success=False,
                data=None,
                error=f"Expert debate failed: {str(e)}"
            )

    async def execute(self, topic: str, rounds: int = 2, **kwargs: Any) -> SkillResult:
        if self._last_stream_result is not None:
            res = self._last_stream_result
            self._last_stream_result = None
            return res

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
                metadata={"summary": f"Completed Dual-Agent Expert Debate on '{topic}'."}
            )
        except Exception as e:
            log.error("expert_debate_skill_failed", topic=topic, error=str(e))
            return SkillResult(
                success=False,
                data=None,
                error=f"Expert debate failed: {str(e)}"
            )
