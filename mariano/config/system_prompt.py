"""
system_prompt.py — Hekki master prompt assembly entry point.

All prompt text now lives in config/prompts/*.md files.
This module assembles them via PromptLoader and exports the
same constants that the rest of the codebase expects:
  SYSTEM_PROMPT, PLANNER_PROMPT, EVALUATOR_PROMPT
"""
from __future__ import annotations

from mariano.config.prompt_loader import (
    load_system_prompt,
    load_planner_prompt,
    load_evaluator_prompt,
)

SYSTEM_PROMPT_VERSION = "3.0.0"

# ---------------------------------------------------------------------------
# Assembled prompt constants — loaded from config/prompts/*.md hierarchy
# ---------------------------------------------------------------------------

SYSTEM_PROMPT: str = load_system_prompt()
PLANNER_PROMPT: str = load_planner_prompt()
EVALUATOR_PROMPT: str = load_evaluator_prompt()
