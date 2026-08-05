"""
FastAPI Session Router — Exposes Antigravity Chat Session Persistence Endpoints
Under 60 lines.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from mariano.coder_engine.native.session_store import (
    create_session,
    list_sessions,
    get_session,
    get_transcript_events
)

session_api_router = APIRouter(prefix="/api/code", tags=["Session Store"])


class CreateSessionPayload(BaseModel):
    session_id: str
    title: str
    workspace: Optional[str] = ""
    model: Optional[str] = "gemini-3.1-flash-lite"


@session_api_router.post("/sessions")
async def api_create_session(payload: CreateSessionPayload):
    sess = create_session(payload.session_id, payload.title, payload.workspace, payload.model)
    return {"status": "ok", "session": sess}


@session_api_router.get("/sessions")
async def api_list_sessions(workspace: Optional[str] = None):
    sessions = list_sessions(workspace)
    return {"sessions": sessions}


@session_api_router.get("/sessions/{session_id}")
async def api_get_session(session_id: str):
    sess = get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session": sess}


@session_api_router.get("/sessions/{session_id}/transcript")
async def api_get_transcript(session_id: str):
    events = get_transcript_events(session_id)
    return {"session_id": session_id, "events": events}
