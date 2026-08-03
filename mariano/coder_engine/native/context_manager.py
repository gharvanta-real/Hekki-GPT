"""
context_manager.py — Sliding-window token manager & symbol indexer for Hekki Engine.
Under 130 lines.
"""

from __future__ import annotations
import os
import logging
from typing import Optional

logger = logging.getLogger("Hekki.NativeContext")


class SymbolTrieNode:
    def __init__(self):
        self.children: dict[str, SymbolTrieNode] = {}
        self.files: set[str] = set()


class WorkspaceContextManager:
    """Manages token budgeting and workspace symbol index."""

    def __init__(self, workspace: str, max_tokens: int = 16000):
        self.workspace = workspace
        self.max_tokens = max_tokens
        self.root = SymbolTrieNode()

    def build_symbol_index(self):
        """Indexes symbols (function/class definitions) across workspace."""
        if not self.workspace or not os.path.exists(self.workspace):
            return

        for root, dirs, files in os.walk(self.workspace):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__"}]
            for f in files:
                if f.endswith((".py", ".js", ".ts", ".jsx", ".tsx")):
                    path = os.path.join(root, f)
                    self._index_file_symbols(path)

    def _index_file_symbols(self, file_path: str):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith(("def ", "class ", "function ", "const ", "export default function")):
                        parts = line.split()
                        if len(parts) > 1:
                            symbol = parts[1].split("(")[0].strip()
                            self._insert_symbol(symbol, file_path)
        except Exception:
            pass

    def _insert_symbol(self, symbol: str, file_path: str):
        node = self.root
        for char in symbol.lower():
            if char not in node.children:
                node.children[char] = SymbolTrieNode()
            node = node.children[char]
        node.files.add(file_path)

    def find_symbol_files(self, symbol_query: str) -> list[str]:
        """Sub-millisecond Trie lookup for file locations containing a symbol."""
        node = self.root
        for char in symbol_query.lower():
            if char not in node.children:
                return []
            node = node.children[char]
        return list(node.files)[:5]

    def prepare_system_prompt(self, workspace_tree: str) -> str:
        """Prepares master system prompt for the Native Engine ReAct loop."""
        return (
            "You are Hekki Native Coding Engine — an autonomous, highly capable AI developer.\n"
            "You have direct access to local workspace tools.\n\n"
            "SYSTEM RULES:\n"
            "1. ALWAYS inspect files or search the workspace before writing or modifying code.\n"
            "2. Never guess paths, imports, or variable names without viewing the source.\n"
            "3. Strictly keep every file UNDER 500 lines. Split into modular files if larger.\n"
            "4. Format tool calls as structured JSON in markdown codeblocks:\n"
            "```json\n"
            '{"tool": "tool_name", "args": {"arg_name": "value"}}\n'
            "```\n"
            "Available tools:\n"
            "- list_workspace_tree: args: {max_depth: 3}\n"
            "- view_file: args: {file_path: 'relative/or/abs/path', start_line: 1, end_line: 200}\n"
            "- write_file: args: {file_path: 'relative/or/abs/path', content: '...'}\n"
            "- replace_file_content: args: {file_path: '...', target: '...', replacement: '...'}\n"
            "- grep_search: args: {query: 'search_term_or_regex'}\n"
            "- find_files: args: {pattern: '*.py'}\n"
            "- run_command: args: {command: 'dir / git status / python ...'}\n"
            "When completed, respond with your final response.\n\n"
            f"[WORKSPACE TREE]\n{workspace_tree}\n"
        )
