"""MARIANO — GrepSearchSkill: Regex and literal string code searching."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from mariano.skills._base.skill_interface import BaseSkill, SkillResult
from mariano.core.workspace import PathGuard


class GrepSearchSkill(BaseSkill):
    name = "grep_search"
    description = (
        "Find pattern matches or exact literal text within files or directories. "
        "Returns matching filenames, line numbers, and snippets."
    )
    version = "1.0.0"
    tags = ["search", "grep", "code", "find"]

    async def execute(self, **kwargs: Any) -> SkillResult:
        query = kwargs.get("query", kwargs.get("Query", kwargs.get("pattern", "")))
        search_path_raw = kwargs.get("search_path", kwargs.get("SearchPath", kwargs.get("path", ".")))
        case_insensitive = kwargs.get("case_insensitive", kwargs.get("CaseInsensitive", True))
        is_regex = kwargs.get("is_regex", kwargs.get("IsRegex", False))
        match_per_line = kwargs.get("match_per_line", kwargs.get("MatchPerLine", True))
        includes = kwargs.get("includes", kwargs.get("Includes", []))

        if not query:
            return SkillResult(success=False, data=None, error="Parameter 'query' is required.")

        try:
            active_proj_path = PathGuard.get_active_project_path()
            resolved = self._resolve_path(search_path_raw, active_proj_path)
            resolved = PathGuard.secure_path(resolved)

            flags = re.IGNORECASE if case_insensitive else 0
            pattern = re.compile(query if is_regex else re.escape(query), flags)

            matches = []
            files_to_scan = []

            if resolved.is_file():
                files_to_scan = [resolved]
            elif resolved.is_dir():
                for p in resolved.rglob("*"):
                    if p.is_file() and not any(part.startswith(".") or part in ("node_modules", "venv", "__pycache__", "dist", "build") for part in p.parts):
                        if includes:
                            if any(p.match(inc) for inc in includes):
                                files_to_scan.append(p)
                        else:
                            files_to_scan.append(p)

            for f in files_to_scan[:500]: # Cap file scan limit
                try:
                    text = f.read_text(encoding="utf-8", errors="ignore")
                    lines = text.splitlines()
                    for line_idx, line in enumerate(lines, start=1):
                        if pattern.search(line):
                            rel_p = str(f)
                            if match_per_line:
                                matches.append({
                                    "file": rel_p,
                                    "line": line_idx,
                                    "content": line.strip()[:200]
                                })
                            else:
                                if rel_p not in [m["file"] for m in matches]:
                                    matches.append({"file": rel_p})
                            if len(matches) >= 50:
                                break
                    if len(matches) >= 50:
                        break
                except Exception:
                    continue

            output_lines = [f"Found {len(matches)} matches for '{query}':"]
            for m in matches:
                if "line" in m:
                    output_lines.append(f"{m['file']}:{m['line']}: {m['content']}")
                else:
                    output_lines.append(m['file'])

            return SkillResult(
                success=True,
                data="\n".join(output_lines),
                metadata={"matches_count": len(matches), "query": query}
            )

        except PermissionError as pe:
            return SkillResult(
                success=False,
                data=None,
                error=str(pe),
                metadata={"__permission_request__": True, "attempted_path": str(search_path_raw), "action": "grep"}
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Grep search failed: {exc}")

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
                "query": {
                    "type": "string",
                    "description": "The search term or regex pattern to look for.",
                },
                "search_path": {
                    "type": "string",
                    "description": "Directory or file path to search inside.",
                },
                "case_insensitive": {
                    "type": "boolean",
                    "description": "Whether to perform case-insensitive search (default true).",
                },
                "is_regex": {
                    "type": "boolean",
                    "description": "Whether query should be treated as regex (default false).",
                },
                "match_per_line": {
                    "type": "boolean",
                    "description": "Whether to return matching lines and numbers (default true).",
                },
            },
            "required": ["query"],
        }
