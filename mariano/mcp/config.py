"""Hekki MCP — Server configuration store.

Loads and persists MCP server definitions from data/mcp_servers.json.
Each server entry describes how to connect (stdio or SSE/HTTP) and
what credentials to inject.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Literal

import structlog

log = structlog.get_logger(__name__)

# ── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class MCPServerConfig:
    """Represents one MCP server connection definition."""
    id: str
    name: str
    transport: Literal["stdio", "sse", "http"]
    enabled: bool = True

    # stdio transport fields
    command: str = ""
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)

    # SSE / HTTP transport fields
    url: str = ""
    headers: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "MCPServerConfig":
        return cls(
            id=d.get("id", str(uuid.uuid4())[:8]),
            name=d.get("name", "Unnamed Server"),
            transport=d.get("transport", "stdio"),
            enabled=d.get("enabled", True),
            command=d.get("command", ""),
            args=d.get("args", []),
            env=d.get("env", {}),
            url=d.get("url", ""),
            headers=d.get("headers", {}),
        )


# ── Config Store ─────────────────────────────────────────────────────────────

class MCPConfigStore:
    """Singleton — reads & writes data/mcp_servers.json."""

    _instance: "MCPConfigStore | None" = None

    def __init__(self) -> None:
        from mariano.config import get_settings
        settings = get_settings()
        self._path: Path = settings.mariano_data_dir / "mcp_servers.json"
        self._servers: dict[str, MCPServerConfig] = {}
        self._load()

    @classmethod
    def get_instance(cls) -> "MCPConfigStore":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ── Persistence ──────────────────────────────────────────────────────────

    def _load(self) -> None:
        if not self._path.exists():
            self._servers = {}
            self._save()
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            servers_list = raw.get("servers", [])
            self._servers = {
                s["id"]: MCPServerConfig.from_dict(s)
                for s in servers_list
                if "id" in s
            }
            log.info("mcp.config_loaded", count=len(self._servers))
        except Exception as exc:
            log.error("mcp.config_load_failed", error=str(exc))
            self._servers = {}

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"servers": [s.to_dict() for s in self._servers.values()]}
        self._path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    # ── CRUD ─────────────────────────────────────────────────────────────────

    def get_all(self) -> list[MCPServerConfig]:
        return list(self._servers.values())

    def get(self, server_id: str) -> MCPServerConfig | None:
        return self._servers.get(server_id)

    def add(self, config: MCPServerConfig) -> MCPServerConfig:
        if not config.id:
            config.id = str(uuid.uuid4())[:8]
        self._servers[config.id] = config
        self._save()
        log.info("mcp.server_added", id=config.id, name=config.name)
        return config

    def update(self, server_id: str, data: dict) -> MCPServerConfig | None:
        server = self._servers.get(server_id)
        if server is None:
            return None
        for k, v in data.items():
            if hasattr(server, k):
                setattr(server, k, v)
        self._save()
        log.info("mcp.server_updated", id=server_id)
        return server

    def remove(self, server_id: str) -> bool:
        if server_id not in self._servers:
            return False
        del self._servers[server_id]
        self._save()
        log.info("mcp.server_removed", id=server_id)
        return True

    def set_enabled(self, server_id: str, enabled: bool) -> bool:
        server = self._servers.get(server_id)
        if server is None:
            return False
        server.enabled = enabled
        self._save()
        return True
