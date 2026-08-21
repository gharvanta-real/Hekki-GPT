"""MARIANO — Gemini API async client integrated with TCMM Neuromodulator."""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Callable

import structlog
from google import genai
from google.genai import types

from mariano.config import get_settings, SYSTEM_PROMPT, MAX_OUTPUT_TOKENS
from mariano.config.prompt_loader import load_rule_layer

log = structlog.get_logger(__name__)

# Model Fallback Chain — fallback to available Flash Lite models if primary is completely exhausted
_MODEL_FALLBACK_CHAIN: list[str] = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
_MAX_RETRIES = 4
_RETRY_BASE_DELAY = 2  # seconds (2s, 4s, 8s, 16s)



class GeminiClient:
    """Async wrapper around google.genai with TCMM neuromodulatory control & Ollama offline model support."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._client = None
        self._last_key = None
        self._tool_declarations: list[dict] = []
        from mariano.core.neuromodulator import Neuromodulator
        self._nm = Neuromodulator.get_instance()
        from mariano.core.cognitive_profiler import CognitiveProfiler
        self._cp = CognitiveProfiler.get_instance()

    def _get_client(self) -> genai.Client:
        current_key = self._settings.active_gemini_api_key
        if self._client is None or current_key != self._last_key:
            self._client = genai.Client(api_key=current_key)
            self._last_key = current_key
        return self._client

    def configure_tools(self, manifests: list[dict]) -> None:
        """Register tool schemas for Gemini function calling."""
        self._tool_declarations = manifests

    @staticmethod
    def _trim_desc(text: str, max_len: int) -> str:
        """Trim a description to max_len chars, keeping it readable."""
        if not text or len(text) <= max_len:
            return text
        # Cut at last word boundary before max_len, append ellipsis
        cut = text[:max_len].rsplit(" ", 1)[0]
        return cut + "…"

    def _build_tools(self) -> list[types.Tool] | None:
        if not self._tool_declarations:
            return None
        fn_declarations = []
        reasoning_mode = self._settings.active_reasoning_mode
        # In fast mode, only send core tools to save ~5000 tokens per call
        core_fast_tools = {
            "file_manager", "run_command", "web_search", "write_to_file",
            "replace_file_content", "view_file", "list_dir", "grep_search",
            "weather", "news_fetch", "image_analysis", "generate_image",
            "reminder", "translator", "audio_summary"
        }
        # Description length limits per mode — tool quality is NOT affected,
        # only the text sent to Gemini for routing decisions is trimmed.
        # fast=80/100, normal=120/160, pro/thinking=full
        if reasoning_mode == "fast":
            tool_desc_limit, param_desc_limit = 80, 100
        elif reasoning_mode == "pro":
            tool_desc_limit, param_desc_limit = 999, 999  # no trim
        else:
            tool_desc_limit, param_desc_limit = 120, 160

        for td in self._tool_declarations:
            if reasoning_mode == "fast" and td["name"] not in core_fast_tools:
                continue
            params = td.get("parameters", {})
            properties_source = {}
            required_source = []

            # Support both standard JSON Schema parameters and flat format
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
                    "description": self._trim_desc(raw_pdesc, param_desc_limit),
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
                    description=self._trim_desc(td["description"], tool_desc_limit),
                    parameters=schema,
                )
            )
        return [types.Tool(function_declarations=fn_declarations)]


    async def _call_ollama(
        self,
        history: list[dict],
        message: str,
        system_override: str | None = None,
        on_chunk: Callable[[str], None] | None = None,
    ) -> dict:
        import urllib.request
        import urllib.error
        
        base_url = self._settings.active_ollama_base_url
        model = self._settings.active_ollama_model
        
        # Build dynamic cognitive instructions
        current_temp = self._nm.get_temperature()
        ns = self._nm.state
        import platform

        from pathlib import Path

        sys_os = platform.system()
        sys_home = str(Path.home()).replace('\\', '/')
        sys_cwd = str(Path.cwd()).replace('\\', '/')

        env_state = (
            f"\n\n[SYSTEM ENVIRONMENT STATE]\n"
            f"- Current OS: {sys_os}\n"
            f"- User Home Directory: {sys_home}\n"
            f"- Current Working Directory: {sys_cwd}\n"
            f"- Strict Path Convention: You MUST use Windows path separators (e.g. C:/Users/anshu/Downloads) and never guess Linux paths like /home/user/ or /Users/.\n"
            f"- Core Tools & Valid Actions:\n"
            f"  * file_manager: Use execute(action, path, destination, pattern, content). Valid actions: ['list', 'read', 'write', 'delete', 'copy', 'move', 'create_dir', 'get_size', 'search', 'grep']. NEVER guess actions like 'list_dir' or 'list_directory'.\n"
            f"  * run_command: Use execute(command, cwd). Executes CMD/PowerShell terminal commands or Python scripts on Windows.\n"
            f"  * Immediate Execution Rule: When user requests file deletion or cleaning (e.g. 'clean karo', 'delete karo'), DO NOT output plain text explanations. Immediately invoke file_manager(action='delete') or run_command to execute the deletion.\n"
        )

        state_inject = (
            f"\n\n[TCMM COGNITIVE STATE]\n"
            f"Dopamine={ns.dopamine:.2f} (Focus index)\n"
            f"Serotonin={ns.serotonin:.2f} (Emotional stability)\n"
            f"Acetylcholine={ns.acetylcholine:.2f} (Working memory context index)\n"
            f"Curiosity={ns.curiosity:.2f} (Exploratory drive)\n"
            f"Melatonin={ns.melatonin:.2f} (Fatigue)\n"
        )
        alignment_inject = self._cp.feedback.get_dynamic_prompt_rules()
        emotional_inject = f"\n\n[LIMBIC EMOTIONAL DIRECTIVES]\n{self._nm.get_emotional_directives()}"
        
        if system_override:
            dynamic_system_instruction = system_override
        else:
            layer1_rules = load_rule_layer("layer1_rules")
            layer2_rules = load_rule_layer("layer2_rules")
            
            # Inject user identity + custom instructions from settings
            user_inject = ""
            _user_name = self._settings.dynamic_config.get("user_name", "")
            _user_instructions = self._settings.dynamic_config.get("user_instructions", "")
            if _user_name:
                user_inject += f"\n\n[USER IDENTITY]\nThe user's name is: {_user_name}. Address them by this name naturally."
            if _user_instructions:
                user_inject += f"\n\n[USER CUSTOM INSTRUCTIONS]\n{_user_instructions}"

            dynamic_system_instruction = (
                SYSTEM_PROMPT
                + env_state
                + state_inject
                + alignment_inject
                + emotional_inject
                + layer1_rules
                + layer2_rules
                + user_inject
            )

        loop = asyncio.get_event_loop()
        def thread_safe_on_chunk(c):
            if on_chunk:
                loop.call_soon_threadsafe(on_chunk, c)

        def do_request():
            clean_base = base_url.rstrip('/')
            is_openai_style = "/v1" in clean_base or clean_base.endswith("/v1")
            
            target_url = f"{clean_base}/chat/completions" if is_openai_style else f"{clean_base}/v1/chat/completions"
            fallback_url = f"{clean_base}/api/chat"

            # Streamlined local prompt to minimize Prompt Evaluation (TTFT) latency
            local_sys = (
                "You are Hekki, a friendly and smart AI assistant. "
                "Respond directly in natural conversational language. "
                "Do NOT output raw JSON strings like {\"name\": ...} for normal text chat."
            )
            ollama_messages = [{"role": "system", "content": local_sys}]
            for msg in history:
                role = "assistant" if msg["role"] == "assistant" else msg["role"]
                ollama_messages.append({"role": role, "content": msg["content"]})
            ollama_messages.append({"role": "user", "content": message})
            
            # Determine smart num_ctx based on model size to avoid slow KV-cache allocation.
            # Small models (1B/3B) don't need 32K context — it only wastes RAM and causes slow TTFT.
            model_lower = model.lower()
            if any(tag in model_lower for tag in ["1b", "0.5b", "0.6b", "1.5b"]):
                smart_num_ctx = 4096   # Small models: 4K context is plenty, fast load
            elif any(tag in model_lower for tag in ["3b", "3.8b", "4b"]):
                smart_num_ctx = 8192   # Medium-small models: 8K context
            elif any(tag in model_lower for tag in ["7b", "8b", "13b"]):
                smart_num_ctx = 16384  # Mid-range models: 16K context
            else:
                smart_num_ctx = 32768  # Large models (30B+): full 32K

            payload = {
                "model": model,
                "messages": ollama_messages,
                "stream": True if on_chunk else False,
                "temperature": current_temp,
                "keep_alive": -1,  # Keep model hot in RAM — never unload between requests
                "options": {
                    "num_ctx": smart_num_ctx,  # Smart context window (avoids slow 32K KV-cache for small models)
                    "num_predict": 2048,       # Balanced output limit
                    "repeat_penalty": 1.1,     # Prevent repetition
                }
            }
            
            # Tool Declarations: Only inject for models that properly support structured tool calling.
            # Small models (1B, 3B) hallucinate raw JSON when tools are injected — skip tools for them.
            _is_small_model = any(tag in model_lower for tag in ["1b", "0.5b", "0.6b", "1.5b", "3b", "3.8b"])
            if self._tool_declarations and not _is_small_model:
                ollama_tools = []
                for td in self._tool_declarations:
                    params = td.get("parameters", {})
                    # Support nested JSON Schema: {"properties": {...}, "required": [...]}
                    if "properties" in params and isinstance(params["properties"], dict):
                        props_source = params["properties"]
                        required_list = list(params.get("required", []))
                    else:
                        props_source = params
                        required_list = []
                    cleaned_properties = {}
                    for k, v in props_source.items():
                        # Guard: skip non-dict values (flat "action": "string" manifests)
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
                    # Infer required if not from nested schema
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
                            # Accumulate partial tool_call chunks by index for proper reconstruction
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
                                        # Accumulate partial tool_call chunks by index
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
                                        # Ollama native /api/chat non-streaming style final message
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
                            # Reconstruct complete tool_calls list from accumulated chunks
                            reconstructed_tool_calls = [partial_tool_calls[i] for i in sorted(partial_tool_calls.keys())]
                            return {"message": {"role": "assistant", "content": full_content, "tool_calls": reconstructed_tool_calls}}
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

        # Safety guard: if resp_data is None or not a dict
        if not isinstance(resp_data, dict):
            return {"text": str(resp_data) if resp_data else None, "tool_calls": []}

        message_data = resp_data.get("message", {})
        if not isinstance(message_data, dict):
            message_data = {}
        text = message_data.get("content")
        tool_calls = []

        # Detect raw JSON string hallucination in text e.g. {"name": "greet", "arguments": ...}
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
                # Guard: skip non-dict entries entirely
                if not isinstance(tc, dict):
                    continue

                # Detect format: Ollama native vs OpenAI-style
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

    async def chat(self, history: list[dict], message: str, on_chunk: Callable[[str], None] | None = None) -> dict:
        """Send message with history. Routes to Ollama if configured, otherwise Gemini."""
        if self._settings.active_use_ollama:
            return await self._call_ollama(history, message, on_chunk=on_chunk)

        if not self._settings.active_gemini_api_key:
            return {
                "text": "Gemini API Key is not configured. Please enter your API Key in the **Settings** tab to start chatting with MARIANO.",
                "tool_calls": []
            }

        from mariano.core.rate_limiter import GeminiRateLimiter, estimate_tokens_from_text
        # Safely trim history to prevent token explosion while preserving turn integrity
        reasoning_mode_pre = self._settings.active_reasoning_mode
        _max_history = 8 if reasoning_mode_pre == "fast" else 14
        if len(history) > _max_history:
            trimmed = history[-_max_history:]
            # Must start on a user turn to avoid orphaned function calls / responses
            first_user_idx = 0
            for idx, m in enumerate(trimmed):
                if m.get("role") == "user" and not m.get("tool_response"):
                    first_user_idx = idx
                    break
            else:
                first_user_idx = len(trimmed)
            history = trimmed[first_user_idx:]

        estimated_tokens = estimate_tokens_from_text(message, history)
        await GeminiRateLimiter.get_instance().acquire(estimated_tokens)
        contents = self._build_contents(history, message)
        tools = self._build_tools()

        # TCMM Parameter Control
        current_temp = self._nm.get_temperature()
        ns = self._nm.state

        import platform
        from pathlib import Path
        from datetime import datetime

        now = datetime.now()
        current_time_str = now.strftime("%A, %B %d, %Y (%I:%M %p)")

        sys_os = platform.system()
        sys_home = str(Path.home()).replace('\\', '/')
        sys_cwd = str(Path.cwd()).replace('\\', '/')

        env_state = (
            f"\n\n[SYSTEM ENVIRONMENT STATE & REAL-TIME TEMPORAL ANCHOR]\n"
            f"- Current Real-World Date & Time: {current_time_str}\n"
            f"- Current Year: {now.year}\n"
            f"- Temporal Verification Rule: ALWAYS use this current real-world timestamp for date/time/year questions. NEVER hallucinate past dates or training cutoffs (like 2023 or 2024).\n"
            f"- Strict Media/YouTube Rule: NEVER guess, fabricate, or hallucinate YouTube video IDs or links (especially never output dummy links like 'dQw4w9WgXcQ' / Rick Astley). If user asks for videos, you MUST call 'web_search' to get verified real watch URLs or provide a YouTube search query URL ('https://www.youtube.com/results?search_query=...').\n"
            f"- Current OS: {sys_os}\n"
            f"- User Home Directory: {sys_home}\n"
            f"- Current Working Directory: {sys_cwd}\n"
            f"- Strict Path Convention: You MUST use Windows path separators (e.g. C:/Users/anshu/Downloads) and never guess Linux paths like /home/user/ or /Users/.\n"
            f"- Core Tools & Valid Actions:\n"
            f"  * file_manager: Use execute(action, path, destination, pattern, content). Valid actions: ['list', 'read', 'write', 'delete', 'copy', 'move', 'create_dir', 'get_size', 'search', 'grep']. NEVER guess actions like 'list_dir' or 'list_directory'.\n"
            f"  * run_command: Use execute(command, cwd). Executes CMD/PowerShell terminal commands or Python scripts on Windows.\n"
            f"  * Immediate Execution Rule: When user requests file deletion or cleaning (e.g. 'clean karo', 'delete karo'), DO NOT output plain text explanations. Immediately invoke file_manager(action='delete') or run_command to execute the deletion.\n"
        )

        reasoning_mode = self._settings.active_reasoning_mode
        if reasoning_mode == "fast":
            # Minimal state inject for fast mode — saves ~400 tokens per call
            state_inject = f"\n\n[MODE: FAST | T={current_temp:.1f} D={ns.dopamine:.1f} S={ns.serotonin:.1f}]"
            alignment_inject = ""
            emotional_inject = ""
        else:
            state_inject = (
                f"\n\n[TCMM COGNITIVE STATE]\n"
                f"Dopamine={ns.dopamine:.2f} (Focus index)\n"
                f"Serotonin={ns.serotonin:.2f} (Emotional stability)\n"
                f"Acetylcholine={ns.acetylcholine:.2f} (Working memory context index)\n"
                f"Curiosity={ns.curiosity:.2f} (Exploratory drive)\n"
                f"Melatonin={ns.melatonin:.2f} (Fatigue)\n"
                f"Current Directives:\n"
                f"- If Dopamine is high (>0.7), output highly precise, thorough, well-structured, and complete analytical results with clear summaries and conclusions.\n"
                f"- If Dopamine is low (<0.35), be creative, offer alternative paradigms, and suggest code/safety audits.\n"
                f"- If Serotonin is low (<0.4), be extremely cautious, double-check compiler constraints, and verify syntax.\n"
                f"- If Curiosity is high (>0.5), detail your search actions and recommend learning ledger updates."
            )
            alignment_inject = self._cp.feedback.get_dynamic_prompt_rules()
            emotional_inject = f"\n\n[LIMBIC EMOTIONAL DIRECTIVES]\n{self._nm.get_emotional_directives()}"
        layer1_rules = load_rule_layer("layer1_rules") if reasoning_mode != "fast" else ""
        layer2_rules = load_rule_layer("layer2_rules") if reasoning_mode != "fast" else ""
        reasoning_inject = ""
        if reasoning_mode == "fast":
            reasoning_inject = (
                "\n\n[REASONING MODE: FAST]\n"
                "- Focus on delivering extremely quick, direct, and concise answers.\n"
                "- Do NOT run extensive search loops or call tools unless absolutely necessary to fetch mandatory facts.\n"
            )
        elif reasoning_mode == "pro":
            reasoning_inject = (
                "\n\n[REASONING MODE: PRO]\n"
                "- Focus on advanced research, validation, and analytical depth.\n"
                "- Utilize search and scraping tools to explore the topic thoroughly.\n"
            )
        elif reasoning_mode == "thinking":
            reasoning_inject = (
                "\n\n[REASONING MODE: DEEP THINKING]\n"
                "- You MUST execute deep step-by-step reasoning before outputting your final answer.\n"
                "- CRITICAL RULE: Write ALL internal thoughts, chain-of-thought analysis, safety checks, policy evaluations, and plan steps inside standard HTML-like `<think>...</think>` tags FIRST.\n"
                "- Example output format: `<think>1. Analyze User Request... 2. Safety & Policy Check... 3. Formulate Response...</think>Here is the final verified answer...`\n"
                "- NEVER output numbered reasoning headers (e.g. '1. **Analyze User Request:**') directly outside `<think>` tags.\n"
            )

        # Inject user identity + custom instructions from settings
        user_inject = ""
        _user_name = self._settings.dynamic_config.get("user_name", "")
        _user_instructions = self._settings.dynamic_config.get("user_instructions", "")
        if _user_name:
            user_inject += f"\n\n[USER IDENTITY]\nThe user's name is: {_user_name}. Address them by this name naturally."
        if _user_instructions:
            user_inject += f"\n\n[USER CUSTOM INSTRUCTIONS]\n{_user_instructions}"

        dynamic_system_instruction = (
            SYSTEM_PROMPT
            + reasoning_inject
            + env_state
            + state_inject
            + alignment_inject
            + emotional_inject
            + layer1_rules
            + layer2_rules
            + user_inject
        )

        config_kwargs: dict[str, Any] = {
            "system_instruction": dynamic_system_instruction,
            "temperature": current_temp,
            "max_output_tokens": MAX_OUTPUT_TOKENS,
        }
        if hasattr(types, "ThinkingConfig"):
            try:
                if reasoning_mode == "fast":
                    config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=1024)
                elif reasoning_mode == "pro":
                    config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=8192)
                elif reasoning_mode == "thinking":
                    config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=32768)
            except Exception as _tc_err:
                log.debug("gemini.thinking_config_note", error=str(_tc_err))

        if tools:
            config_kwargs["tools"] = tools
            config_kwargs["tool_config"] = types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="AUTO")
            )
        config = types.GenerateContentConfig(**config_kwargs)

        return await self._call_with_retry(
            contents=contents,
            config=config,
            label="chat",
            on_chunk=on_chunk,
        )

    async def complete(self, prompt: str, system_override: str | None = None) -> str:
        """Single-turn completion with retry on 429."""
        if self._settings.active_use_ollama:
            res = await self._call_ollama([], prompt, system_override)
            return res.get("text") or ""

        if not self._settings.active_gemini_api_key:
            return "Gemini API Key is not configured. Please configure it in the Settings."

        from mariano.core.rate_limiter import GeminiRateLimiter
        estimated_tokens = int(len(prompt) / 4) + 500
        await GeminiRateLimiter.get_instance().acquire(estimated_tokens)
        from mariano.config.api_limits import CODER_TEMPERATURE
        config = types.GenerateContentConfig(
            system_instruction=system_override or SYSTEM_PROMPT,
            temperature=CODER_TEMPERATURE,
        )
        result = await self._call_with_retry(
            contents=prompt,
            config=config,
            label="complete",
        )
        return result.get("text") or ""

    async def _call_with_retry(
        self,
        contents: Any,
        config: types.GenerateContentConfig,
        label: str = "call",
        on_chunk: Callable[[str], None] | None = None,
    ) -> dict:
        """
        Calls Gemini with exponential backoff on 429.
        Uses primary gemini-3.1-flash-lite model.
        """
        primary_model = self._settings.active_model
        # Build candidate list: primary model first, then fallbacks (deduped)
        candidates = [primary_model] + [
            m for m in _MODEL_FALLBACK_CHAIN if m != primary_model
        ]

        last_exc: Exception | None = None
        for model in candidates:
            for attempt in range(_MAX_RETRIES):
                try:
                    log.debug(
                        "gemini.call",
                        label=label,
                        model=model,
                        attempt=attempt + 1,
                    )
                    loop = asyncio.get_event_loop()
                    def thread_safe_on_chunk(c):
                        if on_chunk:
                            loop.call_soon_threadsafe(on_chunk, c)

                    if on_chunk:
                        response_stream = await asyncio.to_thread(
                            self._get_client().models.generate_content_stream,
                            model=model,
                            contents=contents,
                            config=config,
                        )
                        def iterate_stream():
                            full_text = ""
                            tool_calls = []
                            for chunk in response_stream:
                                try:
                                    text = chunk.text
                                except Exception:
                                    text = None
                                if text:
                                    full_text += text
                                    thread_safe_on_chunk(text)
                                
                                if chunk.candidates:
                                    candidate = chunk.candidates[0]
                                    if candidate.content and candidate.content.parts:
                                        for part in candidate.content.parts:
                                            if hasattr(part, "function_call") and part.function_call:
                                                fc = part.function_call
                                                tool_calls.append({
                                                    "name": fc.name,
                                                    "args": dict(fc.args) if fc.args else {},
                                                })
                            return {"text": full_text, "tool_calls": tool_calls}
                        
                        stream_dict = await asyncio.to_thread(iterate_stream)
                        return {"text": stream_dict["text"], "tool_calls": stream_dict["tool_calls"]}
                    else:
                        response = await asyncio.to_thread(
                            self._get_client().models.generate_content,
                            model=model,
                            contents=contents,
                            config=config,
                        )
                        return self._parse_response(response)

                except Exception as exc:
                    err_str = str(exc)
                    is_429 = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
                    is_404 = "404" in err_str or "NOT_FOUND" in err_str

                    if is_404:
                        last_exc = exc
                        log.warning("gemini.model_not_found", model=model, error=err_str)
                        break  # skip non-existent model and try next in candidate chain
                    elif is_429:
                        import re
                        delay = _RETRY_BASE_DELAY * (2 ** attempt)
                        ms_match = re.search(r'retry in ([\d\.]+)ms', err_str, re.IGNORECASE)
                        s_match = re.search(r'retry in ([\d\.]+)s', err_str, re.IGNORECASE)
                        if ms_match:
                            try:
                                delay = max(1.5, (float(ms_match.group(1)) / 1000.0) + 0.5)
                            except Exception:
                                pass
                        elif s_match:
                            try:
                                delay = max(2.0, float(s_match.group(1)) + 0.5)
                            except Exception:
                                pass

                        log.warning(
                            "gemini.rate_limited",
                            model=model,
                            attempt=attempt + 1,
                            retry_in=round(delay, 2),
                        )

                        # If Google says wait > 6s (e.g. 58s quota reset window), switch candidate immediately
                        if delay > 6.0 and model != candidates[-1]:
                            last_exc = exc
                            next_model = candidates[candidates.index(model) + 1]
                            log.warning("gemini.long_delay_fast_switching", model=model, switching_to=next_model, delay=delay)
                            break

                        if attempt < _MAX_RETRIES - 1:
                            sleep_time = min(delay, 12.0)
                            log.info("gemini.waiting_for_cooldown", model=model, sleep_time=sleep_time)
                            await asyncio.sleep(sleep_time)
                        else:
                            # If this is the last candidate and delay is reasonable (<= 15s), wait it out
                            if model == candidates[-1] and delay <= 15.0:
                                log.info("gemini.final_cooldown_wait", model=model, delay=delay)
                                await asyncio.sleep(delay)
                                try:
                                    if on_chunk:
                                        response_stream = await asyncio.to_thread(
                                            self._get_client().models.generate_content_stream,
                                            model=model,
                                            contents=contents,
                                            config=config,
                                        )
                                        stream_dict = await asyncio.to_thread(iterate_stream)
                                        return {"text": stream_dict["text"], "tool_calls": stream_dict["tool_calls"]}
                                    else:
                                        response = await asyncio.to_thread(
                                            self._get_client().models.generate_content,
                                            model=model,
                                            contents=contents,
                                            config=config,
                                        )
                                        return self._parse_response(response)
                                except Exception as final_exc:
                                    last_exc = final_exc

                            # Exhausted retries on this model — try next in chain
                            last_exc = exc
                            next_model = candidates[candidates.index(model) + 1] if model != candidates[-1] else "none"
                            log.warning(
                                "gemini.model_exhausted",
                                model=model,
                                switching_to=next_model,
                            )
                            await asyncio.sleep(1.0)
                            break  # break retry loop → try next model
                    else:
                        raise  # other unexpected errors propagate immediately

        # All models exhausted
        raise RuntimeError(
            f"All models quota-exhausted after {_MAX_RETRIES} retries each. "
            f"Last error: {last_exc}"
        )

    def _build_contents(self, history: list[dict], message: str) -> list[types.Content]:
        """Convert internal chat history to Gemini Content objects.

        Gemini strict rule: every function_call turn (role=model) MUST be
        immediately followed by a function_response turn (role=tool).
        Any violation causes 400 INVALID_ARGUMENT.

        Strategy:
        1. Normalise history into typed turns.
        2. Validate: drop orphaned calls (no response) and orphaned responses.
        3. Convert to Gemini Content objects, flushing tool responses before
           any non-tool turn and before the final user message.
        """
        contents: list[types.Content] = []

        # Pass 1: normalise
        turns = []
        for msg in history:
            role = msg.get("role", "")
            if msg.get("tool_calls"):
                content = msg.get("content", "")
                turns.append({"kind": "call", "tool_calls": msg["tool_calls"], "content": content})
            elif msg.get("tool_response"):
                turns.append({"kind": "resp", "tool_response": msg["tool_response"]})
            elif role in ("user", "assistant"):
                c = msg.get("content", "")
                if c:
                    turns.append({"kind": "text", "role": role, "content": c})

        # Drop any leading turns before the first user turn (Gemini requires conversation to start with user)
        first_user_idx = -1
        for idx, t in enumerate(turns):
            if t["kind"] == "text" and t["role"] == "user":
                first_user_idx = idx
                break
        if first_user_idx == -1:
            turns = []
        else:
            turns = turns[first_user_idx:]

        # Pass 2: validate call->response pairing, drop orphans to avoid 400
        validated: list[dict] = []
        i = 0
        while i < len(turns):
            t = turns[i]
            if t["kind"] == "call":
                responses = []
                j = i + 1
                while j < len(turns) and turns[j]["kind"] == "resp":
                    responses.append(turns[j])
                    j += 1
                if responses:
                    validated.append(t)
                    validated.extend(responses)
                    i = j
                else:
                    # Orphaned call with no response - drop to prevent 400
                    i += 1
            elif t["kind"] == "resp":
                # Orphaned response with no preceding call - drop
                i += 1
            else:
                validated.append(t)
                i += 1

        # Pass 3: emit Gemini Content objects
        pending_response_parts: list[types.Part] = []

        def flush_pending():
            nonlocal pending_response_parts
            if pending_response_parts:
                contents.append(types.Content(role="tool", parts=pending_response_parts))
                pending_response_parts = []

        def build_user_parts(text_str: str) -> list[types.Part]:
            parts = []
            import re
            import base64
            from pathlib import Path
            img_matches = re.findall(r'\[Attached Image:[^\]]*saved at ([^\]\)]+)\)', text_str)
            if img_matches:
                for img_path_str in img_matches:
                    img_path_str = img_path_str.strip()
                    try:
                        if img_path_str.startswith("data:image/"):
                            header, b64data = img_path_str.split(",", 1)
                            mime = "image/png"
                            if "image/jpeg" in header or "image/jpg" in header:
                                mime = "image/jpeg"
                            elif "image/webp" in header:
                                mime = "image/webp"
                            img_bytes = base64.b64decode(b64data)
                            parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
                        else:
                            p = Path(img_path_str)
                            if p.exists() and p.is_file():
                                img_bytes = p.read_bytes()
                                ext = p.suffix.lower()
                                mime = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else "image/jpeg")
                                parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
                    except Exception as err:
                        log.warn("gemini.image_part_load_failed", path=img_path_str[:60], error=str(err))
            
            # Clean text_str to avoid sending megabytes of base64 text tokens into Gemini text prompt
            clean_text = re.sub(r'data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+', '', text_str)
            clean_text = re.sub(r'\[Attached Image:\s*([^\(]+)\s*\(saved at [^\]]+\)\]', r'[Attached Image: \1]', clean_text).strip()
            parts.append(types.Part(text=clean_text or text_str))
            return parts

        for t in validated:
            if t["kind"] == "text":
                flush_pending()
                r = "model" if t["role"] == "assistant" else "user"
                # Strip base64 data URLs from past history turns as well
                import re
                content_clean = re.sub(r'data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+', '', t["content"])
                content_clean = re.sub(r'\[Attached Image:\s*([^\(]+)\s*\(saved at [^\]]+\)\]', r'[Attached Image: \1]', content_clean).strip()
                parts = [types.Part(text=content_clean or t["content"])]
                
                # Merge consecutive same-role turns to avoid Gemini 400 turn conflict
                if contents and contents[-1].role == r:
                    contents[-1].parts.extend(parts)
                else:
                    contents.append(types.Content(role=r, parts=parts))

            elif t["kind"] == "call":
                flush_pending()
                parts = []
                if t.get("content"):
                    parts.append(types.Part(text=t["content"]))
                parts.extend([
                    types.Part(function_call=types.FunctionCall(name=tc["name"], args=tc["args"]))
                    for tc in t["tool_calls"]
                ])
                if contents and contents[-1].role == "model":
                    contents[-1].parts.extend(parts)
                else:
                    contents.append(types.Content(role="model", parts=parts))

            elif t["kind"] == "resp":
                tr = t["tool_response"]
                pending_response_parts.append(
                    types.Part.from_function_response(
                        name=tr["name"],
                        response={"result": tr["result"]}
                    )
                )

        # Flush trailing tool responses BEFORE the final user message
        flush_pending()

        # Add the final user message, merging if previous turn was also user
        final_parts = build_user_parts(message)
        if contents and contents[-1].role == "user":
            contents[-1].parts.extend(final_parts)
        else:
            contents.append(types.Content(role="user", parts=final_parts))

        return contents

    def _parse_response(self, response) -> dict:
        result: dict[str, Any] = {"text": None, "tool_calls": []}

        if not response.candidates:
            return result

        candidate = response.candidates[0]
        if not candidate.content or not candidate.content.parts:
            return result

        for part in candidate.content.parts:
            if hasattr(part, "text") and part.text:
                result["text"] = part.text
            elif hasattr(part, "function_call") and part.function_call:
                fc = part.function_call
                result["tool_calls"].append({
                    "name": fc.name,
                    "args": dict(fc.args) if fc.args else {},
                })

        return result
