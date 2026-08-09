"""Hekki MCP — Skill Bridge.

This is the KEY integration glue.  For every tool that an MCP server
exposes, this module dynamically creates a concrete BaseSkill subclass
and registers it into Hekki's SkillRegistry.

Registered skill names follow the pattern:
    mcp_{server_id}_{tool_name}

This means:
  • The Hekki ReAct loop and SkillRegistry see MCP tools as native skills.
  • No changes needed to react.py, agent.py, or the Gemini tool manifest.
  • Removing an MCP server automatically unregisters its skills.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, TYPE_CHECKING

import structlog

from mariano.skills._base import BaseSkill, SkillResult

if TYPE_CHECKING:
    from mariano.mcp.client import MCPClient

log = structlog.get_logger(__name__)


# ── Dynamic Skill Factory ────────────────────────────────────────────────────

def _make_mcp_skill_class(
    server_id: str,
    server_name: str,
    tool_def: dict,
) -> type[BaseSkill]:
    """
    Dynamically creates a BaseSkill subclass that wraps one MCP tool.

    Args:
        server_id:   Short identifier for the MCP server (e.g. 'github').
        server_name: Human-readable server name (e.g. 'GitHub MCP').
        tool_def:    The MCP tool manifest dict with 'name', 'description',
                     and 'inputSchema'.
    """
    tool_name: str = tool_def.get("name", "unknown")
    tool_desc: str = tool_def.get("description", f"MCP tool: {tool_name}")
    input_schema: dict = tool_def.get("inputSchema", {})

    skill_name = f"mcp_{server_id}_{tool_name}"
    skill_description = f"[MCP: {server_name}] {tool_desc}"

    # Build Gemini-compatible parameter schema from MCP inputSchema
    def _build_params_schema() -> dict:
        props = input_schema.get("properties", {})
        required = input_schema.get("required", [])
        converted_props: dict = {}
        for pname, pdef in props.items():
            converted_props[pname] = {
                "type": pdef.get("type", "string"),
                "description": pdef.get("description", pname),
            }
            if "enum" in pdef:
                converted_props[pname]["enum"] = pdef["enum"]
        return {
            "type": "object",
            "properties": converted_props,
            "required": required,
        }

    params_schema = _build_params_schema()

    # Dynamically define the class
    class _MCPSkill(BaseSkill):
        name = skill_name
        description = skill_description
        version = "mcp-1.0"
        tags = ["mcp", server_id]

        def get_parameters_schema(self) -> dict:
            return params_schema

        async def execute(self, **kwargs: Any) -> SkillResult:
            """Route the call through the live MCPClient."""
            from mariano.mcp.server_manager import MCPServerManager
            client = MCPServerManager.get_instance().get_client(server_id)
            if client is None or not client.is_connected:
                return SkillResult(
                    success=False,
                    data=None,
                    error=f"MCP server '{server_name}' is not connected.",
                )
            try:
                result = await client.call_tool(tool_name, kwargs)
                # MCP result is: {"content": [...], "isError": bool}
                is_error = result.get("isError", False)
                content_items = result.get("content", [])
                text_parts = []
                for item in content_items:
                    if item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                    elif item.get("type") == "resource":
                        text_parts.append(
                            f"[Resource: {item.get('uri', '')}]\n"
                            + json.dumps(item.get("text", ""), ensure_ascii=False)
                        )
                output = "\n".join(text_parts) if text_parts else json.dumps(result)
                return SkillResult(
                    success=not is_error,
                    data=output,
                    error=output if is_error else None,
                    metadata={"mcp_server": server_name, "tool": tool_name},
                )
            except Exception as exc:
                log.error(
                    "mcp.skill_execute_failed",
                    skill=skill_name,
                    error=str(exc),
                )
                return SkillResult(
                    success=False,
                    data=None,
                    error=f"MCP call failed: {exc}",
                )

    # Give class a unique __name__ for debugging
    _MCPSkill.__name__ = f"MCPSkill_{server_id}_{tool_name}"
    _MCPSkill.__qualname__ = _MCPSkill.__name__
    return _MCPSkill


# ── Bridge ────────────────────────────────────────────────────────────────────

class MCPSkillBridge:
    """Converts all tools from a connected MCPClient into registered BaseSkills."""

    @staticmethod
    async def register_server_tools(
        client: "MCPClient",
        registry,
    ) -> list[str]:
        """
        Fetch tools from an MCP server and register them in the SkillRegistry.

        Returns list of registered skill names.
        """
        info = client.get_info()
        server_id: str = info["server_id"]
        server_name: str = info["server_name"]

        tools = await client.list_tools()
        if not tools:
            log.warning("mcp.bridge_no_tools", server=server_name)
            return []

        registered: list[str] = []
        for tool_def in tools:
            try:
                skill_cls = _make_mcp_skill_class(server_id, server_name, tool_def)
                skill_instance = skill_cls()
                await registry.register(skill_instance)
                registered.append(skill_instance.name)
            except Exception as exc:
                log.error(
                    "mcp.bridge_register_failed",
                    tool=tool_def.get("name"),
                    server=server_name,
                    error=str(exc),
                )

        log.info(
            "mcp.bridge_registered",
            server=server_name,
            count=len(registered),
        )
        return registered

    @staticmethod
    async def unregister_server_tools(
        server_id: str,
        registry,
    ) -> None:
        """Remove all skills belonging to an MCP server from the registry."""
        prefix = f"mcp_{server_id}_"
        to_remove = [
            name for name in registry.skill_names
            if name.startswith(prefix)
        ]
        for name in to_remove:
            await registry.unregister(name)
        log.info("mcp.bridge_unregistered", server_id=server_id, count=len(to_remove))

    @staticmethod
    async def refresh_all(registry) -> dict[str, list[str]]:
        """Re-scan all connected servers and (re-)register their tools."""
        from mariano.mcp.server_manager import MCPServerManager
        manager = MCPServerManager.get_instance()
        results: dict[str, list[str]] = {}
        for client in manager.get_all_clients():
            if not client.is_connected:
                continue
            info = client.get_info()
            sid = info["server_id"]
            await MCPSkillBridge.unregister_server_tools(sid, registry)
            names = await MCPSkillBridge.register_server_tools(client, registry)
            results[sid] = names
        return results
