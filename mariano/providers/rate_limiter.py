"""
Persistent Rate Limiter — Restart-Safe API Call Tracker
=========================================================
Tracks API call counts (per-minute + per-day) for each model/provider.
Usage data is stored in data/rate_limits.json so it SURVIVES app restarts.

Design:
  - Per-minute window: sliding 60-second window
  - Per-day window:    calendar day (midnight IST/local reset)
  - 10% buffer:        already applied in model definitions (safe_rpm / safe_rpd)
                       this class enforces those safe values
  - Thread-safe:       asyncio.Lock per key (safe for concurrent WS sessions)

Usage:
    from mariano.providers.rate_limiter import PersistentRateLimiter

    limiter = PersistentRateLimiter.get_instance()
    allowed, reason = await limiter.check_and_record("openrouter", rpm=18, rpd=180)
    if not allowed:
        return {"text": f"⏳ Rate limit reached: {reason}", "tool_calls": []}
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, date
from pathlib import Path
from typing import ClassVar

import structlog

log = structlog.get_logger(__name__)

# ── Where usage data is stored ────────────────────────────────────────────────
_DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "rate_limits.json"


class PersistentRateLimiter:
    """
    Singleton persistent rate limiter.
    Stores call timestamps to disk so app restarts don't reset daily counters.
    """

    _instance: ClassVar[PersistentRateLimiter | None] = None
    _lock: ClassVar[asyncio.Lock | None] = None

    def __init__(self) -> None:
        self._file = _DATA_FILE
        self._file.parent.mkdir(parents=True, exist_ok=True)
        self._data: dict = self._load()
        self._key_locks: dict[str, asyncio.Lock] = {}

    # ── Singleton ─────────────────────────────────────────────────────────────
    @classmethod
    def get_instance(cls) -> "PersistentRateLimiter":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_lock(self, key: str) -> asyncio.Lock:
        if key not in self._key_locks:
            self._key_locks[key] = asyncio.Lock()
        return self._key_locks[key]

    # ── Persistence ───────────────────────────────────────────────────────────
    def _load(self) -> dict:
        """Load stored rate limit data from disk."""
        if self._file.exists():
            try:
                raw = json.loads(self._file.read_text(encoding="utf-8"))
                log.info("rate_limiter.loaded", file=str(self._file))
                return raw
            except Exception as e:
                log.warning("rate_limiter.load_failed", error=str(e))
        return {}

    def _save(self) -> None:
        """Save current rate limit data to disk (sync, fast)."""
        try:
            self._file.write_text(
                json.dumps(self._data, indent=2),
                encoding="utf-8"
            )
        except Exception as e:
            log.error("rate_limiter.save_failed", error=str(e))

    # ── Internal helpers ──────────────────────────────────────────────────────
    def _get_entry(self, key: str) -> dict:
        """Get or create entry for a model key."""
        today = date.today().isoformat()
        if key not in self._data:
            self._data[key] = {}
        entry = self._data[key]
        # Reset day counter if new calendar day
        if entry.get("day_date") != today:
            entry["day_date"] = today
            entry["day_count"] = 0
            log.info("rate_limiter.daily_reset", key=key, date=today)
        # Sliding minute window: keep only timestamps within last 60s
        now = time.time()
        entry.setdefault("minute_timestamps", [])
        entry["minute_timestamps"] = [
            ts for ts in entry["minute_timestamps"] if now - ts < 60
        ]
        return entry

    # ── Core method ───────────────────────────────────────────────────────────
    async def check_and_record(
        self,
        key: str,
        rpm: int,
        rpd: int,
    ) -> tuple[bool, str]:
        """
        Check if a request is allowed under rate limits, then record it.

        Args:
            key:  Unique identifier string (e.g. 'openrouter', 'gemini_fast')
            rpm:  Max requests per minute (already buffered safe value)
            rpd:  Max requests per day    (already buffered safe value)

        Returns:
            (allowed: bool, reason: str)
            If allowed=False, reason explains the limit hit.
        """
        async with self._get_lock(key):
            entry = self._get_entry(key)
            now = time.time()

            # ── Check RPM ─────────────────────────────────────────────────
            minute_count = len(entry["minute_timestamps"])
            if minute_count >= rpm:
                oldest = min(entry["minute_timestamps"])
                wait_sec = max(1, int(60 - (now - oldest)) + 1)
                reason = (
                    f"Minute limit reached ({minute_count}/{rpm} req/min). "
                    f"Please wait ~{wait_sec}s."
                )
                log.warning("rate_limiter.rpm_blocked", key=key, count=minute_count, limit=rpm)
                return False, reason

            # ── Check RPD ─────────────────────────────────────────────────
            day_count = entry.get("day_count", 0)
            if day_count >= rpd:
                reason = (
                    f"Daily limit reached ({day_count}/{rpd} req/day). "
                    f"Resets at midnight."
                )
                log.warning("rate_limiter.rpd_blocked", key=key, count=day_count, limit=rpd)
                return False, reason

            # ── Record the request ─────────────────────────────────────────
            entry["minute_timestamps"].append(now)
            entry["day_count"] = day_count + 1
            entry["total_ever"] = entry.get("total_ever", 0) + 1
            entry["last_used"] = datetime.now().isoformat()

            self._save()

            log.info(
                "rate_limiter.request_recorded",
                key=key,
                rpm_used=len(entry["minute_timestamps"]),
                rpm_limit=rpm,
                rpd_used=entry["day_count"],
                rpd_limit=rpd,
            )
            return True, "ok"

    async def get_usage(self, key: str) -> dict:
        """Returns current usage stats for a model key."""
        async with self._get_lock(key):
            entry = self._get_entry(key)
            return {
                "key": key,
                "rpm_used": len(entry.get("minute_timestamps", [])),
                "rpd_used": entry.get("day_count", 0),
                "total_ever": entry.get("total_ever", 0),
                "last_used": entry.get("last_used", "never"),
                "day_date": entry.get("day_date", ""),
            }

    async def reset_key(self, key: str) -> None:
        """Manually reset counters for a key (admin use)."""
        async with self._get_lock(key):
            if key in self._data:
                del self._data[key]
            self._save()
            log.info("rate_limiter.manual_reset", key=key)
