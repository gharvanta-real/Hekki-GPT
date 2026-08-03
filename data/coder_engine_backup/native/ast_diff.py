"""
ast_diff.py — 2-Phase fast AST change detector (<5ms latency).
Phase 1: Line-hash region diff filter.
Phase 2: Localized subtree AST parse & complexity score (0-3).
Under 120 lines.
"""

from __future__ import annotations
import ast
import hashlib
import logging
from mariano.coder_engine.native.models import ChangeSummary

logger = logging.getLogger("Hekki.ASTDiff")


def _hash_line(line: str) -> str:
    return hashlib.md5(line.strip().encode("utf-8")).hexdigest()[:8]


def compute_line_region_diff(old_content: str, new_content: str) -> tuple[int, int]:
    """Phase 1: Line-hash filter to isolate changed region line count."""
    old_lines = [line.strip() for line in old_content.splitlines() if line.strip()]
    new_lines = [line.strip() for line in new_content.splitlines() if line.strip()]

    old_hashes = set(_hash_line(l) for l in old_lines)
    new_hashes = set(_hash_line(l) for l in new_lines)

    changed_old = [h for h in old_hashes if h not in new_hashes]
    changed_new = [h for h in new_hashes if h not in old_hashes]

    diff_count = max(len(changed_old), len(changed_new))
    return diff_count, abs(len(new_lines) - len(old_lines))


def analyze_ast_complexity(content: str) -> int:
    """Phase 2: Localized AST analysis — assigns complexity score 0 (simple) to 3 (heavy)."""
    try:
        tree = ast.parse(content)
        nodes = list(ast.walk(tree))
        node_count = len(nodes)
        
        funcs = [n for n in nodes if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
        classes = [n for n in nodes if isinstance(n, ast.ClassDef)]

        if len(classes) > 2 or len(funcs) > 10 or node_count > 250:
            return 3
        elif len(classes) > 0 or len(funcs) > 3 or node_count > 100:
            return 2
        elif node_count > 30:
            return 1
        return 0
    except SyntaxError:
        return 3  # Malformed AST gets max complexity for self-correction


def detect_ast_changes(old_content: str, new_content: str) -> ChangeSummary:
    """Main entry for 2-phase change detection (<5ms)."""
    if old_content == new_content:
        return ChangeSummary(has_changes=False, complexity_score=0, changed_lines=0, description="No changes")

    diff_count, line_delta = compute_line_region_diff(old_content, new_content)
    complexity = analyze_ast_complexity(new_content)

    return ChangeSummary(
        has_changes=True,
        complexity_score=min(3, complexity),
        changed_lines=diff_count + line_delta,
        description=f"Diff count: {diff_count}, complexity score: {complexity}/3"
    )
