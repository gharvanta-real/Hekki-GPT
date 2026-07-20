"""MARIANO Core — TCP IPC client for compiled Rust Nexus-Engine daemon."""
from __future__ import annotations

import asyncio
import json
import socket
from typing import Any, Dict, Optional

import structlog

log = structlog.get_logger(__name__)

IPC_ADDR = "127.0.0.1:57312"


class NexusIpcClient:
    """Client that handles communication with the background Rust Nexus-Engine daemon."""

    _instance: Optional[NexusIpcClient] = None

    def __init__(self) -> None:
        self.host = "127.0.0.1"
        self.port = 57312

    @classmethod
    def get_instance(cls) -> NexusIpcClient:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def is_engine_active(self) -> bool:
        """Checks if the Rust daemon is active on port 57312."""
        try:
            _, writer = await asyncio.open_connection(self.host, self.port)
            writer.close()
            await writer.wait_closed()
            return True
        except Exception:
            return False

    async def send_request(self, request_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Sends JSON request to Rust daemon and returns JSON response."""
        try:
            reader, writer = await asyncio.open_connection(self.host, self.port)
            
            # serialize and append newline for Rust BufReader.lines()
            payload = json.dumps(request_data) + "\n"
            writer.write(payload.encode("utf-8"))
            await writer.drain()

            # Read response line
            line = await reader.readline()
            writer.close()
            await writer.wait_closed()

            if not line:
                return None

            return json.loads(line.decode("utf-8"))
        except Exception as e:
            log.error("ipc_client.request_failed", error=str(e))
            return None
