"""MARIANO Web Watchers — Background tasks for static hot-reload and live UI event streaming."""
from __future__ import annotations

import os
import json
import asyncio
from pathlib import Path
from datetime import datetime
import structlog
from fastapi import WebSocket

log = structlog.get_logger(__name__)

# Registry holding active websocket client sockets
active_connections: list[WebSocket] = []


async def broadcast_reminder_notification(text: str):
    """Broadcasts a real-time reminder notification event to all connected WebSocket clients."""
    log.info("reminder.broadcast_triggered", text=text)
    for ws in list(active_connections):
        try:
            await ws.send_json({
                "type": "agent_event",
                "kind": "reminder_trigger",
                "data": text,
                "metadata": {
                    "timestamp": datetime.utcnow().isoformat()
                }
            })
        except Exception as exc:
            log.error("reminder.broadcast_failed", error=str(exc))


async def watch_static_files(connections: list[WebSocket]):
    """Periodically scans static files for modifications, pushing live hot-reload triggers to browser."""
    static_dir = Path(__file__).resolve().parent / "static"

    def get_mtimes() -> dict[str, float]:
        mtimes = {}
        for p in static_dir.glob("**/*"):
            if p.is_file():
                if p.suffix in (".json", ".jsonl"):
                    continue
                try:
                    mtimes[str(p)] = os.path.getmtime(p)
                except OSError:
                    pass
        return mtimes

    last_mtimes = get_mtimes()

    while True:
        await asyncio.sleep(0.5)
        if not connections:
            continue

        current_mtimes = get_mtimes()
        changed = False

        for filepath, mtime in current_mtimes.items():
            if filepath not in last_mtimes or mtime > last_mtimes[filepath]:
                changed = True
                break

        if not changed:
            for filepath in last_mtimes:
                if filepath not in current_mtimes:
                    changed = True
                    break

        if changed:
            log.info("web.static_files_modified_broadcasting_reload")
            last_mtimes = current_mtimes
            for ws in list(connections):
                try:
                    await ws.send_json({"type": "reload_frontend"})
                except Exception:
                    pass


async def watch_ui_events(connections: list[WebSocket]):
    """Watches ui_events.jsonl for new UI events written by skills and pushes them live to browser."""
    events_path = Path(__file__).resolve().parent / "static" / "ui_events.jsonl"
    last_pos = 0
    if events_path.exists():
        last_pos = events_path.stat().st_size

    while True:
        await asyncio.sleep(0.2)
        if not connections or not events_path.exists():
            continue
        try:
            current_size = events_path.stat().st_size
            if current_size < last_pos:
                last_pos = 0
            if current_size <= last_pos:
                continue
            with events_path.open("r", encoding="utf-8") as f:
                f.seek(last_pos)
                new_lines = f.readlines()
                last_pos = f.tell()
            for line in new_lines:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                    log.info("web.ui_event_broadcasting", ui_event=event.get("event"))
                    for ws in list(connections):
                        try:
                            await ws.send_json(event)
                        except Exception:
                            pass
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            log.error("web.ui_event_watcher_error", error=str(e))
