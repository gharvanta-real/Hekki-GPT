"""
OpenRouter Model Registry
=========================
Yahan sare OpenRouter models define kiye hain unki limits ke saath.
Future mein naya model add karna ho toh sirf is file mein entry karo.

Format:
    OPENROUTER_MODELS = {
        "mode_id": ModelDef(
            model_id  = "openrouter/official/model-slug",
            display   = "Human readable name",
            rpm_limit = requests per minute (stated),
            rpd_limit = requests per day    (stated),
            free      = True/False,
            notes     = "Optional notes",
        )
    }

Buffer Policy:
    Actual enforced limit = floor(stated_limit * RATE_BUFFER_FACTOR)
    RATE_BUFFER_FACTOR = 0.95  (5% buffer — prevents hitting hard OpenRouter walls)
"""
from __future__ import annotations
from dataclasses import dataclass, field

# ── Safety Buffer ─────────────────────────────────────────────────────────────
# 5% buffer: keeps API call headroom safe while maximizing throughput.
RATE_BUFFER_FACTOR = 0.95


@dataclass
class ModelDef:
    model_id:  str            # OpenRouter ka official model slug (e.g. openai/gpt-oss-20b:free)
    display:   str            # UI mein dikhne wala naam
    rpm_limit: int            # Requests per minute (STATED by provider)
    rpd_limit: int            # Requests per day    (STATED by provider)
    free:      bool = True    # Free tier hai ya paid?
    tpm_limit: int  = 0       # Tokens per minute (0 = unknown/unlimited)
    notes:     str  = ""

    @property
    def safe_rpm(self) -> int:
        """Enforced RPM with 10% safety buffer (floor)."""
        return max(1, int(self.rpm_limit * RATE_BUFFER_FACTOR))

    @property
    def safe_rpd(self) -> int:
        """Enforced RPD with 10% safety buffer (floor)."""
        return max(1, int(self.rpd_limit * RATE_BUFFER_FACTOR))


# ════════════════════════════════════════════════════════════════════════════
#  OpenRouter Model Catalogue
#  Add karo yahan — ek entry per model, mode_id == model selector key
# ════════════════════════════════════════════════════════════════════════════
OPENROUTER_MODELS: dict[str, ModelDef] = {

    # ── GPT-oss-20b (Default Free Cloud) ─────────────────────────────────
    "openrouter": ModelDef(
        model_id  = "openai/gpt-oss-20b:free",
        display   = "GPT-oss-20 (Free Cloud)",
        rpm_limit = 20,
        rpd_limit = 200,
        free      = True,
        notes     = "OpenRouter free tier. 20 RPM / 200 RPD. 10% buffer applied.",
    ),

    # ── Gemma 4 31B Free (Google via OpenRouter) ──────────────────────────
    "openrouter_gemma4": ModelDef(
        model_id  = "google/gemma-4-31b-it:free",
        display   = "Gemma 4 31B (Free via OpenRouter)",
        rpm_limit = 20,
        rpd_limit = 200,
        free      = True,
        notes     = "Google Gemma 4 31B via OpenRouter free tier.",
    ),

    # ── Nvidia Nemotron Ultra Free ─────────────────────────────────────────
    "openrouter_nemotron": ModelDef(
        model_id  = "nvidia/nemotron-3-ultra-550b-a55b:free",
        display   = "Nvidia Nemotron Ultra 550B (Free)",
        rpm_limit = 20,
        rpd_limit = 200,
        free      = True,
        notes     = "Nvidia 550B via OpenRouter free tier.",
    ),

    # ────────────────────────────────────────────────────────────────────────
    # TEMPLATE — Naya model add karne ke liye copy karo ye block
    # ────────────────────────────────────────────────────────────────────────
    # "openrouter_NEW_KEY": ModelDef(
    #     model_id  = "provider/model-slug:free",
    #     display   = "Display Name",
    #     rpm_limit = 20,
    #     rpd_limit = 200,
    #     free      = True,
    #     notes     = "",
    # ),

}

# ── Helper: model_id → ModelDef reverse lookup ────────────────────────────────
_MODEL_ID_INDEX: dict[str, ModelDef] = {m.model_id: m for m in OPENROUTER_MODELS.values()}


def get_by_mode(mode_key: str) -> ModelDef | None:
    """mode_key (e.g. 'openrouter', 'openrouter_gemma4') → ModelDef"""
    return OPENROUTER_MODELS.get(mode_key)


def get_by_model_id(model_id: str) -> ModelDef | None:
    """OpenRouter model slug → ModelDef"""
    return _MODEL_ID_INDEX.get(model_id)


def all_modes() -> list[str]:
    """Saare registered OpenRouter mode keys."""
    return list(OPENROUTER_MODELS.keys())
