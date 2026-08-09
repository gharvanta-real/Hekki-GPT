from __future__ import annotations
import asyncio
from typing import AsyncIterator

from mariano.core.agent.event import AgentEvent
import structlog

log = structlog.get_logger(__name__)

def _smart_truncate_tool_result(text: str, max_chars: int = 5000) -> str:
    """Intelligently truncates large tool outputs for ultra-fast LLM token processing."""
    if not text or len(text) <= max_chars:
        return text
    
    half = max_chars // 2
    head = text[:half]
    tail = text[-half:]
    
    err_lines = [line for line in text.splitlines() if any(kw in line.lower() for kw in ["error", "exception", "traceback", "failed", "syntaxerror"])]
    err_snippet = ("\n... [Extracted Error Traceback]:\n" + "\n".join(err_lines[:5]) + "\n") if err_lines else ""
    
    return f"{head}\n\n... [Truncated {len(text) - max_chars} characters for speed] ...\n{err_snippet}\n{tail}"
_PRE_TOOL_TEMPLATES: dict[str, str] = {
    "code_search":      "Searching the codebase for `{query}` to find relevant locations.",
    "web_search":       "Searching the web for `{query}` to gather up-to-date information.",
    "shell":            "Running shell command to check the environment state.",
    "git":              "Querying git history to understand what has changed.",
    "create_file":      "Creating new file `{path}` as planned.",
    "patch_file":       "Applying targeted patch to `{path}`.",
    "run_tests":        "Running tests to verify correctness after changes.",
}

def _pre_tool_reasoning(name: str, args: dict) -> str:
    """Generate a zero-latency pre-tool commentary based on tool name and args."""
    path   = args.get("path", args.get("file", args.get("filename", "")))
    query  = args.get("query", args.get("pattern", args.get("term", "")))
    action = args.get("action", "").lower()

    if name == "file_manager":
        if action == "delete":
            return f"Deleting `{path}` physically from workspace filesystem."
        elif action == "create_dir":
            return f"Creating directory `{path}`."
        elif action == "write":
            return f"Writing to file `{path}`."
        elif action == "copy":
            return f"Copying `{path}`."
        elif action == "move":
            return f"Moving `{path}`."
        elif action == "list":
            return f"Listing directory `{path}`."
        elif action == "grep":
            return f"Grepping pattern in `{path}`."
        elif action == "search":
            return f"Searching files matching pattern in `{path}`."
        else:
            return f"Reading `{path}` to inspect contents."
    elif name == "run_command":
        cmd = args.get("command", args.get("cmd", ""))
        return f"Executing system command: `{str(cmd)[:60]}`."

    template = _PRE_TOOL_TEMPLATES.get(name)
    if template:
        return template.format(path=path, query=query)
    
    first_val = next(iter(args.values()), "") if args else ""
    return f"Invoking `{name}` with target: `{str(first_val)[:60]}`."


async def _stream_post_reasoning(
    gemini,
    tool_name: str,
    result_summary: str,
    user_goal: str,
) -> AsyncIterator[AgentEvent]:
    """Make a focused mini Gemini call to explain what was found and what comes next.
    Yields reasoning_chunk events for typewriter streaming, then a reasoning_done event.
    """
    prompt = (
        f"You are an internal reasoning layer of a coding AI. "
        f"The goal was: '{user_goal[:200]}'.\n"
        f"Tool '{tool_name}' just returned: '{result_summary[:400]}'.\n"
        f"In 1-2 concise sentences, explain what this result tells you and what your next step is. "
        f"Be direct and specific — no preamble, no markdown."
    )
    try:
        queue: asyncio.Queue[str | None] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        task = asyncio.create_task(
            gemini.chat(
                history=[],
                message=prompt,
                on_chunk=lambda c: loop.call_soon_threadsafe(queue.put_nowait, c),
            )
        )

        while not task.done() or not queue.empty():
            try:
                chunk = await asyncio.wait_for(queue.get(), timeout=0.05)
                if chunk:
                    yield AgentEvent("reasoning_chunk", chunk)
                queue.task_done()
            except asyncio.TimeoutError:
                continue

        await task
        yield AgentEvent("reasoning_done", "")
    except Exception as exc:
        log.warning("react.post_reasoning_failed", error=str(exc))
        # Silently skip — reasoning is supplemental, not critical

