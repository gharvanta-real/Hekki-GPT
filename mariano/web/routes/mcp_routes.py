"""Hekki MCP — FastAPI routes for MCP server management.

Provides REST endpoints for the frontend to:
  - List / add / update / remove MCP servers
  - Test a server connection
  - List all available MCP tools (across all servers)
  - Refresh tool registrations
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import structlog

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


# ── Request Models ────────────────────────────────────────────────────────────

class AddServerRequest(BaseModel):
    id: str = ""
    name: str
    transport: str = "stdio"
    enabled: bool = True
    # stdio
    command: str = ""
    args: list[str] = []
    env: dict[str, str] = {}
    # sse/http
    url: str = ""
    headers: dict[str, str] = {}


class UpdateServerRequest(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    command: str | None = None
    args: list[str] | None = None
    env: dict[str, str] | None = None
    url: str | None = None
    headers: dict[str, str] | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/servers")
async def list_servers():
    """Return all configured MCP servers with connection status."""
    from mariano.mcp.server_manager import MCPServerManager
    return {"servers": MCPServerManager.get_instance().get_status()}


@router.post("/servers")
async def add_server(req: AddServerRequest):
    """Add and connect a new MCP server (upserts if server with same ID/name exists)."""
    from mariano.mcp.config import MCPServerConfig, MCPConfigStore
    from mariano.mcp.server_manager import MCPServerManager
    from mariano.mcp.bridge import MCPSkillBridge
    from mariano.skills._registry.registry import SkillRegistry

    target_id = req.id or req.name.lower().replace(" ", "_").replace("/", "_")
    manager = MCPServerManager.get_instance()
    store = MCPConfigStore.get_instance()

    # Remove existing duplicate server with same ID or same name
    existing_servers = [s for s in store.get_all() if s.id == target_id or s.name.lower() == req.name.lower()]
    for s in existing_servers:
        await manager.remove_server(s.id)

    config = MCPServerConfig(
        id=target_id,
        name=req.name,
        transport=req.transport,  # type: ignore[arg-type]
        enabled=req.enabled,
        command=req.command,
        args=req.args,
        env=req.env,
        url=req.url,
        headers=req.headers,
    )
    ok = await manager.add_server(config)

    # Register tools if connected
    if ok and req.enabled:
        client = manager.get_client(config.id)
        if client and client.is_connected:
            registry = SkillRegistry.get_instance()
            await MCPSkillBridge.register_server_tools(client, registry)

    return {"success": ok, "server": config.to_dict()}


@router.put("/servers/{server_id}")
async def update_server(server_id: str, req: UpdateServerRequest):
    """Update configuration fields for an existing server."""
    from mariano.mcp.config import MCPConfigStore
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    updated = MCPConfigStore.get_instance().update(server_id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Server not found")
    return {"success": True, "server": updated.to_dict()}


@router.delete("/servers/{server_id}")
async def remove_server(server_id: str):
    """Disconnect and remove an MCP server, unregistering all its tools."""
    from mariano.mcp.server_manager import MCPServerManager
    from mariano.mcp.bridge import MCPSkillBridge
    from mariano.skills._registry.registry import SkillRegistry

    await MCPSkillBridge.unregister_server_tools(
        server_id, SkillRegistry.get_instance()
    )
    ok = await MCPServerManager.get_instance().remove_server(server_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Server not found")
    return {"success": True}


@router.post("/servers/{server_id}/test")
async def test_server(server_id: str):
    """Probe a server connection and return status + tool count."""
    from mariano.mcp.server_manager import MCPServerManager
    result = await MCPServerManager.get_instance().test_connection(server_id)
    return result


@router.post("/servers/{server_id}/toggle")
async def toggle_server(server_id: str, enabled: bool):
    """Enable or disable an MCP server at runtime."""
    from mariano.mcp.server_manager import MCPServerManager
    from mariano.mcp.bridge import MCPSkillBridge
    from mariano.skills._registry.registry import SkillRegistry

    manager = MCPServerManager.get_instance()
    ok = await manager.toggle_server(server_id, enabled)
    if not ok:
        raise HTTPException(status_code=404, detail="Server not found")

    # Re-register tools if re-enabled
    if enabled:
        client = manager.get_client(server_id)
        if client and client.is_connected:
            await MCPSkillBridge.register_server_tools(
                client, SkillRegistry.get_instance()
            )
    else:
        await MCPSkillBridge.unregister_server_tools(
            server_id, SkillRegistry.get_instance()
        )

    return {"success": True, "enabled": enabled}


@router.get("/tools")
async def list_all_tools():
    """Return all MCP tools currently registered as Hekki skills."""
    from mariano.skills._registry.registry import SkillRegistry
    registry = SkillRegistry.get_instance()
    mcp_skills = [
        s.to_manifest_dict()
        for s in registry.get_all()
        if s.name.startswith("mcp_")
    ]
    return {"tools": mcp_skills, "count": len(mcp_skills)}


@router.post("/refresh")
async def refresh_tools():
    """Re-sync all MCP server tool registrations."""
    from mariano.mcp.bridge import MCPSkillBridge
    from mariano.skills._registry.registry import SkillRegistry
    results = await MCPSkillBridge.refresh_all(SkillRegistry.get_instance())
    total = sum(len(v) for v in results.values())
    return {"refreshed": results, "total_tools": total}
