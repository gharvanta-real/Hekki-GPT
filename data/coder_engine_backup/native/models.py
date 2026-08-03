"""
models.py — Data models for Hekki Native Coding Engine.
Under 60 lines.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, Any
from pydantic import BaseModel


class NativeCoderRequest(BaseModel):
    workspace: str = ""
    prompt: str = ""
    model: str = "gemini-2.0-flash"
    session_id: Optional[str] = None
    history: list[dict] = []


@dataclass
class ChangeSummary:
    has_changes: bool = False
    complexity_score: int = 0  # 0 to 3
    changed_lines: int = 0
    description: str = ""


@dataclass
class ToolCallAction:
    tool_name: str
    args: dict[str, Any] = field(default_factory=dict)
    call_id: str = ""


@dataclass
class CoderStepResult:
    action: Optional[ToolCallAction] = None
    thought: str = ""
    final_answer: str = ""
    is_done: bool = False