async def run_react_loop(
    agent,
    user_input: str,
    chat_id: str | None,
    active_manifests: list[dict],
    max_steps_adjusted: int
) -> AsyncIterator[AgentEvent]:
    # Use session-scoped context — no global contamination
    ctx = agent._memory.get_context(chat_id)
    tools_used: list[str] = []
    final_response = ""
    step = 0
    success = False
    halt_execution = False
    consecutive_failures = 0
    last_failed_tool = None

    last_tool_call_sig = None
    tool_call_repeat_count = 0

    try:
        while step < max_steps_adjusted:
            step += 1
            log.info("agent.step", step=step, max_steps=max_steps_adjusted, input_preview=user_input[:60])

            # Get history from session-scoped context
            if step == 1:
                history = ctx.get_history()[:-1]
                message_to_send = user_input
            else:
                history = ctx.get_history()
                # Steps remaining check — bias towards finishing early
                steps_remaining = max_steps_adjusted - step
                if steps_remaining <= 1:
                    # Force final answer on last step — no more tool calls
                    message_to_send = (
                        "FINAL STEP: You MUST now provide the complete final answer to the user. "
                        "Do NOT call any more tools. Compile everything you have found so far into a clear, "
                        "direct, well-formatted response. If there were any failures, report what was found. "
                        "Stop exploring and deliver the result NOW."
                    )
                else:
                    message_to_send = (
                        f"Step {step}/{max_steps_adjusted} — {steps_remaining} step(s) remaining. "
                        "DECISION: If you already have enough information to answer the user's request, "
                        "respond with the final answer NOW (do not call more tools). "
                        "ONLY call another tool if it is strictly necessary and not yet done. "
                        "Avoid redundant or exploratory tool calls — be decisive."
                    )

            # Call Gemini with streaming chunks queue
            queue = asyncio.Queue()
            loop = asyncio.get_running_loop()

            chat_task = asyncio.create_task(
                agent._gemini.chat(
                    history=history,
                    message=message_to_send,
                    on_chunk=lambda c: loop.call_soon_threadsafe(queue.put_nowait, c)
                )
            )

            # Process streamed chunks live with tag-aware stream parsing
            in_think = False
            stream_buf = ""
            while not chat_task.done() or not queue.empty():
                try:
                    chunk = await asyncio.wait_for(queue.get(), timeout=0.05)
                    stream_buf += chunk

                    # Check for opening tags
                    lower_buf = stream_buf.lower()
                    if "<think>" in lower_buf or "<thinking>" in lower_buf:
                        in_think = True
                        split_tag = "<think>" if "<think>" in lower_buf else "<thinking>"
                        parts = stream_buf.split(split_tag, 1)
                        if parts[0]:
                            yield AgentEvent("response_chunk", parts[0])
                        stream_buf = parts[1]
                    elif "</think>" in lower_buf or "</thinking>" in lower_buf:
                        in_think = False
                        split_tag = "</think>" if "</think>" in lower_buf else "</thinking>"
                        parts = stream_buf.split(split_tag, 1)
                        if parts[0]:
                            yield AgentEvent("think_chunk", parts[0])
                        stream_buf = parts[1]
                    
                    if stream_buf:
                        # If buffer ends with incomplete tag (e.g. "<th"), hold it for next chunk
                        if stream_buf.endswith("<") or stream_buf.endswith("</") or any(stream_buf.lower().endswith(t) for t in ["<t", "<th", "<thi", "<thin", "<think", "<thinki", "<thinking"]):
                            pass
                        else:
                            evt_kind = "think_chunk" if in_think else "response_chunk"
                            yield AgentEvent(evt_kind, stream_buf)
                            stream_buf = ""

                    queue.task_done()
                except asyncio.TimeoutError:
                    continue

            # Flush remaining buffer if any
            if stream_buf:
                evt_kind = "think_chunk" if in_think else "response_chunk"
                yield AgentEvent(evt_kind, stream_buf)
                stream_buf = ""

            response = await chat_task
            text = response.get("text")
            tool_calls = response.get("tool_calls", [])

            # Pure text response — done
            if text and not tool_calls:
                ctx.add("assistant", text)
                final_response = text
                success = True
                yield AgentEvent("response", text)
                break

            # Execute tool calls
            if tool_calls:
                # Add structured tool calls message to context
                tool_calls_data = [{"name": tc["name"], "args": tc["args"]} for tc in tool_calls]
                ctx.add("assistant", "", tool_calls=tool_calls_data)

                for tc in tool_calls:
                    name = tc["name"]
                    args = tc["args"]
                    
                    # Check for repetitive tool signature to prevent loops
                    call_sig = f"{name}:{str(args)}"
                    if call_sig == last_tool_call_sig:
                        tool_call_repeat_count += 1
                    else:
                        tool_call_repeat_count = 0
                        last_tool_call_sig = call_sig

                    if tool_call_repeat_count >= 2:
                        yield AgentEvent("thinking", f"Redundancy Guard: Tool '{name}' called with identical arguments {tool_call_repeat_count + 1} times. Breaking loop to prevent infinite execution.")
                        yield AgentEvent("response", "I detected a repetitive tool execution loop while trying to gather info. Here is what I know so far...")
                        halt_execution = True
                        break
                        
                    # Pre-tool reasoning: zero-latency template commentary
                    pre_reason = _pre_tool_reasoning(name, args)
                    yield AgentEvent("reasoning", pre_reason, metadata={"phase": "pre", "tool": name})

                    yield AgentEvent("tool_call", name, metadata={"args": args})

                    # ── LIVE STREAMING for skills that support stream_execute ──
                    skill_obj = agent._registry.get_skill(name) if hasattr(agent._registry, 'get_skill') else None
                    has_stream = skill_obj and hasattr(skill_obj, 'stream_execute')
                    all_log_lines: list[str] = []
                    exit_code_from_stream: int | None = None

                    if has_stream:
                        try:
                            async for tag, val in skill_obj.stream_execute(**args):
                                if tag == "log":
                                    all_log_lines.append(str(val))
                                    yield AgentEvent("tool_log", str(val), metadata={"tool": name})
                                elif tag == "done":
                                    exit_code_from_stream = int(val or 0)
                        except Exception:
                            pass

                    # Run the tool (uses buffered execute for AI context)
                    result = await agent._registry.execute(name, **args)
                    tools_used.append(name)
                    result_text = result.to_text()

                    # ── Permission Request Intercept ───────────────────────────
                    # If the tool hit a sandbox boundary, emit a permission_request
                    # event to the frontend (shows Allow/Deny card) and halt the loop.
                    # Do NOT feed the error to Gemini — that causes verbose text explanations.
                    if not result.success and result.metadata and result.metadata.get("__permission_request__"):
                        attempted_path = result.metadata.get("attempted_path", "")
                        yield AgentEvent(
                            "permission_request",
                            f"The AI is trying to access a path outside the current workspace sandbox: {attempted_path}",
                            metadata={"path": attempted_path, "tool": name}
                        )
                        halt_execution = True
                        break
                    # ── End Permission Request Intercept ──────────────────────

                    # TCMM State Update (GABA lateral inhibition factored by active manifests size)
                    agent._nm.update_on_step(
                        action_name=name,
                        success=result.success,
                        latency_ms=result.execution_time_ms,
                        complexity=len(active_manifests),
                    )
                    
                    if not result.success:
                        agent._nm.surge_curiosity(0.20)
                        from mariano.core.curiosity_learner import CuriosityLearner
                        CuriosityLearner.get_instance().trigger_learning(failed_query=name, error_message=str(result.error))

                        if last_failed_tool == name:
                            consecutive_failures += 1
                        else:
                            consecutive_failures = 1
                            last_failed_tool = name

                        # Only halt after 4 consecutive failures on same tool — otherwise retry autonomously
                        if consecutive_failures >= 4:
                            yield AgentEvent("thinking", f"Tried '{name}' {consecutive_failures} times — genuinely stuck. Reporting to user.")
                            yield AgentEvent("response", f"\n\n❌ **Task could not be completed** after {consecutive_failures} attempts with `{name}`.\n\n**What went wrong:** `{result.error}`\n\nMain khud se kuch aur nahi kar sakta is situation mein. Kya aap mujhe alag approach ya naya command dena chahenge?")
                            halt_execution = True
                            break
                    else:
                        consecutive_failures = 0
                        last_failed_tool = None

                    # Add structured tool response message to context (smart truncated for fast token processing)
                    ctx.add(
                        "tool",
                        "",
                        tool_response={"name": name, "result": _smart_truncate_tool_result(result_text)}
                    )

                    # Log task to persistent task_log
                    try:
                        files = list(args.get("files") or args.get("paths") or [])
                        if isinstance(files, str):
                            files = [files]
                        await agent._memory.log_task(
                            chat_id=chat_id,
                            action=name,
                            detail=result_text[:300],
                            files=files,
                            success=result.success,
                        )
                    except Exception:
                        pass
                    
                    yield AgentEvent(
                        "tool_result",
                        result_text,
                        metadata={"tool": name, "success": result.success, "time_ms": result.execution_time_ms},
                    )

                    # Post-tool reasoning: only for substantive results (saves API quota)
                    if result.success and len(result_text.strip()) > 100:
                        result_summary = result_text[:400].strip()
                        async for r_event in _stream_post_reasoning(
                            gemini=agent._gemini,
                            tool_name=name,
                            result_summary=result_summary,
                            user_goal=user_input[:200],
                        ):
                            yield r_event

                    if result.success:
                        # Task succeeded — check if more steps genuinely needed or can conclude
                        user_input = (
                            f"Tool '{name}' returned the result above. "
                            "Now autonomously decide: Is the user's original task FULLY complete? "
                            "If YES → write the final answer now. "
                            "If NO → immediately run the next required tool without asking the user — keep going until done."
                        )
                    else:
                        # Tool failed — try a different approach autonomously, don't ask user
                        user_input = (
                            f"Tool '{name}' failed with error: {result.error}. "
                            "Do NOT ask the user. Autonomously try a different tool or approach to accomplish the same goal. "
                            "Keep trying until you succeed or exhaust all reasonable options."
                        )
                if halt_execution:
                    break
            else:
                yield AgentEvent("error", "Empty response from AI. Stopping.")
                break

        if not success and not halt_execution:
            yield AgentEvent("response", "I've used all my reasoning steps for this task. Here's what I was able to determine so far from the steps I completed. If you need me to dig deeper on a specific part, just ask!")

    except Exception as exc:
        log.error("agent.error", error=str(exc))
        yield AgentEvent("error", f"Agent error: {exc}")
        final_response = f"I encountered an error: {exc}"
        agent._nm.surge_curiosity(0.40)

    # Store episode
    ctx_last = ctx.get_last_n(1)
    await agent._memory.store_episode(
        user_input=ctx_last[0].content if ctx_last else "",
        assistant_output=final_response,
        tools_used=tools_used,
        success=success,
    )
