"""MARIANO - Episodic memory backed by SQLite (with task log)."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import aiosqlite
import structlog

from mariano.config import get_settings

log = structlog.get_logger(__name__)

CREATE_MEMORIES = """
CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
)
"""

CREATE_EPISODES = """
CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_input TEXT NOT NULL,
    assistant_output TEXT,
    tools_used TEXT DEFAULT '[]',
    success INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
)
"""

CREATE_TASK_LOG = """
CREATE TABLE IF NOT EXISTS task_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    files TEXT DEFAULT '[]',
    success INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
)
"""

CREATE_CHAT_SESSIONS = """
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project TEXT,
    pinned INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
)
"""

CREATE_CHAT_MESSAGES = """
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    timestamp TEXT NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
)
"""


class EpisodicStore:
    """SQLite-backed episodic, long-term memory and task log."""

    def __init__(self) -> None:
        self._db_path = get_settings().sqlite_path
        self._db_path.parent.mkdir(parents=True, exist_ok=True)

    def _connect(self):
        return aiosqlite.connect(self._db_path, timeout=30.0)

    async def _ensure_tables(self, db) -> None:
        """Ensures all required tables exist in SQLite database."""
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA synchronous=NORMAL")
        await db.execute(CREATE_MEMORIES)
        await db.execute(CREATE_EPISODES)
        await db.execute(CREATE_TASK_LOG)
        await db.execute(CREATE_CHAT_SESSIONS)
        await db.execute(CREATE_CHAT_MESSAGES)
        await db.commit()

    async def initialize(self) -> None:
        async with self._connect() as db:
            await self._ensure_tables(db)
        log.info("episodic.initialized", path=str(self._db_path))


    # ---- Memories ----

    async def store(self, content: str, category: str = "general", metadata: dict | None = None) -> None:
        async with self._connect() as db:
            await self._ensure_tables(db)
            await db.execute(
                "INSERT INTO memories (content, category, metadata, created_at) VALUES (?, ?, ?, ?)",
                (content, category, json.dumps(metadata or {}), datetime.utcnow().isoformat()))
            await db.commit()

    async def search(self, query: str, limit: int = 5) -> list[dict]:
        words = query.lower().split()
        async with self._connect() as db:
            await self._ensure_tables(db)
            db.row_factory = aiosqlite.Row
            conditions = " OR ".join(["LOWER(content) LIKE ?" for _ in words])
            params = [f"%{w}%" for w in words] + [limit]
            sql = f"SELECT * FROM memories WHERE {conditions} ORDER BY created_at DESC LIMIT ?"
            cursor = await db.execute(sql, params)
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_recent(self, limit: int = 10) -> list[dict]:
        async with self._connect() as db:
            await self._ensure_tables(db)
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM memories ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    # ---- Episodes ----

    async def store_episode(self, user_input: str, assistant_output: str,
                             tools_used: list[str], success: bool) -> None:
        async with self._connect() as db:
            await self._ensure_tables(db)
            await db.execute(
                "INSERT INTO episodes (user_input, assistant_output, tools_used, success, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_input, assistant_output, json.dumps(tools_used), int(success), datetime.utcnow().isoformat()))
            await db.commit()

    async def get_episodes(self, limit: int = 50) -> list[dict]:
        async with self._connect() as db:
            await self._ensure_tables(db)
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM episodes ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    # ---- Task Log ----

    async def log_task(self, chat_id: str | None, action: str, detail: str,
                        files: list[str] | None = None, success: bool = True) -> None:
        """Append a structured task log entry."""
        async with self._connect() as db:
            await self._ensure_tables(db)
            await db.execute(
                "INSERT INTO task_log (chat_id, action, detail, files, success, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (chat_id or "__global__", action, detail,
                 json.dumps(files or []), int(success), datetime.utcnow().isoformat()))
            await db.commit()

    async def get_task_log(self, chat_id: str | None = None, limit: int = 50) -> list[dict]:
        """Retrieve task log entries. Pass chat_id to filter by session."""
        async with self._connect() as db:
            await self._ensure_tables(db)
            db.row_factory = aiosqlite.Row
            if chat_id:
                cursor = await db.execute(
                    "SELECT * FROM task_log WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?",
                    (chat_id, limit))
            else:
                cursor = await db.execute(
                    "SELECT * FROM task_log ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = await cursor.fetchall()
            results = []
            for r in rows:
                d = dict(r)
                try:
                    d["files"] = json.loads(d.get("files", "[]"))
                except Exception:
                    d["files"] = []
                results.append(d)
            return results

    # ---- Chat Sessions & Messages ----

    async def get_all_chats(self) -> list[dict]:
        """Fetch all chat sessions along with their messages, sorted by latest activity time."""
        async with self._connect() as db:
            await self._ensure_tables(db)
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM chat_sessions")
            sessions = [dict(r) for r in await cursor.fetchall()]
            
            for s in sessions:
                s["pinned"] = bool(s.get("pinned", 0))
                s["archived"] = bool(s.get("archived", 0))
                s["messages"] = []

            cursor = await db.execute("SELECT * FROM chat_messages ORDER BY timestamp ASC")
            messages = [dict(r) for r in await cursor.fetchall()]
            
            session_map = {s["id"]: s for s in sessions}
            for m in messages:
                cid = m["chat_id"]
                if cid in session_map:
                    try:
                        m_meta = json.loads(m.get("metadata", "{}"))
                    except Exception:
                        m_meta = {}
                    session_map[cid]["messages"].append({
                        "role": m["role"],
                        "text": m["text"],
                        "timestamp": m["timestamp"],
                        "metadata": m_meta
                    })

            def get_sort_key(s):
                if s.get("messages") and len(s["messages"]) > 0:
                    last_ts = s["messages"][-1].get("timestamp")
                    if last_ts:
                        return str(last_ts)
                return str(s.get("created_at") or s.get("timestamp") or "")

            sessions.sort(key=get_sort_key, reverse=True)
            return sessions

    async def sync_chats(self, chats: list[dict]) -> None:
        """Syncs the entire chats list by replacing or inserting sessions & messages."""
        async with self._connect() as db:
            await self._ensure_tables(db)
            await db.execute("DELETE FROM chat_sessions")
            await db.execute("DELETE FROM chat_messages")
            
            for c in chats:
                chat_id = c.get("id")
                if not chat_id:
                    continue
                await db.execute(
                    "INSERT INTO chat_sessions (id, title, project, pinned, archived, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (chat_id, c.get("title", ""), c.get("project"), int(c.get("pinned", False)), int(c.get("archived", False)), c.get("timestamp", datetime.utcnow().isoformat()))
                )
                for m in c.get("messages", []):
                    meta_str = json.dumps(m.get("metadata", {})) if m.get("metadata") else "{}"
                    await db.execute(
                        "INSERT INTO chat_messages (chat_id, role, text, metadata, timestamp) VALUES (?, ?, ?, ?, ?)",
                        (chat_id, m.get("role", "user"), m.get("text", ""), meta_str, m.get("timestamp", datetime.utcnow().isoformat()))
                    )
            await db.commit()

    async def save_single_message(self, chat_id: str, role: str, text: str, metadata: dict | None = None) -> None:
        """Saves a single message under an existing chat session. Auto-creates the session if missing."""
        async with self._connect() as db:
            await self._ensure_tables(db)
            now_iso = datetime.utcnow().isoformat()
            cursor = await db.execute("SELECT 1 FROM chat_sessions WHERE id = ?", (chat_id,))
            exists = await cursor.fetchone()
            if not exists:
                await db.execute(
                    "INSERT INTO chat_sessions (id, title, project, created_at) VALUES (?, ?, ?, ?)",
                    (chat_id, text[:30] + "..." if len(text) > 30 else text, None, now_iso)
                )
            else:
                await db.execute(
                    "UPDATE chat_sessions SET created_at = ? WHERE id = ?",
                    (now_iso, chat_id)
                )
            
            meta_str = json.dumps(metadata) if metadata else "{}"
            await db.execute(
                "INSERT INTO chat_messages (chat_id, role, text, metadata, timestamp) VALUES (?, ?, ?, ?, ?)",
                (chat_id, role, text, meta_str, now_iso)
            )
            await db.commit()

