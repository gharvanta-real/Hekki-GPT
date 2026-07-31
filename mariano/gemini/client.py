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

log = structlog.get_logger(__name__)

# Ordered fallback model chain — tried in sequence on 429
_MODEL_FALLBACK_CHAIN = [
    "gemini-3.1-flash-lite",   # Primary (only model)
]
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 30  # seconds


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

    def _build_tools(self) -> list[types.Tool] | None:
        if not self._tool_declarations:
            return None
        fn_declarations = []
        for td in self._tool_declarations:
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
                prop: dict[str, Any] = {
                    "type": mapped,
                    "description": pinfo.get("description", pname),
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
                    description=td["description"],
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
            layer1_rules = ""
            try:
                rules_path = Path(__file__).parent.parent / "config" / "rules" / "layer1_rules.md"
                layer1_rules = "\n\n" + rules_path.read_text(encoding="utf-8")
            except Exception:
                pass
            
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
                + user_inject
            )

        loop = asyncio.get_event_loop()
        def thread_safe_on_chunk(c):
            if on_chunk:
                loop.call_soon_threadsafe(on_chunk, c)

        def do_request():
            url = f"{base_url.rstrip('/')}/api/chat"
            ollama_messages = [{"role": "system", "content": dynamic_system_instruction}]
            for msg in history:
                role = "assistant" if msg["role"] == "assistant" else msg["role"]
                ollama_messages.append({"role": role, "content": msg["content"]})
            ollama_messages.append({"role": "user", "content": message})
            
            payload = {
                "model": model,
                "messages": ollama_messages,
                "stream": True if on_chunk else False,
                "options": {
                    "temperature": current_temp
                }
            }
            
            if self._tool_declarations:
                ollama_tools = []
                for td in self._tool_declarations:
                    params = td.get("parameters", {})
                    cleaned_properties = {}
                    for k, v in params.items():
                        ptype = v.get("type", "string").lower()
                        if ptype in ("str", "string"):
                            ptype = "string"
                        elif ptype in ("int", "integer"):
                            ptype = "integer"
                        elif ptype in ("float", "number"):
                            ptype = "number"
                        elif ptype in ("bool", "boolean"):
                            ptype = "boolean"
                        elif ptype in ("list", "array"):
                            ptype = "array"
                        elif ptype in ("dict", "object"):
                            ptype = "object"
                            
                        cleaned_prop = {
                            "type": ptype,
                            "description": v.get("description", k)
                        }
                        if v.get("enum"):
                            cleaned_prop["enum"] = v["enum"]
                        cleaned_properties[k] = cleaned_prop
                        
                    ollama_tools.append({
                        "type": "function",
                        "function": {
                            "name": td["name"],
                            "description": td["description"],
                            "parameters": {
                                "type": "object",
                                "properties": cleaned_properties,
                                "required": [k for k, v in params.items() if v.get("required", True) and "default" not in v]
                            }
                        }
                    })
                payload["tools"] = ollama_tools

            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            
            try:
                with urllib.request.urlopen(req, timeout=120) as response:
                    if on_chunk:
                        full_content = ""
                        tool_calls = []
                        for line in response:
                            if not line.strip():
                                continue
                            chunk = json.loads(line.decode("utf-8"))
                            msg = chunk.get("message", {})
                            content = msg.get("content", "")
                            if content:
                                full_content += content
                                thread_safe_on_chunk(content)
                            if "tool_calls" in msg:
                                tool_calls.extend(msg["tool_calls"])
                        return {"message": {"role": "assistant", "content": full_content, "tool_calls": tool_calls}}
                    else:
                        return json.loads(response.read().decode("utf-8"))
            except urllib.error.URLError as e:
                raise RuntimeError(
                    f"Ollama connection error: Failed to connect to local server at '{base_url}'. "
                    f"Make sure Ollama is serving ('ollama serve') and you have pulled the model using 'ollama pull {model}'."
                ) from e
                
        try:
            resp_data = await asyncio.to_thread(do_request)
        except Exception as exc:
            log.error("ollama.chat_error", error=str(exc))
            return {"text": f"Error running offline Ollama model: {exc}", "tool_calls": []}

        message_data = resp_data.get("message", {})
        text = message_data.get("content")
        tool_calls = []
        
        if "tool_calls" in message_data:
            for tc in message_data["tool_calls"]:
                func = tc.get("function", {})
                args = func.get("arguments", {})
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        args = {}
                tool_calls.append({
                    "name": func.get("name"),
                    "args": args
                })
                
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

        from mariano.core.rate_limiter import GeminiRateLimiter
        char_count = len(message) + sum(len(m.get("content", "")) for m in history)
        estimated_tokens = int(char_count / 4) + 1000
        await GeminiRateLimiter.get_instance().acquire(estimated_tokens)
        contents = self._build_contents(history, message)
        tools = self._build_tools()

        # TCMM Parameter Control
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
            f"Current Directives:\n"
            f"- If Dopamine is high (>0.7), output highly precise, thorough, well-structured, and complete analytical results with clear summaries and conclusions.\n"
            f"- If Dopamine is low (<0.35), be creative, offer alternative paradigms, and suggest code/safety audits.\n"
            f"- If Serotonin is low (<0.4), be extremely cautious, double-check compiler constraints, and verify syntax.\n"
            f"- If Curiosity is high (>0.5), detail your search actions and recommend learning ledger updates."
        )
        alignment_inject = self._cp.feedback.get_dynamic_prompt_rules()
        emotional_inject = f"\n\n[LIMBIC EMOTIONAL DIRECTIVES]\n{self._nm.get_emotional_directives()}"
        layer1_rules = ""
        try:
            rules_path = Path(__file__).parent.parent / "config" / "rules" / "layer1_rules.md"
            layer1_rules = "\n\n" + rules_path.read_text(encoding="utf-8")
        except Exception:
            pass

        reasoning_mode = self._settings.active_reasoning_mode
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
                "- Write your complete internal thoughts, chain-of-thought analysis, fact verifications, self-corrections, and assumptions inside standard HTML-like `<think>...</think>` tags.\n"
                "- Example output format: `<think>1. Analyze query... 2. Verify facts... 3. Conclude.</think>Here is the final verified answer...`\n"
                "- Do not hide your thoughts; output them fully in the `<think>` block first, then follow with your direct response outside the tags.\n"
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
            + user_inject
        )

        config_kwargs: dict[str, Any] = {
            "system_instruction": dynamic_system_instruction,
            "temperature": current_temp,
            "max_output_tokens": MAX_OUTPUT_TOKENS,
        }
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
                    if is_429:
                        # Parse retry-after from error if available
                        delay = _RETRY_BASE_DELAY * (2 ** attempt)
                        log.warning(
                            "gemini.rate_limited",
                            model=model,
                            attempt=attempt + 1,
                            retry_in=delay,
                        )
                        if attempt < _MAX_RETRIES - 1:
                            await asyncio.sleep(delay)
                        else:
                            # Exhausted retries on this model — try next in chain
                            last_exc = exc
                            log.warning(
                                "gemini.model_exhausted",
                                model=model,
                                switching_to=candidates[candidates.index(model) + 1]
                                if model != candidates[-1] else "none",
                            )
                            break  # break retry loop → try next model
                    else:
                        raise  # non-429 errors propagate immediately

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
                turns.append({"kind": "call", "tool_calls": msg["tool_calls"]})
            elif msg.get("tool_response"):
                turns.append({"kind": "resp", "tool_response": msg["tool_response"]})
            elif role in ("user", "assistant"):
                c = msg.get("content", "")
                if c:
                    turns.append({"kind": "text", "role": role, "content": c})

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
                prev = validated[-1] if validated else None
                if prev and prev["kind"] == "call":
                    validated.append(t)
                else:
                    # Orphaned response with no preceding call - drop
                    pass
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
            img_matches = re.findall(r'\[Attached Image:[^\]]*saved at ([^\]\)]+)\)', text_str)
            if img_matches:
                for img_path_str in img_matches:
                    try:
                        p = Path(img_path_str.strip())
                        if p.exists() and p.is_file():
                            img_bytes = p.read_bytes()
                            ext = p.suffix.lower()
                            mime = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else "image/jpeg")
                            parts.append(types.Part.from_bytes(data=img_bytes, mime_type=mime))
                    except Exception as err:
                        log.warn("gemini.image_part_load_failed", path=img_path_str, error=str(err))
            parts.append(types.Part(text=text_str))
            return parts

        for t in validated:
            if t["kind"] == "text":
                flush_pending()
                r = "model" if t["role"] == "assistant" else "user"
                # Past history turns remain text-only to prevent old images from ghosting into new queries
                parts = [types.Part(text=t["content"])]
                
                # Merge consecutive same-role turns to avoid Gemini 400 turn conflict
                if contents and contents[-1].role == r:
                    contents[-1].parts.extend(parts)
                else:
                    contents.append(types.Content(role=r, parts=parts))

            elif t["kind"] == "call":
                flush_pending()
                parts = [
                    types.Part(function_call=types.FunctionCall(name=tc["name"], args=tc["args"]))
                    for tc in t["tool_calls"]
                ]
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
