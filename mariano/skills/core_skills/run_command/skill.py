"""run_command — Execute terminal / CMD / PowerShell commands on Windows filesystem.

Allows executing shell commands, batch scripts, and python scratch scripts.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult


class RunCommandSkill(BaseSkill):
    name = "run_command"
    description = (
        "Execute system terminal, CMD, PowerShell commands, or python scripts on Windows. "
        "Use this for shell commands like 'dir', 'del /f /q <path>', 'rmdir /s /q <path>', "
        "or running python scripts. Always specify valid Windows commands."
    )
    version = "1.0.0"
    tags = ["system", "terminal", "cmd", "powershell", "execute"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        command = kwargs.get("command", kwargs.get("cmd", kwargs.get("command_line", "")))
        cwd_param = kwargs.get("cwd", kwargs.get("path", ""))

        if not command:
            return SkillResult(success=False, data=None, error="Parameter 'command' is required.")

        # Determine working directory
        try:
            from mariano.core.workspace import PathGuard
            active_proj_path = PathGuard.get_active_project_path()

            if cwd_param:
                work_dir = PathGuard.secure_path(Path(cwd_param).resolve())
            elif active_proj_path:
                work_dir = PathGuard.secure_path(Path(active_proj_path).resolve())
            else:
                work_dir = Path.cwd().resolve()
        except Exception as e:
            work_dir = Path.cwd().resolve()

        try:
            # Run command asynchronously using asyncio subprocess
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(work_dir)
            )

            stdout_b, stderr_b = await asyncio.wait_for(process.communicate(), timeout=60.0)

            stdout = stdout_b.decode("utf-8", errors="replace")
            stderr = stderr_b.decode("utf-8", errors="replace")
            exit_code = process.returncode

            output_text = f"Exit code: {exit_code}\n"
            if stdout:
                output_text += f"STDOUT:\n{stdout}\n"
            if stderr:
                output_text += f"STDERR:\n{stderr}\n"

            success = (exit_code == 0)
            return SkillResult(
                success=success,
                data=output_text.strip(),
                metadata={"command": command, "exit_code": exit_code, "cwd": str(work_dir)}
            )

        except asyncio.TimeoutError:
            return SkillResult(
                success=False,
                data=None,
                error=f"Command execution timed out after 60 seconds: '{command}'"
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
