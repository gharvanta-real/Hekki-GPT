"""MARIANO Core — Sentinel Proactive Background System Observer."""
from __future__ import annotations

import asyncio
import os
import httpx
import psutil
import structlog

log = structlog.get_logger(__name__)


class SentinelObserver:
    """Background thread that proactively monitors system health and pushes real-time alerts to the user on Telegram."""

    _instance: SentinelObserver | None = None

    def __init__(self) -> None:
        self.running = False
        self.token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        allowed_id = os.getenv("TELEGRAM_ALLOWED_USER_ID", "")
        self.chat_id = int(allowed_id) if allowed_id.isdigit() else None
        
        # Thresholds
        self.cpu_threshold = 85.0  # %
        self.ram_threshold = 85.0  # %
        self.battery_threshold = 20.0  # %

        # Consecutive counters to prevent alert spamming
        self.cpu_high_count = 0
        self.ram_high_count = 0
        self.battery_low_alerted = False

    @classmethod
    def get_instance(cls) -> SentinelObserver:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def start(self) -> None:
        if self.running:
            return
        if not self.token or not self.chat_id:
            log.warning("sentinel.disabled", reason="TELEGRAM_BOT_TOKEN or TELEGRAM_ALLOWED_USER_ID missing in .env")
            return
        
        self.running = True
        asyncio.create_task(self._monitor_loop())
        log.info("sentinel.started")

    def stop(self) -> None:
        self.running = False
        log.info("sentinel.stopped")

    async def _monitor_loop(self) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            # Send boot-up confirmation alert
            await self._send_alert(client, "🟢 **MARIANO Sentinel Online.** Monitoring system logs and hardware metrics...")
            
            while self.running:
                try:
                    await self._check_metrics(client)
                except Exception as exc:
                    log.error("sentinel.check_failed", error=str(exc))
                
                await asyncio.sleep(15)  # Scan every 15 seconds

    async def _check_metrics(self, client: httpx.AsyncClient) -> None:
        # 1. CPU Check
        cpu = psutil.cpu_percent(interval=None)
        if cpu >= self.cpu_threshold:
            self.cpu_high_count += 1
            if self.cpu_high_count == 3:  # Alert if sustained high usage
                await self._send_alert(
                    client,
                    f"⚠️ **Sustained High CPU usage detected:** `{cpu:.1f}%`.\n"
                    f"Cores: {psutil.cpu_count()} | Freq: {psutil.cpu_freq().current:.0f} MHz"
                )
        else:
            self.cpu_high_count = 0

        # 2. RAM Check
        ram = psutil.virtual_memory()
        if ram.percent >= self.ram_threshold:
            self.ram_high_count += 1
            if self.ram_high_count == 3:
                # Find top RAM consuming processes
                procs = sorted(
                    psutil.process_iter(["pid", "name", "memory_percent"]),
                    key=lambda p: p.info["memory_percent"] or 0,
                    reverse=True
                )[:3]
                proc_lines = "\n".join(f"• `{p.info['name']}` (PID:{p.info['pid']}) - {p.info['memory_percent']:.1f}% RAM" for p in procs)
                await self._send_alert(
                    client,
                    f"🚨 **High RAM Usage Alert:** `{ram.percent:.1f}%` used.\n"
                    f"Free RAM: {ram.available // 1024**2} MB\n"
                    f"Top Consuming Processes:\n{proc_lines}"
                )
        else:
            self.ram_high_count = 0

        # 3. Battery Check
        bat = psutil.sensors_battery()
        if bat:
            if bat.percent <= self.battery_threshold and not bat.power_plugged:
                if not self.battery_low_alerted:
                    await self._send_alert(
                        client,
                        f"🔋 **Critical Battery Warning:** `{bat.percent:.0f}%` remaining.\n"
                        f"Status: Discharging. Please connect a power source."
                    )
                    self.battery_low_alerted = True
            else:
                self.battery_low_alerted = False

    async def _send_alert(self, client: httpx.AsyncClient, text: str) -> None:
        url = f"https://api.telegram.org/bot{self.token}/sendMessage"
        try:
            await client.post(url, json={
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": "Markdown",
            })
            log.info("sentinel.alert_sent", text=text[:30])
        except Exception as exc:
            log.error("sentinel.alert_failed", error=str(exc))
