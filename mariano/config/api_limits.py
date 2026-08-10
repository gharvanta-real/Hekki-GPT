"""
API Limits Configuration — Single source of truth for Chat, Coder, and Debate API limits.
"""
from __future__ import annotations

# ==========================================
# 1. GLOBAL RATE LIMITER (Gemini API Limits with Buffer Guard)
# ==========================================
GLOBAL_MAX_RPM = 14       # Buffer guard: 14 RPM (Google limit is 15 RPM)
GLOBAL_MAX_TPM = 250000   # Buffer guard: 250K TPM
GLOBAL_MAX_RPD = 480      # Buffer guard: 480 RPD (Google limit is 500 RPD)
MIN_REQUEST_INTERVAL = 4.0 # 4.0s pacing buffer between requests (ensures max 15 RPM)

LIVE_AUDIO_MAX_TPM = 250000 # 1M TPM for Gemini 2.5 Flash Native Audio Dialog


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

DEBATE_INTER_TURN_DELAY = 1.0  # Safe cap (seconds) between agent turns
DEBATE_PAUSE_POLL_INTERVAL = 0.3
DEBATE_DEFAULT_ROUNDS = 3
