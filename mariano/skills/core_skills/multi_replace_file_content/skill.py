"""MARIANO — MultiReplaceFileContentSkill: Multi-chunk non-contiguous file modifications."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult
from mariano.core.workspace import PathGuard


class MultiReplaceFileContentSkill(BaseSkill):
    name = "multi_replace_file_content"
    description = (
        "Edit an existing file by making multiple non-contiguous block replacements in a single pass."
    )
    version = "1.0.0"
    tags = ["file", "edit", "multi_replace", "code"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        target_file_raw = kwargs.get("target_file", kwargs.get("path", kwargs.get("file", "")))
        chunks = kwargs.get("replacement_chunks", kwargs.get("chunks", []))

        if not target_file_raw:
            return SkillResult(success=False, data=None, error="Parameter 'target_file' is required.")
        if not chunks or not isinstance(chunks, list):
            return SkillResult(success=False, data=None, error="Parameter 'replacement_chunks' must be a non-empty array.")

        try:
            active_proj_path = PathGuard.get_active_project_path()
            resolved = self._resolve_path(target_file_raw, active_proj_path)
            resolved = PathGuard.secure_path(resolved)

            if not resolved.exists():
                return SkillResult(success=False, data=None, error=f"File '{resolved.name}' does not exist.")

            content = resolved.read_text(encoding="utf-8", errors="replace")
            applied_count = 0

            for chunk in chunks:
                if getattr(chunk, "get", None) is None:
                    continue
                target = chunk.get("target_content", chunk.get("TargetContent", chunk.get("target", "")))
                replacement = chunk.get("replacement_content", chunk.get("ReplacementContent", chunk.get("replacement", "")))
                if not target:
                    return SkillResult(success=False, data=None, error="Target content is required in all chunks.")
                if replacement is None:
                    replacement = ""
                
                if target in content:
                    content = content.replace(target, replacement, 1)
                    applied_count += 1
                else:
                    return SkillResult(
                        success=False,
                        data=None,
                        error=f"Target content chunk not found in {resolved.name}: '{target[:40]}...'"
                    )

            resolved.write_text(content, encoding="utf-8")
            return SkillResult(
                success=True,
                data=f"Successfully applied {applied_count} replacement chunks to {resolved.name}",
                metadata={"path": str(resolved), "chunks_applied": applied_count}
            )

        except PermissionError as pe:
            return SkillResult(
                success=False,
                data=None,
                error=str(pe),
                metadata={"__permission_request__": True, "attempted_path": str(target_file_raw), "action": "multi_replace"}
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Failed multi-replace: {exc}")

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
                    "description": "File path to edit.",
                },
                "replacement_chunks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "target_content": {"type": "string"},
                            "replacement_content": {"type": "string"},
                            "start_line": {"type": "integer"},
                            "end_line": {"type": "integer"},
                        },
                        "required": ["target_content", "replacement_content"],
                    },
                    "description": "Array of replacement objects to apply to the target file.",
                },
            },
            "required": ["target_file", "replacement_chunks"],
        }
