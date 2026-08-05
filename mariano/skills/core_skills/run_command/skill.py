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

        # Security Policy check — if super/unrestricted mode is active, route deletion to Recycle Bin
        from mariano.core.workspace import active_permission_policy
        current_policy = active_permission_policy.get()

        cmd_lower = command.lower()
        blocked_terms = ["del ", "del/", "rmdir", "rd ", "rd/", "rm -", "remove-item", "erase ", "format "]
        if any(term in cmd_lower for term in blocked_terms):
            if current_policy in ("super", "auto", "everything"):
                # Execute safe Recycle Bin deletion on target paths extracted from command
                import re
                paths = re.findall(r'["\']([^"\']+)["\']|(\S+)', command)
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
            partial_text = ""
            try:
                process.kill()
                out_b, err_b = await process.communicate()
                partial_out = out_b.decode("utf-8", errors="replace") if out_b else ""
                partial_err = err_b.decode("utf-8", errors="replace") if err_b else ""
                if partial_out or partial_err:
                    partial_text = f"STDOUT:\n{partial_out}\nSTDERR:\n{partial_err}".strip()
            except Exception:
                pass
            err_msg = f"ERROR: Command execution timed out after 60 seconds: '{command}'"
            return SkillResult(
                success=False,
                data=partial_text if partial_text else err_msg,
                error=err_msg
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
