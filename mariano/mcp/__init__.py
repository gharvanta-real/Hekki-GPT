"""Hekki MCP — Model Context Protocol client integration layer.

This package connects Hekki to any MCP-compatible server (GitHub, Notion,
Postgres, Slack, etc.) and dynamically exposes their tools as native Hekki skills.
"""
from mariano.mcp.config import MCPServerConfig, MCPConfigStore
from mariano.mcp.client import MCPClient
from mariano.mcp.server_manager import MCPServerManager
from mariano.mcp.bridge import MCPSkillBridge

__all__ = [
    "MCPServerConfig",
    "MCPConfigStore",
    "MCPClient",
    "MCPServerManager",
    "MCPSkillBridge",
]
