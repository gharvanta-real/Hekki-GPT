"""file_manager — File management skill.

Handles: read, write, list, grep, search, delete, copy, move, create_dir, get_size.
Resolves relative paths against the active project or user home.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult


class FileManagerSkill(BaseSkill):
    name = "file_manager"
    description = (
        "Read, write, list, search, grep, delete, copy, move, create directories, and inspect sizes of files on the local filesystem. "
        "Use action='read' to read a file, action='write' to write content, action='list' to list a directory, "
        "action='delete' to delete a file or directory, action='copy' to copy, action='move' to move/rename, "
        "action='create_dir' to create a folder, action='get_size' to check total size, "
        "action='grep' to search text inside files, action='search' to find files by name. "
        "Always use absolute paths."
    )
    version = "2.1.0"
    tags = ["files", "filesystem", "read", "write", "delete", "copy", "move", "search"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        action      = kwargs.get("action", "list")
        path        = kwargs.get("path", kwargs.get("file", kwargs.get("filename", "")))
        destination = kwargs.get("destination", kwargs.get("dst", kwargs.get("target", "")))
        pattern     = kwargs.get("pattern", kwargs.get("query", ""))
        start       = kwargs.get("start_line")
        end         = kwargs.get("end_line")

        # Resolve primary path — absolute preferred, fallback to active project or user home
        try:
            from mariano.core.workspace import PathGuard
            active_proj_path = PathGuard.get_active_project_path()

            resolved = self._resolve_single_path(path, active_proj_path)
            resolved = PathGuard.secure_path(resolved)

            resolved_dst = None
            if destination:
                resolved_dst = self._resolve_single_path(destination, active_proj_path)
                resolved_dst = PathGuard.secure_path(resolved_dst)

        except PermissionError as pe:
            # Extract the attempted path from the error message for the permission card
            import re as _re
            _path_match = _re.search(r"Path '([^']+)' resolves outside", str(pe))
            _attempted_path = _path_match.group(1) if _path_match else str(path)
            return SkillResult(
                success=False,
                data=None,
                error=str(pe),
                metadata={
                    "__permission_request__": True,
                    "attempted_path": _attempted_path,
                    "action": action
                }
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Path resolution failed: {e}")

        if action == "read":
            return self._read(resolved, start, end)
        elif action == "write":
            content = kwargs.get("content", kwargs.get("code", kwargs.get("text", "")))
            return self._write(resolved, content)
        elif action == "replace":
            target = kwargs.get("target_content", kwargs.get("target", kwargs.get("old_code", "")))
            replacement = kwargs.get("replacement_content", kwargs.get("replacement", kwargs.get("new_code", "")))
            return self._replace(resolved, target, replacement)
        elif action == "multi_replace":
            replacements = kwargs.get("replacements", kwargs.get("chunks", []))
            return self._multi_replace(resolved, replacements)
        elif action == "delete":
            return SkillResult(
                success=False,
                data=None,
                error="Safety Policy: File and directory deletion ('delete' action) is strictly disabled by user security policy."
            )
        elif action == "create_dir":
            return self._create_dir(resolved)
        elif action == "copy":
            if not resolved_dst:
                return SkillResult(success=False, data=None, error="Action 'copy' requires a 'destination' path parameter")
            return self._copy(resolved, resolved_dst)
        elif action == "move":
            if not resolved_dst:
                return SkillResult(success=False, data=None, error="Action 'move' requires a 'destination' path parameter")
            return self._move(resolved, resolved_dst)
        elif action == "get_size":
            return self._get_size(resolved)
        elif action == "list":
            return self._list(resolved)
        elif action == "grep":
            return self._grep(resolved, pattern)
        elif action == "search":
            return self._search(resolved, pattern)
        else:
            return SkillResult(
                success=False,
                data=None,
                error=f"Unknown action '{action}'. Use: read, write, delete, create_dir, copy, move, get_size, list, grep, search"
            )

    def _resolve_single_path(self, raw_path: Any, active_proj_path: str | None) -> Path:
        if raw_path:
            path_str = str(raw_path).replace("\\", "/")
            if active_proj_path:
                proj_root = Path(active_proj_path).resolve()
                proj_name = proj_root.name.lower()
                
                clean_path = path_str.strip("./").strip("/")
                clean_parts = clean_path.split("/")
                
                if clean_path.lower() == proj_name:
                    return proj_root
                elif clean_parts and clean_parts[0].lower() == proj_name:
                    sub_path = "/".join(clean_parts[1:])
                    return (proj_root / sub_path).resolve()
                else:
                    resolved = Path(raw_path).expanduser()
                    if not resolved.is_absolute():
                        return (proj_root / resolved).resolve()
                    else:
                        return resolved.resolve()
            else:
                resolved = Path(raw_path).expanduser()
                if not resolved.is_absolute():
                    return (Path.cwd() / resolved).resolve()
                else:
                    return resolved.resolve()
        else:
            if active_proj_path:
                return Path(active_proj_path).resolve()
            else:
                return Path.cwd().resolve()

    def _delete(self, path: Path) -> SkillResult:
        try:
            if not path.exists():
                return SkillResult(success=False, data=None, error=f"Path not found for deletion: {path}")
            if path.is_dir():
                shutil.rmtree(path)
                return SkillResult(
                    success=True,
                    data=f"Successfully deleted directory '{path.name}'",
                    metadata={"path": str(path), "action": "delete"}
                )
            else:
                path.unlink()
                return SkillResult(
                    success=True,
                    data=f"Successfully deleted file '{path.name}'",
                    metadata={"path": str(path), "action": "delete"}
                )
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Failed to delete '{path}': {e}")

    def _create_dir(self, path: Path) -> SkillResult:
        try:
            path.mkdir(parents=True, exist_ok=True)
            return SkillResult(
                success=True,
                data=f"Successfully created directory '{path.name}'",
                metadata={"path": str(path), "action": "create_dir"}
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Failed to create directory '{path}': {e}")

    def _copy(self, path: Path, destination: Path) -> SkillResult:
        try:
            if not path.exists():
                return SkillResult(success=False, data=None, error=f"Source path not found: {path}")
            if path.is_dir():
                shutil.copytree(path, destination, dirs_exist_ok=True)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, destination)
            return SkillResult(
                success=True,
                data=f"Successfully copied '{path.name}' to '{destination.name}'",
                metadata={"src": str(path), "dst": str(destination), "action": "copy"}
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Failed to copy '{path}' to '{destination}': {e}")

    def _move(self, path: Path, destination: Path) -> SkillResult:
        try:
            if not path.exists():
                return SkillResult(success=False, data=None, error=f"Source path not found: {path}")
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(path), str(destination))
            return SkillResult(
                success=True,
                data=f"Successfully moved '{path.name}' to '{destination.name}'",
                metadata={"src": str(path), "dst": str(destination), "action": "move"}
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Failed to move '{path}' to '{destination}': {e}")

    def _get_size(self, path: Path) -> SkillResult:
        try:
            if not path.exists():
                return SkillResult(success=False, data=None, error=f"Path not found: {path}")
            if path.is_file():
                size = path.stat().st_size
            else:
                size = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
            return SkillResult(
                success=True,
                data=f"Total size of '{path.name}': {size:,} bytes",
                metadata={"path": str(path), "size_bytes": size, "action": "get_size"}
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Failed to calculate size for '{path}': {e}")

    def _replace(self, path: Path, target_content: str, replacement_content: str) -> SkillResult:
        try:
            if not path.exists():
                return SkillResult(success=False, data=None, error=f"File not found: {path}")
            if not target_content:
                return SkillResult(success=False, data=None, error="Action 'replace' requires 'target_content' parameter")

            text = path.read_text(encoding="utf-8", errors="replace")
            if target_content not in text:
                return SkillResult(success=False, data=None, error=f"Target content snippet not found in '{path.name}'. Ensure exact character/line match.")

            count = text.count(target_content)
            new_text = text.replace(target_content, replacement_content, 1)
            path.write_text(new_text, encoding="utf-8")

            return SkillResult(
                success=True,
                data=f"Successfully replaced target block in '{path.name}' ({count} match(es) found).",
                metadata={"path": str(path), "matches": count, "action": "replace"}
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Replace operation failed on '{path}': {e}")

    def _multi_replace(self, path: Path, replacements: list[dict]) -> SkillResult:
        try:
            if not path.exists():
                return SkillResult(success=False, data=None, error=f"File not found: {path}")
            if not replacements or not isinstance(replacements, list):
                return SkillResult(success=False, data=None, error="Action 'multi_replace' requires 'replacements' list of dicts parameter")

            text = path.read_text(encoding="utf-8", errors="replace")
            applied = 0
            for item in replacements:
                target = item.get("target_content", item.get("target", ""))
                replacement = item.get("replacement_content", item.get("replacement", ""))
                if target and target in text:
                    text = text.replace(target, replacement, 1)
                    applied += 1

            path.write_text(text, encoding="utf-8")

            return SkillResult(
                success=True,
                data=f"Successfully applied {applied}/{len(replacements)} non-contiguous block replacements to '{path.name}'.",
                metadata={"path": str(path), "applied": applied, "action": "multi_replace"}
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Multi-replace operation failed on '{path}': {e}")

    def _write(self, path: Path, content: str) -> SkillResult:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            return SkillResult(
                success=True,
                data=f"Successfully wrote {len(content)} characters to {path.name}",
                metadata={"path": str(path), "size": len(content), "action": "write"}
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=str(e))

    def _read(self, path: Path, start, end) -> SkillResult:
        try:
            if not path.exists():
                return SkillResult(success=False, data=None, error=f"File not found: {path}")
            if path.is_dir():
                return self._list(path)
            if path.stat().st_size > 500_000:
                return SkillResult(success=False, data=None, error=f"File too large (>500KB): {path}")

            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
            total = len(lines)

            if start is not None or end is not None:
                s = max(1, int(start) if start else 1)
                e = min(total, int(end) if end else total)
                chunk = lines[s - 1:e]
                header = f"<!-- {path.name} lines {s}-{e} of {total} -->\n"
                content = header + "```\n" + "\n".join(chunk) + "\n```"
            else:
                content = "```\n" + "\n".join(lines) + "\n```"

            return SkillResult(
                success=True, data=content,
                metadata={"path": str(path), "total_lines": total, "action": "read"}
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=str(e))

    def _list(self, path: Path) -> SkillResult:
        try:
            if not path.exists():
                return SkillResult(success=False, data=None, error=f"Path not found: {path}")
            target = path if path.is_dir() else path.parent
            entries = sorted(target.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
            lines = []
            for e in entries:
                prefix = "__DIR__" if e.is_dir() else "__FILE__"
                size = f" ({e.stat().st_size:,}B)" if e.is_file() else ""
                lines.append(f"{prefix} {e.name}{size}")
            text = f"Directory: {target}\n" + ("\n".join(lines) or "(empty)")
            return SkillResult(success=True, data=text, metadata={"path": str(target), "count": len(entries), "action": "list"})
        except Exception as e:
            return SkillResult(success=False, data=None, error=str(e))

    def _grep(self, path: Path, pattern: str) -> SkillResult:
        try:
            if not pattern:
                return SkillResult(success=False, data=None, error="Pattern required for grep")
            root = path if path.is_dir() else path.parent
            results = []
            for f in sorted(root.rglob("*")):
                if f.is_file() and f.stat().st_size < 500_000:
                    try:
                        for i, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
                            if pattern.lower() in line.lower():
                                results.append(f"{f.relative_to(root)}:{i}: {line.strip()}")
                                if len(results) >= 100:
                                    break
                    except Exception:
                        pass
                if len(results) >= 100:
                    break
            text = "\n".join(results) if results else f"No matches for '{pattern}'"
            return SkillResult(success=True, data=text, metadata={"pattern": pattern, "matches": len(results), "action": "grep"})
        except Exception as e:
            return SkillResult(success=False, data=None, error=str(e))

    def _search(self, path: Path, pattern: str) -> SkillResult:
        try:
            root = path if path.is_dir() else path.parent
            pat  = pattern or "*"
            matches = [str(m.relative_to(root)) for m in sorted(root.rglob(pat))[:80]]
            text = "\n".join(matches) if matches else f"No files matching '{pat}'"
            return SkillResult(success=True, data=text, metadata={"pattern": pat, "count": len(matches), "action": "search"})
        except Exception as e:
            return SkillResult(success=False, data=None, error=str(e))

    def get_parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["read", "write", "replace", "multi_replace", "delete", "copy", "move", "create_dir", "get_size", "list", "grep", "search"],
                    "description": "Operation: read, write, replace (surgical single block edit), multi_replace (multiple non-contiguous edits), delete, copy, move, create_dir, get_size, list, grep, search.",
                },
                "path": {
                    "type": "string",
                    "description": "Absolute path or relative project path to target file or directory.",
                },
                "destination": {
                    "type": "string",
                    "description": "Destination path required for copy or move actions.",
                },
                "content": {
                    "type": "string",
                    "description": "Required for write action: complete text/code content to write to the file.",
                },
                "target_content": {
                    "type": "string",
                    "description": "Required for replace action: exact string/lines of code to target for replacement.",
                },
                "replacement_content": {
                    "type": "string",
                    "description": "Required for replace action: new replacement code/text to substitute in.",
                },
                "replacements": {
                    "type": "array",
                    "description": "Required for multi_replace action: list of objects containing [{target_content: 'old', replacement_content: 'new'}]",
                },
                "pattern": {
                    "type": "string",
                    "description": "For grep: text to search inside files. For search: filename glob pattern (e.g. *.css)",
                },
                "start_line": {"type": "integer", "description": "Start line for partial read (1-indexed)"},
                "end_line":   {"type": "integer", "description": "End line for partial read (inclusive)"},
            },
            "required": ["action", "path"],
        }

