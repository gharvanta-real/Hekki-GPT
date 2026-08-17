"""
API Limits Configuration — Single source of truth for Chat, Coder, and Debate API limits.
"""
from __future__ import annotations

# ==========================================
# 1. GLOBAL & MODEL-SPECIFIC RATE LIMITS (Exact Google Quota Dashboard)
# ==========================================
# Gemini 3.5 Flash / 3.6 Flash / 3.7 Flash: 5 RPM, 250K TPM, 20 RPD
FLASH_MAX_RPM = 5
FLASH_MAX_TPM = 250000
FLASH_MAX_RPD = 20
FLASH_MIN_INTERVAL = 12.0  # 60s / 5 requests

# Gemini 3.5 Flash Lite / 3.1 Flash Lite: 15 RPM, 250K TPM, 500 RPD
FLASH_LITE_MAX_RPM = 15
FLASH_LITE_MAX_TPM = 250000
FLASH_LITE_MAX_RPD = 500
FLASH_LITE_MIN_INTERVAL = 4.0  # 60s / 15 requests

# Active Default Buffer Fallbacks
GLOBAL_MAX_RPM = 15
GLOBAL_MAX_TPM = 250000
GLOBAL_MAX_RPD = 500
MIN_REQUEST_INTERVAL = 4.0

LIVE_AUDIO_MAX_TPM = 250000


# ==========================================
# 2. CHAT SESSION LIMITS
# ==========================================
CHAT_MAX_OUTPUT_TOKENS = 32768
CHAT_TEMPERATURE = 0.70

# ==========================================
# 3. CODER SESSION LIMITS
# ==========================================
CODER_MAX_OUTPUT_TOKENS = 32768
CODER_TEMPERATURE = 0.40  # More deterministic for code generation

# ==========================================
# 4. DEBATE PLAYGROUND LIMITS
# ==========================================
DEBATE_ALPHA_MAX_TOKENS = 16384
DEBATE_BETA_MAX_TOKENS = 16384
DEBATE_SUMMARY_MAX_TOKENS = 32768

DEBATE_ALPHA_TEMPERATURE = 0.80
DEBATE_BETA_TEMPERATURE = 0.82
DEBATE_SUMMARY_TEMPERATURE = 0.30

DEBATE_INTER_TURN_DELAY = 1.0  # Safe cap (seconds) between agent turns
DEBATE_PAUSE_POLL_INTERVAL = 0.3
DEBATE_DEFAULT_ROUNDS = 3
