"""MARIANO Web Core — FastAPI WebSocket Server hosting Web HUD with Filesystem hot-reload observer."""
from __future__ import annotations

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import os
import re
import uuid
import base64
import json
import asyncio
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import uvicorn
import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, Response
from pydantic import BaseModel

from mariano.config import get_settings
from mariano.core.voice_control import VoiceController
from mariano.core.cognitive_profiler import CognitiveProfiler
from mariano.core.neuromodulator import Neuromodulator

log = structlog.get_logger(__name__)
settings = get_settings()

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
                # Skip dynamic data files (like ui_events.jsonl) to avoid page refresh loop
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
        
        # Check for changed or new files
        for filepath, mtime in current_mtimes.items():
            if filepath not in last_mtimes or mtime > last_mtimes[filepath]:
                changed = True
                break
        
        # Check for deleted files
        if not changed:
            for filepath in last_mtimes:
                if filepath not in current_mtimes:
                    changed = True
                    break

        if changed:
            log.info("web.static_files_modified_broadcasting_reload")
            last_mtimes = current_mtimes
            # Skip ui_events.jsonl from triggering a full page reload
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
            # Handle file truncation/rotation: reset position if file shrank
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Asynchronously initializes systems and spawns the static files hot-reload daemon task on boot."""
    from mariano.gemini.client import GeminiClient
    from mariano.skills._registry.registry import SkillRegistry
    from mariano.skills._registry.discovery import SkillDiscovery
    from mariano.memory.memory_manager import MemoryManager
    from mariano.core.agent import MarianoAgent
    
    log.info("web.booting_systems")
    settings.mariano_data_dir.mkdir(parents=True, exist_ok=True)
    settings.logs_dir.mkdir(parents=True, exist_ok=True)
    settings.evolved_skills_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Initialize Memory Manager
    memory = MemoryManager.get_instance()
    await memory.initialize()
    
    # Create workspace folder
    (settings.mariano_data_dir / "workspace").mkdir(parents=True, exist_ok=True)
    
    # 2. Discover and Load all active expert skills
    registry = SkillRegistry.get_instance()
    discovery = SkillDiscovery(registry, settings.evolved_skills_dir)
    await discovery.discover_all()

    # 2b. Start MCP Server Manager — connect configured MCP servers & register tools
    from mariano.mcp.server_manager import MCPServerManager
    from mariano.mcp.bridge import MCPSkillBridge
    mcp_manager = MCPServerManager.get_instance()
    try:
        await mcp_manager.startup()
        await MCPSkillBridge.refresh_all(registry)
        log.info("mcp.systems_online")
    except Exception as _mcp_err:
        log.warning("mcp.startup_skipped", error=str(_mcp_err))

    # 3. Instantiate Gemini Client
    gemini = GeminiClient()
    
    # 4. Construct Agent and store on app state
    app.state.agent = MarianoAgent(gemini=gemini, registry=registry, memory=memory)
    
    # 5. Start observer daemon
    from mariano.core.sentinel import SentinelObserver
    SentinelObserver.get_instance().start()
    
    # 6. Start the static files hot-reload watcher task
    watcher_task = asyncio.create_task(watch_static_files(active_connections))
    # 7. Start ui_events watcher — allows skills to push live UI components
    ui_events_task = asyncio.create_task(watch_ui_events(active_connections))

    log.info("web.systems_online")
    yield
    # Shutdown
    from mariano.mcp.server_manager import MCPServerManager
    await MCPServerManager.get_instance().shutdown()
    watcher_task.cancel()
    ui_events_task.cancel()
    log.info("web.shutting_down")


app = FastAPI(title="Hekki Engine", lifespan=lifespan)

# Setup static files directory
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

from mariano.web.workspace import router as workspace_router
app.include_router(workspace_router)

from mariano.coder_engine.connection import router as coder_router
app.include_router(coder_router)

# ── Modular Route Registrations ───────────────────────────────────────────────
from mariano.web.routes.settings import router as settings_router
app.include_router(settings_router)

from mariano.web.routes.chats import router as chats_router
app.include_router(chats_router)

from mariano.web.routes.skills_routes import router as skills_router
app.include_router(skills_router)

from mariano.web.routes.canvas import router as canvas_router
app.include_router(canvas_router)

from mariano.web.routes.images import router as images_router
app.include_router(images_router)

from mariano.web.routes.recon import router as recon_router
app.include_router(recon_router)

from mariano.web.routes.mcp_routes import router as mcp_router
app.include_router(mcp_router)

voice_controller = VoiceController.get_instance()
profiler = CognitiveProfiler.get_instance()
neuromodulator = Neuromodulator.get_instance()


@app.get("/")
async def get_index():
    """Serves the main Stark-HUD Bloomberg template page."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(
            content=index_file.read_text(encoding="utf-8"),
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return HTMLResponse(content="<h1>Hekki index.html not found.</h1>", status_code=404)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(status_code=204)


