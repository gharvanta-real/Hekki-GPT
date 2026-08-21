"""MARIANO Core — Gemini API 3-Tier Rate Limiter & Quota Buffer Guard (RPM, TPM, RPD).
Uses iterative wait loop (not recursive) to prevent stack depth issues in long agent loops.
"""
from __future__ import annotations

import asyncio
import time
from collections import deque
from typing import Optional

import structlog

from mariano.core.notifications import NotificationCenter

log = structlog.get_logger(__name__)

# Maximum total wait time before giving up (safety cap to prevent infinite hangs)
_MAX_TOTAL_WAIT_SECS = 120.0


class GeminiRateLimiter:
    """Monitors and queues requests to Gemini API, enforcing strict RPM, TPM, and RPD limits.
    Thread-safe via asyncio.Lock. Uses iterative retry loop — NOT recursive — to prevent
    stack overflow in long autonomous agent loops.
    """

    _instance: Optional[GeminiRateLimiter] = None

    def __init__(self) -> None:
        from mariano.config.api_limits import GLOBAL_MAX_RPM, GLOBAL_MAX_TPM, GLOBAL_MAX_RPD, MIN_REQUEST_INTERVAL
        self.max_rpm = GLOBAL_MAX_RPM
        self.max_tpm = GLOBAL_MAX_TPM
        self.max_rpd = GLOBAL_MAX_RPD
        self.min_interval = MIN_REQUEST_INTERVAL
        self._last_request_time: float = 0.0

        # Sliding window queues
        self._timestamps: deque[float] = deque()                    # RPM window (60s)
        self._token_timestamps: deque[tuple[float, int]] = deque()  # TPM window (60s)
        self._day_timestamps: deque[float] = deque()                # RPD window (24h)
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> GeminiRateLimiter:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _resolve_model_limits(self) -> None:
        """Dynamically resolve limits for the currently active model."""
        from mariano.config import get_settings
        from mariano.config.api_limits import (
            FLASH_MAX_RPM, FLASH_MAX_TPM, FLASH_MAX_RPD, FLASH_MIN_INTERVAL,
            FLASH_LITE_MAX_RPM, FLASH_LITE_MAX_TPM, FLASH_LITE_MAX_RPD, FLASH_LITE_MIN_INTERVAL,
        )
        active_m = (get_settings().active_model or "").lower()
        if "lite" in active_m:
            self.max_rpm = FLASH_LITE_MAX_RPM
            self.max_tpm = FLASH_LITE_MAX_TPM
            self.max_rpd = FLASH_LITE_MAX_RPD
            self.min_interval = FLASH_LITE_MIN_INTERVAL
        else:
            self.max_rpm = FLASH_MAX_RPM
            self.max_tpm = FLASH_MAX_TPM
            self.max_rpd = FLASH_MAX_RPD
            self.min_interval = FLASH_MIN_INTERVAL

    def _housekeep(self, now: float) -> None:
        """Remove expired timestamps from sliding windows."""
        while self._timestamps and self._timestamps[0] < now - 60.0:
            self._timestamps.popleft()
        while self._token_timestamps and self._token_timestamps[0][0] < now - 60.0:
            self._token_timestamps.popleft()
        while self._day_timestamps and self._day_timestamps[0] < now - 86400.0:
            self._day_timestamps.popleft()

    async def acquire(self, token_count: int = 1000) -> None:
        """Block execution if request metrics approach RPM, TPM, or RPD limits.
        Uses an iterative wait loop — NOT recursive — safe for long autonomous agent loops.
        Raises RuntimeError if daily quota (RPD) is exhausted.
        """
        nc = NotificationCenter.get_instance()
        total_waited = 0.0

        while True:
            async with self._lock:
                now = time.time()
                self._resolve_model_limits()
                self._housekeep(now)

                # 1. Daily quota hard-stop
                if len(self._day_timestamps) >= self.max_rpd:
                    msg = f"Daily API Quota Exhausted ({len(self._day_timestamps)}/{self.max_rpd} RPD). Standby."
                    log.error("rate_limiter.rpd_limit_exceeded", active_rpd=len(self._day_timestamps))
                    nc.push_notification("Quota Guard", msg, "critical")
                    raise RuntimeError(msg)

                wait_time = 0.0

                # 2. Pacing interval (min gap between requests)
                pacing_wait = max(0.0, self.min_interval - (now - self._last_request_time))
                wait_time = max(wait_time, pacing_wait)

                # 3. RPM limit — wait only until oldest slot expires (not a flat 60s sleep)
                if len(self._timestamps) >= self.max_rpm:
                    oldest_ts = self._timestamps[0]
                    time_until_slot_frees = (oldest_ts + 60.0) - now
                    rpm_wait = max(0.1, time_until_slot_frees)
                    wait_time = max(wait_time, rpm_wait)
                    log.warning(
                        "rate_limiter.rpm_limit_approaching",
                        active_rpm=len(self._timestamps),
                        wait_secs=round(rpm_wait, 2),
                    )
                    nc.push_notification(
                        title="Rate Limit Guard",
                        message=f"RPM Limit ({len(self._timestamps)}/{self.max_rpm}). Pausing {rpm_wait:.1f}s.",
                        severity="warning",
                    )

                # 4. TPM limit
                active_tokens = sum(t for _, t in self._token_timestamps)
                if active_tokens > 0 and (active_tokens + token_count > self.max_tpm):
                    oldest_token_ts = self._token_timestamps[0][0] if self._token_timestamps else now
                    tpm_wait = max(0.5, 60.0 - (now - oldest_token_ts))
                    wait_time = max(wait_time, tpm_wait)
                    log.warning(
                        "rate_limiter.tpm_limit_approaching",
                        active_tpm=active_tokens,
                        incoming=token_count,
                        wait_secs=round(tpm_wait, 2),
                    )
                    nc.push_notification(
                        title="Rate Limit Guard",
                        message=f"TPM Limit ({active_tokens + token_count}/{self.max_tpm}). Pausing {tpm_wait:.1f}s.",
                        severity="warning",
                    )

                if wait_time <= 0:
                    # Slot available — record and exit
                    self._timestamps.append(now)
                    self._token_timestamps.append((now, min(token_count, self.max_tpm)))
                    self._day_timestamps.append(now)
                    self._last_request_time = now
                    log.debug(
                        "rate_limiter.acquired",
                        active_rpm=len(self._timestamps),
                        active_tpm=active_tokens + token_count,
                    )
                    return

            # Safety cap: if we have been waiting too long, break to avoid infinite hang
            total_waited += wait_time
            if total_waited >= _MAX_TOTAL_WAIT_SECS:
                log.error("rate_limiter.max_wait_exceeded", total_waited=total_waited)
                raise RuntimeError(
                    f"Rate limiter waited {total_waited:.0f}s — exceeds safety cap. Aborting request."
                )

            # Sleep OUTSIDE the lock so other coroutines can proceed
            log.info("rate_limiter.sleeping", seconds=round(wait_time, 2))
            await asyncio.sleep(wait_time)
            # Loop again to re-check after sleep


def estimate_tokens_from_text(message: str, history: list[dict] | None = None) -> int:
    """Accurately estimate token count including tool responses and history."""
    import re
    total_text = message or ""
    if history:
        for m in history:
            total_text += " " + (m.get("content") or "")
            if m.get("tool_response"):
                tr = m["tool_response"]
                if isinstance(tr, dict):
                    total_text += " " + str(tr.get("result", ""))
                else:
                    total_text += " " + str(tr)
            if m.get("tool_calls"):
                total_text += " " + str(m["tool_calls"])
    
    # Each image part in Gemini is ~258 tokens
    img_count = len(re.findall(r'\[Attached Image:', total_text))
    # Strip base64 data URLs if any leaked into message string
    clean = re.sub(r'data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+', '', total_text)
    clean = re.sub(r'\[Attached Image:[^\]]+\]', '[Image]', clean)
    text_tokens = int(len(clean) / 4)
    return max(100, text_tokens + (img_count * 300) + 500)

