"""MARIANO — WriteToFileSkill: High-precision file creation and overwriting."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult
from mariano.core.workspace import PathGuard


class WriteToFileSkill(BaseSkill):
    name = "write_to_file"
    description = (
        "Create a new file or overwrite an existing file with complete specified code content. "
        "Creates parent directories automatically."
    )
    version = "1.0.0"
    tags = ["file", "create", "write", "code"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        target_file_raw = kwargs.get("target_file", kwargs.get("path", kwargs.get("file", "")))
        code_content = kwargs.get("code_content", kwargs.get("content", kwargs.get("code", "")))
        overwrite = kwargs.get("overwrite", True)

        if not target_file_raw:
            return SkillResult(success=False, data=None, error="Parameter 'target_file' is required.")

        try:
            active_proj_path = PathGuard.get_active_project_path()
            resolved = self._resolve_path(target_file_raw, active_proj_path)
            resolved = PathGuard.secure_path(resolved)

            if resolved.exists() and not overwrite:
                return SkillResult(
                    success=False,
                    data=None,
                    error=f"File '{resolved.name}' already exists and overwrite is set to false."
                )

            resolved.parent.mkdir(parents=True, exist_ok=True)
            resolved.write_text(code_content, encoding="utf-8")

            return SkillResult(
                success=True,
                data=f"Successfully wrote {len(code_content)} characters ({len(code_content.splitlines())} lines) to {resolved}",
                metadata={"path": str(resolved), "lines": len(code_content.splitlines()), "bytes": len(code_content)}
            )

        except PermissionError as pe:
            return SkillResult(
                success=False,
                data=None,
                error=str(pe),
                metadata={"__permission_request__": True, "attempted_path": str(target_file_raw), "action": "write"}
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Failed to write file: {exc}")

    def _resolve_path(self, raw_path: Any, active_proj_path: str | None) -> Path:
        path_str = str(raw_path).replace("\\", "/")
        if active_proj_path:
            proj_root = Path(active_proj_path).resolve()
            resolved = Path(raw_path).expanduser()
            if not resolved.is_absolute():
                return (proj_root / resolved).resolve()
            return resolved.resolve()
        else:
            resolved = Path(raw_path).expanduser()
            if not resolved.is_absolute():
                return (Path.cwd() / resolved).resolve()
            return resolved.resolve()

    def get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "target_file": {
                    "type": "string",
                    "description": "The file path to create or write code to (absolute or relative to active workspace).",
                },
                "code_content": {
                    "type": "string",
                    "description": "The full code or text contents to write to the file.",
                },
                "overwrite": {
                    "type": "boolean",
                    "description": "Whether to overwrite if the file already exists (default true).",
                },
            },
            "required": ["target_file", "code_content"],
        }
