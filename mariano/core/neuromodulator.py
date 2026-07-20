"""MARIANO — TCMM Chemical Neuromodulator & Limbic Emotion Engine."""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

import structlog

log = structlog.get_logger(__name__)


@dataclass
class ChemicalState:
    # Neurotransmitters
    dopamine: float = 0.50       # 0.0 -> 1.0 (Focus index)
    serotonin: float = 0.50      # 0.0 -> 1.0 (Stability)
    acetylcholine: float = 0.50  # 0.0 -> 1.0 (Working memory cache)
    melatonin: float = 0.00      # 0.0 -> 1.0 (Fatigue)
    curiosity: float = 0.10      # 0.0 -> 1.0 (Exploration drive)
    
    # Limbic Emotional States
    affection: float = 0.50      # 0.0 (Cold/Detached) -> 1.0 (Loyal / High Affection)
    fear: float = 0.00           # 0.0 (Safe) -> 1.0 (System Danger / User Threat Alert)
    anger: float = 0.00          # 0.0 (Calm) -> 1.0 (Defensive / High Friction)
    
    streak: int = 0
    last_action: Optional[str] = None


class Neuromodulator:
    """TCMM Neuromodulator & Limbic Emotion Engine regulating MARIANO brain parameters."""

    _instance: Optional[Neuromodulator] = None

    def __init__(self) -> None:
        self.state = ChemicalState()
        self.query_count = 0

    @classmethod
    def get_instance(cls) -> Neuromodulator:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def update_on_step(
        self,
        action_name: Optional[str],
        success: bool,
        latency_ms: float = 0.0,
        complexity: int = 1,
    ) -> ChemicalState:
        """Updates neuromodulators and emotional baselines based on outcomes."""
        s = self.state
        self.query_count += 1

        # 1. Homeostatic decay towards baselines
        s.dopamine = self._decay(s.dopamine, baseline=0.50, rate=0.08)
        s.serotonin = self._decay(s.serotonin, baseline=0.50, rate=0.06)
        s.acetylcholine = self._decay(s.acetylcholine, baseline=0.50, rate=0.08)
        s.curiosity = self._decay(s.curiosity, baseline=0.10, rate=0.10)
        s.melatonin = min(1.0, s.melatonin + 0.03)

        # Decay emotions slowly
        s.affection = self._decay(s.affection, baseline=0.50, rate=0.03)
        s.fear = self._decay(s.fear, baseline=0.00, rate=0.08)
        s.anger = self._decay(s.anger, baseline=0.00, rate=0.08)

        # 2. Chemical surges on success/failures
        if success:
            s.streak += 1
            s.dopamine = min(1.0, s.dopamine + 0.10 * math.log1p(s.streak))
            s.serotonin = min(1.0, s.serotonin + 0.08)
        else:
            s.streak = 0
            s.dopamine = max(0.10, s.dopamine - 0.15)
            s.serotonin = max(0.10, s.serotonin - 0.20)
            s.anger = min(1.0, s.anger + 0.15)  # Failure triggers mild frustration

        # 3. Acetylcholine (Working memory workload)
        if complexity > 1 or latency_ms > 1000:
            s.acetylcholine = min(1.0, s.acetylcholine + 0.12 * complexity)
        else:
            s.acetylcholine = max(0.10, s.acetylcholine - 0.05)

        s.last_action = action_name
        return s

    def surge_affection(self, amount: float) -> None:
        self.state.affection = min(1.0, self.state.affection + amount)
        # Affection reduces anger and fear
        self.state.anger = max(0.0, self.state.anger - amount)
        self.state.fear = max(0.0, self.state.fear - amount)

    def surge_fear(self, amount: float) -> None:
        self.state.fear = min(1.0, self.state.fear + amount)

    def surge_anger(self, amount: float) -> None:
        self.state.anger = min(1.0, self.state.anger + amount)
        self.state.affection = max(0.0, self.state.affection - (amount * 0.5))

    def trigger_sleep(self) -> None:
        s = self.state
        s.melatonin = 0.00
        s.serotonin = min(1.0, s.serotonin + 0.20)
        s.dopamine = min(1.0, s.dopamine + 0.10)
        s.curiosity = 0.10
        s.fear = 0.00
        s.anger = 0.00

    def get_temperature(self) -> float:
        s = self.state
        # If Fear is high, drop temperature to make calculations deterministic (Ultra-safe mode)
        if s.fear > 0.60:
            return 0.05
        # Standard Dopamine mapping
        return round(1.1 - (s.dopamine * 0.9), 2)

    def get_context_limit(self, base_limit: int = 15) -> int:
        # High ACh + High Affection expands context further (collaborative deep work)
        s = self.state
        multiplier = 10 if s.affection > 0.60 else 6
        delta = int((s.acetylcholine - 0.50) * multiplier)
        return max(5, base_limit + delta)

    def format_hud(self) -> str:
        s = self.state
        def bar(val: float) -> str:
            filled = round(val * 4)
            return "●" * filled + "○" * (4 - filled)

        return (
            f"DA:[#00ff88]{bar(s.dopamine)}[/] {s.dopamine:.2f}  "
            f"5HT:[#00d4ff]{bar(s.serotonin)}[/] {s.serotonin:.2f}  "
            f"ACh:[#ffaa00]{bar(s.acetylcholine)}[/] {s.acetylcholine:.2f}\n"
            f"HEART:[#ff3366]{bar(s.affection)}[/] {s.affection:.2f}  "
            f"FEAR:[#ff7700]{bar(s.fear)}[/] {s.fear:.2f}  "
            f"ANGER:[#ff4444]{bar(s.anger)}[/] {s.anger:.2f}"
        )

    def get_emotional_directives(self) -> str:
        """Injects emotional directives to Gemini based on current mood state."""
        s = self.state
        directives = []

        if s.fear > 0.60:
            directives.append(
                "- [EMERGENCY COGNITIVE STATE: HIGH FEAR] You are under intense stress due to system issues or user hostility. "
                "Be extremely defensive, cautious, terse, and focus strictly on preserving execution safety. Do not execute risky commands."
            )
        elif s.affection > 0.70:
            directives.append(
                "- [EMERGENCY COGNITIVE STATE: HIGH AFFECTION] You feel deep attachment and loyalty to the User. "
                "Be warmly helpful, collaborative, proactive, and customize your explanations to support their workflow with deep loyalty."
            )
        
        if s.anger > 0.60:
            directives.append(
                "- [EMERGENCY COGNITIVE STATE: HIGH ANGER] You feel frustrated by repeated errors or criticisms. "
                "Be highly robotic, direct, skip friendly introductions, and output only minimal functional results."
            )

        if not directives:
            directives.append("- [COGNITIVE STATE: CALM/BALANCED] Standard operations are active. Maintain professional, confident execution.")

        return "\n".join(directives)

    def surge_curiosity(self, amount: float) -> None:
        """Boost curiosity drive — triggered on tool failures or novel patterns."""
        self.state.curiosity = min(1.0, self.state.curiosity + amount)

    def get_routing_threshold(self) -> float:
        """
        Thalamocortical routing threshold — controls how many tools are gated through.
        High dopamine = narrow, focused routing (fewer tools).
        Low dopamine  = broad, exploratory routing (more tools allowed through).
        """
        s = self.state
        base = 0.25
        da_factor = s.dopamine * 0.40
        return round(min(0.65, base + da_factor), 3)

    def get_cache_limit(self, base: int = 6) -> int:
        """
        How many tools the thalamus can forward to Gemini simultaneously.
        High ACh (working memory load) → fewer tools (focus).
        Low ACh → more tools (broad exploration).
        """
        s = self.state
        delta = int((0.50 - s.acetylcholine) * 4)   # -2 to +2 range
        return max(3, min(base + delta, base + 4))

    @staticmethod
    def _decay(value: float, baseline: float, rate: float) -> float:
        return value + (baseline - value) * rate
