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
    ignored = {".git", "node_modules", "__pycache__", "venv", ".venv", "dist", "build", ".next", ".cache"}
    files = []
    try:
        for p in proj_dir.rglob("*"):
            if any(part in ignored or part.startswith(".") for part in p.relative_to(proj_dir).parts):
                continue
            if p.is_file():
                files.append(str(p.relative_to(proj_dir)))
                if len(files) >= 200:
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

        # Apply permission policy (user may have granted wider access via the permission card)
        if permission_policy and permission_policy != "ask":
            PathGuard.set_permission_policy(permission_policy, scoped_path=project_path)
        else:
            PathGuard.set_permission_policy("ask")

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
        window_size = int(self._settings.dynamic_config.get("short_term_window", self._settings.short_term_window))
        if ctx.message_count >= window_size:
            yield AgentEvent("thinking", "Context window saturated. Compressing older turns to preserve memory...")
            await ctx.compress_history(self._gemini)

        prefix_context = []

        # 7b. Inject task log summary if first message in this session context
        if ctx.count == 0 and chat_id:
            session_summary = await self._memory.get_session_summary(chat_id)
            if session_summary:
                prefix_context.append("[TASK LOG - READ TO UNDERSTAND PREVIOUS WORK]\n" + session_summary)
                log.info("agent.task_log_injected", chat_id=chat_id)

        # 8. Auto Memory Selection & Retrieval
        memories = await self._memory.search(user_input, limit=3)
        if memories:
            memory_list = "\n".join([f"- [{m.get('category', 'general')}] {m.get('content', '')}" for m in memories])
            log.info("agent.memory_auto_retrieved", count=len(memories))
            prefix_context.append(f"[RECALLED PAST CONTEXT - USE FOR CONTINUITY]\n{memory_list}")
            yield AgentEvent(
                "thinking",
                f"Memory Engine: Auto-selected {len(memories)} relevant long-term memories."
            )

        # Detect user-specified file/folder paths in user_input (e.g. E:\Office, C:\Users\..., /var/data)
        path_matches = re.findall(r'([A-Za-z]:\\[^\s*?"<>|]+)', user_input)
        if path_matches:
            matched_p = Path(path_matches[0])
            if matched_p.exists():
                target_dir = str(matched_p if matched_p.is_dir() else matched_p.parent)
                ctx.set_active_target_dir(target_dir)
            else:
                ctx.set_active_target_dir(path_matches[0])

        if ctx.active_target_dir:
            prefix_context.append(
                f"[Active Working Target Directory: {ctx.active_target_dir}]\n"
                f"NOTE: The user is actively operating on directory '{ctx.active_target_dir}'. "
                f"All follow-up file operations (e.g. listing, organizing, moving PDFs, creating subdirectories) "
                f"MUST be performed within '{ctx.active_target_dir}' unless the user explicitly provides a different directory path."
            )
        elif project and not aider_enabled:
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
            prefix_context.append(f"[Active Workspace Context: {proj_dir.name} | Absolute Path: {proj_dir.resolve().as_posix()}]\n{summary}")

        if prefix_context:
            full_user_input = "\n\n".join(prefix_context) + f"\n\nUser Request: {user_input}"
        else:
            full_user_input = user_input

        ctx.add("user", full_user_input)

        # 10. Execute core ReAct loop
        # Autonomous step limits: robust runway for multi-step projects, iterative builds, and self-healing.
        reasoning_mode = self._settings.active_reasoning_mode
        configured_max = int(self._settings.dynamic_config.get("max_steps", self._settings.max_steps or 35))
        if reasoning_mode == "fast":
            max_steps_limit = min(15, configured_max)   # Quick targeted tasks
        elif reasoning_mode == "pro":
            max_steps_limit = min(28, configured_max)   # Multi-file builds, refactors, scraping
        else:  # thinking / autonomous deep tasks
            max_steps_limit = configured_max            # Full 35+ step runway

        # Ensure neuromodulator fatigue never starves the agent below a usable floor
        max_steps_adjusted = max(10, self._nm.get_context_limit(max_steps_limit))
        async for event in run_react_loop(
            agent=self,
            user_input=user_input,
            chat_id=chat_id,
            active_manifests=self._registry.get_manifests(),
            max_steps_adjusted=max_steps_adjusted
        ):
            yield event
