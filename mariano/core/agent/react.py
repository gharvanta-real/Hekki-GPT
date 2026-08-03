from __future__ import annotations
import asyncio
from typing import AsyncIterator

from mariano.core.agent.event import AgentEvent
import structlog

log = structlog.get_logger(__name__)

# ─── Pre-tool reasoning templates (zero-latency, contextual) ─────────────────
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
                message_to_send = (
                    f"Step {step}/{max_steps_adjusted}. "
                    "Based on the tool results, execute the NEXT required action immediately using the appropriate tool. "
                    "If all tool execution steps are complete, provide a comprehensive, fully detailed final response. "
                    "Provide a clear summary of what was done, a detailed explanation of findings or changes, and a definitive concluding section. "
                    "NEVER output just 1-2 lines or a bare table without thorough explanatory text and a clear conclusion."
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

            # Process streamed chunks live
            in_think = False
            while not chat_task.done() or not queue.empty():
                try:
                    chunk = await asyncio.wait_for(queue.get(), timeout=0.05)
                    
                    # Parse thinking tags on the fly
                    if "<think>" in chunk:
                        in_think = True
                        parts = chunk.split("<think>", 1)
                        if parts[0]:
                            yield AgentEvent("response_chunk", parts[0])
                        if parts[1]:
                            yield AgentEvent("think_chunk", parts[1])
                    elif "</think>" in chunk:
                        in_think = False
                        parts = chunk.split("</think>", 1)
                        if parts[0]:
                            yield AgentEvent("think_chunk", parts[0])
                        if parts[1]:
                            yield AgentEvent("response_chunk", parts[1])
                    else:
                        if in_think:
                            yield AgentEvent("think_chunk", chunk)
                        else:
                            yield AgentEvent("response_chunk", chunk)
                            
                    queue.task_done()
                except asyncio.TimeoutError:
                    continue

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
                    
                    # Run the tool
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
                            
                        if consecutive_failures >= 3:
                            yield AgentEvent("thinking", f"Failure Guard: Tool '{name}' failed {consecutive_failures} times consecutively. Halting execution loop to prevent API exhaustion.")
                            yield AgentEvent("response", f"\n\n✕ **Execution Stopped by Safety Guard**: Tool `{name}` failed consecutively 3 times. Please guide me with a different command.")
                            halt_execution = True
                            break
                    else:
                        consecutive_failures = 0
                        last_failed_tool = None

                    # Add structured tool response message to context
                    ctx.add(
                        "tool",
                        "",
                        tool_response={"name": name, "result": result_text[:40000]}
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
                        user_input = f"Tool '{name}' returned: {result_text[:40000]}. Continue."
                    else:
                        user_input = f"Tool '{name}' failed: {result.error}. Try a different approach."
                if halt_execution:
                    break
            else:
                yield AgentEvent("error", "Empty response from AI. Stopping.")
                break

        if not success and not halt_execution:
            yield AgentEvent("response", "I have completed all the exploration steps but haven't formulated a final summary yet. Please let me know if you would like me to compile the gathered information or continue exploring.")

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
