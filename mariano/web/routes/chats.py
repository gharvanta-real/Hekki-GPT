"""Chat session persistence routes."""
from __future__ import annotations
import json
from fastapi import APIRouter, HTTPException
from mariano.memory.memory_manager import MemoryManager

router = APIRouter()


@router.get("/api/chats")
async def get_chats():
    try:
        chats = await MemoryManager.get_instance().get_all_chats()
        return {"chats": chats}
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("failed_to_get_chats", error=str(e))
        raise HTTPException(status_code=500, detail="Database error while fetching chats")


@router.post("/api/chats/sync")
async def sync_chats(req: dict):
    try:
        chats = req.get("chats", [])
        await MemoryManager.get_instance().sync_chats(chats)
        return {"success": True}
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("failed_to_sync_chats", error=str(e))
        raise HTTPException(status_code=500, detail="Database error while syncing chats")


@router.post("/api/chats/message")
async def save_single_message(req: dict):
    """Save a single message to an active chat session in SQLite database."""
    chat_id = req.get("chat_id")
    role = req.get("role", "user")
    text = req.get("text", "")
    metadata = req.get("metadata")
    if not chat_id or not text:
        raise HTTPException(status_code=400, detail="Missing required parameters: chat_id, text")
    try:
        await MemoryManager.get_instance().save_single_message(chat_id, role, text, metadata)
        return {"success": True}
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("failed_to_save_message", error=str(e))
        raise HTTPException(status_code=500, detail="Database error while saving message")
