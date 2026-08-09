"""Hekki MCP — Server process lifecycle manager.

Manages multiple MCPClient instances. On startup it connects to every
enabled server in MCPConfigStore. It runs a background health-check loop
and reconnects dead servers automatically.
"""
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import structlog

from mariano.mcp.config import MCPConfigStore, MCPServerConfig
from mariano.mcp.client import MCPClient

if TYPE_CHECKING:
    pass

log = structlog.get_logger(__name__)

HEALTH_CHECK_INTERVAL = 30  # seconds


class MCPServerManager:
    """Singleton — manages the lifecycle of all MCP server connections."""

    _instance: "MCPServerManager | None" = None

    def __init__(self) -> None:
        self._clients: dict[str, MCPClient] = {}  # server_id → MCPClient
        self._lock = asyncio.Lock()
        self._health_task: asyncio.Task | None = None

    @classmethod
    def get_instance(cls) -> "MCPServerManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ── Startup / Shutdown ───────────────────────────────────────────────────

    async def startup(self) -> None:
        """Connect to all enabled servers and start health-check loop."""
        store = MCPConfigStore.get_instance()
        servers = [s for s in store.get_all() if s.enabled]
        log.info("mcp.manager_startup", server_count=len(servers))

        tasks = [self._connect_server(s) for s in servers]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        self._health_task = asyncio.create_task(self._health_loop())

    async def shutdown(self) -> None:
        """Gracefully disconnect all servers."""
        if self._health_task and not self._health_task.done():
            self._health_task.cancel()
        async with self._lock:
            for client in list(self._clients.values()):
                try:
                    await client.disconnect()
                except Exception:
                    pass
            self._clients.clear()
        log.info("mcp.manager_shutdown")

    # ── Connection Management ─────────────────────────────────────────────────

    async def _connect_server(self, config: MCPServerConfig) -> None:
        client = MCPClient(config)
        success = await client.connect()
        if success:
            async with self._lock:
                self._clients[config.id] = client
            log.info("mcp.server_registered", id=config.id, name=config.name)
        else:
            log.warning("mcp.server_connect_failed", id=config.id, name=config.name)

    async def add_server(self, config: MCPServerConfig) -> bool:
        """Connect a newly-added server and register it."""
        # Persist to config store
        MCPConfigStore.get_instance().add(config)
        if not config.enabled:
            return True
        await self._connect_server(config)
        return self._clients.get(config.id) is not None

    async def remove_server(self, server_id: str) -> bool:
        """Disconnect and remove a server."""
        async with self._lock:
            client = self._clients.pop(server_id, None)
        if client:
            await client.disconnect()
        MCPConfigStore.get_instance().remove(server_id)
        return True

    async def toggle_server(self, server_id: str, enabled: bool) -> bool:
        """Enable or disable a server at runtime."""
        store = MCPConfigStore.get_instance()
        store.set_enabled(server_id, enabled)
        config = store.get(server_id)
        if config is None:
            return False

        if enabled:
            await self._connect_server(config)
        else:
            async with self._lock:
                client = self._clients.pop(server_id, None)
            if client:
                await client.disconnect()
        return True

    async def test_connection(self, server_id: str) -> dict:
        """Attempt to connect (or ping) and return status."""
        store = MCPConfigStore.get_instance()
        config = store.get(server_id)
        if config is None:
            return {"success": False, "error": "Server not found"}

        # If already connected, just ping
        client = self._clients.get(server_id)
        if client and client.is_connected:
            alive = await client.ping()
            return {"success": alive, "info": client.get_info()}

        # Try fresh connection
        probe = MCPClient(config)
        ok = await probe.connect()
        if ok:
            info = probe.get_info()
            tools = await probe.list_tools()
            await probe.disconnect()
            return {"success": True, "info": info, "tool_count": len(tools)}
        return {"success": False, "error": "Connection failed"}

    # ── Tool Access ───────────────────────────────────────────────────────────

    def get_client(self, server_id: str) -> MCPClient | None:
        return self._clients.get(server_id)

    def get_all_clients(self) -> list[MCPClient]:
        return list(self._clients.values())

    def get_status(self) -> list[dict]:
        store = MCPConfigStore.get_instance()
        result = []
        for cfg in store.get_all():
            client = self._clients.get(cfg.id)
            result.append({
                "id": cfg.id,
                "name": cfg.name,
                "transport": cfg.transport,
                "enabled": cfg.enabled,
                "connected": client.is_connected if client else False,
            })
        return result

    # ── Health Loop ───────────────────────────────────────────────────────────

    async def _health_loop(self) -> None:
        """Periodically ping servers; reconnect if dead."""
        await asyncio.sleep(HEALTH_CHECK_INTERVAL)
        while True:
            try:
                store = MCPConfigStore.get_instance()
                for cfg in store.get_all():
                    if not cfg.enabled:
                        continue
                    client = self._clients.get(cfg.id)
                    if client is None or not client.is_connected:
                        log.info("mcp.health_reconnecting", id=cfg.id)
                        await self._connect_server(cfg)
                    else:
                        alive = await client.ping()
                        if not alive:
                            log.warning("mcp.health_dead", id=cfg.id)
                            async with self._lock:
                                self._clients.pop(cfg.id, None)
                            await self._connect_server(cfg)
            except asyncio.CancelledError:
                return
            except Exception as exc:
                log.error("mcp.health_loop_error", error=str(exc))
            await asyncio.sleep(HEALTH_CHECK_INTERVAL)
