"""Hekki MCP — JSON-RPC 2.0 client.

Supports two transports:
  • stdio  — spawns a local subprocess (npx / uvx / python), speaks over
             stdin / stdout.  No network required.
  • sse    — connects to a remote MCP server via HTTP Server-Sent Events.
  • http   — connects via plain HTTP POST (Streamable HTTP transport).

Protocol spec: MCP 2025-03-26 (backward-compat with 2024-11-05)
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from typing import Any

import structlog

from mariano.mcp.config import MCPServerConfig

log = structlog.get_logger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_request(method: str, params: dict | None = None) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4())[:8],
        "method": method,
        "params": params or {},
    }

def _encode(obj: dict) -> bytes:
    return (json.dumps(obj) + "\n").encode("utf-8")


# ── Stdio Transport ──────────────────────────────────────────────────────────

class StdioTransport:
    """Manages a child process and communicates over its stdin/stdout."""

    def __init__(self, config: MCPServerConfig) -> None:
        self._config = config
        self._proc: asyncio.subprocess.Process | None = None
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None

    async def start(self) -> None:
        merged_env = {**os.environ, **self._config.env}
        self._proc = await asyncio.create_subprocess_exec(
            self._config.command,
            *self._config.args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=merged_env,
        )
        self._writer = self._proc.stdin  # type: ignore[assignment]
        self._reader = self._proc.stdout  # type: ignore[assignment]
        log.info("mcp.stdio_started", cmd=self._config.command, pid=self._proc.pid)

    async def send(self, obj: dict) -> None:
        if self._writer is None:
            raise RuntimeError("Transport not started")
        self._writer.write(_encode(obj))
        await self._writer.drain()

    async def receive(self) -> dict:
        if self._reader is None:
            raise RuntimeError("Transport not started")
        line = await asyncio.wait_for(self._reader.readline(), timeout=30)
        return json.loads(line.decode("utf-8").strip())

    async def stop(self) -> None:
        if self._proc and self._proc.returncode is None:
            self._proc.terminate()
            try:
                await asyncio.wait_for(self._proc.wait(), timeout=5)
            except asyncio.TimeoutError:
                self._proc.kill()
        log.info("mcp.stdio_stopped", cmd=self._config.command)


# ── SSE / HTTP Transport ─────────────────────────────────────────────────────

class HttpTransport:
    """Connects to a remote MCP server over HTTP (SSE or POST)."""

    def __init__(self, config: MCPServerConfig) -> None:
        self._config = config
        self._session = None
        self._pending: dict[str, asyncio.Future] = {}

    async def start(self) -> None:
        try:
            import httpx
            self._session = httpx.AsyncClient(
                headers=self._config.headers,
                timeout=60,
            )
            log.info("mcp.http_started", url=self._config.url)
        except ImportError:
            raise RuntimeError("httpx not installed. Run: pip install httpx")

    async def send(self, obj: dict) -> None:
        pass  # HTTP sends happen inline in receive()

    async def receive(self) -> dict:
        """For HTTP transport, send + receive are combined in call()."""
        raise NotImplementedError("Use call() directly for HTTP transport")

    async def call(self, obj: dict) -> dict:
        if self._session is None:
            raise RuntimeError("Transport not started")
        resp = await self._session.post(self._config.url, json=obj)
        resp.raise_for_status()
        return resp.json()

    async def stop(self) -> None:
        if self._session:
            await self._session.aclose()
        log.info("mcp.http_stopped", url=self._config.url)


# ── MCP Client ───────────────────────────────────────────────────────────────

class MCPClient:
    """High-level MCP client — wraps transport and provides typed API."""

    def __init__(self, config: MCPServerConfig) -> None:
        self._config = config
        self._transport: StdioTransport | HttpTransport | None = None
        self._is_connected = False
        self._server_info: dict = {}
        self._capabilities: dict = {}

    @property
    def is_connected(self) -> bool:
        return self._is_connected

    @property
    def server_name(self) -> str:
        return self._server_info.get("name", self._config.name)

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def connect(self) -> bool:
        """Initialize transport, perform MCP handshake. Returns True on success."""
        try:
            if self._config.transport == "stdio":
                self._transport = StdioTransport(self._config)
            else:
                self._transport = HttpTransport(self._config)

            await self._transport.start()
            await self._handshake()
            self._is_connected = True
            log.info(
                "mcp.connected",
                server=self._config.name,
                info=self._server_info,
            )
            return True
        except Exception as exc:
            log.error("mcp.connect_failed", server=self._config.name, error=str(exc))
            self._is_connected = False
            return False

    async def disconnect(self) -> None:
        if self._transport:
            await self._transport.stop()
        self._is_connected = False

    # ── Protocol ─────────────────────────────────────────────────────────────

    async def _handshake(self) -> None:
        """Send MCP initialize request and receive server capabilities."""
        init_req = _make_request("initialize", {
            "protocolVersion": "2025-03-26",
            "capabilities": {
                "roots": {"listChanged": False},
                "sampling": {},
            },
            "clientInfo": {
                "name": "Hekki",
                "version": "1.0.0",
            },
        })
        resp = await self._rpc(init_req)
        result = resp.get("result", {})
        self._server_info = result.get("serverInfo", {})
        self._capabilities = result.get("capabilities", {})

        # Send initialized notification (no response expected)
        notif = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        }
        await self._transport.send(notif)  # type: ignore[union-attr]

    async def _rpc(self, request: dict) -> dict:
        """Send a JSON-RPC request and await the matching response."""
        if isinstance(self._transport, HttpTransport):
            return await self._transport.call(request)

        assert isinstance(self._transport, StdioTransport)
        await self._transport.send(request)

        req_id = request["id"]
        # Drain responses until we find ours (server may emit notifications)
        for _ in range(20):
            raw = await self._transport.receive()
            if raw.get("id") == req_id:
                if "error" in raw:
                    raise RuntimeError(f"MCP error: {raw['error']}")
                return raw
        raise TimeoutError(f"No response for request id={req_id}")

    # ── Public API ───────────────────────────────────────────────────────────

    async def list_tools(self) -> list[dict]:
        """Return list of tool definitions from the server."""
        if not self._is_connected:
            return []
        try:
            resp = await self._rpc(_make_request("tools/list"))
            tools = resp.get("result", {}).get("tools", [])
            log.info("mcp.tools_listed", server=self._config.name, count=len(tools))
            return tools
        except Exception as exc:
            log.error("mcp.list_tools_failed", server=self._config.name, error=str(exc))
            return []

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict:
        """Invoke a specific tool and return the raw result content."""
        if not self._is_connected:
            return {"error": "Not connected"}
        try:
            req = _make_request("tools/call", {
                "name": tool_name,
                "arguments": arguments,
            })
            resp = await self._rpc(req)
            result = resp.get("result", {})
            log.info("mcp.tool_called", tool=tool_name, server=self._config.name)
            return result
        except Exception as exc:
            log.error("mcp.call_tool_failed", tool=tool_name, error=str(exc))
            return {"error": str(exc)}

    async def ping(self) -> bool:
        """Check if the server is still responsive."""
        try:
            resp = await self._rpc(_make_request("ping"))
            return "result" in resp
        except Exception:
            return False

    def get_info(self) -> dict:
        return {
            "server_id": self._config.id,
            "server_name": self._config.name,
            "transport": self._config.transport,
            "connected": self._is_connected,
            "capabilities": self._capabilities,
            "server_info": self._server_info,
        }
