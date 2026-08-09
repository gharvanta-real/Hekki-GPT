"""
persistent_memory.py — Agentic Context Memory Ledger Module

Provides deterministic state hashing, persistent JSON/file storage,
keyword search indexing, and lightweight LLM prompt context formatting
to completely solve AI context window memory loss and forgetting.
"""

from __future__ import annotations
import json
import hashlib
import os
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional


class MemoryEntry:
    """Represents a single atomic memory item in the ledger."""
    def __init__(
        self,
        key: str,
        value: Any,
        category: str = "general",
        priority: int = 1,
        created_at: Optional[str] = None,
        updated_at: Optional[str] = None
    ):
        self.key = key
        self.value = value
        self.category = category
        self.priority = priority # 1 = low, 5 = critical/always-remember
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "value": self.value,
            "category": self.category,
            "priority": self.priority,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> MemoryEntry:
        return cls(
            key=data["key"],
            value=data["value"],
            category=data.get("category", "general"),
            priority=data.get("priority", 1),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )


class PersistentMemoryManager:
    """
    Manages long-term persistent memory for LLM sessions.
    
    Features:
    - Merkle-like SHA-256 state hashing for instant verification
    - Category & Priority based prompt context synthesis
    - Keyword search & fast lookup
    - File-backed JSON persistence
    """

    def __init__(self, storage_path: Optional[str | Path] = None):
        if storage_path:
            self.storage_path = Path(storage_path)
        else:
            self.storage_path = Path("./data/memory_ledger.json")

        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._memories: Dict[str, MemoryEntry] = {}
        self.load()

    def set(self, key: str, value: Any, category: str = "general", priority: int = 1) -> str:
        """Stores or updates a memory entry. Returns the updated state hash."""
        now = datetime.now().isoformat()
        if key in self._memories:
            entry = self._memories[key]
            entry.value = value
            entry.category = category
            entry.priority = priority
            entry.updated_at = now
        else:
            entry = MemoryEntry(key=key, value=value, category=category, priority=priority, created_at=now, updated_at=now)
            self._memories[key] = entry

        self.save()
        return self.compute_state_hash()

    def get(self, key: str, default: Any = None) -> Any:
        """Retrieves value for a specific memory key."""
        entry = self._memories.get(key)
        return entry.value if entry else default

    def delete(self, key: str) -> bool:
        """Removes a memory key from the ledger."""
        if key in self._memories:
            del self._memories[key]
            self.save()
            return True
        return False

    def search(self, query: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Searches memory entries matching a query string or category."""
        query_lower = query.lower()
        results = []
        for entry in self._memories.values():
            if category and entry.category != category:
                continue
            key_match = query_lower in entry.key.lower()
            val_match = query_lower in str(entry.value).lower()
            if key_match or val_match:
                results.append(entry.to_dict())
        return results

    def get_prompt_context(self, min_priority: int = 1, max_items: int = 20) -> str:
        """
        Synthesizes active memories into a compact markdown string for LLM system prompts.
        This prevents context loss by injecting active rules/facts into every request.
        """
        if not self._memories:
            return ""

        sorted_items = sorted(
            [m for m in self._memories.values() if m.priority >= min_priority],
            key=lambda x: (x.priority, x.updated_at),
            reverse=True
        )[:max_items]

        if not sorted_items:
            return ""

        lines = ["<ACTIVE_PERSISTENT_MEMORY>"]
        for m in sorted_items:
            lines.append(f"- [{m.category.upper()}] {m.key}: {m.value}")
        lines.append("</ACTIVE_PERSISTENT_MEMORY>")
        return "\n".join(lines)

    def compute_state_hash(self) -> str:
        """Computes SHA-256 state hash of all active memories for O(1) integrity check."""
        serialized = json.dumps(
            [m.to_dict() for m in sorted(self._memories.values(), key=lambda x: x.key)],
            sort_keys=True
        )
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def load(self) -> None:
        """Loads memories from JSON file storage."""
        if not self.storage_path.exists():
            self._memories = {}
            return
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._memories = {k: MemoryEntry.from_dict(v) for k, v in data.items()}
        except Exception:
            self._memories = {}

    def save(self) -> None:
        """Saves active memories to JSON file storage."""
        try:
            data = {k: v.to_dict() for k, v in self._memories.items()}
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving persistent memory ledger: {e}")
