"""
prompt_loader.py — Central hierarchical prompt loader for Hekki.

Loads all prompt .md files from config/prompts/ and config/rules/,
assembles the master SYSTEM_PROMPT, and caches results in memory.
Supports per-module overrides (planner, evaluator, native_coder).
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger("Hekki.PromptLoader")

# Root directories
_PROMPTS_DIR = Path(__file__).parent / "prompts"
_RULES_DIR = Path(__file__).parent / "rules"

# Ordered core prompt directories that compose the master SYSTEM_PROMPT
_CORE_DIRS: list[str] = [
    "01_identity",
    "02_behavior",
    "03_writing_style",
    "04_questions_interaction",
    "05_execution_engine",
    "06_tools_protocols",
    "07_visual_components",
]

# Legacy flat fallback files if modular folders are missing
_LEGACY_CORE_LAYERS: list[str] = [
    "00_identity.md",
    "01_writing_style.md",
    "02_research.md",
    "03_swe_agent.md",
    "04_tools.md",
    "05_environment.md",
]


def _read_md(path: Path) -> str:
    """Read a markdown file, return empty string on error."""
    try:
        if path.exists() and path.is_file():
            return path.read_text(encoding="utf-8").strip()
        return ""
    except Exception as exc:
        logger.warning("PromptLoader: could not read %s — %s", path, exc)
        return ""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def load_system_prompt() -> str:
    """
    Assemble and return the master SYSTEM_PROMPT from modular directory layers.
    Scans 01_identity through 07_visual_components in deterministic sorted order.
    Falls back to legacy flat .md files if directories are not present.
    """
    sections: list[str] = []

    # 1. Scan granular modular directories
    for dir_name in _CORE_DIRS:
        target_dir = _PROMPTS_DIR / dir_name
        if target_dir.exists() and target_dir.is_dir():
            for md_file in sorted(target_dir.glob("*.md")):
                content = _read_md(md_file)
                if content:
                    sections.append(content)

    # 2. Fallback to legacy flat files if no modular directories were loaded
    if not sections:
        for filename in _LEGACY_CORE_LAYERS:
            content = _read_md(_PROMPTS_DIR / filename)
            if content:
                sections.append(content)

    if not sections:
        logger.error("PromptLoader: no prompt sections loaded — falling back to minimal prompt.")
        return "You are Hekki, a helpful AI assistant."

    assembled = "\n\n---\n\n".join(sections)
    logger.info("PromptLoader: SYSTEM_PROMPT assembled from %d modular prompt files.", len(sections))
    return assembled


@lru_cache(maxsize=1)
def load_planner_prompt() -> str:
    """Load the planner module prompt."""
    content = _read_md(_PROMPTS_DIR / "08_specialized_modules" / "planner.md") or _read_md(_PROMPTS_DIR / "planner.md")
    if not content:
        return "You are the planning module of Hekki. Output JSON only."
    return content


@lru_cache(maxsize=1)
def load_evaluator_prompt() -> str:
    """Load the evaluator module prompt."""
    content = _read_md(_PROMPTS_DIR / "08_specialized_modules" / "evaluator.md") or _read_md(_PROMPTS_DIR / "evaluator.md")
    if not content:
        return "You are the evaluator module of Hekki. Output JSON only."
    return content


@lru_cache(maxsize=1)
def load_native_coder_prompt() -> str:
    """Load the native coding engine prompt (used by context_manager)."""
    content = _read_md(_PROMPTS_DIR / "08_specialized_modules" / "native_coder.md") or _read_md(_PROMPTS_DIR / "native_coder.md")
    if not content:
        return "You are Hekki Native Coding Engine. Use tools to inspect and modify code."
    return content


def load_rule_layer(name: str) -> str:
    """
    Load a specific rules file from config/rules/ by filename stem.
    Example: load_rule_layer("layer1_rules")  →  reads layer1_rules.md
             load_rule_layer("layer2_rules")  →  reads layer2_rules.md
    Returns empty string if file not found (never raises).
    """
    path = _RULES_DIR / f"{name}.md"
    if not path.exists():
        path = _RULES_DIR / name  # allow passing full filename too
    content = _read_md(path)
    if content:
        return "\n\n" + content
    return ""


def invalidate_cache() -> None:
    """Force reload on next access — call after hot-editing any .md file."""
    load_system_prompt.cache_clear()
    load_planner_prompt.cache_clear()
    load_evaluator_prompt.cache_clear()
    load_native_coder_prompt.cache_clear()
    logger.info("PromptLoader: cache cleared — prompts will reload on next access.")
