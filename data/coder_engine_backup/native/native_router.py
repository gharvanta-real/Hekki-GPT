"""
native_router.py — FastAPI endpoint for Hekki Native Coding Engine.
Under 70 lines.
"""

from __future__ import annotations
import os
import json
import time
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from mariano.coder_engine.native.models import NativeCoderRequest
from mariano.coder_engine.native.agent_loop import run_native_agent_loop
from mariano.coder_engine.native.session_store import create_session

logger = logging.getLogger("Hekki.NativeRouter")
router = APIRouter(prefix="/api/code", tags=["NativeCoder"])


@router.post("/native_stream")
async def native_stream_code_execution(req: NativeCoderRequest):
    """
    POST /api/code/native_stream — In-process ReAct coding loop stream.
    Zero PTY / subprocess dependencies. Direct SSE stream with session persistence.
    """
    sess_id = req.session_id
    if not sess_id:
        sess_id = f"session_{int(time.time()*1000)}"
        create_session(sess_id, req.prompt, req.workspace, req.model)

    async def _sse():
        # First yield session ID header to client
        yield f"data: {json.dumps({'session_id': sess_id})}\n\n"
        async for chunk in run_native_agent_loop(
            prompt=req.prompt,
            workspace=req.workspace,
            model=req.model,
            history=req.history,
            session_id=sess_id
        ):
            if chunk:
                # Ensure single-line SSE data payload
                single_line = chunk.replace("\r", "").replace("\n", "")
                yield f"data: {single_line}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        _sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
