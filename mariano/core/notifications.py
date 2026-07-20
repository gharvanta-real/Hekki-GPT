"""MARIANO Core — System Notification Center & Alert Registry."""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

import httpx
import structlog

log = structlog.get_logger(__name__)


@dataclass
class Notification:
    title: str
    message: str
    severity: str  # "info" | "warning" | "critical"
    timestamp: str = ""

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.now().strftime("%H:%M:%S")


class NotificationCenter:
    """Central notification center to cache, display, and push alert signals."""

    _instance: Optional[NotificationCenter] = None

    def __init__(self) -> None:
        self.notifications: List[Notification] = []
        self.max_notifications = 20
        self.token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        allowed_id = os.getenv("TELEGRAM_ALLOWED_USER_ID", "")
        self.chat_id = int(allowed_id) if allowed_id.isdigit() else None

    @classmethod
    def get_instance(cls) -> NotificationCenter:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def push_notification(self, title: str, message: str, severity: str = "info") -> None:
        """Pushes a new notification to registry. If critical/warning, sends a Telegram alert."""
        notif = Notification(title=title, message=message, severity=severity)
        self.notifications.append(notif)
        
        # Maintain cache size
        if len(self.notifications) > self.max_notifications:
            self.notifications.pop(0)

        log.info("notification.pushed", title=title, severity=severity)

        # Trigger Telegram alert for critical/warning events
        if severity in ("warning", "critical") and self.token and self.chat_id:
            import asyncio
            asyncio.create_task(self._send_telegram_alert(notif))

    def get_all(self) -> List[Notification]:
        return self.notifications

    def get_latest(self) -> Optional[Notification]:
        return self.notifications[-1] if self.notifications else None

    def clear(self) -> None:
        self.notifications.clear()

    async def _send_telegram_alert(self, notif: Notification) -> None:
        icon = "⚠️" if notif.severity == "warning" else "🚨"
        msg = f"{icon} **[{notif.title.upper()}]**\n{notif.message}"
        url = f"https://api.telegram.org/bot{self.token}/sendMessage"
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(url, json={
                    "chat_id": self.chat_id,
                    "text": msg,
                    "parse_mode": "Markdown",
                })
        except Exception as e:
            log.error("notification.telegram_push_failed", error=str(e))
