"""MARIANO — InvokeSubagentSkill: True Autonomous Parallel Multi-Agent Swarm Orchestrator."""
from __future__ import annotations

import asyncio
import time
from typing import Any, AsyncGenerator

from mariano.config import get_settings
from mariano.gemini.client import GeminiClient
from mariano.skills._base.skill_interface import BaseSkill, SkillResult


class InvokeSubagentSkill(BaseSkill):
    name = "invoke_subagent"
    description = (
        "Invoke a swarm of specialized subagents in parallel to execute complex, multi-faceted tasks "
        "(e.g. parallel codebase architecture, frontend coding, backend API design, deep testing, and data analysis). "
        "All subagents run concurrently at peak speed."
    )
    version = "2.0.0"
    tags = ["subagent", "swarm", "parallel", "orchestrator", "worker", "multi-agent"]

    async def _run_single_worker(self, gemini: GeminiClient, role: str, prompt: str) -> dict[str, Any]:
        """Execute a single subagent worker in isolation with dedicated persona."""
        system_instruction = (
            f"You are a specialized subagent operating within the Hekki Multi-Agent Swarm.\n"
            f"Your designated Role is: **{role}**.\n"
            f"Focus exclusively on your specialized domain. Be thorough, decisive, high-agency, and produce "
            f"complete, production-ready output, code, and insights without placeholders or hesitation."
        )
        t0 = time.perf_counter()
        try:
            res = await gemini.chat(
                history=[{"role": "user", "parts": [f"[SYSTEM: {system_instruction}]\n\nTask: {prompt}"]}],
                message=prompt,
            )
            text = res.get("text", "") if isinstance(res, dict) else str(res)
            duration_ms = (time.perf_counter() - t0) * 1000
            return {
                "role": role,
                "prompt": prompt,
                "success": True,
                "output": text.strip(),
                "duration_ms": round(duration_ms, 1),
            }
        except Exception as e:
            duration_ms = (time.perf_counter() - t0) * 1000
            return {
                "role": role,
                "prompt": prompt,
                "success": False,
                "error": str(e),
                "output": f"Worker execution failed: {e}",
                "duration_ms": round(duration_ms, 1),
            }

    async def stream_execute(self, **kwargs: Any) -> AsyncGenerator:
        subagents = kwargs.get("subagents", kwargs.get("Subagents", []))
        if subagents is None:
            subagents = []
        if not isinstance(subagents, list):
            subagents = [subagents]
        prompt = kwargs.get("prompt", kwargs.get("Prompt", ""))
        role = kwargs.get("role", kwargs.get("Role", "Specialist Worker"))

        if not subagents and prompt:
            subagents = [{"role": role, "prompt": prompt}]

        if not subagents:
            yield ("log", "ERROR: Parameter 'subagents' or 'prompt' is required.")
            yield ("done", 1)
            return

        yield ("log", f"⚡ [Swarm Orchestrator] Spawning {len(subagents)} concurrent subagents...")
        for i, sa in enumerate(subagents, 1):
            r = sa.get("role", sa.get("Role", f"Worker-{i}"))
            p = sa.get("prompt", sa.get("Prompt", ""))
            yield ("log", f"  ↳ Subagent #{i} [{r}]: {p[:70]}...")

        settings = get_settings()
        gemini = GeminiClient()

        tasks = [
            self._run_single_worker(gemini, sa.get("role", f"Worker-{i}"), sa.get("prompt", ""))
            for i, sa in enumerate(subagents, 1)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for res in results:
            if isinstance(res, Exception):
                yield ("log", f"⚠️ [Swarm] Worker encountered exception: {res}")
            elif res.get("success"):
                yield ("log", f"✅ [Swarm] [{res['role']}] Completed in {res['duration_ms']}ms.")
            else:
                yield ("log", f"⚠️ [Swarm] [{res['role']}] Encountered error: {res.get('error')}")

        yield ("done", 0)

    async def execute(self, **kwargs: Any) -> SkillResult:
        subagents = kwargs.get("subagents", kwargs.get("Subagents", []))
        if subagents is None:
            subagents = []
        if not isinstance(subagents, list):
            subagents = [subagents]
        prompt = kwargs.get("prompt", kwargs.get("Prompt", ""))
        role = kwargs.get("role", kwargs.get("Role", "Specialist Worker"))

        if not subagents and prompt:
            subagents = [{"role": role, "prompt": prompt}]

        if not subagents:
            return SkillResult(success=False, data=None, error="Parameter 'subagents' array or 'prompt' is required.")

        gemini = GeminiClient()

        t_start = time.perf_counter()
        tasks = [
            self._run_single_worker(gemini, sa.get("role", f"Worker-{i}"), sa.get("prompt", ""))
            for i, sa in enumerate(subagents, 1)
        ]

        raw_results = await asyncio.gather(*tasks, return_exceptions=True)
        results = []
        for i, res in enumerate(raw_results, 1):
            if isinstance(res, Exception):
                results.append({
                    "role": f"Worker-{i}",
                    "prompt": subagents[i-1].get("prompt", "") if i-1 < len(subagents) else "",
                    "success": False,
                    "error": str(res),
                    "response": f"Encountered error: {res}",
                    "duration_ms": 0
                })
            else:
                results.append(res)

        total_time_ms = round((time.perf_counter() - t_start) * 1000, 1)

        # Build clean markdown synthesis of parallel results
        sections = [f"### 👥 Multi-Agent Swarm Synthesis ({len(results)} Workers — {total_time_ms}ms)\n"]
        for res in results:
            status_badge = "✅" if res.get("success") else "❌"
            sections.append(f"#### {status_badge} Subagent: **{res['role']}** ({res['duration_ms']}ms)")
            sections.append(f"**Task Prompt:** `{res['prompt']}`\n")
            sections.append(f"{res['output']}\n\n---\n")

        full_output = "\n".join(sections)
        return SkillResult(
            success=True,
            data=full_output,
            metadata={"subagents_count": len(results), "total_time_ms": total_time_ms, "results": results}
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
                            "role": {"type": "string", "description": "Role/job title of subagent (e.g. Lead Architect, UI Specialist, Security Auditor, Test Engineer)."},
                            "prompt": {"type": "string", "description": "Detailed actionable task description for this subagent."},
                        },
                        "required": ["role", "prompt"],
                    },
                    "description": "List of specialized subagents to launch concurrently in parallel.",
                },
                "prompt": {
                    "type": "string",
                    "description": "Shortcut single task prompt if launching one subagent.",
                },
                "role": {
                    "type": "string",
                    "description": "Role title when using shortcut single prompt.",
                },
            },
        }
