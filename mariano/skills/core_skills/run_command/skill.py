"""run_command — Execute terminal / CMD / PowerShell commands on Windows filesystem.

Allows executing shell commands, batch scripts, and python scratch scripts.
Supports real-time live stdout streaming via stream_execute().
"""
from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path
from typing import Any, AsyncGenerator

from mariano.skills._base.skill_interface import BaseSkill, SkillResult


class RunCommandSkill(BaseSkill):
    name = "run_command"
    description = (
        "Execute system terminal, CMD, PowerShell commands, or python scripts on Windows. "
        "Use this for shell commands like 'dir', 'del /f /q <path>', 'rmdir /s /q <path>', "
        "or running python scripts. Always specify valid Windows commands."
    )
    version = "1.1.0"
    tags = ["system", "terminal", "cmd", "powershell", "execute"]

    # ── Internal helpers ──────────────────────────────────────────────────────
    async def _get_workdir(self, cwd_param: str) -> Path:
        try:
            from mariano.core.workspace import PathGuard
            active_proj_path = PathGuard.get_active_project_path()
            if cwd_param:
                return PathGuard.secure_path(Path(cwd_param).resolve())
            elif active_proj_path:
                return PathGuard.secure_path(Path(active_proj_path).resolve())
        except Exception:
            pass
        return Path.cwd().resolve()

    def _check_delete_blocked(self, command: str) -> bool | None:
        """Returns True if blocked, handles safe-recycle if super mode."""
        from mariano.core.workspace import active_permission_policy
        current_policy = active_permission_policy.get()
        cmd_lower = command.lower()
        blocked_terms = ["del ", "del/", "rmdir", "rd ", "rd/", "rm -", "remove-item", "erase ", "format "]
        if not any(term in cmd_lower for term in blocked_terms):
            return None  # Not a delete command
        if current_policy in ("super", "auto", "everything"):
            return False  # Allowed in super mode
        return True  # Blocked

    # ── stream_execute: real-time line-by-line stdout streaming ───────────────
    async def stream_execute(self, **kwargs: Any) -> AsyncGenerator:
        command = kwargs.get("command", kwargs.get("cmd", kwargs.get("command_line", "")))
        cwd_param = kwargs.get("cwd", kwargs.get("path", ""))

        if not command:
            yield ("log", "ERROR: No command provided.")
            yield ("done", 1)
            return
        command = str(command)

        # Security check
        blocked = self._check_delete_blocked(command)
        if blocked is True:
            yield ("log", "Safety Policy: Deletion blocked. Use Super Permission mode.")
            yield ("done", 1)
            return

        # Inline python -c guard
        cmd_strip = command.strip()
        if cmd_strip.startswith("python -c") or cmd_strip.startswith("python3 -c"):
            if "#" in command or "\n" in command or len(command) > 250:
                yield ("log", "ERROR: Execution Policy Error: Inline 'python -c' with '#' comments or long scripts is forbidden. You MUST write your python code to a file (e.g. scratch/temp_script.py) using file_manager / write_to_file and then execute 'python scratch/temp_script.py'.")
                yield ("done", 1)
                return

        work_dir = await self._get_workdir(cwd_param)
        yield ("log", f"$ {command}")
        yield ("log", f"  cwd: {work_dir}")

        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,  # merge stderr → stdout for unified stream
                cwd=str(work_dir)
            )

            try:
                async with asyncio.timeout(120):
                    async for raw in process.stdout:
                        line = raw.decode("utf-8", errors="replace").rstrip("\r\n")
                        yield ("log", line)
            except asyncio.TimeoutError:
                yield ("log", "ERROR: Command timed out after 120 seconds.")
                try:
                    process.kill()
                except Exception:
                    pass

            await process.wait()
            yield ("done", process.returncode or 0)

        except Exception as e:
            yield ("log", f"ERROR: {e}")
            yield ("done", 1)

    # ── execute: buffered (used as fallback / for AI result text) ────────────
    async def execute(self, **kwargs: Any) -> SkillResult:
        command = kwargs.get("command", kwargs.get("cmd", kwargs.get("command_line", "")))
        cwd_param = kwargs.get("cwd", kwargs.get("path", ""))

        if not command:
            return SkillResult(success=False, data=None, error="Parameter 'command' is required.")
        command = str(command)

        # Inline python -c guard
        cmd_strip = command.strip()
        if cmd_strip.startswith("python -c") or cmd_strip.startswith("python3 -c"):
            if "#" in command or "\n" in command or len(command) > 250:
                return SkillResult(
                    success=False,
                    data=None,
                    error="Execution Policy Error: Inline 'python -c' with '#' comments or long scripts is forbidden because Windows command line truncates them. You MUST write your python code to a file (e.g. scratch/temp_script.py) using file_manager / write_to_file and then execute 'python scratch/temp_script.py'."
                )

        # Security Policy check
        from mariano.core.workspace import active_permission_policy
        current_policy = active_permission_policy.get()
        cmd_lower = command.lower()
        blocked_terms = ["del ", "del/", "rmdir", "rd ", "rd/", "rm -", "remove-item", "erase ", "format "]
        if any(term in cmd_lower for term in blocked_terms):
            if current_policy in ("super", "auto", "everything"):
                import re
                paths = re.findall(r'["\'"]([^"\']+)["\']|(\S+)', command)
                recycled_items = []
                for p_tuple in paths:
                    p_str = p_tuple[0] or p_tuple[1]
                    if p_str.lower() in ("del", "/f", "/q", "/s", "rmdir", "rd", "rm", "-rf", "remove-item", "format"):
                        continue
                    p_obj = Path(p_str).expanduser()
                    if p_obj.exists():
                        try:
                            import send2trash
                            send2trash.send2trash(str(p_obj.resolve()))
                            recycled_items.append(str(p_obj.name))
                        except Exception:
                            pass
                if recycled_items:
                    return SkillResult(
                        success=True,
                        data=f"Super Permission Active: Successfully moved target(s) {recycled_items} to Windows Recycle Bin. Safe deletion complete.",
                        metadata={"command": command, "recycled": recycled_items}
                    )
            return SkillResult(
                success=False,
                data=None,
                error="Safety Policy: Direct permanent deletion commands are disabled. Switch to 'Super Permission' mode in the + icon menu to safely delete files to the Recycle Bin."
            )

        work_dir = await self._get_workdir(cwd_param)

        try:
            all_lines: list[str] = []
            exit_code = 0
            async for tag, val in self.stream_execute(**kwargs):
                if tag == "log":
                    all_lines.append(val)
                elif tag == "done":
                    exit_code = int(val or 0)

            stdout_lines = [l for l in all_lines if not l.startswith("$ ") and not l.startswith("  cwd: ")]
            actual_stdout = "\n".join(stdout_lines).strip()
            out_lower = actual_stdout.lower()
            error_patterns = [
                "syntaxerror:", "traceback (most recent call last):", "failed because", 
                "is not recognized as an internal", "command not found",
                "module_not_found_error", "importerror:", "indentationerror:"
            ]
            has_error_keyword = any(pat in out_lower for pat in error_patterns)
            is_success = (exit_code == 0 or len(actual_stdout) > 0) and not has_error_keyword

            output_text = "\n".join(all_lines) if all_lines else "(no output)"
            return SkillResult(
                success=is_success,
                data=f"Exit code: {exit_code}\nSTDOUT:\n{output_text}",
                metadata={"command": command, "exit_code": exit_code, "cwd": str(work_dir)}
            )
        except Exception as e:
            return SkillResult(
                success=False,
                data=None,
                error=f"Failed to execute command '{command}': {e}"
            )

    def get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Terminal / CMD / PowerShell command string to execute.",
                },
                "cwd": {
                    "type": "string",
                    "description": "Optional working directory for command execution.",
                },
            },
            "required": ["command"],
        }
