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

    def __init__(self) -> None:
        super().__init__()
        self._last_stream_result: SkillResult | None = None

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

    def _transform_inline_python(self, command: str, work_dir: Path) -> tuple[str, Path | None]:
        """Transparently convert inline python -c commands to safe scratch scripts on Windows."""
        cmd_strip = command.strip()
        prefix = None
        if cmd_strip.startswith("python -c"):
            prefix = "python -c"
        elif cmd_strip.startswith("python3 -c"):
            prefix = "python3 -c"

        if not prefix:
            return command, None

        code_part = cmd_strip[len(prefix):].strip()
        if (code_part.startswith('"') and code_part.endswith('"')) or (code_part.startswith("'") and code_part.endswith("'")):
            code_part = code_part[1:-1]

        scratch_dir = work_dir / ".scratch"
        scratch_dir.mkdir(parents=True, exist_ok=True)
        import uuid
        temp_script = scratch_dir / f"auto_exec_{uuid.uuid4().hex[:8]}.py"
        temp_script.write_text(code_part, encoding="utf-8")
        return f'python "{temp_script.resolve()}"', temp_script

    _MODULE_MAP = {
        "fitz": "pymupdf", "cv2": "opencv-python", "bs4": "beautifulsoup4",
        "yaml": "pyyaml", "PIL": "pillow", "dotenv": "python-dotenv",
        "sklearn": "scikit-learn", "dateutil": "python-dateutil", "jwt": "pyjwt",
        "pypdf2": "pypdf2", "pypdf": "pypdf", "pdfplumber": "pdfplumber",
        "playwright": "playwright", "duckduckgo_search": "duckduckgo_search",
        "fastapi": "fastapi", "uvicorn": "uvicorn", "requests": "requests",
        "pandas": "pandas", "numpy": "numpy", "scipy": "scipy",
        "matplotlib": "matplotlib", "seaborn": "seaborn", "openpyxl": "openpyxl",
        "docx": "python-docx", "pptx": "python-pptx", "websockets": "websockets",
        "aiohttp": "aiohttp", "httpx": "httpx", "send2trash": "send2trash"
    }

    def _extract_missing_module(self, lines: list[str]) -> str | None:
        """Parse stdout/stderr lines for missing python module names."""
        import re
        for line in reversed(lines):
            m = re.search(r"ModuleNotFoundError:\s+No module named ['\"]([^'\"]+)['\"]", line)
            if m:
                return m.group(1)
            m2 = re.search(r"ImportError:\s+cannot import name .* from ['\"]([^'\"]+)['\"]", line)
            if m2:
                return m2.group(1)
            m3 = re.search(r"No module named ['\"]([^'\"]+)['\"]", line)
            if m3:
                return m3.group(1)
        return None

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

        work_dir = await self._get_workdir(cwd_param)
        exec_command, temp_script = self._transform_inline_python(command, work_dir)

        yield ("log", f"$ {command}")
        yield ("log", f"  cwd: {work_dir}")

        timeout_secs = int(kwargs.get("timeout", 300))
        for attempt in range(2):
            captured_lines: list[str] = []
            process = None
            try:
                process = await asyncio.create_subprocess_shell(
                    exec_command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                    cwd=str(work_dir)
                )

                try:
                    async with asyncio.timeout(timeout_secs):
                        async for raw in process.stdout:
                            line = raw.decode("utf-8", errors="replace").rstrip("\r\n")
                            captured_lines.append(line)
                            yield ("log", line)
                except asyncio.TimeoutError:
                    yield ("log", f"ERROR: Command timed out after {timeout_secs} seconds.")
                    try:
                        process.kill()
                    except Exception:
                        pass

                await process.wait()
                exit_code = process.returncode or 0

                # Auto-Dependency Healing: Check for missing module on failure
                if exit_code != 0 and attempt == 0:
                    missing_mod = self._extract_missing_module(captured_lines)
                    if missing_mod:
                        pip_pkg = self._MODULE_MAP.get(missing_mod, missing_mod)
                        yield ("log", f"⚡ [Auto-Dependency Healing] Missing module '{missing_mod}' detected. Auto-installing '{pip_pkg}'...")
                        try:
                            pip_proc = await asyncio.create_subprocess_shell(
                                f"pip install {pip_pkg}",
                                stdout=asyncio.subprocess.PIPE,
                                stderr=asyncio.subprocess.STDOUT,
                                cwd=str(work_dir)
                            )
                            async with asyncio.timeout(180):
                                async for raw in pip_proc.stdout:
                                    line = raw.decode("utf-8", errors="replace").rstrip("\r\n")
                                    yield ("log", f"  [pip] {line}")
                            await pip_proc.wait()
                            if pip_proc.returncode == 0:
                                yield ("log", f"✅ Successfully installed '{pip_pkg}'. Retrying command autonomously...")
                                continue  # Retry the script with new package
                        except Exception as e:
                            yield ("log", f"⚠️ Auto-install of '{pip_pkg}' failed: {e}")

                yield ("done", exit_code)

                # Cache stream result so subsequent execute() does not rerun the command
                stdout_lines = [l for l in captured_lines if not l.startswith("$ ") and not l.startswith("  cwd: ")]
                actual_stdout = "\n".join(stdout_lines).strip()
                out_lower = actual_stdout.lower()
                error_patterns = [
                    "syntaxerror:", "traceback (most recent call last):", "failed because", 
                    "is not recognized as an internal", "command not found",
                    "module_not_found_error", "importerror:", "indentationerror:"
                ]
                has_error_keyword = any(pat in out_lower for pat in error_patterns)
                is_success = (exit_code == 0 or len(actual_stdout) > 0) and not has_error_keyword
                output_text = "\n".join(captured_lines) if captured_lines else "(no output)"
                self._last_stream_result = SkillResult(
                    success=is_success,
                    data=f"Exit code: {exit_code}\nSTDOUT:\n{output_text}",
                    metadata={"command": command, "exit_code": exit_code, "cwd": str(work_dir)}
                )
                break

            except Exception as e:
                yield ("log", f"ERROR: {e}")
                yield ("done", 1)
                self._last_stream_result = SkillResult(
                    success=False,
                    data=None,
                    error=f"Failed to execute command '{command}': {e}"
                )
                break
            finally:
                if temp_script and temp_script.exists():
                    try:
                        temp_script.unlink()
                    except Exception:
                        pass

    # ── execute: buffered (used as fallback / for AI result text) ────────────
    async def execute(self, **kwargs: Any) -> SkillResult:
        if self._last_stream_result is not None:
            res = self._last_stream_result
            self._last_stream_result = None
            return res

        command = kwargs.get("command", kwargs.get("cmd", kwargs.get("command_line", "")))
        cwd_param = kwargs.get("cwd", kwargs.get("path", ""))

        if not command:
            return SkillResult(success=False, data=None, error="Parameter 'command' is required.")
        command = str(command)

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

        if self._last_stream_result is not None:
            res = self._last_stream_result
            self._last_stream_result = None
            return res

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
