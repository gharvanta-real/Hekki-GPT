"""
tools_base.py — Ultra-resilient Native Python execution tools for Hekki Engine.
Under 160 lines.
"""

from __future__ import annotations
import os
import re
import glob
import asyncio
import logging
from mariano.coder_engine.native.linter import check_code_syntax
from mariano.coder_engine.native.ast_diff import detect_ast_changes

logger = logging.getLogger("Hekki.NativeTools")
IGNORE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}


def tool_list_workspace_tree(workspace: str, max_depth: int = 3) -> str:
    if not os.path.exists(workspace):
        return f"[Error: Workspace path '{workspace}' does not exist]"
    tree = []
    base_depth = workspace.rstrip(os.sep).count(os.sep)
    for root, dirs, files in os.walk(workspace):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        cur_depth = root.count(os.sep) - base_depth
        if cur_depth >= max_depth:
            continue
        indent = "  " * cur_depth
        rel = os.path.relpath(root, workspace)
        tree.append(f"{indent}📁 {os.path.basename(root) if rel != '.' else rel}/")
        for f in files[:20]:
            tree.append(f"{indent}  📄 {f}")
        if len(files) > 20:
            tree.append(f"{indent}  ... ({len(files)-20} more files)")
    return "\n".join(tree[:80])


def tool_view_file(file_path: str, start_line: int = 1, end_line: int = 200) -> str:
    if not os.path.exists(file_path):
        return f"[Error: File '{file_path}' not found]"
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        total = len(lines)
        slice_lines = lines[max(0, start_line - 1):end_line]
        out = [f"{i + start_line}: {line.rstrip()}" for i, line in enumerate(slice_lines)]
        return f"--- {file_path} (Lines {start_line}-{min(end_line, total)} of {total}) ---\n" + "\n".join(out)
    except Exception as e:
        return f"[Read error: {e}]"


def tool_write_file(file_path: str, content: str) -> str:
    lines_count = len(content.splitlines())
    if lines_count > 500:
        return f"[Error: File exceeds strict 500 lines limit ({lines_count} lines). Split into modular files.]"

    is_valid, lint_msg = check_code_syntax(file_path, content)
    if not is_valid:
        return f"[Linter Error - File not saved]: {lint_msg}"

    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
    old_content = ""
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                old_content = f.read()
        except Exception:
            pass

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    summary = detect_ast_changes(old_content, content)
    return f"Successfully wrote {file_path} ({lines_count} lines). AST {summary.description}"


def tool_replace_file_content(file_path: str, target: str, replacement: str) -> str:
    """Replaces target content with fuzzy whitespace-resilient fallback."""
    if not os.path.exists(file_path):
        return f"[Error: File '{file_path}' not found]"
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    if target in content:
        new_content = content.replace(target, replacement, 1)
        return tool_write_file(file_path, new_content)

    # Fuzzy fallback: match ignoring whitespace leading/trailing spaces per line
    norm_target = "\n".join([line.strip() for line in target.splitlines() if line.strip()])
    norm_content_lines = content.splitlines()
    
    for i in range(len(norm_content_lines) - len(target.splitlines()) + 1):
        chunk = "\n".join([l.strip() for l in norm_content_lines[i:i + len(target.splitlines())] if l.strip()])
        if chunk == norm_target:
            orig_target = "\n".join(norm_content_lines[i:i + len(target.splitlines())])
            new_content = content.replace(orig_target, replacement, 1)
            return tool_write_file(file_path, new_content)

    return f"[Error: Target content block not found in {file_path}]"


def tool_grep_search(workspace: str, query: str) -> str:
    """Searches workspace files using case-insensitive & regex search."""
    results = []
    try:
        pattern = re.compile(query, re.IGNORECASE)
    except Exception:
        pattern = re.compile(re.escape(query), re.IGNORECASE)

    for root, dirs, files in os.walk(workspace):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for file in files:
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    for i, line in enumerate(f, 1):
                        if pattern.search(line):
                            results.append(f"{os.path.relpath(path, workspace)}:{i}: {line.strip()[:100]}")
                            if len(results) >= 25:
                                return "\n".join(results)
            except Exception:
                pass
    return "\n".join(results) if results else f"No matches found for '{query}'"


def tool_find_files(workspace: str, pattern: str) -> str:
    """Finds files by glob pattern across workspace."""
    results = []
    for root, dirs, files in os.walk(workspace):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            if glob.fnmatch.fnmatch(f.lower(), pattern.lower()):
                results.append(os.path.relpath(os.path.join(root, f), workspace))
                if len(results) >= 30:
                    break
    return "\n".join(results) if results else f"No files matching '{pattern}' found."


async def tool_run_command(cmd: str, cwd: str) -> str:
    """Runs shell command with cross-platform shell fallback."""
    try:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=45.0)
        out_str = stdout.decode("utf-8", errors="ignore").strip()
        err_str = stderr.decode("utf-8", errors="ignore").strip()
        res = (out_str + "\n" + err_str).strip() or f"[Command '{cmd}' finished with exit code {proc.returncode}]"
        return res[:1200]
    except asyncio.TimeoutError:
        return "[Error: Command execution timed out after 45 seconds]"
    except Exception as e:
        return f"[Execution error: {e}]"
