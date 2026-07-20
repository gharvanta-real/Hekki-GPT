"""MARIANO — Convert skill manifests to Gemini function calling schemas."""
from __future__ import annotations

from typing import Any


TYPE_MAP = {
    "string": "STRING",
    "str": "STRING",
    "integer": "INTEGER",
    "int": "INTEGER",
    "number": "NUMBER",
    "float": "NUMBER",
    "boolean": "BOOLEAN",
    "bool": "BOOLEAN",
    "array": "ARRAY",
    "list": "ARRAY",
    "object": "OBJECT",
    "dict": "OBJECT",
}


def skill_to_gemini_tool(manifest: dict) -> dict:
    """Convert a skill manifest dict to Gemini function declaration dict."""
    params = manifest.get("parameters", {})
    required = []
    properties = {}

    for param_name, param_info in params.items():
        param_type = param_info.get("type", "string")
        gemini_type = TYPE_MAP.get(param_type.lower(), "STRING")

        properties[param_name] = {
            "type": gemini_type,
            "description": param_info.get("description", param_name),
        }

        if param_info.get("enum"):
            properties[param_name]["enum"] = param_info["enum"]

        if param_info.get("required", True) and "default" not in param_info:
            required.append(param_name)

    tool_schema = {
        "name": manifest["name"],
        "description": manifest["description"],
        "parameters": {
            "type": "OBJECT",
            "properties": properties,
        },
    }

    if required:
        tool_schema["parameters"]["required"] = required

    return tool_schema


def build_tool_declarations(manifests: list[dict]) -> list[dict]:
    """Build list of Gemini tool declarations from skill manifests."""
    return [skill_to_gemini_tool(m) for m in manifests]
