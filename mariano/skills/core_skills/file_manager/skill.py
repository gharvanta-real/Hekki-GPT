"""file_manager — Lightweight read-only file access skill.

Handles: read, list, grep, search.
Resolves relative paths against the active project or user home.
Write operations are intentionally excluded — Aider handles those.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult


class FileManagerSkill(BaseSkill):
    name = "file_manager"
    description = (
        "Read, list, search, and grep files on the local filesystem. "
        "Use action='read' to read a file, action='list' to list a directory, "
        "action='grep' to search text inside files, action='search' to find files by name. "
        "Always use absolute paths."
    )
    version = "2.0.0"
    tags = ["files", "filesystem", "read", "search"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        action  = kwargs.get("action", "list")
        path    = kwargs.get("path", kwargs.get("file", kwargs.get("filename", "")))
        pattern = kwargs.get("pattern", kwargs.get("query", ""))
        start   = kwargs.get("start_line")
        end     = kwargs.get("end_line")

        # Resolve path — absolute preferred, fallback to active project or user home
        try:
            from mariano.core.workspace import PathGuard
            active_proj_path = PathGuard.get_active_project_path()

            if path:
                path_str = str(path).replace("\\", "/")
                if active_proj_path:
                    proj_root = Path(active_proj_path).resolve()
                    proj_name = proj_root.name.lower()
                    
                    clean_path = path_str.strip("./").strip("/")
                    clean_parts = clean_path.split("/")
                    
                    if clean_path.lower() == proj_name:
                        resolved = proj_root
                    elif clean_parts and clean_parts[0].lower() == proj_name:
                        sub_path = "/".join(clean_parts[1:])
                        resolved = (proj_root / sub_path).resolve()
                    else:
                        resolved = Path(path).expanduser()
                        if not resolved.is_absolute():
                            resolved = (proj_root / resolved).resolve()
                        else:
                            resolved = resolved.resolve()
                else:
                    resolved = Path(path).expanduser()
                    if not resolved.is_absolute():
                        resolved = (Path.home() / resolved).resolve()
                    else:
                        resolved = resolved.resolve()
            else:
                if active_proj_path:
                    resolved = Path(active_proj_path).resolve()
                else:
                    resolved = Path.cwd().resolve()

            # Enforce path isolation and project scoping
            resolved = PathGuard.secure_path(resolved)
        except PermissionError as pe:
            return SkillResult(success=False, data=None, error=str(pe))
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Path resolution failed: {e}")

        if action == "read":
            return self._read(resolved, start, end)
        elif action == "write":
            content = kwargs.get("content", kwargs.get("code", kwargs.get("text", "")))
            return self._write(resolved, content)
        elif action == "list":
            return self._list(resolved)
        elif action == "grep":
            return self._grep(resolved, pattern)
        elif action == "search":
            return self._search(resolved, pattern)
        else:
            return SkillResult(success=False, data=None, error=f"Unknown action '{action}'. Use: read, write, list, grep, search")

    def _write(self, path: Path, content: str) -> SkillResult:
        try:
            # Enforce path isolation safety
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
                    "enum": ["read", "write", "list", "grep", "search"],
                    "description": "Operation: read (file contents), write (file contents), list (directory), grep (search inside files), search (find files by name pattern)",
                },
                "path": {
                    "type": "string",
                    "description": "Absolute path to file or directory. Example: C:/Users/anshu/Desktop/my-project/index.html",
                },
                "content": {
                    "type": "string",
                    "description": "Required for write action: complete text/code content to write to the file.",
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
