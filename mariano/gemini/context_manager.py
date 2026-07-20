"""MARIANO — Token-aware context window manager with Synaptic Compression."""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import structlog

from mariano.config import get_settings

log = structlog.get_logger(__name__)


@dataclass
class Message:
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tool_name: str | None = None
    metadata: dict = field(default_factory=dict)


class ContextManager:
    """Manages the sliding window of conversation context, compressing older turns to prevent memory decay."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._messages: deque[Message] = deque()
        self._synaptic_summary: str = ""

    def add_user(self, content: str) -> None:
        self._messages.append(Message(role="user", content=content))

    def add_assistant(self, content: str) -> None:
        self._messages.append(Message(role="assistant", content=content))

    def add_tool_result(self, tool_name: str, result: str) -> None:
        self._messages.append(
            Message(role="assistant", content=f"[Tool: {tool_name}]\n{result}", tool_name=tool_name)
        )

    def get_history(self) -> list[dict]:
        """Get history in format expected by GeminiClient, injecting the dynamic context summary if available."""
        history = []
        if self._synaptic_summary:
            history.append({
                "role": "user",
                "content": (
                    f"[COGNITIVE CONTEXT SUMMARY - DO NOT FORGET]\n"
                    f"Below is the highly dense summary of our older conversation history. Use this to maintain context continuity:\n"
                    f"{self._synaptic_summary}"
                )
            })
            history.append({
                "role": "assistant",
                "content": "Understood. I have integrated this background history summary into my active memory context."
            })
        
        for m in self._messages:
            role = "model" if m.role == "assistant" else m.role
            # Ensure Gemini format uses correct roles (user/model)
            history.append({"role": role, "content": m.content})
        
        return history

    async def compress_history(self, gemini_client: Any) -> None:
        """Compresses the oldest 6 messages in the context window to free up sliding space while preserving memory."""
        if len(self._messages) < 6:
            return

        to_compress = list(self._messages)[:6]
        exchange = []
        for m in to_compress:
            exchange.append(f"{m.role.upper()}: {m.content[:500]}")
        
        exchange_text = "\n".join(exchange)
        prompt = (
            f"You are a cognitive context compression engine. Summarize the following dialogue exchange "
            f"between a User and an Assistant. Retain all key technical parameters, files, user preferences, "
            f"and instructions. Be extremely dense and concise, outputting only bullet points:\n\n"
            f"{exchange_text}"
        )

        try:
            log.info("context.compression_start", count=len(to_compress))
            summary = await gemini_client.complete(prompt)
            if summary:
                if self._synaptic_summary:
                    merge_prompt = (
                        f"Merge the following two context summaries into a single dense, bulleted summary, "
                        f"retaining all operational facts:\n"
                        f"1. {self._synaptic_summary}\n"
                        f"2. {summary}"
                    )
                    self._synaptic_summary = await gemini_client.complete(merge_prompt)
                else:
                    self._synaptic_summary = summary

                # Dequeue the oldest 6 messages
                for _ in range(6):
                    if self._messages:
                        self._messages.popleft()
                
                log.info("context.compressed", summary_len=len(self._synaptic_summary))
        except Exception as e:
            log.error("context.compression_failed", error=str(e))

    def get_recent(self, n: int = 5) -> list[Message]:
        messages = list(self._messages)
        return messages[-n:] if len(messages) >= n else messages

    def clear(self) -> None:
        self._messages.clear()
        self._synaptic_summary = ""

    @property
    def message_count(self) -> int:
        return len(self._messages)
