"""MARIANO Web Core — FastAPI WebSocket Server hosting Web HUD with Filesystem hot-reload observer."""
from __future__ import annotations

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import os
import base64
import json
import asyncio
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import uvicorn
import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from mariano.config import get_settings
from mariano.core.voice_control import VoiceController
from mariano.core.cognitive_profiler import CognitiveProfiler
from mariano.core.neuromodulator import Neuromodulator

log = structlog.get_logger(__name__)
settings = get_settings()

# Registry holding active websocket client sockets
active_connections: list[WebSocket] = []


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
    watcher_task.cancel()
    ui_events_task.cancel()
    log.info("web.shutting_down")


app = FastAPI(title="MARIANO HUD Engine", lifespan=lifespan)

# Setup static files directory
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

from mariano.web.workspace import router as workspace_router
app.include_router(workspace_router)

from mariano.coder_engine.connection import router as coder_router
app.include_router(coder_router)


voice_controller = VoiceController.get_instance()
profiler = CognitiveProfiler.get_instance()
neuromodulator = Neuromodulator.get_instance()


@app.get("/")
async def get_index():
    """Serves the main Stark-HUD Bloomberg template page."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>MARIANO index.html not found.</h1>", status_code=404)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi.responses import Response
    return Response(status_code=204)


from pydantic import BaseModel

class SkillToggleRequest(BaseModel):
    name: str
    enabled: bool

class SettingsUpdateRequest(BaseModel):
    gemini_api_key: str | None = None
    use_ollama: bool | None = None
    ollama_model: str | None = None
    ollama_base_url: str | None = None
    reasoning_mode: str | None = None
    hekki_model: str | None = None
    user_name: str | None = None
    user_instructions: str | None = None
    theme: str | None = None

@app.get("/api/models")
async def get_available_models():
    """Queries and returns only Gemini 3.1 and Qwen offline model."""
    settings = get_settings()
    models = [
        {"name": "Gemini 3.1", "use_ollama": False},
        {"name": "qwen2.5-coder-abliterate:3b", "use_ollama": True}
    ]
    return {"models": models, "active": {
        "use_ollama": settings.active_use_ollama,
        "ollama_model": settings.active_ollama_model,
        "mariano_model": settings.active_model
    }}

@app.get("/api/settings")
async def get_api_settings():
    """Returns all dynamic configurations."""
    settings = get_settings()
    return {
        "gemini_api_key": settings.active_gemini_api_key,
        "use_ollama": settings.active_use_ollama,
        "ollama_model": settings.active_ollama_model,
        "ollama_base_url": settings.active_ollama_base_url,
        "hekki_model": settings.active_model,
        "reasoning_mode": settings.active_reasoning_mode,
        "user_name": settings.dynamic_config.get("user_name", ""),
        "user_instructions": settings.dynamic_config.get("user_instructions", ""),
        "theme": settings.dynamic_config.get("theme", "dark"),
    }

@app.post("/api/settings")
async def update_api_settings(req: SettingsUpdateRequest):
    """Saves dynamic configurations to persistent settings file."""
    settings = get_settings()
    update_dict = {}
    if req.gemini_api_key is not None:
        update_dict["gemini_api_key"] = req.gemini_api_key
    if req.use_ollama is not None:
        update_dict["use_ollama"] = req.use_ollama
    if req.ollama_model is not None:
        update_dict["ollama_model"] = req.ollama_model
    if req.ollama_base_url is not None:
        update_dict["ollama_base_url"] = req.ollama_base_url
    if req.reasoning_mode is not None:
        update_dict["reasoning_mode"] = req.reasoning_mode
    if req.hekki_model is not None:
        update_dict["hekki_model"] = req.hekki_model
    if req.user_name is not None:
        update_dict["user_name"] = req.user_name
    if req.user_instructions is not None:
        update_dict["user_instructions"] = req.user_instructions
    if req.theme is not None:
        update_dict["theme"] = req.theme
    settings.save_dynamic_config(update_dict)
    return {"success": True}

@app.get("/api/chats")
async def get_chats():
    """Fetch all chat sessions from SQLite database."""
    from mariano.memory.memory_manager import MemoryManager
    chats = await MemoryManager.get_instance().get_all_chats()
    return {"chats": chats}

@app.post("/api/chats/sync")
async def sync_chats(req: dict):
    """Overwrite all chat sessions in SQLite database."""
    chats = req.get("chats", [])
    print("DEBUG_SYNC_CHATS:", json.dumps(chats, indent=2))
    from mariano.memory.memory_manager import MemoryManager
    await MemoryManager.get_instance().sync_chats(chats)
    return {"success": True}

@app.post("/api/chats/message")
async def save_single_message(req: dict):
    """Save a single message to an active chat session in SQLite database."""
    chat_id = req.get("chat_id")
    role = req.get("role", "user")
    text = req.get("text", "")
    metadata = req.get("metadata")
    if not chat_id or not text:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Missing required parameters: chat_id, text")
    from mariano.memory.memory_manager import MemoryManager
    await MemoryManager.get_instance().save_single_message(chat_id, role, text, metadata)
    return {"success": True}

# (Developer plan endpoints removed)

@app.get("/api/skills")
async def get_skills():
    """Exposes all loaded expert skills."""
    from mariano.skills._registry.registry import SkillRegistry
    manifests = SkillRegistry.get_instance().get_manifests(include_disabled=True)
    return manifests


@app.post("/api/skills/toggle")
async def toggle_skill(req: SkillToggleRequest):
    """Enable or disable a specific skill."""
    from mariano.skills._registry.registry import SkillRegistry
    registry = SkillRegistry.get_instance()
    registry.set_enabled(req.name, req.enabled)
    return {"success": True, "name": req.name, "enabled": req.enabled}


@app.post("/api/skills/clean")
async def clean_skills():
    """Resets call statistics for all skills."""
    from mariano.skills._registry.registry import SkillRegistry
    registry = SkillRegistry.get_instance()
    registry.clean_stats()
    return {"success": True}


class EvolutionLogRequest(BaseModel):
    type: str
    title: str
    description: str
    reason: str
    impact: str

@app.get("/api/evolution-log")
async def get_evolution_log():
    """Returns all AI changelog entries."""
    from mariano.core.evolution_ledger import EvolutionLedger
    return EvolutionLedger.get_all()

@app.post("/api/evolution-log")
async def add_evolution_log(req: EvolutionLogRequest):
    """Adds a new AI-written changelog entry."""
    from mariano.core.evolution_ledger import EvolutionLedger
    EvolutionLedger.append(
        change_type=req.type,
        title=req.title,
        description=req.description,
        reason=req.reason,
        impact=req.impact
    )
    return {"success": True}


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

    async def run_query(query_text, project=None, project_path=None, chat_id=None, permission_policy=None, aider_enabled=False):
        try:
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
        except Exception as e:
            log.error("web.query_run_error", error=str(e))

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            action_type = payload.get("type")
            
            if action_type == "query":
                text = payload.get("text", "")
                project = payload.get("project")
                project_path = payload.get("project_path")
                chat_id = payload.get("chat_id")
                permission_policy = payload.get("permission_policy")
                aider_enabled = payload.get("aider_enabled", False)
                log.info("web.query_received", text=text, project=project, project_path=project_path, chat_id=chat_id, permission_policy=permission_policy, aider_enabled=aider_enabled)
                if query_task and not query_task.done():
                    query_task.cancel()
                query_task = asyncio.create_task(run_query(text, project=project, project_path=project_path, chat_id=chat_id, permission_policy=permission_policy, aider_enabled=aider_enabled))

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
                websocket.app.state._debate = _debate

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
                debate = getattr(websocket.app.state, "_debate", None)
                if debate:
                    debate.inject_user_message(message)
                    log.info("web.debate_intervene", message=message)

            elif action_type == "debate_pause":
                debate = getattr(websocket.app.state, "_debate", None)
                if debate:
                    debate.pause()

            elif action_type == "debate_resume":
                debate = getattr(websocket.app.state, "_debate", None)
                if debate:
                    debate.resume()

            elif action_type == "debate_stop":
                debate = getattr(websocket.app.state, "_debate", None)
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
                    temp_wav = temp_dir / "mariano_web_voice.wav"
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
