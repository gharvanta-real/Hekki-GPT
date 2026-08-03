"""
agent_loop.py — ReAct execution loop with Max 3-Retry Self-Correction.
Under 160 lines.
"""

from __future__ import annotations
import os
import json
import logging
from typing import AsyncGenerator
from mariano.coder_engine.code_brain import stream_brain
from mariano.coder_engine.native.tools_base import (
    tool_list_workspace_tree,
    tool_view_file,
    tool_write_file,
    tool_replace_file_content,
    tool_grep_search,
    tool_find_files,
    tool_run_command,
)
from mariano.coder_engine.native.context_manager import WorkspaceContextManager
from mariano.coder_engine.native.session_store import append_transcript_event

logger = logging.getLogger("Hekki.NativeLoop")
MAX_SELF_CORRECT_RETRIES = 3


def parse_tool_call(llm_response: str) -> tuple[dict | None, str]:
    """Extracts JSON tool call block (codeblock or raw JSON) from LLM response text."""
    if "```json" in llm_response:
        try:
            start = llm_response.index("```json") + 7
            end = llm_response.index("```", start)
            block = llm_response[start:end].strip()
            data = json.loads(block)
            if isinstance(data, dict) and "tool" in data:
                thought = llm_response[:start - 7].strip()
                return data, thought
        except Exception:
            pass

    if '"tool"' in llm_response:
        try:
            start = llm_response.index('{')
            end = llm_response.rindex('}') + 1
            block = llm_response[start:end].strip()
            data = json.loads(block)
            if isinstance(data, dict) and "tool" in data:
                thought = llm_response[:start].strip()
                return data, thought
        except Exception:
            pass

    return None, llm_response


async def execute_tool_call(tool_dict: dict, workspace: str) -> str:
    """Executes native tool call with zero-failure fallbacks and command aliases."""
    name = tool_dict.get("tool", "")
    args = tool_dict.get("args", {})

    if name in ("bash", "run_command", "cmd"):
        cmd = args.get("command") or tool_dict.get("command") or ""
        if cmd.strip() in ("ls", "ls -la", "ls -l", "dir", "ls -la ."):
            return tool_list_workspace_tree(workspace)
        return await tool_run_command(cmd, workspace)
    elif name == "list_workspace_tree":
        return tool_list_workspace_tree(workspace, args.get("max_depth", 3))
    elif name == "view_file":
        path = args.get("file_path", "") or args.get("path", "")
        if not os.path.isabs(path) and workspace:
            path = os.path.join(workspace, path)
        return tool_view_file(path, args.get("start_line", 1), args.get("end_line", 200))
    elif name == "write_file":
        path = args.get("file_path", "") or args.get("path", "")
        if not os.path.isabs(path) and workspace:
            path = os.path.join(workspace, path)
        return tool_write_file(path, args.get("content", ""))
    elif name == "replace_file_content":
        path = args.get("file_path", "") or args.get("path", "")
        if not os.path.isabs(path) and workspace:
            path = os.path.join(workspace, path)
        return tool_replace_file_content(path, args.get("target", ""), args.get("replacement", ""))
    elif name == "grep_search":
        return tool_grep_search(workspace, args.get("query", ""))
    elif name == "find_files":
        return tool_find_files(workspace, args.get("pattern", "*"))

    return f"[Error: Unknown tool '{name}']"


