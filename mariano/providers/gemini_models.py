"""
Google Gemini Model Registry
==============================
Yahan sare Gemini models define kiye hain unki limits ke saath.
Future mein naya Gemini model add karna ho toh sirf is file mein entry karo.

Format:
    GEMINI_MODELS = {
        "mode_id": GeminiModelDef(
            model_id  = "gemini-X.X-model-name",
            display   = "Human readable name",
            rpm_limit = requests per minute (stated),
            rpd_limit = requests per day    (stated),
            tpm_limit = tokens per minute   (stated),
            paid_tier = False (Free AI Studio key)
        )
    }

Buffer Policy:
    Actual enforced limit = floor(stated_limit * RATE_BUFFER_FACTOR)
    RATE_BUFFER_FACTOR = 0.90  (10% buffer)

Routing Logic:
    mode_id 'fast'     → gemini_flash_lite
    mode_id 'pro'      → gemini_flash
    mode_id 'thinking' → gemini_flash (same model, thinking instructions differ)
"""
from __future__ import annotations
from dataclasses import dataclass

# ── Safety Buffer ─────────────────────────────────────────────────────────────
RATE_BUFFER_FACTOR = 0.80   # 20% safety buffer below stated limit for free tier stability


@dataclass
class GeminiModelDef:
    model_id:  str        # Gemini API model identifier
    display:   str        # UI display name
    rpm_limit: int        # Requests per minute (STATED)
    rpd_limit: int        # Requests per day    (STATED)
    tpm_limit: int        # Tokens per minute   (STATED, 0 = unknown)
    paid_tier: bool = False

    @property
    def safe_rpm(self) -> int:
        return max(1, int(self.rpm_limit * RATE_BUFFER_FACTOR))

    @property
    def safe_rpd(self) -> int:
        return max(1, int(self.rpd_limit * RATE_BUFFER_FACTOR))

    @property
    def safe_tpm(self) -> int:
        if self.tpm_limit == 0:
            return 0
        return max(1, int(self.tpm_limit * RATE_BUFFER_FACTOR))


# ════════════════════════════════════════════════════════════════════════════
#  Gemini Model Catalogue
#  mode_id == reasoning_mode value from settings
# ════════════════════════════════════════════════════════════════════════════
GEMINI_MODELS: dict[str, GeminiModelDef] = {

    "gemini-3.5-flash-lite": GeminiModelDef(
        model_id  = "gemini-3.5-flash-lite",
        display   = "Gemini 3.5 Flash Lite",
        rpm_limit = 15,
        rpd_limit = 500,
        tpm_limit = 250_000,
        paid_tier = False,
    ),

    "gemini-3.1-flash-lite": GeminiModelDef(
        model_id  = "gemini-3.1-flash-lite",
        display   = "Gemini 3.1 Flash Lite",
        rpm_limit = 15,
        rpd_limit = 500,
        tpm_limit = 250_000,
        paid_tier = False,
    ),

    # Aliases all mapping strictly to 500 RPD Lite model
    "fast": GeminiModelDef(
        model_id  = "gemini-3.5-flash-lite",
        display   = "Gemini 3.5 Flash Lite",
        rpm_limit = 15,
        rpd_limit = 500,
        tpm_limit = 250_000,
        paid_tier = False,
    ),

    "pro": GeminiModelDef(
        model_id  = "gemini-3.5-flash-lite",
        display   = "Gemini 3.5 Flash Lite",
        rpm_limit = 15,
        rpd_limit = 500,
        tpm_limit = 250_000,
        paid_tier = False,
    ),

    "thinking": GeminiModelDef(
        model_id  = "gemini-3.5-flash-lite",
        display   = "Gemini 3.5 Flash Lite",
        rpm_limit = 15,
        rpd_limit = 500,
        tpm_limit = 250_000,
        paid_tier = False,
    ),

    "normal": GeminiModelDef(
        model_id  = "gemini-3.5-flash-lite",
        display   = "Gemini 3.5 Flash Lite",
        rpm_limit = 15,
        rpd_limit = 500,
        tpm_limit = 250_000,
        paid_tier = False,
    ),
}
    # ────────────────────────────────────────────────────────────────────────
    # TEMPLATE — Naya Gemini model add karne ke liye copy karo
    # ────────────────────────────────────────────────────────────────────────
    # "NEW_MODE_KEY": GeminiModelDef(
    #     model_id  = "gemini-X.X-model-name",
    #     display   = "Display Name",
    #     rpm_limit = 15,
    #     rpd_limit = 1500,
    #     tpm_limit = 1_000_000,
    #     paid_tier = False,
    # ),

_MODEL_ID_INDEX: dict[str, GeminiModelDef] = {m.model_id: m for m in GEMINI_MODELS.values()}


def get_by_mode(mode_key: str) -> GeminiModelDef | None:
    """mode_key (e.g. 'fast', 'pro', 'thinking') → GeminiModelDef"""
    return GEMINI_MODELS.get(mode_key)


def get_by_model_id(model_id: str) -> GeminiModelDef | None:
    """Gemini model_id → GeminiModelDef"""
    return _MODEL_ID_INDEX.get(model_id)


def all_modes() -> list[str]:
    return list(GEMINI_MODELS.keys())
