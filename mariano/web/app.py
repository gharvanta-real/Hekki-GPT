"""MARIANO Web Core — Modular FastAPI Server hosting Web HUD with Filesystem hot-reload observer."""
from __future__ import annotations

import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

import uvicorn
import structlog
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, Response

from mariano.config import get_settings
from mariano.web.watchers import active_connections, watch_static_files, watch_ui_events

log = structlog.get_logger(__name__)
settings = get_settings()


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
    
    memory = MemoryManager.get_instance()
    await memory.initialize()
    (settings.mariano_data_dir / "workspace").mkdir(parents=True, exist_ok=True)
    
    registry = SkillRegistry.get_instance()
    discovery = SkillDiscovery(registry, settings.evolved_skills_dir)
    await discovery.discover_all()

    from mariano.mcp.server_manager import MCPServerManager
    from mariano.mcp.bridge import MCPSkillBridge
    mcp_manager = MCPServerManager.get_instance()
    try:
        await mcp_manager.startup()
        await MCPSkillBridge.refresh_all(registry)
        log.info("mcp.systems_online")
    except Exception as _mcp_err:
        log.warning("mcp.startup_skipped", error=str(_mcp_err))

    gemini = GeminiClient()
    app.state.agent = MarianoAgent(gemini=gemini, registry=registry, memory=memory)
    
    from mariano.core.sentinel import SentinelObserver
    SentinelObserver.get_instance().start()
    
    watcher_task = asyncio.create_task(watch_static_files(active_connections))
    ui_events_task = asyncio.create_task(watch_ui_events(active_connections))

    log.info("web.systems_online")
    yield
    
    await MCPServerManager.get_instance().shutdown()
    watcher_task.cancel()
    ui_events_task.cancel()
    log.info("web.shutting_down")


class NoCacheStaticFiles(StaticFiles):
    def is_not_modified(self, response_headers, request_headers) -> bool:
        return False

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


app = FastAPI(title="Hekki Engine", lifespan=lifespan)

STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", NoCacheStaticFiles(directory=str(STATIC_DIR)), name="static")

# ── Include Modular Routers ───────────────────────────────────────────────────
from mariano.web.workspace import router as workspace_router
app.include_router(workspace_router)

from mariano.coder_engine.connection import router as coder_router
app.include_router(coder_router)

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

from mariano.web.routes.core_api import router as core_api_router
app.include_router(core_api_router)

from mariano.web.routes.workflows_routes import router as workflows_router
app.include_router(workflows_router)

from mariano.web.routes.graph_routes import router as graph_router
app.include_router(graph_router)

from mariano.web.routes.ws_routes import router as ws_router
app.include_router(ws_router)


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
