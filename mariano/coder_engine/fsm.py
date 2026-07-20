"""
Hekki Coder Engine — Deterministic State Machine (FSM)

Controls the refactoring state transitions and token budget tracking
to prevent infinite calling loops and hallucinations.
"""
from __future__ import annotations
import time
from enum import Enum
from typing import Dict, List, Optional
import structlog

log = structlog.get_logger(__name__)

class CoderState(Enum):
    IDLE = "IDLE"
    ANALYZING = "ANALYZING"
    VALIDATING = "VALIDATING"
    APPLYING = "APPLYING"
    ROLLBACK = "ROLLBACK"
    ERROR = "ERROR"

class CoderFSM:
    """
    Finite State Machine (FSM) regulating transitions and safety limits
    for the coding agent backend.
    """
    def __init__(self, file_size_tokens: int, budget_multiplier: float = 3.0) -> None:
        self._state = CoderState.IDLE
        self.file_size_tokens = file_size_tokens
        self.max_budget = int(file_size_tokens * budget_multiplier)
        self.tokens_consumed = 0
        self.error_count = 0
        self.history: List[Dict[str, str]] = []
        self.start_time = time.time()
        
        # Valid state transitions
        self._transitions: Dict[CoderState, List[CoderState]] = {
            CoderState.IDLE: [CoderState.ANALYZING],
            CoderState.ANALYZING: [CoderState.VALIDATING, CoderState.ERROR],
            CoderState.VALIDATING: [CoderState.APPLYING, CoderState.ROLLBACK, CoderState.ERROR],
            CoderState.APPLYING: [CoderState.IDLE, CoderState.ERROR],
            CoderState.ROLLBACK: [CoderState.ANALYZING, CoderState.ERROR],
            CoderState.ERROR: [CoderState.IDLE]
        }

    @property
    def state(self) -> CoderState:
        return self._state

    @property
    def remaining_budget(self) -> int:
        # Penalty calculation: increase effective cost dynamically with errors
        penalty = 1.5 ** self.error_count
        effective_cost = int(self.tokens_consumed * penalty)
        return max(0, self.max_budget - effective_cost)

    def transition_to(self, target_state: CoderState, reason: str = "") -> bool:
        """
        Transitions the FSM to a target state if valid under isolation and budget rules.
        """
        # Safety check: Token budget check
        if self.remaining_budget <= 0 and target_state != CoderState.ERROR:
            log.warning("fsm.budget_exhausted", tokens_consumed=self.tokens_consumed, error_count=self.error_count)
            self._state = CoderState.ERROR
            self.history.append({
                "from_state": self._state.value,
                "to_state": CoderState.ERROR.value,
                "reason": "Token budget exhausted (loop prevention triggered SIGKILL)"
            })
            return False

        # Validate transition path
        allowed = self._transitions.get(self._state, [])
        if target_state not in allowed:
            log.error("fsm.invalid_transition", current=self._state.value, target=target_state.value)
            return False

        old_state = self._state
        self._state = target_state
        self.history.append({
            "from_state": old_state.value,
            "to_state": target_state.value,
            "reason": reason
        })
        log.info("fsm.transition_success", current=old_state.value, target=target_state.value, reason=reason)
        return True

    def consume_tokens(self, count: int) -> None:
        self.tokens_consumed += count
        log.debug("fsm.token_consumption", consumed=count, total=self.tokens_consumed)

    def record_error(self, error_msg: str) -> None:
        self.error_count += 1
        self.transition_to(CoderState.ERROR, f"Error: {error_msg}")
        log.warn("fsm.error_recorded", error=error_msg, count=self.error_count)
        
    def reset(self) -> None:
        self._state = CoderState.IDLE
        self.tokens_consumed = 0
        self.error_count = 0
        self.history.clear()
        self.start_time = time.time()
        log.info("fsm.reset")