@app.get("/manifest.json", include_in_schema=False)
async def get_manifest():
    manifest_file = STATIC_DIR / "manifest.json"
    if manifest_file.exists():
        return FileResponse(
            manifest_file,
            media_type="application/manifest+json",
            headers={"Cache-Control": "no-cache"}
        )
    return Response(status_code=404)


@app.get("/sw.js", include_in_schema=False)
async def get_sw():
    sw_file = STATIC_DIR / "sw.js"
    if sw_file.exists():
        return FileResponse(
            sw_file,
            media_type="application/javascript",
            headers={
                "Cache-Control": "no-cache",
                "Service-Worker-Allowed": "/"
            }
        )
    return Response(status_code=404)


from pydantic import BaseModel


class QuickVoiceRequest(BaseModel):
    text: str

@app.post("/api/quick-voice")
async def quick_voice(req: QuickVoiceRequest):
    """Processes a short voice/text query from the mini overlay.
    Routes to system control, app launcher, terminal, or Gemini AI.
    """
    from mariano.core.rate_limiter import GeminiRateLimiter
    from google import genai as genai_sdk

    try:
        settings_obj = get_settings()

        # ── System Control + App Launcher + Terminal (ComputerUseEngine) ──
        from mariano.core.computer_use import ComputerUseEngine
        cu_result = await ComputerUseEngine.execute_intent(req.text.strip())
        if cu_result.get("success"):
            return {"response_text": cu_result.get("message", "Done!")}

        # ── Fallback: Gemini AI conversational response ────────────────────
        system_prompt = (
            "You are Hekki, a warm, intelligent AI assistant. "
            "Answer the user's question in 1-2 short, warm, human-like conversational sentences, "
            "exactly like a friend or colleague answering directly in a quick conversation. "
            "Do NOT use markdown formatting, bullet points, numbered lists, or headers. "
            "Just plain natural language."
        )

        client_sdk = genai_sdk.Client(api_key=settings_obj.active_gemini_api_key)
        loop = asyncio.get_event_loop()
        await GeminiRateLimiter.get_instance().acquire(token_count=500)

        response = await loop.run_in_executor(
            None,
            lambda: client_sdk.models.generate_content(
                model=settings_obj.active_model,
                contents=[{"role": "user", "parts": [{"text": f"{system_prompt}\n\nUser: {req.text.strip()}"}]}]
            )
        )

        answer = response.text.strip() if response.text else "I'm not sure. Try asking in the main Hekki window."
        return {"response_text": answer}

    except Exception as e:
        log.error("web.quick_voice_failed", error=str(e))
        return {"response_text": "Something went wrong. Please try again."}


