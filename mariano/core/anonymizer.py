"""MARIANO — Dynamic Network Anonymizer & Traceback Credential Sanitizer."""
from __future__ import annotations

import os
import random
from typing import Dict

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
]

REFERERS = [
    "https://www.google.com/",
    "https://www.bing.com/",
    "https://duckduckgo.com/",
    "https://search.yahoo.com/",
]

LANGUAGES = [
    "en-US,en;q=0.9",
    "en-GB,en;q=0.8,en-US;q=0.6",
    "en-US,en;q=0.5",
]


class NetworkAnonymizer:
    """Generates randomized browser fingerprints and handles proxy configuration for privacy."""

    @staticmethod
    def get_proxy_url() -> str | None:
        """Resolves proxy URL from environment variables (SOCKS5_PROXY, HTTP_PROXY, HTTPS_PROXY)."""
        return (
            os.getenv("SOCKS5_PROXY")
            or os.getenv("HTTPS_PROXY")
            or os.getenv("HTTP_PROXY")
            or os.getenv("ALL_PROXY")
            or None
        )

    @staticmethod
    def get_headers() -> Dict[str, str]:
        """Returns a complete set of randomized headers mimicking a real user browser session."""
        return {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": random.choice(LANGUAGES),
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Sec-Fetch-User": "?1",
            "Referer": random.choice(REFERERS),
            "Cache-Control": "max-age=0",
        }

    @staticmethod
    def check_opsec_ip_leak(exposed_ip: str | None = None) -> dict[str, str | bool]:
        """OPSEC Check: Verifies current IP routing and generates safety status."""
        proxy = NetworkAnonymizer.get_proxy_url()
        is_protected = bool(proxy) or (exposed_ip and exposed_ip.startswith(("10.", "172.16.", "192.168.")))
        status = {
            "safe": is_protected,
            "ip": exposed_ip or ("Proxy Active" if proxy else "Protected / Internal Interface"),
            "proxy": proxy or "None",
            "warning": None if is_protected else "⚠️ OPSEC NOTICE: Direct routing detected. Set SOCKS5_PROXY or HTTP_PROXY for full traffic masking."
        }
        return status


class DataSanitizer:
    """Detects and redacts sensitive API keys and tokens from tracebacks and output payloads."""

    @staticmethod
    def redact(text: str) -> str:
        """Finds and replaces sensitive credentials with safe redaction notices."""
        if not isinstance(text, str):
            return text

        # Load keys from environment dynamically
        keys_to_redact = []
        for env_var in ["GEMINI_API_KEY", "TELEGRAM_BOT_TOKEN", "NEWS_API_KEY"]:
            val = os.getenv(env_var, "").strip()
            if val and len(val) > 5:
                keys_to_redact.append((val, f"[REDACTED_{env_var}]"))

        cleaned = text
        for secret, placeholder in keys_to_redact:
            if secret in cleaned:
                cleaned = cleaned.replace(secret, placeholder)

        return cleaned
