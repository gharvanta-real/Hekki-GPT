"""MARIANO WebSocket Routes — Real-time bidirectional WebSocket pipeline and OpenAI SSE streaming."""
from __future__ import annotations

import os
import re
import uuid
import json
import base64
import asyncio
import tempfile
from pathlib import Path
import structlog

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from mariano.config import get_settings
from mariano.core.voice_control import VoiceController
from mariano.core.cognitive_profiler import CognitiveProfiler
from mariano.core.neuromodulator import Neuromodulator
from mariano.web.watchers import active_connections

log = structlog.get_logger(__name__)
router = APIRouter(tags=["ws"])

voice_controller = VoiceController.get_instance()
profiler = CognitiveProfiler.get_instance()
neuromodulator = Neuromodulator.get_instance()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Bidirectional WebSocket pipeline streaming real-time metrics, logs, and queries."""
    await websocket.accept()
    active_connections.append(websocket)
    log.info("web.client_connected")
    
    agent = websocket.app.state.agent
    chem_state = neuromodulator.state
    
    await websocket.send_json({
        "type": "state_sync",
        "employee_id": profiler.employee.employee_id,
        "role": profiler.employee.designation,
        "chemicals": {
            "dopamine": chem_state.dopamine,
            "serotonin": chem_state.serotonin,
            "acetylcholine": chem_state.acetylcholine,
            "affection": chem_state.affection,
            "fear": chem_state.fear
        }
    })

    query_task = None
    _ws_debate = None

    async def run_query(query_text, project=None, project_path=None, chat_id=None, permission_policy=None, aider_enabled=False, model_alpha=None, model_beta=None):
        try:
            is_debate_query = query_text.strip().startswith("/debate") or \
                              query_text.strip().lower().startswith("run debate") or \
                              query_text.strip().lower().startswith("expert debate")

            if is_debate_query:
                raw_topic = query_text.replace("/debate", "").replace("run debate on", "").replace("expert debate on", "").replace("run debate", "").replace("expert debate", "").strip()
                topic = raw_topic if raw_topic else "Technical Architecture & System Design"
                
                rounds_match = re.search(r'(\d+)\s*rounds?', query_text, re.IGNORECASE)
                rounds_count = max(1, min(5, int(rounds_match.group(1)))) if rounds_match else 3

                await websocket.send_json({"type": "agent_event", "kind": "thinking", "data": f"⚡ Initializing Expert Debate Engine for '{topic}'...", "metadata": {}})
                await websocket.send_json({
                    "type": "agent_event",
                    "kind": "tool_start",
                    "data": "expert_debate",
                    "metadata": {"name": "expert_debate", "args": {"topic": topic, "rounds": rounds_count}}
                })

                from mariano.core.debate.debate_config import ALPHA_MODEL, BETA_MODEL
                from mariano.core.debate.debate_orchestrator import DebateOrchestrator
                _settings = get_settings()
                api_key = _settings.active_gemini_api_key

                m_alpha = model_alpha if model_alpha else ALPHA_MODEL
                m_beta = model_beta if model_beta else BETA_MODEL

                orchestrator = DebateOrchestrator(
                    api_key=api_key,
                    model_alpha=m_alpha,
                    model_beta=m_beta,
                    max_rounds=rounds_count
                )

                async def _debate_event_callback(event_dict):
                    ev_type = event_dict.get("type")
                    agent_name = event_dict.get("agent", "Expert")
                    rnd = event_dict.get("round", 1)
                    total_r = rounds_count

                    msg = ""
                    if ev_type == "turn_start":
                        msg = f"[Round {rnd}/{total_r}] [{agent_name}] Initiating technical analysis..."
                    elif ev_type == "searching":
                        q = event_dict.get("query", "")
                        msg = f"  [Search] Round {rnd}/{total_r} [{agent_name}] Searching web for '{q}'"
                    elif ev_type == "search_results":
                        cnt = len(event_dict.get("results", []))
                        msg = f"  [Results] Round {rnd}/{total_r} [{agent_name}] Retrieved {cnt} empirical sources."
                    elif ev_type == "turn_complete":
                        msg = f"[Round {rnd}/{total_r}] [{agent_name}] Formulated technical stance & evidence."
                    elif ev_type == "round_complete":
                        msg = f"[Round {rnd}/{total_r} Done] Consensus checkpoint reached."
                    elif ev_type == "synthesis_start":
                        msg = f"[Synthesis] Formulating Joint Synthesis & Consensus Summary..."
                    elif ev_type == "synthesis_chunk":
                        chunk = event_dict.get("text", "")
                        await websocket.send_json({"type": "agent_event", "kind": "chunk", "data": chunk, "metadata": {}})

                    if msg:
                        await websocket.send_json({"type": "agent_event", "kind": "tool_log", "data": msg, "metadata": {"tool": "expert_debate"}})

                await orchestrator.run_debate(topic=topic, send_event=_debate_event_callback)

                await websocket.send_json({"type": "agent_event", "kind": "tool_end", "data": "expert_debate", "metadata": {"name": "expert_debate"}})
                await websocket.send_json({"type": "agent_event", "kind": "done", "data": "", "metadata": {}})
                return

            async for event in agent.run(query_text, project=project, project_path=project_path, chat_id=chat_id, permission_policy=permission_policy, aider_enabled=aider_enabled):
                await websocket.send_json({"type": "agent_event", "kind": event.kind, "data": event.data, "metadata": event.metadata or {}})
            
            latest_chem = neuromodulator.state
            await websocket.send_json({
                "type": "state_sync",
                "employee_id": profiler.employee.employee_id,
                "role": profiler.employee.designation,
                "chemicals": {
                    "dopamine": latest_chem.dopamine,
                    "serotonin": latest_chem.serotonin,
                    "acetylcholine": latest_chem.acetylcholine,
                    "affection": latest_chem.affection,
                    "fear": latest_chem.fear
                }
            })
        except asyncio.CancelledError:
            log.info("web.query_cancelled")
            await websocket.send_json({"type": "agent_event", "kind": "error", "data": "Generation stopped by user.", "metadata": {}})
        except asyncio.TimeoutError:
            log.error("web.query_timeout")
            await websocket.send_json({"type": "agent_event", "kind": "error", "data": "Request timed out after 5 minutes. Please try again.", "metadata": {}})
        except Exception as e:
            log.error("web.query_run_error", error=str(e))
            try:
                await websocket.send_json({"type": "agent_event", "kind": "error", "data": f"An error occurred: {str(e)[:300]}", "metadata": {}})
            except Exception:
                pass

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                log.warning("web.ws_invalid_json_received")
                continue
            action_type = payload.get("type")
            
            if action_type == "query":
                text = payload.get("text", "")
                attachments = payload.get("attachments", [])
                project = payload.get("project")
                project_path = payload.get("project_path")
                chat_id = payload.get("chat_id")
                permission_policy = payload.get("permission_policy")
                aider_enabled = payload.get("aider_enabled", False)

                if attachments:
                    try:
                        attach_dir = Path(__file__).resolve().parent.parent.parent / "data" / "workspace" / "attachments"
                        attach_dir.mkdir(parents=True, exist_ok=True)
                        extra_context = []

                        for att in attachments:
                            name = att.get("name", "file")
                            name = re.sub(r'[^\w\-. ]', '_', Path(name).name).strip() or "file"
                            is_img = att.get("is_image", False)

                            if is_img and att.get("base64"):
                                try:
                                    img_bytes = base64.b64decode(att["base64"])
                                    import time
                                    safe_name = f"{int(time.time()*1000)}_{name}"
                                    img_path = attach_dir / safe_name
                                    img_path.write_bytes(img_bytes)
                                    extra_context.append(f"\n\n[Attached Image: {name} (saved at {img_path.as_posix()})]")
                                except Exception as err:
                                    extra_context.append(f"\n\n[Attached Image: {name} (Error: {err})]")

                            elif att.get("text"):
                                doc_text = att["text"]
                                line_count = len(doc_text.splitlines())
                                char_count = len(doc_text)
                                extra_context.append(
                                    f"\n\n--- Attached Document: {name} ({line_count} lines, {char_count} chars) ---\n"
                                    f"{doc_text}\n"
                                    f"--- End Document: {name} ---"
                                )

                            elif att.get("base64"):
                                try:
                                    doc_bytes = base64.b64decode(att["base64"])
                                    import time
                                    safe_name = f"{int(time.time()*1000)}_{name}"
                                    doc_path = attach_dir / safe_name
                                    doc_path.write_bytes(doc_bytes)
                                    extra_context.append(f"\n\n[Attached File: {name} (saved at {doc_path.as_posix()})]")
                                except Exception as err:
                                    extra_context.append(f"\n\n[Attached File: {name} (Error: {err})]")

                        has_image = any(a.get("is_image") for a in attachments)
                        if has_image:
                            extra_context.append("\n\n[DIRECT VISION DIRECTIVE: A NEW image has been attached directly to your vision context. Please inspect and analyze the visual contents of this NEW image directly, and answer the user's prompt directly.]")

                        text = text + "".join(extra_context)
                    except Exception as exc:
                        log.error("web.attachment_processing_failed", error=str(exc))

                model_alpha = payload.get("model_alpha")
                model_beta = payload.get("model_beta")

                log.info("web.query_received", text=text, attachments_count=len(attachments), project=project, project_path=project_path, chat_id=chat_id, permission_policy=permission_policy, aider_enabled=aider_enabled, model_alpha=model_alpha, model_beta=model_beta)
                if query_task and not query_task.done():
                    query_task.cancel()

                async def _run_with_timeout(*args, **kwargs):
                    await asyncio.wait_for(run_query(*args, **kwargs), timeout=300)
                query_task = asyncio.create_task(_run_with_timeout(text, project=project, project_path=project_path, chat_id=chat_id, permission_policy=permission_policy, aider_enabled=aider_enabled, model_alpha=model_alpha, model_beta=model_beta))

            elif action_type == "grant_permission":
                chat_id = payload.get("chat_id")
                if chat_id:
                    log.info("web.permission_granted_noop", chat_id=chat_id)

            elif action_type == "sync_session":
                chat_id = payload.get("chat_id")
                messages = payload.get("messages", [])
                if chat_id:
                    from mariano.memory.memory_manager import MemoryManager
                    await MemoryManager.get_instance().restore_session(chat_id, messages)
                    log.info("web.session_synced", chat_id=chat_id, message_count=len(messages))

            elif action_type == "debate_start":
                topic = payload.get("topic", "")
                rounds = payload.get("rounds", 3)
                
                from mariano.core.debate.debate_config import ALPHA_MODEL, BETA_MODEL
                model_alpha = payload.get("model_alpha") or ALPHA_MODEL
                model_beta = payload.get("model_beta") or BETA_MODEL
                
                from mariano.core.debate.debate_orchestrator import DebateOrchestrator
                _debate = DebateOrchestrator(
                    api_key=get_settings().active_gemini_api_key,
                    model_alpha=model_alpha,
                    model_beta=model_beta,
                    max_rounds=rounds,
                )
                _ws_debate = _debate

                async def send_debate_event(evt):
                    try:
                        await websocket.send_json(evt)
                    except Exception:
                        pass

                if query_task and not query_task.done():
                    query_task.cancel()
                query_task = asyncio.create_task(_debate.run_debate(topic=topic, send_event=send_debate_event))

            elif action_type == "debate_intervene":
                message = payload.get("message", "")
                if _ws_debate:
                    _ws_debate.inject_user_message(message)

            elif action_type == "debate_pause":
                if _ws_debate:
                    _ws_debate.pause()

            elif action_type == "debate_resume":
                if _ws_debate:
                    _ws_debate.resume()

            elif action_type == "debate_stop":
                if _ws_debate:
                    _ws_debate.stop()
                if query_task and not query_task.done():
                    query_task.cancel()

            elif action_type == "stop":
                log.info("web.stop_query_requested")
                if query_task and not query_task.done():
                    query_task.cancel()

            elif action_type == "voice":
                b64_audio = payload.get("audio", "")
                if not b64_audio:
                    continue
                try:
                    audio_bytes = base64.b64decode(b64_audio)
                    temp_dir = Path(tempfile.gettempdir())
                    temp_wav = temp_dir / f"mariano_voice_{uuid.uuid4().hex[:8]}.wav"
                    temp_wav.write_bytes(audio_bytes)
                    try:
                        transcript = await voice_controller.transcribe_audio(temp_wav)
                    finally:
                        try:
                            temp_wav.unlink(missing_ok=True)
                        except Exception:
                            pass
                    await websocket.send_json({"type": "voice_transcript", "text": transcript})
                except Exception as err:
                    log.error("web.voice_processing_failed", error=str(err))
                    await websocket.send_json({"type": "voice_transcript", "text": "", "error": str(err)})

    except WebSocketDisconnect:
        log.info("web.client_disconnected")
    except Exception as e:
        log.error("web.websocket_error", error=str(e))
    finally:
        if query_task and not query_task.done():
            query_task.cancel()
        if websocket in active_connections:
            active_connections.remove(websocket)


@router.get("/api/live-audio/stats")
async def get_live_audio_stats():
    """Returns real-time session statistics for Gemini Live Audio engine."""
    from mariano.core.live_audio import LiveAudioEngine
    return LiveAudioEngine.get_instance().get_stats()


@router.websocket("/ws/live-audio")
async def live_audio_websocket_endpoint(websocket: WebSocket):
    """Zero-latency bi-directional WebSocket audio pipeline using Gemini Live API."""
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
        if 'send_task' in dir() and send_task and not send_task.done():
            send_task.cancel()
        if session:
            await engine.close_session(session_id)


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
    settings_obj = get_settings()
    expected_key = getattr(settings_obj, "openai_api_key", None)
    if expected_key and authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token != expected_key:
            raise HTTPException(status_code=401, detail="Invalid API Key provided")

    import time
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
