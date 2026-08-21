"""Ollama offline model client and tool routing adapter."""
from __future__ import annotations

import asyncio
import json
import urllib.request
import urllib.error
from typing import Any, Callable
import structlog

log = structlog.get_logger(__name__)


async def call_ollama(
    settings: Any,
    nm: Any,
    cp: Any,
    tool_declarations: list[dict],
    history: list[dict],
    message: str,
    system_override: str | None = None,
    on_chunk: Callable[[str], None] | None = None,
) -> dict:
    """Execute chat completion via local Ollama / OpenAI-compatible endpoint."""
    base_url = settings.active_ollama_base_url
    model = settings.active_ollama_model
    current_temp = nm.get_temperature()

    loop = asyncio.get_event_loop()
    def thread_safe_on_chunk(c):
        if on_chunk:
            loop.call_soon_threadsafe(on_chunk, c)

    def do_request():
        clean_base = base_url.rstrip('/')
        is_openai_style = "/v1" in clean_base or clean_base.endswith("/v1")
        target_url = f"{clean_base}/chat/completions" if is_openai_style else f"{clean_base}/v1/chat/completions"
        fallback_url = f"{clean_base}/api/chat"

        local_sys = (
            system_override or
            "You are Hekki, a friendly and smart AI assistant. "
            "Respond directly in natural conversational language. "
            "Do NOT output raw JSON strings like {\"name\": ...} for normal text chat."
        )
        ollama_messages = [{"role": "system", "content": local_sys}]
        for msg in history:
            role = "assistant" if msg.get("role") == "assistant" else msg.get("role", "user")
            ollama_messages.append({"role": role, "content": msg.get("content", "")})
        ollama_messages.append({"role": "user", "content": message})

        model_lower = model.lower()
        if any(tag in model_lower for tag in ["1b", "0.5b", "0.6b", "1.5b"]):
            smart_num_ctx = 4096
        elif any(tag in model_lower for tag in ["3b", "3.8b", "4b"]):
            smart_num_ctx = 8192
        elif any(tag in model_lower for tag in ["7b", "8b", "13b"]):
            smart_num_ctx = 16384
        else:
            smart_num_ctx = 32768

        payload = {
            "model": model,
            "messages": ollama_messages,
            "stream": True if on_chunk else False,
            "temperature": current_temp,
            "keep_alive": -1,
            "options": {
                "num_ctx": smart_num_ctx,
                "num_predict": 2048,
                "repeat_penalty": 1.1,
            }
        }

        is_small_model = any(tag in model_lower for tag in ["1b", "0.5b", "0.6b", "1.5b", "3b", "3.8b"])
        if tool_declarations and not is_small_model:
            ollama_tools = []
            for td in tool_declarations:
                params = td.get("parameters", {})
                if "properties" in params and isinstance(params["properties"], dict):
                    props_source = params["properties"]
                    required_list = list(params.get("required", []))
                else:
                    props_source = params
                    required_list = []
                cleaned_properties = {}
                for k, v in props_source.items():
                    if not isinstance(v, dict):
                        cleaned_properties[k] = {"type": "string", "description": k}
                        continue
                    ptype = v.get("type", "string").lower()
                    if ptype in ("str", "string"): ptype = "string"
                    elif ptype in ("int", "integer"): ptype = "integer"
                    elif ptype in ("float", "number"): ptype = "number"
                    elif ptype in ("bool", "boolean"): ptype = "boolean"
                    elif ptype in ("list", "array"): ptype = "array"
                    elif ptype in ("dict", "object"): ptype = "object"
                    cleaned_prop = {
                        "type": ptype,
                        "description": v.get("description", k)
                    }
                    if v.get("enum"):
                        cleaned_prop["enum"] = v["enum"]
                    cleaned_properties[k] = cleaned_prop
                if not required_list:
                    required_list = [
                        k for k, v in props_source.items()
                        if isinstance(v, dict) and v.get("required", True) and "default" not in v
                    ]
                ollama_tools.append({
                    "type": "function",
                    "function": {
                        "name": td["name"],
                        "description": td["description"],
                        "parameters": {
                            "type": "object",
                            "properties": cleaned_properties,
                            "required": required_list
                        }
                    }
                })
            payload["tools"] = ollama_tools

        urls = [target_url, fallback_url] if is_openai_style else [fallback_url, target_url]
        last_error = None
        for url in urls:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=300) as response:
                    if on_chunk:
                        full_content = ""
                        partial_tool_calls: dict[int, dict] = {}
                        for raw_line in response:
                            line = raw_line.decode("utf-8", errors="replace").strip()
                            if not line:
                                continue
                            if line.startswith("data: "):
                                line = line[6:].strip()
                            if line == "[DONE]":
                                break
                            try:
                                chunk = json.loads(line)
                                if "choices" in chunk and isinstance(chunk["choices"], list) and len(chunk["choices"]) > 0:
                                    delta = chunk["choices"][0].get("delta", {})
                                    content = delta.get("content", "") or ""
                                    if content:
                                        full_content += content
                                        thread_safe_on_chunk(content)
                                    for tc_chunk in (delta.get("tool_calls") or []):
                                        idx = tc_chunk.get("index", 0)
                                        if idx not in partial_tool_calls:
                                            partial_tool_calls[idx] = {"id": "", "type": "function", "function": {"name": "", "arguments": ""}}
                                        if tc_chunk.get("id"):
                                            partial_tool_calls[idx]["id"] += tc_chunk["id"]
                                        func_chunk = tc_chunk.get("function", {})
                                        if func_chunk.get("name"):
                                            partial_tool_calls[idx]["function"]["name"] += func_chunk["name"]
                                        if func_chunk.get("arguments"):
                                            partial_tool_calls[idx]["function"]["arguments"] += func_chunk["arguments"]
                                elif "message" in chunk and isinstance(chunk["message"], dict):
                                    msg = chunk["message"]
                                    content = msg.get("content", "") or ""
                                    if content:
                                        full_content += content
                                        thread_safe_on_chunk(content)
                                    for tc in (msg.get("tool_calls") or []):
                                        idx = len(partial_tool_calls)
                                        partial_tool_calls[idx] = tc
                            except Exception:
                                continue
                        reconstructed = [partial_tool_calls[i] for i in sorted(partial_tool_calls.keys())]
                        return {"message": {"role": "assistant", "content": full_content, "tool_calls": reconstructed}}
                    else:
                        resp_json = json.loads(response.read().decode("utf-8"))
                        if "choices" in resp_json and isinstance(resp_json["choices"], list) and len(resp_json["choices"]) > 0:
                            msg = resp_json["choices"][0].get("message", {})
                            return {"message": msg}
                        return resp_json
            except urllib.error.HTTPError as e:
                last_error = e
                if e.code == 404:
                    continue
                raise
            except urllib.error.URLError as e:
                last_error = e
                break

        raise RuntimeError(
            f"Local Gateway Connection error: Failed to connect to local server at '{base_url}'. "
            f"Make sure your local model server (Ollama, LM Studio, vLLM, LiteLLM) is running."
        ) from last_error

    try:
        resp_data = await asyncio.to_thread(do_request)
    except Exception as exc:
        log.error("ollama.chat_error", error=str(exc))
        return {"text": f"Error running offline Ollama model: {exc}", "tool_calls": []}

    if not isinstance(resp_data, dict):
        return {"text": str(resp_data) if resp_data else None, "tool_calls": []}

    message_data = resp_data.get("message", {})
    if not isinstance(message_data, dict):
        message_data = {}
    text = message_data.get("content")
    tool_calls = []

    if text and text.strip().startswith("{") and text.strip().endswith("}"):
        try:
            parsed_json = json.loads(text.strip())
            if isinstance(parsed_json, dict) and ("name" in parsed_json or "function" in parsed_json):
                tname = parsed_json.get("name") or parsed_json.get("function", {}).get("name")
                targs = parsed_json.get("arguments") or parsed_json.get("args") or parsed_json.get("function", {}).get("arguments", {})
                if tname:
                    tool_calls.append({"name": tname, "args": targs if isinstance(targs, dict) else {}})
                    text = None
        except Exception:
            pass

    if "tool_calls" in message_data and message_data["tool_calls"]:
        for tc in message_data["tool_calls"]:
            if not isinstance(tc, dict):
                continue
            if "function" in tc:
                func = tc.get("function", {})
                if not isinstance(func, dict):
                    continue
                tc_name = func.get("name")
                args = func.get("arguments", {})
            else:
                tc_name = tc.get("name")
                args = tc.get("arguments", tc.get("args", {}))

            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except Exception:
                    args = {}
            if not isinstance(args, dict):
                args = {}

            if tc_name:
                tool_calls.append({"name": tc_name, "args": args})

    return {"text": text, "tool_calls": tool_calls}