@app.post("/api/screen-capture")
async def screen_capture():
    """Captures the primary monitor and analyzes active screen content with Gemini Vision.
    Reads visible text, activities, notes, reminders, errors from any open application.
    """
    import io
    from PIL import Image
    from mariano.core.rate_limiter import GeminiRateLimiter
    from google import genai as genai_sdk
    from google.genai import types as genai_types

    try:
        settings_obj = get_settings()
        client_sdk = genai_sdk.Client(api_key=settings_obj.active_gemini_api_key)

        # ── Step 1: Capture screen (mss primary → pyautogui fallback) ─────
        img: Image.Image | None = None
        capture_error: str = ""

        try:
            import mss
            with mss.mss() as sct:
                mon = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]
                sct_img = sct.grab(mon)
                # mss returns BGRA raw bytes — use RGBA mode + convert to avoid BGRX issues
                img = Image.frombytes(
                    mode="RGBA",
                    size=(sct_img.width, sct_img.height),
                    data=bytes(sct_img.raw),
                    decoder_name="raw",
                    args=["BGRA"]
                ).convert("RGB")
        except Exception as mss_err:
            capture_error = str(mss_err)
            try:
                import pyautogui
                img = pyautogui.screenshot().convert("RGB")
                capture_error = ""
            except Exception as pg_err:
                return {
                    "success": False,
                    "analysis": f"Screen capture unavailable. mss: {capture_error} | pyautogui: {pg_err}"
                }

        # ── Step 2: Resize & encode for Gemini Vision ──────────────────────
        img.thumbnail((1280, 800), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88)
        img_bytes = buf.getvalue()

        # ── Step 3: Focused vision prompt — extract on-screen content ──────
        vision_prompt = (
            "You are Hekki, an intelligent desktop assistant. "
            "Analyze this screenshot of the user's active screen. "
            "Extract and summarize in plain conversational language (no markdown):\n"
            "1. What application or window is open and what the user is currently doing.\n"
            "2. Any visible text — notes, documents, code, messages, tasks, reminders, calendar events, or to-do items.\n"
            "3. Any errors, warnings, or important notifications visible on screen.\n"
            "4. One helpful observation or reminder based on what is visible (e.g. unsaved work, a pending task, or useful insight).\n"
            "Keep total response under 4 conversational sentences. Be warm and direct."
        )

        loop = asyncio.get_event_loop()
        await GeminiRateLimiter.get_instance().acquire(token_count=1200)

        # ── Step 4: Send to Gemini Vision (correct Content/Part format) ────
        response = await loop.run_in_executor(
            None,
            lambda: client_sdk.models.generate_content(
                model=settings_obj.active_model,
                contents=[
                    genai_types.Content(
                        role="user",
                        parts=[
                            genai_types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                            genai_types.Part.from_text(text=vision_prompt),
                        ]
                    )
                ]
            )
        )

        analysis = response.text.strip() if (response and response.text) else "Screen captured but Gemini returned no analysis."
        return {"success": True, "analysis": analysis}

    except Exception as e:
        log.error("web.screen_capture_failed", error=str(e))
        return {"success": False, "analysis": f"Vision analysis failed: {str(e)[:300]}"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Bidirectional WebSocket pipeline streaming real-time metrics, logs, and voice queries."""
    await websocket.accept()
    active_connections.append(websocket)
    log.info("web.client_connected")
    
    # Fetch agent from app state
    agent = websocket.app.state.agent
    
    # Send initial state sync (dials, credentials)
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
    _ws_debate = None  # [L-1] Per-connection debate instance (not shared on app.state)

    async def run_query(query_text, project=None, project_path=None, chat_id=None, permission_policy=None, aider_enabled=False, model_alpha=None, model_beta=None):
        try:
            # Check if query triggers Dual-Agent Expert Debate Engine in Chat
            is_debate_query = query_text.strip().startswith("/debate") or \
                              query_text.strip().lower().startswith("run debate") or \
                              query_text.strip().lower().startswith("expert debate")

            if is_debate_query:
                raw_topic = query_text.replace("/debate", "").replace("run debate on", "").replace("expert debate on", "").replace("run debate", "").replace("expert debate", "").strip()
                topic = raw_topic if raw_topic else "Technical Architecture & System Design"

                await websocket.send_json({"type": "agent_event", "kind": "thinking", "data": f"⚡ Initializing Expert Consensus Engine for '{topic}'...", "metadata": {}})
                await websocket.send_json({
                    "type": "agent_event",
                    "kind": "tool_start",
                    "data": "expert_debate",
                    "metadata": {"name": "expert_debate", "args": {"topic": topic, "rounds": 2}}
                })

                from mariano.config import get_settings
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
                    max_rounds=2
                )

                async def _debate_event_callback(event_dict):
                    ev_type = event_dict.get("type")
                    agent_name = event_dict.get("agent", "Expert")
                    rnd = event_dict.get("round", 1)
                    total_r = 2

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
                        await websocket.send_json({
                            "type": "agent_event",
                            "kind": "chunk",
                            "data": chunk,
                            "metadata": {}
                        })

                    if msg:
                        await websocket.send_json({
                            "type": "agent_event",
                            "kind": "tool_log",
                            "data": msg,
                            "metadata": {"tool": "expert_debate"}
                        })

                await orchestrator.run_debate(topic=topic, send_event=_debate_event_callback)

                await websocket.send_json({
                    "type": "agent_event",
                    "kind": "tool_end",
                    "data": "expert_debate",
                    "metadata": {"name": "expert_debate"}
                })
                await websocket.send_json({"type": "agent_event", "kind": "done", "data": "", "metadata": {}})
                return

            async for event in agent.run(query_text, project=project, project_path=project_path, chat_id=chat_id, permission_policy=permission_policy, aider_enabled=aider_enabled):
                await websocket.send_json({
                    "type": "agent_event",
                    "kind": event.kind,
                    "data": event.data,
                    "metadata": event.metadata or {}
                })
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
            await websocket.send_json({
                "type": "agent_event",
                "kind": "error",
                "data": "Generation stopped by user.",
                "metadata": {}
            })
        except asyncio.TimeoutError:
            log.error("web.query_timeout")
            await websocket.send_json({
                "type": "agent_event",
                "kind": "error",
                "data": "Request timed out after 5 minutes. Please try again.",
                "metadata": {}
            })
        except Exception as e:
            log.error("web.query_run_error", error=str(e))
            # [C-2] Forward error to WS client so UI spinner does not freeze
            try:
                await websocket.send_json({
                    "type": "agent_event",
                    "kind": "error",
                    "data": f"An error occurred: {str(e)[:300]}",
                    "metadata": {}
                })
            except Exception:
                pass

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            action_type = payload.get("type")
            
            if action_type == "query":
                text = payload.get("text", "")
                attachments = payload.get("attachments", [])
                project = payload.get("project")
                project_path = payload.get("project_path")
                chat_id = payload.get("chat_id")
                permission_policy = payload.get("permission_policy")
                aider_enabled = payload.get("aider_enabled", False)

                # Process attachments if present
                if attachments:
                    try:
                        attach_dir = Path(__file__).resolve().parent.parent.parent / "data" / "workspace" / "attachments"
                        attach_dir.mkdir(parents=True, exist_ok=True)
                        extra_context = []

                        for att in attachments:
                            name = att.get("name", "file")
                            # [H-4] Sanitize filename: strip directory components and dangerous chars
                            name = re.sub(r'[^\w\-. ]', '_', Path(name).name).strip() or "file"
                            is_img = att.get("is_image", False)
                            ext = att.get("ext", "bin")

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
                                extra_context.append(f"\n\n--- Attached Document: {name} ---\n{att['text']}\n--- End Document ---")

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
                # [H-3] 300s timeout guard to prevent hung queries freezing UI
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
                
                log.info("web.debate_start", topic=topic, rounds=rounds, model_alpha=model_alpha, model_beta=model_beta)

                from mariano.config import get_settings
                _settings = get_settings()
                api_key = _settings.active_gemini_api_key

                from mariano.core.debate.debate_orchestrator import DebateOrchestrator
                _debate = DebateOrchestrator(
                    api_key=api_key,
                    model_alpha=model_alpha,
                    model_beta=model_beta,
                    max_rounds=rounds,
                )
                _ws_debate = _debate  # [L-1] Store per-connection, not on app.state

                async def send_debate_event(evt):
                    try:
                        await websocket.send_json(evt)
                    except Exception:
                        pass

                if query_task and not query_task.done():
                    query_task.cancel()
                query_task = asyncio.create_task(
                    _debate.run_debate(topic=topic, send_event=send_debate_event)
                )

            elif action_type == "debate_intervene":
                message = payload.get("message", "")
                debate = _ws_debate
                if debate:
                    debate.inject_user_message(message)
                    log.info("web.debate_intervene", message=message)

            elif action_type == "debate_pause":
                debate = _ws_debate
                if debate:
                    debate.pause()

            elif action_type == "debate_resume":
                debate = _ws_debate
                if debate:
                    debate.resume()

            elif action_type == "debate_stop":
                debate = _ws_debate
                if debate:
                    debate.stop()
                if query_task and not query_task.done():
                    query_task.cancel()

            elif action_type == "stop":
                log.info("web.stop_query_requested")
                if query_task and not query_task.done():
                    query_task.cancel()

            elif action_type == "voice":
                # Receive voice audio base64, write to local temp file, and transcribe
                b64_audio = payload.get("audio", "")
                if not b64_audio:
                    continue
                
                try:
                    audio_bytes = base64.b64decode(b64_audio)
                    temp_dir = Path(tempfile.gettempdir())
                    # [M-8] Unique filename to prevent concurrent request collision
                    temp_wav = temp_dir / f"mariano_voice_{uuid.uuid4().hex[:8]}.wav"
                    temp_wav.write_bytes(audio_bytes)
                    
                    transcript = await voice_controller.transcribe_audio(temp_wav)
                    await websocket.send_json({
                        "type": "voice_transcript",
                        "text": transcript
                    })
                except Exception as err:
                    log.error("web.voice_processing_failed", error=str(err))
                    await websocket.send_json({
                        "type": "voice_transcript",
                        "text": "",
                        "error": str(err)
                    })

    except WebSocketDisconnect:
        log.info("web.client_disconnected")
    except Exception as e:
        log.error("web.websocket_error", error=str(e))
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)


# ════════════════════════════════════════════════════════════════════════════
# Gemini 2.5 Flash Native Audio Dialog — Zero Latency Live Audio WebSocket Endpoint
# ════════════════════════════════════════════════════════════════════════════

@app.get("/api/live-audio/stats")
async def get_live_audio_stats():
    """Returns real-time session statistics for Gemini Live Audio engine."""
    from mariano.core.live_audio import LiveAudioEngine
    return LiveAudioEngine.get_instance().get_stats()


@app.websocket("/ws/live-audio")
async def live_audio_websocket_endpoint(websocket: WebSocket):
    """Zero-latency bi-directional WebSocket audio pipeline using Gemini 2.5 Flash Native Audio Dialog.
    Streams PCM 16kHz audio between client browser/overlay and Gemini Live API.
    """
    import uuid
    from mariano.core.live_audio import LiveAudioEngine

    await websocket.accept()
    session_id = f"live_ws_{uuid.uuid4().hex[:8]}"
    engine = LiveAudioEngine.get_instance()
    session = None

    try:
        session = await engine.create_session(session_id)
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "model": session.model_name
        })

        async def send_to_client():
            """Streams Gemini response audio/text chunks to the client WebSocket."""
            try:
                async for chunk in session.receive_stream():
                    if chunk["type"] == "audio":
                        b64_pcm = base64.b64encode(chunk["data"]).decode("utf-8")
                        await websocket.send_json({
                            "type": "audio",
                            "data": b64_pcm,
                            "mime_type": chunk.get("mime_type", "audio/pcm")
                        })
                    elif chunk["type"] == "text":
                        await websocket.send_json({
                            "type": "text",
                            "text": chunk["text"]
                        })
                    elif chunk["type"] == "turn_complete":
                        await websocket.send_json({"type": "turn_complete"})
                    elif chunk["type"] == "error":
                        await websocket.send_json({
                            "type": "error",
                            "message": chunk.get("message", "Stream error")
                        })
            except Exception as e:
                log.error("web.live_audio_send_to_client_failed", error=str(e))

        send_task = asyncio.create_task(send_to_client())

        # Receive loop from client
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
                # Raw binary PCM bytes
                await session.send_audio_chunk(raw_msg["bytes"])

    except WebSocketDisconnect:
        log.info("web.live_audio_client_disconnected", session_id=session_id)
    except Exception as e:
        err_str = str(e)
        if "1000" in err_str or "OK" in err_str or "closed" in err_str.lower():
            log.info("web.live_audio_session_completed_normally", session_id=session_id)
        else:
            log.error("web.live_audio_websocket_failed", error=err_str)
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Live API Notice: {err_str}"
                })
                await asyncio.sleep(0.5)
            except Exception:
                pass
    finally:
        if send_task and not send_task.done():
            send_task.cancel()
        if session:
            await engine.close_session(session_id)


# ── GPT-Grade OpenAI-Compatible SSE Streaming Endpoint ─────────────────────────
class OpenAIChatMessage(BaseModel):
    role: str
    content: str

class OpenAIChatCompletionRequest(BaseModel):
    model: str | None = "hekki-gpt"
    messages: list[OpenAIChatMessage]
    stream: bool | None = True
    chat_id: str | None = None
    project: str | None = None

from fastapi import Request, Header

@app.post("/api/v1/chat/completions")
@app.post("/v1/chat/completions")
async def openai_chat_completions(
    req: OpenAIChatCompletionRequest,
    raw_req: Request,
    authorization: str | None = Header(None)
):
    """GPT-Grade OpenAI-compatible Server-Sent Events (SSE) chat streaming endpoint.
    Allows standard LLM clients, browser apps, and extensions to stream responses safely.
    """
    settings_obj = get_settings()
    # [C-3] Optional API key authentication guard if active key is configured
    expected_key = getattr(settings_obj, "openai_api_key", None)
    if expected_key and authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token != expected_key:
            raise HTTPException(status_code=401, detail="Invalid API Key provided")
    from fastapi.responses import StreamingResponse
    import time
    import uuid
    from mariano.core.agent.event import AgentEvent

    if not req.messages:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="messages array cannot be empty")

    user_input = req.messages[-1].content
    chat_id = req.chat_id or f"chat_{uuid.uuid4().hex[:8]}"
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created_ts = int(time.time())

    agent: MarianoAgent = app.state.agent

    async def sse_event_generator():
        try:
            async for event in agent.run(
                user_input=user_input,
                chat_id=chat_id,
                project=req.project
            ):
                if event.type == "response":
                    chunk_payload = {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created_ts,
                        "model": req.model or "hekki-gpt",
                        "choices": [
                            {
                                "index": 0,
                                "delta": {"content": event.content},
                                "finish_reason": None
                            }
                        ]
                    }
                    yield f"data: {json.dumps(chunk_payload)}\n\n"

                elif event.type in ("thinking", "tool_start", "tool_result"):
                    chunk_payload = {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created_ts,
                        "model": req.model or "hekki-gpt",
                        "choices": [
                            {
                                "index": 0,
                                "delta": {"tool_event": {"type": event.type, "data": event.content}},
                                "finish_reason": None
                            }
                        ]
                    }
                    yield f"data: {json.dumps(chunk_payload)}\n\n"

            # Final stop chunk
            stop_payload = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_ts,
                "model": req.model or "hekki-gpt",
                "choices": [
                    {
                        "index": 0,
                        "delta": {},
                        "finish_reason": "stop"
                    }
                ]
            }
            yield f"data: {json.dumps(stop_payload)}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            log.error("web.openai_sse_stream_error", error=str(e))
            err_payload = {"error": {"message": str(e), "type": "server_error"}}
            yield f"data: {json.dumps(err_payload)}\n\n"

    if req.stream is not False:
        return StreamingResponse(
            sse_event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    else:
        # Non-streaming response fallback
        full_text = ""
        async for event in agent.run(user_input=user_input, chat_id=chat_id, project=req.project):
            if event.type == "response":
                full_text += event.content

        return {
            "id": completion_id,
            "object": "chat.completion",
            "created": created_ts,
            "model": req.model or "hekki-gpt",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": full_text},
                    "finish_reason": "stop"
                }
            ]
        }

# ── Image Proxy & Search Endpoints ───────────────────────────────────────────
