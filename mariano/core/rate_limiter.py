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
        from mariano.config.api_limits import GLOBAL_MAX_RPM, GLOBAL_MAX_TPM, GLOBAL_MAX_RPD
        self.max_rpm = GLOBAL_MAX_RPM
        self.max_tpm = GLOBAL_MAX_TPM
        self.max_rpd = GLOBAL_MAX_RPD

        # Queues to hold timestamps
        self._timestamps: deque[float] = deque()                    # RPM window (60s)
        self._token_timestamps: deque[tuple[float, int]] = deque()  # TPM window (60s)
        self._day_timestamps: deque[float] = deque()                # RPD window (24h / 86400s)

    @classmethod
    def get_instance(cls) -> GeminiRateLimiter:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def acquire(self, token_count: int = 1000) -> None:
        """Blocks execution if request metrics approach RPM, TPM, or RPD limits."""
        current_time = time.time()
        nc = NotificationCenter.get_instance()

        # 1. Housekeeping: Remove old timestamps
        while self._timestamps and self._timestamps[0] < current_time - 60.0:
            self._timestamps.popleft()

        while self._token_timestamps and self._token_timestamps[0][0] < current_time - 60.0:
            self._token_timestamps.popleft()

        while self._day_timestamps and self._day_timestamps[0] < current_time - 86400.0:
            self._day_timestamps.popleft()

        # 2. Check Daily Limit (RPD)
        if len(self._day_timestamps) >= self.max_rpd:
            msg = f"Daily API Quota Exhausted ({len(self._day_timestamps)}/{self.max_rpd} RPD). Standby."
            log.error("rate_limiter.rpd_limit_exceeded", active_rpd=len(self._day_timestamps))
            nc.push_notification("Quota Guard", msg, "critical")
            raise RuntimeError(msg)

        # 3. Check Requests Per Minute (RPM)
        if len(self._timestamps) >= self.max_rpm:
            oldest_ts = self._timestamps[0]
            wait_time = max(0.1, 60.0 - (current_time - oldest_ts))
            
            log.warning("rate_limiter.rpm_limit_approaching", active_rpm=len(self._timestamps), wait_secs=round(wait_time, 2))
            nc.push_notification(
                title="Rate Limit Guard",
                message=f"RPM Limit approaching ({len(self._timestamps)}/{self.max_rpm} RPM). Pausing for {wait_time:.1f}s.",
                severity="warning"
            )
            await asyncio.sleep(wait_time)
            # Recheck after waiting
            await self.acquire(token_count)
            return

        # 4. Check Tokens Per Minute (TPM)
        active_tokens = sum(tokens for _, tokens in self._token_timestamps)
        if active_tokens + token_count > self.max_tpm:
            oldest_token_ts = self._token_timestamps[0][0]
            wait_time = max(0.1, 60.0 - (current_time - oldest_token_ts))
            
            log.warning(
                "rate_limiter.tpm_limit_approaching", 
                active_tpm=active_tokens, 
                incoming=token_count, 
                wait_secs=round(wait_time, 2)
            )
            nc.push_notification(
                title="Rate Limit Guard",
                message=f"TPM Limit approaching ({active_tokens + token_count}/{self.max_tpm} TPM). Pausing for {wait_time:.1f}s.",
                severity="warning"
            )
            await asyncio.sleep(wait_time)
            # Recheck after waiting
            await self.acquire(token_count)
            return

        # 5. Acquire resource lock
        self._timestamps.append(current_time)
        self._token_timestamps.append((current_time, token_count))
        self._day_timestamps.append(current_time)
        
        log.debug("rate_limiter.acquired", active_rpm=len(self._timestamps), active_tpm=active_tokens + token_count)
