"""MARIANO - Session-isolated context window per chat_id."""
from __future__ import annotations
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mariano.gemini.client import GeminiClient


@dataclass
class ContextMessage:
    role: str
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tool_name: str | None = None
    tool_calls: list[dict] | None = None
    tool_response: dict | None = None


class ContextWindow:
    """Sliding context window scoped to one chat session. No cross-chat contamination."""
    MAX_SIZE = 40

    def __init__(self, chat_id: str | None = None) -> None:
        self._chat_id = chat_id
        self._messages: deque[ContextMessage] = deque(maxlen=self.MAX_SIZE)
        self._synaptic_summary: str = ""
        self._active_target_dir: str | None = None

    @property
    def active_target_dir(self) -> str | None:
        return self._active_target_dir

    def set_active_target_dir(self, target_dir: str | None) -> None:
        if target_dir:
            self._active_target_dir = str(target_dir).strip().replace("/", "\\")

    def add(self, role: str, content: str, tool_name: str | None = None,
            tool_calls: list[dict] | None = None, tool_response: dict | None = None) -> None:
        self._messages.append(ContextMessage(
            role=role, content=content, tool_name=tool_name,
            tool_calls=tool_calls, tool_response=tool_response))

    def seed_from_history(self, messages: list[dict]) -> None:
        """Inject persisted messages as starting context on session restore."""
        for m in messages[-40:]:
            self._messages.append(ContextMessage(
                role=m.get("role", "user"),
                content=m.get("content", ""),
                tool_name=m.get("tool_name"),
                tool_calls=m.get("tool_calls"),
                tool_response=m.get("tool_response"),
            ))

    def get_history(self) -> list[dict]:
        history = []
        if self._synaptic_summary:
            history.append({"role": "user", "content": "[CONTEXT SUMMARY]: " + self._synaptic_summary})
            history.append({"role": "assistant", "content": "Understood. Continuing from context summary."})
        for m in self._messages:
            history.append({"role": m.role, "content": m.content,
                            "tool_calls": m.tool_calls, "tool_response": m.tool_response})
        return history

    def get_last_n(self, n: int) -> list[ContextMessage]:
        return list(self._messages)[-n:]

    def clear(self) -> None:
        self._messages.clear()
        self._synaptic_summary = ""

    @property
    def count(self) -> int: return len(self._messages)

    @property
    def message_count(self) -> int: return len(self._messages)

    async def compress_history(self, gemini: "GeminiClient") -> None:
        """Compress oldest 8 messages into accumulating synaptic summary."""
        if len(self._messages) < 6:
            return
        try:
            oldest = []
            for _ in range(8):
                if self._messages:
                    oldest.append(self._messages.popleft())
            lines = [m.role.upper() + ": " + m.content[:500] for m in oldest]
            prompt = (
                "You are an internal context compression engine. Compress these past conversation turns "
                "into a high-density, factual summary. Strictly preserve: user instructions, target goals, "
                "links/URLs, file paths, directory organization rules, decisions made, errors, and task statuses:\n\n"
                + "\n".join(lines)
            )
            new_summary = (await gemini.complete(prompt)).strip()
            self._synaptic_summary = ((self._synaptic_summary + " | " + new_summary)
                                       if self._synaptic_summary else new_summary)
        except Exception:
            pass
