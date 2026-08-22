"""MARIANO Live Audio Routes — Zero-latency bi-directional Gemini Live Audio stream."""
from __future__ import annotations

import base64
import json
import uuid
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

log = structlog.get_logger(__name__)
router = APIRouter(tags=["live_audio"])


@router.get("/api/live-audio/stats")
async def get_live_audio_stats():
    """Returns real-time session statistics for Gemini Live Audio engine."""
    from mariano.core.live_audio import LiveAudioEngine
    return LiveAudioEngine.get_instance().get_stats()


@router.websocket("/ws/live-audio")
async def live_audio_websocket_endpoint(websocket: WebSocket):
    """Zero-latency bi-directional WebSocket audio pipeline using Gemini Live API."""
    import asyncio
    from mariano.core.live_audio import LiveAudioEngine

    await websocket.accept()
    session_id = f"live_ws_{uuid.uuid4().hex[:8]}"
    engine = LiveAudioEngine.get_instance()
    session = None

    try:
        session = await engine.create_session(session_id)
        await websocket.send_json({"type": "connected", "session_id": session_id, "model": session.model_name})

        async def send_to_client():
            try:
                async for chunk in session.receive_stream():
                    if chunk["type"] == "audio":
                        b64_pcm = base64.b64encode(chunk["data"]).decode("utf-8")
                        await websocket.send_json({"type": "audio", "data": b64_pcm, "mime_type": chunk.get("mime_type", "audio/pcm")})
                    elif chunk["type"] == "text":
                        await websocket.send_json({"type": "text", "text": chunk["text"]})
                    elif chunk["type"] == "turn_complete":
                        await websocket.send_json({"type": "turn_complete"})
                    elif chunk["type"] == "error":
                        await websocket.send_json({"type": "error", "message": chunk.get("message", "Stream error")})
            except Exception as e:
                log.error("web.live_audio_send_to_client_failed", error=str(e))

        send_task = asyncio.create_task(send_to_client())

        while session.is_active:
            raw_msg = await websocket.receive()
            if "text" in raw_msg and raw_msg["text"]:
                try:
                    payload = json.loads(raw_msg["text"])
                    msg_type = payload.get("type", "audio")
                    if msg_type == "text":
                        text_val = payload.get("text", "").strip()
                        if text_val:
                            await session.send_text(text_val)
                    elif msg_type == "audio":
                        b64_pcm = payload.get("data", "")
                        if b64_pcm:
                            pcm_bytes = base64.b64decode(b64_pcm)
                            mime = payload.get("mime_type", "audio/pcm;rate=16000")
                            await session.send_audio_chunk(pcm_bytes, mime_type=mime)
                    elif msg_type == "ping":
                        await websocket.send_json({"type": "pong"})
                except json.JSONDecodeError:
                    pass
            elif "bytes" in raw_msg and raw_msg["bytes"]:
                await session.send_audio_chunk(raw_msg["bytes"])

    except WebSocketDisconnect:
        log.info("web.live_audio_client_disconnected", session_id=session_id)
    except Exception as e:
        log.error("web.live_audio_websocket_failed", error=str(e))
    finally:
        if 'send_task' in locals() and send_task and not send_task.done():
            send_task.cancel()
        if session:
            await engine.close_session(session_id)
