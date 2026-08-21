"""MARIANO Core Skill — Web Scraper with 7-layer WAF bypass & fallback chain."""
from __future__ import annotations

import asyncio
import re
import urllib.parse
from typing import Any
import httpx
from mariano.skills._base import BaseSkill, SkillResult
from mariano.core.anonymizer import NetworkAnonymizer
import structlog

log = structlog.get_logger(__name__)

# --------------------------------------------------------------------------- #
#  Rotating browser fingerprint pools
# --------------------------------------------------------------------------- #
_ULTRA_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
]

_REFERERS = [
    "https://www.google.com/",
    "https://www.bing.com/",
    "https://duckduckgo.com/",
    "https://t.co/",
    "https://www.reddit.com/",
]

import random


def _make_headers(agent_override: str | None = None) -> dict[str, str]:
    return {
        "User-Agent": agent_override or random.choice(_ULTRA_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": random.choice(_REFERERS),
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Upgrade-Insecure-Requests": "1",
        "DNT": "1",
    }


class WebScraperSkill(BaseSkill):
    name = "web_scrape"
    description = (
        "Read the full content of any webpage URL. Uses a 7-layer WAF-bypass and "
        "fallback chain (direct, Wayback Machine, Google Cache, 12ft.io proxy, "
        "Bing cache, PDF text extract) — never gives up on a blocked page."
    )
    version = "2.0.0"
    tags = ["web", "scrape", "read", "content", "bypass", "waf", "wayback"]

    def get_parameters_schema(self) -> dict:
        return {
            "url": {"type": "string", "description": "Full URL to scrape", "required": True},
            "max_chars": {"type": "integer", "description": "Max characters to return (default 12000)", "default": 12000},
        }

    # ---------------------------------------------------------------------- #
    #  Public entry point
    # ---------------------------------------------------------------------- #
    async def execute(self, url: str, max_chars: int = 12000) -> SkillResult:
        url = url.strip()
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        strategies = [
            ("direct_rotating_ua",  self._try_direct),
            ("wayback_machine",     self._try_wayback),
            ("google_cache",        self._try_google_cache),
            ("12ft_proxy",         self._try_12ft),
            ("bing_cache",          self._try_bing_cache),
            ("googlebot_spoof",     self._try_googlebot),
            ("pdf_binary_fallback", self._try_pdf),
        ]

        last_errors: list[str] = []

        async with httpx.AsyncClient(
            timeout=25,
            follow_redirects=True,
            verify=False,          # some sites have bad certs
        ) as client:
            for name, fn in strategies:
                try:
                    text = await fn(client, url)
                    if text and len(text.strip()) > 80:
                        clean = self._clean(text)[:max_chars]
                        return SkillResult(
                            success=True,
                            data=clean,
                            metadata={
                                "url": url,
                                "strategy": name,
                                "chars": len(clean),
                                "attempts_before_success": len(last_errors),
                            },
                        )
                    else:
                        last_errors.append(f"{name}: empty/too-short response")
                except Exception as exc:
                    last_errors.append(f"{name}: {type(exc).__name__}: {exc}")
                    log.warning("web_scraper.strategy_failed", strategy=name, url=url, error=str(exc))
                await asyncio.sleep(0.6)   # polite inter-attempt delay

        return SkillResult(
            success=False,
            data=None,
            error=(
                f"All 7 bypass strategies failed for: {url}\n"
                + "\n".join(f"  • {e}" for e in last_errors)
            ),
        )

    # ---------------------------------------------------------------------- #
    #  Strategy 1 — Direct with 3 rotating UA fingerprints
    # ---------------------------------------------------------------------- #
    async def _try_direct(self, client: httpx.AsyncClient, url: str) -> str:
        for agent in random.sample(_ULTRA_AGENTS[:6], 3):
            try:
                resp = await client.get(url, headers=_make_headers(agent))
                if resp.status_code < 400:
                    return resp.text
            except Exception:
                pass
            await asyncio.sleep(0.4)
        raise RuntimeError("All direct UA attempts failed")

    # ---------------------------------------------------------------------- #
    #  Strategy 2 — Wayback Machine (latest snapshot via CDX API)
    # ---------------------------------------------------------------------- #
    async def _try_wayback(self, client: httpx.AsyncClient, url: str) -> str:
        enc = urllib.parse.quote_plus(url)
        cdx = f"https://archive.org/wayback/available?url={enc}"
        r = await client.get(cdx, headers=_make_headers())
        if r.status_code == 200:
            snap = r.json().get("archived_snapshots", {}).get("closest", {})
            wb_url = snap.get("url", "")
            if wb_url:
                r2 = await client.get(wb_url, headers=_make_headers())
                if r2.status_code < 400:
                    return r2.text
        raise RuntimeError("Wayback snapshot unavailable")

    # ---------------------------------------------------------------------- #
    #  Strategy 3 — Google Cache (works for many indexed pages)
    # ---------------------------------------------------------------------- #
    async def _try_google_cache(self, client: httpx.AsyncClient, url: str) -> str:
        cache_url = f"https://webcache.googleusercontent.com/search?q=cache:{urllib.parse.quote_plus(url)}"
        r = await client.get(cache_url, headers=_make_headers())
        if r.status_code < 400 and len(r.text) > 200:
            return r.text
        raise RuntimeError(f"Google cache returned {r.status_code}")

    # ---------------------------------------------------------------------- #
    #  Strategy 4 — 12ft.io Proxy (bypasses paywalls and many WAFs)
    # ---------------------------------------------------------------------- #
    async def _try_12ft(self, client: httpx.AsyncClient, url: str) -> str:
        proxy_url = f"https://12ft.io/proxy?q={urllib.parse.quote_plus(url)}"
        r = await client.get(proxy_url, headers=_make_headers())
        if r.status_code < 400 and len(r.text) > 200:
            return r.text
        raise RuntimeError(f"12ft.io returned {r.status_code}")

    # ---------------------------------------------------------------------- #
    #  Strategy 5 — Bing Cache
    # ---------------------------------------------------------------------- #
    async def _try_bing_cache(self, client: httpx.AsyncClient, url: str) -> str:
        # Bing cache redirect via search snippet
        q = urllib.parse.quote_plus(f"site:{url}")
        bing_url = f"https://www.bing.com/search?q={q}&format=json"
        r = await client.get(bing_url, headers=_make_headers())
        if r.status_code < 400 and len(r.text) > 500:
            return r.text
        raise RuntimeError(f"Bing cache returned {r.status_code}")

    # ---------------------------------------------------------------------- #
    #  Strategy 6 — Googlebot UA spoof (bypasses many bot-detection guards)
    # ---------------------------------------------------------------------- #
    async def _try_googlebot(self, client: httpx.AsyncClient, url: str) -> str:
        googlebot_headers = {
            "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
        r = await client.get(url, headers=googlebot_headers)
        if r.status_code < 400 and len(r.text) > 200:
            return r.text
        raise RuntimeError(f"Googlebot spoof returned {r.status_code}")

    # ---------------------------------------------------------------------- #
    #  Strategy 7 — Binary PDF fetch + text extraction (no pdfplumber needed)
    # ---------------------------------------------------------------------- #
    async def _try_pdf(self, client: httpx.AsyncClient, url: str) -> str:
        if not url.lower().endswith(".pdf"):
            raise RuntimeError("Not a PDF URL, skipping binary fetch")
        r = await client.get(url, headers=_make_headers())
        if r.status_code < 400:
            # Lightweight regex extraction of readable text from PDF binary
            raw = r.content.decode("latin-1", errors="ignore")
            chunks = re.findall(r"\(([^\)]{4,200})\)", raw)
            readable = " ".join(
                c for c in chunks
                if sum(32 <= ord(ch) <= 126 for ch in c) / max(len(c), 1) > 0.8
            )
            if len(readable) > 80:
                return readable
        raise RuntimeError(f"PDF binary fetch returned {r.status_code}")

    # ---------------------------------------------------------------------- #
    #  HTML → clean text converter
    # ---------------------------------------------------------------------- #
    def _clean(self, html: str) -> str:
        html = re.sub(r"<head[^>]*>.*?</head>", "", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"<h[1-6][^>]*>(.*?)</h[1-6]>", r"\n\n# \1\n", html, flags=re.IGNORECASE)
        html = re.sub(r"<p[^>]*>(.*?)</p>", r"\n\n\1\n", html, flags=re.IGNORECASE)
        html = re.sub(r"<li[^>]*>(.*?)</li>", r"\n* \1", html, flags=re.IGNORECASE)
        html = re.sub(r'<a[^>]*href=["\'](.*?)["\'][^>]*>(.*?)</a>', r" [\2](\1) ", html, flags=re.IGNORECASE)
        html = re.sub(r"<tr[^>]*>", r"\n| ", html, flags=re.IGNORECASE)
        html = re.sub(r"<td[^>]*>(.*?)</td>", r"\1 | ", html, flags=re.IGNORECASE)
        html = re.sub(r"<[^>]+>", " ", html)
        html = re.sub(r"&nbsp;", " ", html, flags=re.IGNORECASE)
        html = re.sub(r"&lt;", "<", html, flags=re.IGNORECASE)
        html = re.sub(r"&gt;", ">", html, flags=re.IGNORECASE)
        html = re.sub(r"&amp;", "&", html, flags=re.IGNORECASE)
        html = re.sub(r"&#\d+;", " ", html)
        html = re.sub(r"[ \t]+", " ", html)
        html = re.sub(r"\n\s*\n", "\n\n", html)
        return html.strip()
