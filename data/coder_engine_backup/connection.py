"""
Hekki Coder Engine — Connection Layer

Provides WebSocket connection managers and routers to stream
state transitions, execution logs, and code delta changes to frontend clients.
Exposes /api/coder/ws where the frontend can send refactor commands and
receive real-time FSM state events as the pipeline executes.
"""
from __future__ import annotations
import asyncio
import json
from typing import Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import structlog

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/coder")


class CoderConnectionManager:
    """Manages active WebSockets and distributes event packets to all connected UIs."""

    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        log.info("coder.connection_established", count=len(self.active_connections))

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)
        log.info("coder.connection_terminated", count=len(self.active_connections))

    async def broadcast(self, message: dict) -> None:
        """Sends JSON payload to all listening clients; prunes dead sockets."""
        payload = json.dumps(message)
        dead: list[WebSocket] = []
        for ws in list(self.active_connections):
            try:
                await ws.send_text(payload)
            except Exception as e:
                log.error("coder.broadcast_failed", error=str(e))
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


# Singleton manager — imported by coder_refactor/skill.py for broadcasting
manager = CoderConnectionManager()

# Tracks active chat stream tasks by stream_id
active_chat_tasks: dict[str, asyncio.Task] = {}


async def _handle_refactor_command(websocket: WebSocket, payload: dict) -> None:
    """
    Drives the full AST-safe refactor pipeline over WebSocket with live FSM state
    broadcasting. Imports are done inside the function to avoid circular references.
    """
    # Lazy imports to avoid circular dependency with coder_refactor/skill.py
    from mariano.coder_engine.fsm import CoderFSM, CoderState
    from mariano.coder_engine.ast_guard import ASTGuard
    from mariano.coder_engine.diff_patcher import DiffPatcher
    from mariano.core.workspace import PathGuard

    file_path: str = payload.get("file_path", "")
    old_content: str = payload.get("old_content", "")
    new_content: str = payload.get("new_content", "")
    verify_symbol: str | None = payload.get("verify_symbol")

    # --- Validate required params ---
    if not file_path or not old_content or not new_content:
        await websocket.send_text(json.dumps({
            "event": "error",
            "reason": "Missing required fields: file_path, old_content, new_content"
        }))
        return

    async def _broadcast_state(fsm: CoderFSM, reason: str = "", extra: dict | None = None) -> None:
        packet: dict = {
            "event": "fsm_state",
            "state": fsm.state.value,
            "tokens_consumed": fsm.tokens_consumed,
            "remaining_budget": fsm.remaining_budget,
            "reason": reason,
        }
        if extra:
            packet.update(extra)
        await manager.broadcast(packet)

    # --- Path guard ---
    try:
        resolved_path = PathGuard.secure_path(file_path)
    except PermissionError as pe:
        await websocket.send_text(json.dumps({"event": "error", "reason": str(pe)}))
        return

    if not resolved_path.exists():
        await websocket.send_text(json.dumps({
            "event": "error",
            "reason": f"File not found: {file_path}"
        }))
        return

    with open(resolved_path, "r", encoding="utf-8") as f:
        content = f.read()

    # --- Initialize FSM ---
    file_size_tokens = max(200, len(content) // 4)
    fsm = CoderFSM(file_size_tokens=file_size_tokens)
    fsm.transition_to(CoderState.ANALYZING, "WebSocket-initiated refactor: reading file")
    fsm.consume_tokens(file_size_tokens)
    await _broadcast_state(fsm, "Analyzing file structure")

    # --- Pre-flight AST guard ---
    if verify_symbol:
        guard = ASTGuard(str(resolved_path), content)
        node_info = guard.verify_node(verify_symbol)
        if not node_info:
            siblings = guard.get_sibling_suggestions(verify_symbol)
            fsm.record_error(f"Symbol '{verify_symbol}' not found")
            await _broadcast_state(fsm, f"AST preflight failed: '{verify_symbol}' not found")
            await websocket.send_text(json.dumps({
                "event": "refactor_complete",
                "success": False,
                "error": (
                    f"Symbol '{verify_symbol}' not found in {file_path}. "
                    f"Did you mean: {', '.join(siblings) if siblings else 'N/A'}?"
                )
            }))
            return

    # --- VALIDATING: patch in sandbox ---
    fsm.transition_to(CoderState.VALIDATING, "Pre-flight passed, validating patch in sandbox")
    await _broadcast_state(fsm, "Validating patch in sandbox replica")

    patcher = DiffPatcher(str(resolved_path))
    if not patcher.apply_patch(old_content, new_content):
        patcher.cleanup()
        fsm.record_error("Patch target string not found")
        await _broadcast_state(fsm, "Patch target not found — aborting")
        await websocket.send_text(json.dumps({
            "event": "refactor_complete",
            "success": False,
            "error": "The old_content string was not found in the target file."
        }))
        return

    # --- APPLYING: atomic commit ---
    fsm.transition_to(CoderState.APPLYING, "Syntax valid, committing changes atomically")
    await _broadcast_state(fsm, "Committing changes to disk atomically")

    success = patcher.commit()
    if not success:
        error_msg = "Syntax check failed — atomic rollback executed."
        if patcher.last_error:
            error_msg += f" Diagnostics: {patcher.last_error}"
        fsm.record_error("Compile check failed")
        await _broadcast_state(fsm, "Commit failed, rollback triggered")
        await websocket.send_text(json.dumps({
            "event": "refactor_complete",
            "success": False,
            "error": error_msg
        }))
        return

    # --- IDLE: success ---
    fsm.consume_tokens(len(new_content) // 4)
    fsm.transition_to(CoderState.IDLE, "Refactor committed successfully")
    await _broadcast_state(fsm, "Refactor complete", {"file_path": file_path})
    await websocket.send_text(json.dumps({
        "event": "refactor_complete",
        "success": True,
        "data": f"Successfully refactored {file_path}",
        "file_path": file_path,
        "tokens_consumed": fsm.tokens_consumed,
    }))


async def _handle_chat_command(websocket: WebSocket, payload: dict) -> None:
    """
    Real agent streaming handler for the Hekki Coder chat.
    Streams raw agent events directly to the frontend client.
    """
    text: str = payload.get("text", "").strip()
    project: str = payload.get("project", "")
    project_path: str = payload.get("project_path", "")
    chat_id: str = payload.get("chat_id", "coder_default")

    if not text:
        await websocket.send_text(json.dumps({
            "event": "agent_event",
            "kind": "error",
            "data": "Empty prompt — nothing to process."
        }))
        return

    # Retrieve the shared MarianoAgent from FastAPI app state
    try:
        agent = websocket.app.state.agent
    except AttributeError:
        await websocket.send_text(json.dumps({
            "event": "agent_event",
            "kind": "error",
            "data": "Agent not initialised yet. Please wait for server boot to complete."
        }))
        return

    try:
        async for event in agent.run(
            text,
            project=project or None,
            project_path=project_path or None,
            chat_id=chat_id,
        ):
            await websocket.send_text(json.dumps({
                "event": "agent_event",
                "kind": event.kind,
                "data": event.data,
                "metadata": event.metadata or {}
            }))

        # Ensure done is always sent at the end of the generator
        await websocket.send_text(json.dumps({
            "event": "agent_event",
            "kind": "done",
            "data": ""
        }))

    except asyncio.CancelledError:
        await websocket.send_text(json.dumps({
            "event": "agent_event",
            "kind": "error",
            "data": "Generation cancelled."
        }))
    except Exception as exc:
        log.error("coder.chat_stream_error", error=str(exc))
        try:
            await websocket.send_text(json.dumps({
                "event": "agent_event",
                "kind": "error",
                "data": f"Agent error: {exc}"
            }))
        except Exception:
            pass


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for the Hekki Coder Page.

    Inbound commands:
      ping                            → pong
      get_status                      → active connection count
      read_file    {file_path}         → file_content + symbol list
      list_dir     {dir_path}          → workspace directory tree
      preview_patch {file_path, old_content, new_content}
                                       → unified diff (no disk write)
      list_symbols {file_path}         → AST symbol map
      refactor     {file_path, old_content, new_content, ?verify_symbol}
                                       → streams FSM states + refactor_complete

    Outbound events:
      pong
      status          {active_connections}
      file_content    {file_path, content, symbols}
      dir_listing     {dir_path, entries}
      patch_preview   {file_path, diff}
      symbols         {file_path, symbols}
      fsm_state       {state, tokens_consumed, remaining_budget, reason}
      refactor_complete {success, data|error, file_path}
      error           {reason}
    """
    await manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            cmd: str = message.get("command", "")
            payload: dict = message.get("payload", {})

            log.info("coder.ws_command_received", command=cmd)

            if cmd == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))

            elif cmd == "get_status":
                await websocket.send_text(json.dumps({
                    "event": "status",
                    "data": {"active_connections": len(manager.active_connections)}
                }))

            elif cmd == "read_file":
                # Returns file content + parsed symbol list from AST cache
                from mariano.core.workspace import PathGuard
                from mariano.coder_engine.ast_guard import ASTGuard
                try:
                    resolved = PathGuard.secure_path(payload.get("file_path", ""))
                    text = resolved.read_text(encoding="utf-8")
                    guard = ASTGuard(str(resolved), text)
                    await websocket.send_text(json.dumps({
                        "event": "file_content",
                        "file_path": str(resolved),
                        "content": text,
                        "symbols": guard.list_all_symbols(),
                    }))
                except Exception as exc:
                    await websocket.send_text(json.dumps({"event": "error", "reason": str(exc)}))

            elif cmd == "list_dir":
                # Returns workspace directory tree (files only, bounded by PathGuard)
                from mariano.core.workspace import PathGuard
                try:
                    dir_path = payload.get("dir_path", ".")
                    resolved_dir = PathGuard.secure_path(dir_path)
                    entries = []
                    if resolved_dir.is_dir():
                        for item in sorted(resolved_dir.rglob("*")):
                            if item.is_file():
                                entries.append({
                                    "path": str(item.relative_to(resolved_dir)),
                                    "size": item.stat().st_size,
                                    "suffix": item.suffix,
                                })
                    await websocket.send_text(json.dumps({
                        "event": "dir_listing",
                        "dir_path": str(resolved_dir),
                        "entries": entries,
                    }))
                except Exception as exc:
                    await websocket.send_text(json.dumps({"event": "error", "reason": str(exc)}))

            elif cmd == "preview_patch":
                # Dry-run: returns unified diff without writing anything to disk
                from mariano.core.workspace import PathGuard
                from mariano.coder_engine.diff_patcher import DiffPatcher
                try:
                    resolved = PathGuard.secure_path(payload.get("file_path", ""))
                    patcher = DiffPatcher(str(resolved))
                    diff = patcher.preview_patch(
                        payload.get("old_content", ""),
                        payload.get("new_content", ""),
                    )
                    patcher.cleanup()
                    if diff is None:
                        await websocket.send_text(json.dumps({
                            "event": "error",
                            "reason": "old_content not found in file — nothing to preview"
                        }))
                    else:
                        await websocket.send_text(json.dumps({
                            "event": "patch_preview",
                            "file_path": str(resolved),
                            "diff": diff,
                        }))
                except Exception as exc:
                    await websocket.send_text(json.dumps({"event": "error", "reason": str(exc)}))

            elif cmd == "list_symbols":
                # Returns AST symbol map for any file (uses cache if unchanged)
                from mariano.core.workspace import PathGuard
                from mariano.coder_engine.ast_guard import ASTGuard
                try:
                    resolved = PathGuard.secure_path(payload.get("file_path", ""))
                    text = resolved.read_text(encoding="utf-8")
                    guard = ASTGuard(str(resolved), text)
                    await websocket.send_text(json.dumps({
                        "event": "symbols",
                        "file_path": str(resolved),
                        "symbols": guard.list_all_symbols(),
                    }))
                except Exception as exc:
                    await websocket.send_text(json.dumps({"event": "error", "reason": str(exc)}))

            elif cmd == "chat":
                # Cancel previous task of the same stream_id if somehow duplicated
                stream_id = payload.get("stream_id", "default")
                if stream_id in active_chat_tasks:
                    active_chat_tasks[stream_id].cancel()
                
                # Fire-and-forget: stream real agent response without blocking WS loop
                task = asyncio.create_task(_handle_chat_command(websocket, payload))
                active_chat_tasks[stream_id] = task
                
                def _cleanup(t, sid=stream_id):
                    active_chat_tasks.pop(sid, None)
                task.add_done_callback(_cleanup)

            elif cmd == "chat_cancel":
                # Client requests cancellation of the current stream
                stream_id = payload.get("stream_id")
                if stream_id and stream_id in active_chat_tasks:
                    active_chat_tasks[stream_id].cancel()
                    log.info("coder.ws_chat_task_cancelled", stream_id=stream_id)
                await websocket.send_text(json.dumps({"event": "pong"}))

            elif cmd == "refactor":
                # Fire-and-forget: run full pipeline in background so WS stays responsive
                asyncio.create_task(_handle_refactor_command(websocket, payload))

            else:
                await websocket.send_text(json.dumps({
                    "event": "error",
                    "reason": (
                        f"Unknown command: '{cmd}'. "
                        "Valid: ping, get_status, read_file, list_dir, "
                        "preview_patch, list_symbols, refactor"
                    )
                }))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        log.error("coder.ws_handler_exception", error=str(e))
        manager.disconnect(websocket)
