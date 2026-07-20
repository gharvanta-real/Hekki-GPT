"""
Hekki Coder Engine — AST Guard (v2)

Provides cross-platform AST-aware structure validation, node verification,
and sibling path suggestions (re-routing suggestions on failed edits).

v2 changes:
  - Fixed ASTNodeInfo dataclass: children uses field(default_factory=list)
  - Fixed Python AST attribute: end_lineno (not end_line)
  - Added LRU AST cache keyed by (file_path, mtime) to avoid re-parsing unchanged files
"""
from __future__ import annotations
import ast
import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional, Tuple


@dataclass
class ASTNodeInfo:
    name: str
    type: str          # "class", "function", "generic"
    start_line: int
    end_line: int
    parent: Optional[str] = None
    children: List[str] = field(default_factory=list)  # Fixed: was `= list` (bug)


# ---------------------------------------------------------------------------
# Module-level parse cache: (file_path, mtime) → list[ASTNodeInfo]
# Avoids re-parsing a file that hasn't changed since last call.
# ---------------------------------------------------------------------------
_ast_cache: Dict[Tuple[str, float], List[ASTNodeInfo]] = {}
_AST_CACHE_MAX = 64  # evict oldest entries beyond this limit


def _cache_get(file_path: str) -> Optional[List[ASTNodeInfo]]:
    try:
        mtime = os.path.getmtime(file_path)
        return _ast_cache.get((file_path, mtime))
    except OSError:
        return None


def _cache_set(file_path: str, nodes: List[ASTNodeInfo]) -> None:
    try:
        mtime = os.path.getmtime(file_path)
        if len(_ast_cache) >= _AST_CACHE_MAX:
            # Evict oldest entry
            oldest_key = next(iter(_ast_cache))
            del _ast_cache[oldest_key]
        _ast_cache[(file_path, mtime)] = nodes
    except OSError:
        pass


class ASTGuard:
    """
    Validates existence of symbol nodes and compiles list of sibling suggestions
    to redirect the LLM coder agent away from hallucinations.

    Uses an mtime-keyed module-level cache so repeated calls on unchanged files
    skip the AST parse entirely.
    """

    def __init__(self, file_path: str, content: str) -> None:
        self.file_path = file_path
        self.content = content
        self.nodes: List[ASTNodeInfo] = []
        self._parse()

    def _parse(self) -> None:
        """Try cache first; otherwise parse and cache result."""
        cached = _cache_get(self.file_path)
        if cached is not None:
            self.nodes = cached
            return

        if self.file_path.endswith(".py"):
            self._parse_python()
        else:
            self._parse_fallback()

        _cache_set(self.file_path, self.nodes)

    def _parse_python(self) -> None:
        """Parses Python code using the native ast module."""
        try:
            tree = ast.parse(self.content)

            class Visitor(ast.NodeVisitor):
                def __init__(self_v, guard: ASTGuard):
                    self_v.guard = guard
                    self_v.current_parent: Optional[str] = None

                def _make_node(self_v, node: ast.AST, kind: str) -> ASTNodeInfo:
                    return ASTNodeInfo(
                        name=node.name,            # type: ignore[attr-defined]
                        type=kind,
                        start_line=node.lineno,    # type: ignore[attr-defined]
                        # Fixed: end_lineno is the correct Python 3.8+ attribute
                        end_line=getattr(node, "end_lineno", node.lineno),  # type: ignore[attr-defined]
                        parent=self_v.current_parent,
                    )

                def visit_ClassDef(self_v, node: ast.ClassDef):
                    info = self_v._make_node(node, "class")
                    self_v.guard.nodes.append(info)
                    old = self_v.current_parent
                    self_v.current_parent = node.name
                    self_v.generic_visit(node)
                    self_v.current_parent = old

                def visit_FunctionDef(self_v, node: ast.FunctionDef):
                    info = self_v._make_node(node, "function")
                    self_v.guard.nodes.append(info)
                    old = self_v.current_parent
                    self_v.current_parent = node.name
                    self_v.generic_visit(node)
                    self_v.current_parent = old

                def visit_AsyncFunctionDef(self_v, node: ast.AsyncFunctionDef):
                    info = self_v._make_node(node, "function")
                    self_v.guard.nodes.append(info)
                    old = self_v.current_parent
                    self_v.current_parent = node.name
                    self_v.generic_visit(node)
                    self_v.current_parent = old

            Visitor(self).visit(tree)

        except Exception:
            self._parse_fallback()

    def _parse_fallback(self) -> None:
        """Fallback line-based parser for C/C++, JavaScript, TypeScript, etc."""
        lines = self.content.splitlines()
        class_regex = re.compile(r"^\s*(class|interface)\s+(\w+)")
        func_regex = re.compile(r"^\s*(function|def|void|int|async|export\s+function)\s+(\w+)\s*\(")

        current_class: Optional[str] = None
        for i, line in enumerate(lines):
            line_num = i + 1
            class_match = class_regex.match(line)
            if class_match:
                name = class_match.group(2)
                self.nodes.append(ASTNodeInfo(
                    name=name, type="class",
                    start_line=line_num, end_line=line_num,
                ))
                current_class = name
                continue

            func_match = func_regex.match(line)
            if func_match:
                name = func_match.group(2)
                self.nodes.append(ASTNodeInfo(
                    name=name, type="function",
                    start_line=line_num, end_line=line_num,
                    parent=current_class,
                ))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def verify_node(self, node_name: str) -> Optional[ASTNodeInfo]:
        """Returns ASTNodeInfo if node exists, otherwise None."""
        for node in self.nodes:
            if node.name == node_name:
                return node
        return None

    def get_sibling_suggestions(self, failed_node_name: str) -> List[str]:
        """
        Returns up to 6 symbol names ranked by fuzzy string similarity to the
        failed query, directing the agent back toward valid targets.
        """
        from difflib import SequenceMatcher
        scored = [
            (SequenceMatcher(None, node.name, failed_node_name).ratio(), node.name)
            for node in self.nodes
            if node.name != failed_node_name
        ]
        scored.sort(reverse=True, key=lambda x: x[0])
        return [name for _, name in scored[:6]]

    def list_all_symbols(self) -> List[Dict[str, object]]:
        """Returns all parsed symbols — useful for frontend file-tree rendering."""
        return [
            {
                "name": n.name,
                "type": n.type,
                "start_line": n.start_line,
                "end_line": n.end_line,
                "parent": n.parent,
            }
            for n in self.nodes
        ]
