"""
agy_bridge.py — Live Real-time Antigravity CLI PTY Bridge (Windows)
Uses pywinpty + asyncio.Queue for true line-by-line live streaming.
Every log, tool call, thinking step streams instantly as agy prints it.
Strictly under 200 lines.
"""

import os
import re
import shutil
import asyncio
import logging
import concurrent.futures
from typing import AsyncGenerator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger("Hekki.AgyBridge")
router = APIRouter(prefix="/api/code")

AGY_IDLE_TIMEOUT = 12.0   # seconds of silence = done
AGY_MAX_TIMEOUT  = 300    # 5 min absolute max


class CodeStreamRequest(BaseModel):
    workspace: str
    prompt: str
    model: str = "gemini-2.0-flash"  # Default: Flash for speed


def find_agy() -> str | None:
    found = shutil.which("agy")
    if found:
        return found
    for c in [
        os.path.join(os.path.expanduser("~"), "AppData", "Local", "agy", "bin", "agy.exe"),
        os.path.join(os.path.expanduser("~"), ".gemini", "antigravity", "bin", "agy.exe"),
        os.path.join(os.path.expanduser("~"), ".gemini", "antigravity", "bin", "agy"),
        os.path.join(os.path.expanduser("~"), ".local", "bin", "agy"),
    ]:
        if os.path.exists(c):
            return c
    return None


def _strip_ansi(text: str) -> str:
    """Strip all VT100/ANSI/xterm escape codes."""
    text = re.sub(r'\x1b[@-Z\\-_]', '', text)
    text = re.sub(r'\x1b\[[\d;:<=>?]*[ -/]*[@-~]', '', text)
    text = re.sub(r'\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)', '', text)
    text = re.sub(r'\x1b[^\[\]@-Z\\-_]?', '', text)
    text = re.sub(r'[\r\x00\x07]', '', text)
    text = re.sub(r'[^\x09\x0a\x20-\x7e\u00a0-\uffff]', '', text)
    return text


async def _stream_pty_live(cmd_list: list[str]) -> AsyncGenerator[str, None]:
    """
    Spawns agy in a Windows PTY via background thread.
    Lines are pushed into asyncio.Queue as they arrive → true real-time stream.
    """
    try:
        import winpty
    except ImportError:
        yield "data: [Error: pywinpty not installed — run: pip install pywinpty]\n\n"
        return

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    DONE = object()

    def _reader_thread():
        """Blocking PTY reader — runs in ThreadPoolExecutor."""
        import time
        try:
            # Wide terminal (500 cols) prevents mid-word wrapping
            pty = winpty.PtyProcess.spawn(cmd_list, dimensions=(60, 500))
        except Exception as e:
            loop.call_soon_threadsafe(queue.put_nowait, f"[PTY spawn error: {e}]")
            loop.call_soon_threadsafe(queue.put_nowait, DONE)
            return

        idle = 0.0
        tick = 0.03  # 30ms poll

        while True:
            try:
                raw = pty.read(8192)
                if raw:
                    clean = _strip_ansi(raw)
                    for line in clean.splitlines():
                        stripped = line.strip()
                        if stripped:
                            loop.call_soon_threadsafe(queue.put_nowait, stripped)
                    idle = 0.0
                else:
                    idle += tick
                    if idle >= AGY_IDLE_TIMEOUT:
                        break
            except EOFError:
                break
            except Exception:
                idle += tick
                if idle >= AGY_IDLE_TIMEOUT:
                    break
            time.sleep(tick)

        try:
            pty.close()
        except Exception:
            pass
        loop.call_soon_threadsafe(queue.put_nowait, DONE)

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="agy_pty")
    loop.run_in_executor(executor, _reader_thread)

    total_wait = 0.0
    while total_wait < AGY_MAX_TIMEOUT:
        try:
            item = await asyncio.wait_for(queue.get(), timeout=2.0)
            if item is DONE:
                break
            yield f"data: {item}\n\n"
            total_wait = 0.0
        except asyncio.TimeoutError:
            total_wait += 2.0
            yield "data: \n\n"


async def generate_agy_stream(workspace: str, prompt: str, model: str = "gemini-2.0-flash") -> AsyncGenerator[str, None]:
    agy_path = find_agy()
    if not agy_path:
        yield "data: ## Antigravity CLI Not Found\n\n"
        yield "data: Download from: https://antigravity.dev\n\n"
        return

    cmd_list = [
        agy_path,
        "--print", prompt,
        "--dangerously-skip-permissions",
    ]
    if workspace and os.path.exists(workspace):
        cmd_list += ["--add-dir", workspace]

    logger.info(f"[AgyBridge] Model={model} | PTY: {cmd_list[:4]}")
    async for chunk in _stream_pty_live(cmd_list):
        yield chunk


@router.post("/stream")
async def stream_code_execution(req: CodeStreamRequest):
    """POST /api/code/stream — agy PTY tool execution stream."""
    return StreamingResponse(
        generate_agy_stream(req.workspace, req.prompt, req.model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection":    "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


class BrainRequest(BaseModel):
    prompt: str
    model: str = "gemini-2.0-flash"
    history: list = []


@router.post("/brain")
async def stream_brain_response(req: BrainRequest):
    """
    POST /api/code/brain — Direct brain model stream (Gemini).
    agy not involved. Pure LLM chat with SSE.
    """
    from mariano.coder_engine.code_brain import stream_brain

    async def _sse():
        import json
        async for chunk in stream_brain(req.prompt, req.model, req.history or []):
            if chunk:
                payload = json.dumps({"text": chunk})
                yield f"data: {payload}\n\n"

    return StreamingResponse(
        _sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection":    "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
