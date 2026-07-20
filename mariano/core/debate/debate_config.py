"""
debate_config.py — Single source of truth for all Debate Playground limits.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  REAL API LIMITS (Gemini 3.1 Flash Lite — verified Jul 2026)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RPM  : 15    requests per minute
  TPM  : 250,000 tokens per minute  (input tokens)
  RPD  : 490   requests per day (Configured with safe buffer limit) ← TIGHT. Budget carefully.

STRATEGY:
  ┌──────────────────────────────────────────────────────┐
  │  TPM budget per turn (at 12 RPM safe rate):          │
  │    Input per turn  ≈  6,000 tokens (context+search)  │
  │    Output per turn ≈  8,000 tokens                   │
  │    Total per turn  ≈  14,000 tokens                  │
  │    At 12 RPM → 168,000 TPM  (safely under 250K)     │
  │                                                      │
  │  RPD budget: 490/day → ~4-5 full debates (3 rounds)  │
  │  Each debate = ~12 API calls (Tony+Bruce×3 + summary)│
  └──────────────────────────────────────────────────────┘

"""
from __future__ import annotations

# Import centralized API limits
from mariano.config.api_limits import (
    DEBATE_ALPHA_MAX_TOKENS as ALPHA_MAX_TOKENS,
    DEBATE_BETA_MAX_TOKENS as BETA_MAX_TOKENS,
    DEBATE_SUMMARY_MAX_TOKENS as SUMMARY_MAX_TOKENS,
    DEBATE_ALPHA_TEMPERATURE as ALPHA_TEMPERATURE,
    DEBATE_BETA_TEMPERATURE as BETA_TEMPERATURE,
    DEBATE_SUMMARY_TEMPERATURE as SUMMARY_TEMPERATURE,
    DEBATE_INTER_TURN_DELAY as INTER_TURN_DELAY,
    DEBATE_PAUSE_POLL_INTERVAL as PAUSE_POLL_INTERVAL,
    DEBATE_DEFAULT_ROUNDS as DEFAULT_ROUNDS,
)

# ── Model IDs (single source — never override elsewhere) ──────────────────────
ALPHA_MODEL = "gemini-3.1-flash-lite"
BETA_MODEL   = "gemini-3.1-flash-lite"

# ── Search config — MORE context per search ───────────────────────────────────
SEARCH_MAX_RESULTS  = 6    # 6 results per agent per turn (was 4)
SEARCH_SNIPPET_LEN  = 500  # 500 chars per snippet — actual paper content (was 220)

# ── Academic Evidence config — multi-source research engine ───────────────────
ACADEMIC_MAX_PAPERS      = 9    # Total papers fetched pre-debate (3 per source: arXiv+PubMed+S2)
ACADEMIC_SNIPPET_LEN     = 400  # Abstract chars per paper
CITATION_SORT_ENABLED    = True # Sort papers by citation count (most cited = highest credibility)

# ── Summary model ─────────────────────────────────────────────────────────────
SUMMARY_MODEL       = ALPHA_MODEL


