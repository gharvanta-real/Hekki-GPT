"""MARIANO — OpenAI-compatible SSE Chat Completions endpoint."""
from __future__ import annotations

import uuid
import json
import structlog

from fastapi import APIRouter, Request, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from mariano.config import get_settings

log = structlog.get_logger(__name__)
router = APIRouter(tags=["openai_compat"])


class OpenAIChatMessage(BaseModel):
    role: str
    content: str


class OpenAIChatCompletionRequest(BaseModel):
    model: str | None = "hekki-gpt"
    messages: list[OpenAIChatMessage]
    stream: bool | None = True
    chat_id: str | None = None
    project: str | None = None


@router.post("/api/v1/chat/completions")
@router.post("/v1/chat/completions")
async def openai_chat_completions(
    req: OpenAIChatCompletionRequest,
    raw_req: Request,
    authorization: str | None = Header(None)
):
    """GPT-Grade OpenAI-compatible Server-Sent Events (SSE) chat streaming endpoint."""
    import time
    settings_obj = get_settings()
    expected_key = getattr(settings_obj, "openai_api_key", None)
    if expected_key and authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token != expected_key:
            raise HTTPException(status_code=401, detail="Invalid API Key provided")

    if not req.messages:
        raise HTTPException(status_code=400, detail="messages array cannot be empty")

    user_input = req.messages[-1].content
    chat_id = req.chat_id or f"chat_{uuid.uuid4().hex[:8]}"
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created_ts = int(time.time())
    agent = raw_req.app.state.agent

    async def sse_event_generator():
        try:
            async for event in agent.run(user_input=user_input, chat_id=chat_id, project=req.project):
                if event.type == "response":
                    chunk_payload = {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created_ts,
                        "model": req.model or "hekki-gpt",
                        "choices": [{"index": 0, "delta": {"content": event.content}, "finish_reason": None}]
                    }
                    yield f"data: {json.dumps(chunk_payload)}\n\n"

            stop_payload = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_ts,
                "model": req.model or "hekki-gpt",
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]
            }
            yield f"data: {json.dumps(stop_payload)}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            log.error("web.openai_sse_stream_error", error=str(e))
            err_payload = {"error": {"message": str(e)[:300], "type": "server_error"}}
            yield f"data: {json.dumps(err_payload)}\n\n"

    if req.stream is not False:
        return StreamingResponse(
            sse_event_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
        )
    else:
        full_text = ""
        async for event in agent.run(user_input=user_input, chat_id=chat_id, project=req.project):
            if event.type == "response":
                full_text += event.content

        return {
            "id": completion_id,
            "object": "chat.completion",
            "created": created_ts,
            "model": req.model or "hekki-gpt",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": full_text}, "finish_reason": "stop"}]
        }
