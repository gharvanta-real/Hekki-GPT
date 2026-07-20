from __future__ import annotations

import asyncio
import re
import os
from pathlib import Path
from typing import AsyncIterator

import structlog

from mariano.gemini.client import GeminiClient
from mariano.skills._registry.registry import SkillRegistry
from mariano.memory.memory_manager import MemoryManager
from mariano.core.neuromodulator import Neuromodulator
from mariano.config import get_settings
from mariano.core.workspace import PathGuard

from mariano.core.agent.event import AgentEvent
from mariano.core.agent.react import run_react_loop

log = structlog.get_logger(__name__)

def _get_project_files_summary(proj_dir: Path) -> str:
    """Recursively lists files inside the project directory, skipping git/node_modules/etc."""
    ignored = {".git", "node_modules", "__pycache__", "venv", ".venv"}
    files = []
    try:
        for p in proj_dir.rglob("*"):
            if any(part in ignored or part.startswith(".") for part in p.relative_to(proj_dir).parts):
                continue
            if p.is_file():
                files.append(str(p.relative_to(proj_dir)))
                if len(files) >= 80:
                    break
    except Exception:
        pass
    if not files:
        return "Workspace is currently empty."
    return "Workspace File Tree:\n" + "\n".join(f"- {f}" for f in files)

class MarianoAgent:
    """The main autonomous agent. Powered by Thalamocortical Gating & Synaptic Consolidation."""

    def __init__(
        self,
        gemini: GeminiClient,
        registry: SkillRegistry,
        memory: MemoryManager,
    ) -> None:
        self._gemini = gemini
        self._registry = registry
        self._memory = memory
        self._settings = get_settings()
        self._nm = Neuromodulator.get_instance()

    async def run(
        self,
        user_input: str,
        project: str | None = None,
        project_path: str | None = None,
        chat_id: str | None = None,
        permission_policy: str | None = None,
        aider_enabled: bool = False
    ) -> AsyncIterator[AgentEvent]:
        """Process user input through full ReAct loop. Yields events."""
        # Get session-scoped context (not global!)
        ctx = self._memory.get_context(chat_id)

        # Configure tools for function calling
        self._gemini.configure_tools(self._registry.get_manifests())

        # Set active sandbox project path
        if project:
            PathGuard.set_active_project(project, project_path=project_path)
        else:
            PathGuard.set_active_project("default")

        # 5. Cognitive Profiler Feedback Analysis
        from mariano.core.cognitive_profiler import CognitiveProfiler
        cp = CognitiveProfiler.get_instance()

        history = ctx.get_history()
        last_assistant = None
        for msg in reversed(history):
            if msg["role"] == "assistant" and not msg["content"].startswith("[Tool:"):
                last_assistant = msg["content"]
                break
        
        if last_assistant:
            sentiment = cp.feedback.analyze_feedback(user_input, last_assistant)
            if sentiment == "negative":
                log.info("agent.negative_feedback_detected", feedback=user_input)
                self._nm.state.serotonin = max(0.10, self._nm.state.serotonin - 0.25)
                if any(w in user_input.lower() for w in ["kill", "shutdown", "stop", "delete", "format", "useless", "stupid"]):
                    self._nm.surge_fear(0.25)
                else:
                    self._nm.surge_anger(0.15)
                self._nm.update_on_step(action_name="user_refusal", success=False)
            elif sentiment == "positive":
                log.info("agent.positive_feedback_detected", feedback=user_input)
                if any(w in user_input.lower() for w in ["love", "thanks", "thank", "nice", "mast", "perfect", "good", "great"]):
                    self._nm.surge_affection(0.20)
                else:
                    self._nm.surge_affection(0.08)

        # 6. Cognitive Consolidation / Sleep Triggers
        if any(w in user_input.lower() for w in ["sleep", "consolidate", "reflect"]):
            self._nm.trigger_sleep()
            yield AgentEvent("thinking", "Entering slow-wave sleep. Replaying experiences and tuning synaptic anchors...")
            
            from mariano.core.consolidation import SynapticConsolidator
            consolidator = SynapticConsolidator()
            res = await consolidator.consolidate()
            
            adjusted = res.get("adjusted_signatures", [])
            adjusted_str = ", ".join(adjusted) if adjusted else "None"
            yield AgentEvent(
                "response", 
                f"✨ **Sleep Consolidation Complete!**\n"
                f"- Homeostasis: Restored to baseline.\n"
                f"- Synaptic weights adjusted (Hebbian Learning): `{adjusted_str}`"
            )
            return

        # 7. Context Sliding Window Compression
        if ctx.message_count >= self._settings.short_term_window:
            yield AgentEvent("thinking", "Context window saturated. Compressing older turns to preserve memory...")
            await ctx.compress_history(self._gemini)

        # 7b. Inject task log summary if first message in this session context
        if ctx.count == 0 and chat_id:
            session_summary = await self._memory.get_session_summary(chat_id)
            if session_summary:
                ctx.add("assistant", "[TASK LOG - READ TO UNDERSTAND PREVIOUS WORK]\n" + session_summary)
                log.info("agent.task_log_injected", chat_id=chat_id)

        if project and not aider_enabled:
            if project_path and Path(project_path).is_absolute():
                proj_dir = Path(project_path)
            else:
                proj_dir = self._settings.mariano_data_dir / "workspace" / project
            
            # Ensure the workspace directory is created and seeded on agent startup
            proj_dir.mkdir(parents=True, exist_ok=True)
            try:
                from mariano.web.workspace import seed_default_workspace
                seed_default_workspace(proj_dir)
            except Exception:
                pass
                
            summary = _get_project_files_summary(proj_dir)
            user_input = f"[Active Workspace Context: {proj_dir.name} | Absolute Path: {proj_dir.resolve().as_posix()}]\n{summary}\n\nUser Request: {user_input}"

        ctx.add("user", user_input)

        # 8. Auto Memory Selection & Retrieval
        memories = await self._memory.search(user_input, limit=3)
        if memories:
            memory_list = "\n".join([f"- [{m.get('category', 'general')}] {m.get('content', '')}" for m in memories])
            log.info("agent.memory_auto_retrieved", count=len(memories))
            yield AgentEvent(
                "thinking",
                f"Memory Engine: Auto-selected {len(memories)} relevant long-term memories."
            )
            ctx.add(
                "assistant",
                f"[RECALLED PAST CONTEXT - USE FOR CONTINUITY]\n{memory_list}"
            )

        # 10. Execute core ReAct loop
        reasoning_mode = self._settings.active_reasoning_mode
        if reasoning_mode == "fast":
            max_steps_limit = 5
        elif reasoning_mode == "pro":
            max_steps_limit = 15
        else: # thinking
            max_steps_limit = 35

        max_steps_adjusted = self._nm.get_context_limit(max_steps_limit)
        async for event in run_react_loop(
            agent=self,
            user_input=user_input,
            chat_id=chat_id,
            active_manifests=self._registry.get_manifests(),
            max_steps_adjusted=max_steps_adjusted
        ):
            yield event
