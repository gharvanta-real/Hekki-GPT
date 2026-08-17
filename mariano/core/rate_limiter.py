"""MARIANO Core — Gemini API 3-Tier Rate Limiter & Quota Buffer Guard (RPM, TPM, RPD)."""
from __future__ import annotations

import asyncio
import time
from collections import deque
from typing import Optional

import structlog

from mariano.core.notifications import NotificationCenter

log = structlog.get_logger(__name__)


class GeminiRateLimiter:
    """Monitors and queues requests to Gemini API, enforcing strict RPM, TPM, and RPD limits."""

    _instance: Optional[GeminiRateLimiter] = None

    def __init__(self) -> None:
        from mariano.config.api_limits import GLOBAL_MAX_RPM, GLOBAL_MAX_TPM, GLOBAL_MAX_RPD, MIN_REQUEST_INTERVAL
        self.max_rpm = GLOBAL_MAX_RPM
        self.max_tpm = GLOBAL_MAX_TPM
        self.max_rpd = GLOBAL_MAX_RPD
        self.min_interval = MIN_REQUEST_INTERVAL
        self._last_request_time: float = 0.0

        # Queues to hold timestamps
        self._timestamps: deque[float] = deque()                    # RPM window (60s)
        self._token_timestamps: deque[tuple[float, int]] = deque()  # TPM window (60s)
        self._day_timestamps: deque[float] = deque()                # RPD window (24h / 86400s)
        self._lock = asyncio.Lock()  # Prevent concurrent acquire() race conditions

    @classmethod
    def get_instance(cls) -> GeminiRateLimiter:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def acquire(self, token_count: int = 1000) -> None:
        """Blocks execution if request metrics approach RPM, TPM, or RPD limits.
        Uses asyncio.Lock to prevent race conditions when multiple concurrent tasks
        check and append timestamps simultaneously.
        """
        async with self._lock:
            current_time = time.time()
            nc = NotificationCenter.get_instance()

            # 0. Dynamically resolve limits for active model
            from mariano.config import get_settings
            from mariano.config.api_limits import (
                FLASH_MAX_RPM, FLASH_MAX_TPM, FLASH_MAX_RPD, FLASH_MIN_INTERVAL,
                FLASH_LITE_MAX_RPM, FLASH_LITE_MAX_TPM, FLASH_LITE_MAX_RPD, FLASH_LITE_MIN_INTERVAL
            )
            active_m = get_settings().active_model or ""
            if "lite" in active_m.lower():
                self.max_rpm = FLASH_LITE_MAX_RPM
                self.max_tpm = FLASH_LITE_MAX_TPM
                self.max_rpd = FLASH_LITE_MAX_RPD
                self.min_interval = FLASH_LITE_MIN_INTERVAL
            else:
                self.max_rpm = FLASH_MAX_RPM
                self.max_tpm = FLASH_MAX_TPM
                self.max_rpd = FLASH_MAX_RPD
                self.min_interval = FLASH_MIN_INTERVAL

            # 1. Housekeeping: Remove old timestamps
            while self._timestamps and self._timestamps[0] < current_time - 60.0:
                self._timestamps.popleft()

            while self._token_timestamps and self._token_timestamps[0][0] < current_time - 60.0:
                self._token_timestamps.popleft()

            while self._day_timestamps and self._day_timestamps[0] < current_time - 86400.0:
                self._day_timestamps.popleft()

            # 1.5 Check Pacing Interval Buffer
            pacing_wait = max(0.0, self.min_interval - (current_time - self._last_request_time))
            wait_time = pacing_wait

            # 2. Check Daily Limit (RPD)
            if len(self._day_timestamps) >= self.max_rpd:
                msg = f"Daily API Quota Exhausted ({len(self._day_timestamps)}/{self.max_rpd} RPD). Standby."
                log.error("rate_limiter.rpd_limit_exceeded", active_rpd=len(self._day_timestamps))
                nc.push_notification("Quota Guard", msg, "critical")
                raise RuntimeError(msg)

            # 3. Check Requests Per Minute (RPM)
            if len(self._timestamps) >= self.max_rpm:
                oldest_ts = self._timestamps[0]
                rpm_wait = max(0.1, 60.0 - (current_time - oldest_ts))
                wait_time = max(wait_time, rpm_wait)

                log.warning("rate_limiter.rpm_limit_approaching", active_rpm=len(self._timestamps), wait_secs=round(rpm_wait, 2))
                nc.push_notification(
                    title="Rate Limit Guard",
                    message=f"RPM Limit approaching ({len(self._timestamps)}/{self.max_rpm} RPM). Pausing for {rpm_wait:.1f}s.",
                    severity="warning"
                )

            # 4. Check Tokens Per Minute (TPM)
            active_tokens = sum(tokens for _, tokens in self._token_timestamps)
            if active_tokens + token_count > self.max_tpm:
                oldest_token_ts = self._token_timestamps[0][0] if self._token_timestamps else current_time
                tpm_wait = max(0.1, 60.0 - (current_time - oldest_token_ts))
                wait_time = max(wait_time, tpm_wait)

                log.warning(
                    "rate_limiter.tpm_limit_approaching",
                    active_tpm=active_tokens,
                    incoming=token_count,
                    wait_secs=round(tpm_wait, 2)
                )
                nc.push_notification(
                    title="Rate Limit Guard",
                    message=f"TPM Limit approaching ({active_tokens + token_count}/{self.max_tpm} TPM). Pausing for {tpm_wait:.1f}s.",
                    severity="warning"
                )

            # 5. If waiting needed, sleep outside lock to avoid blocking other tasks

        # Sleep outside the lock so other coroutines can proceed
        if wait_time > 0:
            await asyncio.sleep(wait_time)
            # After sleep, re-run acquire (recursive retry)
            await self.acquire(token_count)
            return

        # Re-acquire lock to safely append timestamps
        async with self._lock:
            current_time = time.time()
            active_tokens = sum(tokens for _, tokens in self._token_timestamps)
            # 5. Acquire resource slot
            self._timestamps.append(current_time)
            self._token_timestamps.append((current_time, token_count))
            self._day_timestamps.append(current_time)
            self._last_request_time = current_time

            log.debug("rate_limiter.acquired", active_rpm=len(self._timestamps), active_tpm=active_tokens + token_count)
