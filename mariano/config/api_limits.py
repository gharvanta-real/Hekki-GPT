"""
API Limits Configuration — Single source of truth for Chat, Coder, and Debate API limits.
"""
from __future__ import annotations

# ==========================================
# 1. GLOBAL RATE LIMITER (Gemini API Limits)
# ==========================================
GLOBAL_MAX_RPM = 1000   # Unlimited / High throughput
GLOBAL_MAX_TPM = 1000000 # 1 Million Tokens Per Minute (as per Google Live API Quota)
GLOBAL_MAX_RPD = 100000 # Unlimited / High daily quota

LIVE_AUDIO_MAX_TPM = 1000000 # 1M TPM for Gemini 2.5 Flash Native Audio Dialog


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
