"""Chat session persistence routes."""
from __future__ import annotations
import json
from fastapi import APIRouter, HTTPException
from mariano.memory.memory_manager import MemoryManager

router = APIRouter()


@router.get("/api/chats")
async def get_chats():
    """Fetch all chat sessions from SQLite database."""
    chats = await MemoryManager.get_instance().get_all_chats()
    return {"chats": chats}


@router.post("/api/chats/sync")
async def sync_chats(req: dict):
    """Overwrite all chat sessions in SQLite database."""
    chats = req.get("chats", [])
    await MemoryManager.get_instance().sync_chats(chats)
    return {"success": True}


@router.post("/api/chats/message")
async def save_single_message(req: dict):
    """Save a single message to an active chat session in SQLite database."""
    chat_id = req.get("chat_id")
    role = req.get("role", "user")
    text = req.get("text", "")
    metadata = req.get("metadata")
    if not chat_id or not text:
        raise HTTPException(status_code=400, detail="Missing required parameters: chat_id, text")
    await MemoryManager.get_instance().save_single_message(chat_id, role, text, metadata)
    return {"success": True}
