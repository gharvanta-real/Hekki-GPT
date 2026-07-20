"""MARIANO - Unified memory interface with per-session context isolation."""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

import structlog

from mariano.memory.short_term.context_window import ContextWindow
from mariano.memory.episodic.episodic_store import EpisodicStore

log = structlog.get_logger(__name__)


class MemoryManager:
    """
    Unified interface to all memory layers.
    
    Key design: each chat_id gets its own ContextWindow instance.
    No cross-session contamination. History seeded from SQLite on first access.
    """
    _instance: "MemoryManager | None" = None

    def __init__(self) -> None:
        # Per chat_id context windows
        self._contexts: dict[str, ContextWindow] = {}
        # Default global context for cases with no chat_id
        self._default_context: ContextWindow = ContextWindow(chat_id="__global__")
        self._episodic: EpisodicStore | None = None
        self._initialized = False

    @classmethod
    def get_instance(cls) -> "MemoryManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def initialize(self) -> None:
        if self._initialized:
            return
        self._episodic = EpisodicStore()
        await self._episodic.initialize()
        self._initialized = True
        log.info("memory.initialized")

    def get_context(self, chat_id: str | None = None) -> ContextWindow:
        """Return session-isolated ContextWindow for this chat_id."""
        if not chat_id:
            return self._default_context
        if chat_id not in self._contexts:
            self._contexts[chat_id] = ContextWindow(chat_id=chat_id)
        return self._contexts[chat_id]

    async def restore_session(self, chat_id: str, messages: list[dict]) -> None:
        """Seed context window from persisted chat history (call on WS connect)."""
        ctx = self.get_context(chat_id)
        if ctx.count == 0 and messages:
            ctx.seed_from_history(messages)
            log.info("memory.session_restored", chat_id=chat_id, msgs=len(messages))

    @property
    def context(self) -> ContextWindow:
        """Backwards-compatible: returns default global context."""
        return self._default_context

    # --- Episodic / Long-term ---

    async def store(self, content: str, category: str = "general", metadata: dict | None = None) -> None:
        if self._episodic:
            await self._episodic.store(content=content, category=category, metadata=metadata or {})
        log.debug("memory.stored", category=category, chars=len(content))

    async def search(self, query: str, limit: int = 5) -> list[dict]:
        if not self._episodic:
            return []
        return await self._episodic.search(query=query, limit=limit)

    async def get_recent(self, limit: int = 10) -> list[dict]:
        if not self._episodic:
            return []
        return await self._episodic.get_recent(limit=limit)

    async def store_episode(self, user_input: str, assistant_output: str,
                             tools_used: list[str], success: bool) -> None:
        if self._episodic:
            await self._episodic.store_episode(
                user_input=user_input, assistant_output=assistant_output,
                tools_used=tools_used, success=success)

    async def get_episodes(self, limit: int = 50) -> list[dict]:
        if not self._episodic:
            return []
        return await self._episodic.get_episodes(limit=limit)

    # --- Task Log ---

    async def log_task(self, chat_id: str | None, action: str, detail: str,
                        files: list[str] | None = None, success: bool = True) -> None:
        """Write a structured task log entry to the episodic store."""
        if self._episodic:
            await self._episodic.log_task(
                chat_id=chat_id, action=action, detail=detail,
                files=files or [], success=success)

    async def get_task_log(self, chat_id: str | None = None, limit: int = 50) -> list[dict]:
        """Retrieve task log entries, optionally filtered by chat_id."""
        if not self._episodic:
            return []
        return await self._episodic.get_task_log(chat_id=chat_id, limit=limit)

    async def get_session_summary(self, chat_id: str) -> str:
        """
        Build a markdown summary of what was done in this session.
        Used to seed AI context at session start.
        """
        if not self._episodic:
            return ""
        logs = await self._episodic.get_task_log(chat_id=chat_id, limit=20)
        if not logs:
            return ""
        lines = ["## Previous Session Task Log"]
        for entry in logs:
            ts = entry.get("created_at", "")[:16].replace("T", " ")
            action = entry.get("action", "")
            detail = entry.get("detail", "")
            files = entry.get("files", [])
            ok = "+" if entry.get("success") else "-"
            line = f"[{ts}] [{ok}] {action}: {detail}"
            if files:
                line += " | files: " + ", ".join(files[:5])
            lines.append(line)
        return "\n".join(lines)

    async def get_all_chats(self) -> list[dict]:
        if not self._episodic:
            return []
        return await self._episodic.get_all_chats()

    async def sync_chats(self, chats: list[dict]) -> None:
        if self._episodic:
            await self._episodic.sync_chats(chats)

    async def save_single_message(self, chat_id: str, role: str, text: str, metadata: dict | None = None) -> None:
        if self._episodic:
            await self._episodic.save_single_message(chat_id, role, text, metadata)

