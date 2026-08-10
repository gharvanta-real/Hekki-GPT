"""
Hekki Code Session Store — Antigravity Dual-Layer Persistence Engine
SQLite Metadata Indexing + JSONL Event Transcript Streams
"""
import os
import json
import sqlite3
from datetime import datetime

DB_PATH = os.path.join("data", "hekki.db")
CONVERSATIONS_DIR = os.path.join("data", "conversations")


def _get_db():
    os.makedirs("data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_session_tables():
    conn = _get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS code_sessions (
            session_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            workspace TEXT,
            model TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def create_session(session_id: str, title: str, workspace: str = "", model: str = "gemini-3.1-flash-lite") -> dict:
    init_session_tables()
    now = datetime.utcnow().isoformat() + "Z"
    clean_title = (title or "New Conversation").strip()
    if len(clean_title) > 60:
        clean_title = clean_title[:57] + "..."

    conn = _get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO code_sessions (session_id, title, workspace, model, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET title=?, updated_at=?
    """, (session_id, clean_title, workspace, model, now, now, clean_title, now))
    conn.commit()
    conn.close()

    # Ensure transcript folder exists
    os.makedirs(os.path.join(CONVERSATIONS_DIR, session_id), exist_ok=True)

    return {
        "session_id": session_id,
        "title": clean_title,
        "workspace": workspace,
        "model": model,
        "created_at": now,
        "updated_at": now
    }


def list_sessions(workspace: str = None) -> list:
    init_session_tables()
    conn = _get_db()
    cursor = conn.cursor()
    if workspace:
        cursor.execute("SELECT * FROM code_sessions WHERE workspace=? ORDER BY updated_at DESC", (workspace,))
    else:
        cursor.execute("SELECT * FROM code_sessions ORDER BY updated_at DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session(session_id: str) -> dict:
    init_session_tables()
    conn = _get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM code_sessions WHERE session_id=?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def append_transcript_event(session_id: str, event: dict):
    if not session_id:
        return
    sess_dir = os.path.join(CONVERSATIONS_DIR, session_id)
    os.makedirs(sess_dir, exist_ok=True)
    jsonl_path = os.path.join(sess_dir, "transcript.jsonl")

    event_record = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        **event
    }
    with open(jsonl_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(event_record, ensure_ascii=False) + "\n")

    # Touch updated_at in DB
    now = datetime.utcnow().isoformat() + "Z"
    conn = _get_db()
    conn.execute("UPDATE code_sessions SET updated_at=? WHERE session_id=?", (now, session_id))
    conn.commit()
    conn.close()


def get_transcript_events(session_id: str) -> list:
    jsonl_path = os.path.join(CONVERSATIONS_DIR, session_id, "transcript.jsonl")
    if not os.path.exists(jsonl_path):
        return []
    events = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            l = line.strip()
            if l:
                try:
                    events.append(json.loads(l))
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning("Failed to decode event: %s", e)
    return events