def build_antigravity_activity_meta(tool_name: str, args: dict) -> dict:
    path = args.get("file_path") or args.get("path") or ""
    file_name = os.path.basename(path) if path else ""
    ext = os.path.splitext(file_name)[1].lower() if file_name else ""

    icons = {".py": "🐍", ".js": "js", ".ts": "ts", ".css": "{}", ".html": "🌐", ".json": "{}", ".md": "📝"}
    icon = icons.get(ext, "📄")

    if tool_name in ("view_file", "read_file"):
        start = args.get("start_line", 1)
        end = args.get("end_line", 200)
        range_str = f"#L{start}-{end}" if (start > 1 or end < 200) else ""
        return {
            "verb": "Analyzed",
            "icon": icon,
            "file_name": file_name or path or "file",
            "detail_badge": range_str,
            "category": "explored"
        }
    elif tool_name in ("write_file", "replace_file_content"):
        content = args.get("content") or args.get("replacement_content") or ""
        added = max(1, content.count("\n"))
        return {
            "verb": "Edited",
            "icon": icon,
            "file_name": file_name or path or "file",
            "diff_added": added,
            "diff_deleted": 1,
            "category": "edited"
        }
    elif tool_name in ("run_command", "bash", "cmd"):
        cmd = args.get("command") or ""
        return {
            "verb": "Ran",
            "icon": "⚡",
            "command": cmd,
            "category": "ran"
        }
    else:
        return {
            "verb": "Explored",
            "icon": "📁",
            "file_name": file_name or path or "workspace",
            "category": "explored"
        }


async def run_native_agent_loop(
    prompt: str,
    workspace: str = "",
    model: str = "openrouter_nemotron",
    history: list[dict] = None,
    session_id: str = None
) -> AsyncGenerator[str, None]:
    """
    Executes ReAct native loop with zero-failure self-correction and SSE streaming.
    Persists events line-by-line to session transcript.jsonl.
    """
    if session_id:
        append_transcript_event(session_id, {"role": "user", "type": "prompt", "content": prompt})

    ctx_mgr = WorkspaceContextManager(workspace)
    ctx_mgr.build_symbol_index()
    tree = tool_list_workspace_tree(workspace) if workspace else "No workspace open"
    sys_prompt = ctx_mgr.prepare_system_prompt(tree)

    messages = (history or []).copy()
    if not messages or messages[0].get("role") != "system":
        messages.insert(0, {"role": "system", "content": sys_prompt})

    messages.append({"role": "user", "content": prompt})

    retry_count = 0
    max_steps = 25

    for step in range(max_steps):
        step_response = ""
        async for chunk in stream_brain(prompt="", model_key=model, history=messages):
            step_response += chunk

def summarize_tool_result(tool_name: str, output: str) -> str:
    if not output:
        return "Completed"
    out_clean = output.strip()
    if "Error" in out_clean or "Exception" in out_clean:
        return out_clean.split("\n")[0][:60]

    lines = out_clean.split("\n")
    line_count = len(lines)
    if tool_name in ("view_file", "read_file"):
        return f"Read {line_count} lines"
    elif tool_name in ("write_file", "replace_file_content"):
        return "Saved file changes"
    elif tool_name in ("run_command", "bash", "cmd"):
        return "Execution completed (exit 0)"
    else:
        return f"Found {line_count} entries"


