"""MARIANO — ViewFileSkill: High-precision file viewing with line ranges."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult
from mariano.core.workspace import PathGuard


class ViewFileSkill(BaseSkill):
    name = "view_file"
    description = (
        "View the contents of a file from local filesystem. Supports line range slicing (1-indexed start/end lines) "
        "and byte offset preview limits."
    )
    version = "1.0.0"
    tags = ["file", "read", "view", "inspect"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        absolute_path_raw = kwargs.get("absolute_path", kwargs.get("path", kwargs.get("file", kwargs.get("TargetFile", ""))))
        start_line = kwargs.get("start_line", kwargs.get("StartLine"))
        end_line = kwargs.get("end_line", kwargs.get("EndLine"))

        if not absolute_path_raw:
            return SkillResult(success=False, data=None, error="Parameter 'absolute_path' is required.")

        try:
            active_proj_path = PathGuard.get_active_project_path()
            resolved = self._resolve_path(absolute_path_raw, active_proj_path)
            resolved = PathGuard.secure_path(resolved)

            if not resolved.exists():
                return SkillResult(success=False, data=None, error=f"File '{resolved.name}' does not exist.")

            if not resolved.is_file():
                return SkillResult(success=False, data=None, error=f"Path '{resolved.name}' is a directory, not a file.")

            content = resolved.read_text(encoding="utf-8", errors="replace")
            lines = content.splitlines()
            total_lines = len(lines)

            # Process 1-indexed line range slicing if provided
            s_line = int(start_line) if start_line is not None else 1
            e_line = int(end_line) if end_line is not None else min(total_lines, s_line + 800)

            s_line = max(1, s_line)
            e_line = min(total_lines, e_line)

            if s_line > total_lines:
                selected_lines = []
            else:
                selected_lines = lines[s_line - 1:e_line]

            formatted_lines = [f"{i + s_line:4d}: {line}" for i, line in enumerate(selected_lines)]
            output_text = f"File: {resolved} ({total_lines} total lines, showing {s_line}-{e_line})\n" + "\n".join(formatted_lines)

            return SkillResult(
                success=True,
                data=output_text,
                metadata={"path": str(resolved), "total_lines": total_lines, "start_line": s_line, "end_line": e_line}
            )

        except PermissionError as pe:
            return SkillResult(
                success=False,
                data=None,
                error=str(pe),
                metadata={"__permission_request__": True, "attempted_path": str(absolute_path_raw), "action": "read"}
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Failed to view file: {exc}")

    def _resolve_path(self, raw_path: Any, active_proj_path: str | None) -> Path:
        resolved = Path(raw_path).expanduser()
        if active_proj_path and not resolved.is_absolute():
            return (Path(active_proj_path).resolve() / resolved).resolve()
        elif not resolved.is_absolute():
            return (Path.cwd() / resolved).resolve()
        return resolved.resolve()

    def get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "absolute_path": {
                    "type": "string",
                    "description": "Path to file to view (absolute or relative).",
                },
                "start_line": {
                    "type": "integer",
                    "description": "Optional starting line number to view (1-indexed).",
                },
                "end_line": {
                    "type": "integer",
                    "description": "Optional ending line number to view (1-indexed).",
                },
            },
            "required": ["absolute_path"],
        }
