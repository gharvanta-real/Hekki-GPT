"""
context_manager.py — Sliding-window token manager & symbol indexer for Hekki Engine.
Under 130 lines.
"""

from __future__ import annotations
import os
import logging
from typing import Optional
from mariano.config.prompt_loader import load_native_coder_prompt

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
        except Exception as e:
            logger.warning(f"Failed to index symbols for {file_path}: {e}")

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
        base_prompt = load_native_coder_prompt()
        return f"{base_prompt}\n\n[WORKSPACE TREE]\n{workspace_tree}\n"