async def run_native_agent_loop(
    prompt: str,
    workspace: str = "",
    model: str = "openrouter_nemotron",
    history: list[dict] = None,
    session_id: str = None
) -> AsyncGenerator[str, None]:
    """
    Executes ReAct native loop with zero-failure self-correction and SSE streaming.
    Persists events line-by-line to session transcript.jsonl.
    """
    if session_id:
        append_transcript_event(session_id, {"role": "user", "type": "prompt", "content": prompt})

    ctx_mgr = WorkspaceContextManager(workspace)
    ctx_mgr.build_symbol_index()
    tree = tool_list_workspace_tree(workspace) if workspace else "No workspace open"
    sys_prompt = ctx_mgr.prepare_system_prompt(tree)

    messages = (history or []).copy()
    if not messages or messages[0].get("role") != "system":
        messages.insert(0, {"role": "system", "content": sys_prompt})

    messages.append({"role": "user", "content": prompt})

    retry_count = 0
    max_steps = 25

    for step in range(max_steps):
        # Yield working event IMMEDIATELY so UI updates live on step start
        yield json.dumps({"type": "working", "text": f"Reasoning...", "thought": "Reasoning..."})

        step_response = ""
        is_streaming_text = False

        async for chunk in stream_brain(prompt="", model_key=model, history=messages):
            step_response += chunk
            clean_start = step_response.strip()

            if not is_streaming_text and len(clean_start) > 12:
                if not (clean_start.startswith("{") or clean_start.startswith("```json") or clean_start.startswith("```")):
                    is_streaming_text = True
                    yield json.dumps({"type": "token", "content": step_response})
                    continue

            if is_streaming_text:
                yield json.dumps({"type": "token", "content": chunk})

        tool_call, thought = parse_tool_call(step_response)

        # Only yield thought if it is a short 1-line agent thought, NOT a full markdown text answer
        if thought and thought.strip():
            clean_t = thought.strip()
            if len(clean_t) < 120 and "```" not in clean_t and "##" not in clean_t and "\n\n" not in clean_t:
                if session_id:
                    append_transcript_event(session_id, {"role": "assistant", "type": "thought", "content": clean_t})
                yield json.dumps({"type": "thinking", "thought": clean_t, "text": clean_t})

        if not tool_call:
            # Final text answer
            if session_id:
                append_transcript_event(session_id, {"role": "assistant", "type": "text", "content": step_response})
            break

        # Extract rich detail string for UI display
        tool_name = tool_call.get("tool", "")
        args = tool_call.get("args", {})
        path = args.get("file_path") or args.get("path") or ""
        file_name = os.path.basename(path) if path else ""

        meta = build_antigravity_activity_meta(tool_name, args)

        # Execute tool locally
        tool_output = await execute_tool_call(tool_call, workspace)
        summary = summarize_tool_result(tool_name, tool_output)

        # Build typed StreamEvent
        event_type = "explore"
        event_payload = {
            "type": event_type,
            "tool": tool_name,
            "action": tool_name,
            "meta": meta,
            "summary": summary
        }

        if tool_name in ("view_file", "read_file"):
            event_payload.update({
                "type": "analyze",
                "file": file_name or path or "file",
                "lines": meta.get("detail_badge", ""),
                "summary": summary
            })
        elif tool_name in ("write_file", "replace_file_content"):
            event_payload.update({
                "type": "edit",
                "file": file_name or path or "file",
                "added": meta.get("diff_added", 1),
                "removed": meta.get("diff_deleted", 1),
                "summary": summary
            })
        elif tool_name in ("run_command", "bash", "cmd"):
            event_payload.update({
                "type": "command",
                "command": args.get("command", ""),
                "status": "success",
                "summary": summary
            })
        else:
            event_payload.update({
                "type": "explore",
                "files": [file_name or path or "workspace"],
                "summary": summary
            })

        if session_id:
            append_transcript_event(session_id, {
                "role": "assistant",
                "type": "tool_call",
                "tool": tool_name,
                "detail": path or args.get("command", ""),
                "args": args,
                "meta": meta,
                "event": event_payload
            })

        yield json.dumps(event_payload)

        # Add step execution messages to conversation history for next loop step
        messages.append({"role": "assistant", "content": step_response})
        messages.append({"role": "user", "content": f"Tool '{tool_name}' output:\n{tool_output[:2000]}"})

        if session_id:
            append_transcript_event(session_id, {
                "role": "system",
                "type": "tool_result",
                "output": tool_output[:300]
            })

        # Self-correction retry logic check
        if "[Error:" in tool_output or "[Linter Error" in tool_output:
            retry_count += 1
            if retry_count > MAX_SELF_CORRECT_RETRIES:
                yield json.dumps({"text": f"\n⚠️ **Self-Correction Retry Cap Reached ({MAX_SELF_CORRECT_RETRIES} attempts)**\n\n{tool_output}"})
                break
            tool_output += f"\n\n[System Alert: Attempt {retry_count}/{MAX_SELF_CORRECT_RETRIES}. Please fix error and retry.]"

        messages.append({"role": "assistant", "content": step_response})
        messages.append({"role": "user", "content": f"[TOOL RESULT]\n{tool_output}"})

        # If we reached last tool step, request final summary from LLM
        if step == max_steps - 1:
            messages.append({"role": "user", "content": "All tools executed. Now provide a clean markdown summary of what was found or built."})
            async for chunk in stream_brain(prompt="", model_key=model, history=messages):
                yield json.dumps({"text": chunk})
