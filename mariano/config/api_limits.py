"""
API Limits Configuration — Single source of truth for Chat, Coder, and Debate API limits.

Both models: Gemini 3.5 Flash Lite & Gemini 3.1 Flash Lite
Real Free Tier hard limits: 15 RPM / 250K TPM / 500 RPD

Buffer Strategy:
  - RPM:  Keep 2 RPM headroom → max 13 requests/min (free tier hard cap = 15 RPM)
  - TPM:  Keep 100K tokens headroom → max 150K tokens/min used by agent
  - RPD:  Keep 75 requests/day headroom → max 425 req/day
  - MIN INTERVAL: 1.0s minimum gap between any two API calls
  - INTER-STEP DELAY: 0.3s sleep between each agentic step in a loop
"""
from __future__ import annotations

# ==========================================
# 1. GLOBAL & MODEL-SPECIFIC RATE LIMITS
# Real Gemini Free Tier (Flash Lite): 15 RPM / 250K TPM / 500 RPD
# ==========================================

# Safety buffer constants (conservative for free tier lite models)
_RPM_BUFFER  = 2       # keep 2 RPM headroom  → safe limit = 13 RPM (free tier hard cap = 15)
_TPM_BUFFER  = 100_000 # keep 100K tokens headroom → safe limit = 150K TPM
_RPD_BUFFER  = 75      # keep 75 requests/day headroom → safe limit = 425 RPD
_INTERVAL_MS = 0.5     # extra 0.5s per interval safety pad

# Gemini Flash Lite (3.1 & 3.5): 15 RPM / 250K TPM / 500 RPD
FLASH_LITE_MAX_RPM      = 15 - _RPM_BUFFER              # = 10
FLASH_LITE_MAX_TPM      = 250_000 - _TPM_BUFFER         # = 150,000
FLASH_LITE_MAX_RPD      = 500 - _RPD_BUFFER             # = 425
FLASH_LITE_MIN_INTERVAL = 1.0                           # 1.0s pacing (RPM window guards max 10/min)

# Non-lite Flash (not used but kept for API compat)
FLASH_MAX_RPM       = 15 - _RPM_BUFFER          # = 10
FLASH_MAX_TPM       = 250_000 - _TPM_BUFFER     # = 150,000 (same limits for safety)
FLASH_MAX_RPD       = 500 - _RPD_BUFFER         # = 425
FLASH_MIN_INTERVAL  = FLASH_LITE_MIN_INTERVAL

# Conservative Global Fallback (used when model is unrecognized)
GLOBAL_MAX_RPM       = FLASH_LITE_MAX_RPM
GLOBAL_MAX_TPM       = FLASH_LITE_MAX_TPM
GLOBAL_MAX_RPD       = FLASH_LITE_MAX_RPD
MIN_REQUEST_INTERVAL = FLASH_LITE_MIN_INTERVAL

LIVE_AUDIO_MAX_TPM = FLASH_LITE_MAX_TPM


# ==========================================
# 2. CHAT SESSION LIMITS
# ==========================================
CHAT_MAX_OUTPUT_TOKENS = 8192   # Reduced from 32768 to save TPM budget
CHAT_TEMPERATURE = 0.70

# ==========================================
# 3. CODER SESSION LIMITS
# ==========================================
CODER_MAX_OUTPUT_TOKENS = 8192  # Reduced from 32768 to save TPM budget
CODER_TEMPERATURE = 0.40        # More deterministic for code generation

# ==========================================
# 4. DEBATE PLAYGROUND LIMITS
# ==========================================
DEBATE_ALPHA_MAX_TOKENS  = 4096  # Reduced — debate turns must be concise
DEBATE_BETA_MAX_TOKENS   = 4096
DEBATE_SUMMARY_MAX_TOKENS = 8192

DEBATE_ALPHA_TEMPERATURE = 0.80
DEBATE_BETA_TEMPERATURE  = 0.82
DEBATE_SUMMARY_TEMPERATURE = 0.30

DEBATE_INTER_TURN_DELAY  = 6.5  # Must match FLASH_LITE_MIN_INTERVAL for safe cadence
DEBATE_PAUSE_POLL_INTERVAL = 0.3
DEBATE_DEFAULT_ROUNDS    = 3
