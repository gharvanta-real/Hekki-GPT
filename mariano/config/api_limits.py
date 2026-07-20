"""
API Limits Configuration — Single source of truth for Chat, Coder, and Debate API limits.
"""
from __future__ import annotations

# ==========================================
# 1. GLOBAL RATE LIMITER (Gemini API Limits)
# ==========================================
GLOBAL_MAX_RPM = 15     # Max requests per minute (safe cap, actual Gemini is 15)
GLOBAL_MAX_TPM = 250000 # Max tokens per minute
GLOBAL_MAX_RPD = 490    # Max requests per day (with safe buffer limit)

# ==========================================
# 2. CHAT SESSION LIMITS
# ==========================================
CHAT_MAX_OUTPUT_TOKENS = 8192
CHAT_TEMPERATURE = 0.70

# ==========================================
# 3. CODER SESSION LIMITS
# ==========================================
CODER_MAX_OUTPUT_TOKENS = 8192
CODER_TEMPERATURE = 0.40  # More deterministic for code generation

# ==========================================
# 4. DEBATE PLAYGROUND LIMITS
# ==========================================
DEBATE_ALPHA_MAX_TOKENS = 8000
DEBATE_BETA_MAX_TOKENS = 8000
DEBATE_SUMMARY_MAX_TOKENS = 8192

DEBATE_ALPHA_TEMPERATURE = 0.80
DEBATE_BETA_TEMPERATURE = 0.82
DEBATE_SUMMARY_TEMPERATURE = 0.30

DEBATE_INTER_TURN_DELAY = 5.0  # Safe cap (seconds) between agent turns
DEBATE_PAUSE_POLL_INTERVAL = 0.3
DEBATE_DEFAULT_ROUNDS = 3
