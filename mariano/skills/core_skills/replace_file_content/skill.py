"""MARIANO — ReplaceFileContentSkill: Targeted single-block text replacement."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult
from mariano.core.workspace import PathGuard


class ReplaceFileContentSkill(BaseSkill):
    name = "replace_file_content"
    description = (
        "Edit an existing file by replacing a single contiguous block of target text with new replacement text. "
        "Verifies line ranges and exact string match."
    )
    version = "1.0.0"
    tags = ["file", "edit", "replace", "code"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        target_file_raw = kwargs.get("target_file", kwargs.get("path", kwargs.get("file", "")))
        target_content = kwargs.get("target_content", kwargs.get("target", ""))
        replacement_content = kwargs.get("replacement_content", kwargs.get("replacement", ""))
        start_line = kwargs.get("start_line", kwargs.get("StartLine"))
        end_line = kwargs.get("end_line", kwargs.get("EndLine"))

        if not target_file_raw:
            return SkillResult(success=False, data=None, error="Parameter 'target_file' is required.")
        if target_content is None:
            return SkillResult(success=False, data=None, error="Parameter 'target_content' is required.")

        try:
            active_proj_path = PathGuard.get_active_project_path()
            resolved = self._resolve_path(target_file_raw, active_proj_path)
            resolved = PathGuard.secure_path(resolved)

            if not resolved.exists():
                return SkillResult(success=False, data=None, error=f"File '{resolved.name}' does not exist.")

            content = resolved.read_text(encoding="utf-8", errors="replace")

            if target_content not in content:
                return SkillResult(
                    success=False,
                    data=None,
                    error=f"Target content not found in {resolved.name}. Verify line range and exact text."
                )

            # Perform exact string replacement
            new_content = content.replace(target_content, replacement_content, 1)
            resolved.write_text(new_content, encoding="utf-8")

            return SkillResult(
                success=True,
                data=f"Successfully replaced text in {resolved.name}",
                metadata={"path": str(resolved), "replaced_len": len(target_content), "new_len": len(replacement_content)}
            )

        except PermissionError as pe:
            return SkillResult(
                success=False,
                data=None,
                error=str(pe),
                metadata={"__permission_request__": True, "attempted_path": str(target_file_raw), "action": "replace"}
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Failed to replace content: {exc}")

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
                "target_file": {
                    "type": "string",
                    "description": "Absolute or relative file path to edit.",
                },
                "target_content": {
                    "type": "string",
                    "description": "The exact block of text to be replaced (must match character for character).",
                },
                "replacement_content": {
                    "type": "string",
                    "description": "The new replacement content.",
                },
                "start_line": {
                    "type": "integer",
                    "description": "Optional starting line number (1-indexed) for precise context targeting.",
                },
                "end_line": {
                    "type": "integer",
                    "description": "Optional ending line number (1-indexed) for precise context targeting.",
                },
            },
            "required": ["target_file", "target_content", "replacement_content"],
        }
