"""MARIANO — ListDirSkill: Directory contents inspector with metadata."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult
from mariano.core.workspace import PathGuard


class ListDirSkill(BaseSkill):
    name = "list_dir"
    description = (
        "List the contents of a directory (files and subdirectories) with sizes and item metadata."
    )
    version = "1.0.0"
    tags = ["directory", "list", "files", "ls"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        directory_path_raw = kwargs.get("directory_path", kwargs.get("DirectoryPath", kwargs.get("path", ".")))
        if not directory_path_raw:
            directory_path_raw = "."

        try:
            active_proj_path = PathGuard.get_active_project_path()
            resolved = self._resolve_path(directory_path_raw, active_proj_path)
            resolved = PathGuard.secure_path(resolved)

            if not resolved.exists():
                return SkillResult(success=False, data=None, error=f"Directory '{resolved}' does not exist.")

            if not resolved.is_dir():
                return SkillResult(success=False, data=None, error=f"Path '{resolved}' is a file, not a directory.")

            items = []
            for entry in sorted(resolved.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
                if entry.name.startswith("."):
                    continue
                is_dir = entry.is_dir()
                size = entry.stat().st_size if not is_dir else 0
                items.append(f"{'[DIR] ' if is_dir else '[FILE]':7s} {entry.name} ({size} bytes)" if not is_dir else f"[DIR]   {entry.name}/")

            output_text = f"Directory contents of {resolved}:\n" + "\n".join(items) if items else f"Directory {resolved} is empty."
            return SkillResult(
                success=True,
                data=output_text,
                metadata={"directory": str(resolved), "count": len(items)}
            )

        except PermissionError as pe:
            return SkillResult(
                success=False,
                data=None,
                error=str(pe),
                metadata={"__permission_request__": True, "attempted_path": str(directory_path_raw), "action": "list"}
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Failed to list directory: {exc}")

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
                "directory_path": {
                    "type": "string",
                    "description": "Path to directory to list.",
                },
            },
            "required": ["directory_path"],
        }
