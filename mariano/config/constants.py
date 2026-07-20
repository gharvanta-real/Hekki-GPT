"""MARIANO — All constants. No magic strings in code."""
from __future__ import annotations

# Agent
AGENT_NAME = "MARIANO"
AGENT_VERSION = "1.0.0"

# Memory
SHORT_TERM_MAX_MESSAGES = 20
EPISODIC_MAX_RESULTS = 10
SEMANTIC_MAX_RESULTS = 5
EMBEDDING_MODEL = "models/text-embedding-004"

# Skills
SKILL_REGISTRY_FILE = "_registry.json"
CORE_SKILLS_PACKAGE = "mariano.skills.core_skills"
EVOLVED_SKILLS_PACKAGE = "mariano.skills.evolved_skills"
SKILL_MAX_RETRIES = 3
SKILL_TIMEOUT_SECONDS = 30

# Gemini
from .api_limits import CHAT_MAX_OUTPUT_TOKENS as MAX_OUTPUT_TOKENS
FUNCTION_CALLING_MODE = "AUTO"

# IPC (Rust engine)
IPC_PIPE_NAME = r"\\.\pipe\mariano_engine"
IPC_TIMEOUT_MS = 5000

# Logging
LOG_FORMAT = "json"

# UI
THEME_PRIMARY = "#00d4ff"
THEME_SECONDARY = "#0066cc"
THEME_BG = "#0a0a12"
THEME_SUCCESS = "#00ff88"
THEME_ERROR = "#ff4444"
THEME_WARNING = "#ffaa00"
