"""Tool schema translation and trimming for Gemini function calling."""
from __future__ import annotations

from typing import Any
from google.genai import types


def trim_description(text: str, max_len: int) -> str:
    """Trim a description to max_len chars, keeping it readable."""
    if not text or len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return cut + "…"


def build_gemini_tools(
    tool_declarations: list[dict],
    reasoning_mode: str = "normal",
) -> list[types.Tool] | None:
    """Convert tool manifests to Google GenAI Tool structures with mode-based trimming."""
    if not tool_declarations:
        return None

    fn_declarations = []
    core_fast_tools = {
        "file_manager", "run_command", "web_search", "write_to_file",
        "replace_file_content", "view_file", "list_dir", "grep_search",
        "weather", "news_fetch", "image_analysis", "generate_image",
        "reminder", "translator", "audio_summary"
    }

    if reasoning_mode == "fast":
        tool_desc_limit, param_desc_limit = 80, 100
    elif reasoning_mode == "pro":
        tool_desc_limit, param_desc_limit = 999, 999
    else:
        tool_desc_limit, param_desc_limit = 120, 160

    for td in tool_declarations:
        if reasoning_mode == "fast" and td["name"] not in core_fast_tools:
            continue
        params = td.get("parameters", {})
        properties_source = {}
        required_source = []

        if "properties" in params and isinstance(params["properties"], dict):
            properties_source = params["properties"]
            req = params.get("required", [])
            required_source = list(req) if isinstance(req, (list, tuple, set)) else []
        else:
            properties_source = params
            required_source = []
            for pname, pinfo in params.items():
                if isinstance(pinfo, dict) and pinfo.get("required", False):
                    required_source.append(pname)

        properties = {}
        required = []
        for pname, pinfo in properties_source.items():
            if not isinstance(pinfo, dict):
                continue
            ptype = pinfo.get("type", "string").upper()
            type_map = {
                "STRING": "STRING", "STR": "STRING",
                "INTEGER": "INTEGER", "INT": "INTEGER",
                "NUMBER": "NUMBER", "FLOAT": "NUMBER",
                "BOOLEAN": "BOOLEAN", "BOOL": "BOOLEAN",
                "ARRAY": "ARRAY", "LIST": "ARRAY",
                "OBJECT": "OBJECT", "DICT": "OBJECT",
            }
            mapped = type_map.get(ptype, "STRING")
            raw_pdesc = pinfo.get("description", pname)
            prop: dict[str, Any] = {
                "type": mapped,
                "description": trim_description(raw_pdesc, param_desc_limit),
            }
            if pinfo.get("enum"):
                prop["enum"] = pinfo["enum"]
            if mapped == "ARRAY":
                items_src = pinfo.get("items", {"type": "string"})
                items_type = items_src.get("type", "string").upper()
                mapped_items_type = type_map.get(items_type, "STRING")
                prop["items"] = types.Schema(type=mapped_items_type)
            properties[pname] = prop

            is_req = (pname in required_source) or (pinfo.get("required", True) and "default" not in pinfo)
            if is_req:
                required.append(pname)

        schema = types.Schema(
            type="OBJECT",
            properties={k: types.Schema(**v) for k, v in properties.items()},
            required=required if required else None,
        )
        fn_declarations.append(
            types.FunctionDeclaration(
                name=td["name"],
                description=trim_description(td["description"], tool_desc_limit),
                parameters=schema,
            )
        )
    return [types.Tool(function_declarations=fn_declarations)]
