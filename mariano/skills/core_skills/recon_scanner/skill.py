"""Hekki Core Skill — Super-Intelligent Subdomain Reconnaissance & Attack Surface Engine."""
from __future__ import annotations

import asyncio
import re
from typing import Any
import httpx

from mariano.skills._base import BaseSkill, SkillResult
from mariano.core.anonymizer import NetworkAnonymizer

SUPER_WORDLIST = [
    # Core Infrastructure
    "mail", "docs", "drive", "calendar", "photos", "maps", "translate",
    "news", "play", "plus", "sites", "groups", "blogger", "ads",
    "analytics", "search", "console", "cloud", "api", "status",
    # Dev & Staging Environments
    "dev", "test", "stage", "staging", "beta", "sandbox", "demo", "lab",
    # Administrative & Management
    "admin", "portal", "vpn", "auth", "login", "sso", "manage", "dashboard",
    "grafana", "jenkins", "k8s", "gitlab", "jira", "vault", "monitor",
    # Backend & API Gateways
    "app", "mobile", "secure", "db", "internal", "gateway", "v1", "v2"
]

BOUNDARY_PATHS = [
    "/.env",
    "/.git/HEAD",
    "/robots.txt",
    "/sitemap.xml",
    "/api-docs",
    "/swagger-ui.html",
    "/openapi.json",
    "/actuator/health",
    "/.well-known/security.txt"
]

PROBE_PORTS = [80, 443, 8000, 8080, 8443, 3000, 5000, 9000]


class ReconScannerSkill(BaseSkill):
    name = "recon_scanner"
    description = (
        "Super-intelligent reconnaissance engine for multi-stage subdomain discovery, "
        "sensitive boundary path probing, WAF/CDN detection, and risk scoring."
    )
    version = "3.0.0"
    tags = ["recon", "security", "subdomain", "boundary", "super-intelligence", "attack-surface"]

    def get_parameters_schema(self) -> dict:
        return {
            "target_domain": {
                "type": "string",
                "description": "Target domain to scan (e.g. 'google.com' or 'example.com')",
                "required": True,
            },
            "deep_boundary_scan": {
                "type": "boolean",
                "description": "Probe sensitive boundary paths (/.env, /.git/HEAD, swagger, etc.)",
                "default": True,
            },
            "timeout_sec": {
                "type": "number",
                "description": "Timeout per target endpoint in seconds",
                "default": 3.5,
            },
            "max_concurrency": {
                "type": "integer",
                "description": "Maximum concurrent async workers",
                "default": 15,
            },
        }

    async def execute(
        self,
        target_domain: str,
        deep_boundary_scan: bool = True,
        timeout_sec: float = 3.5,
        max_concurrency: int = 15,
    ) -> SkillResult:
        try:
            domain_clean = target_domain.strip().lower()
            domain_clean = re.sub(r"^https?://", "", domain_clean).rstrip("/")

            headers = NetworkAnonymizer.get_headers()
            semaphore = asyncio.Semaphore(max_concurrency)
            subdomain_results: list[dict[str, Any]] = []

            async with httpx.AsyncClient(
                timeout=timeout_sec,
                follow_redirects=True,
                headers=headers,
                verify=False,
            ) as client:
                # Stage 1: Subdomain Resolution
                tasks = [
                    self._probe_subdomain(client, sub, domain_clean, semaphore)
                    for sub in SUPER_WORDLIST
                ]
                probed = await asyncio.gather(*tasks, return_exceptions=True)

                for r in probed:
                    if isinstance(r, dict):
                        subdomain_results.append(r)

                active_subdomains = [r for r in subdomain_results if r["status_code"] > 0]

                # Stage 2: Deep Boundary Path Probing (on active endpoints)
                boundary_exposures: list[dict[str, Any]] = []
                if deep_boundary_scan and active_subdomains:
                    probe_targets = active_subdomains[:5] # Probe top 5 active targets
                    boundary_tasks = []
                    for target in probe_targets:
                        for path in BOUNDARY_PATHS:
                            boundary_tasks.append(
                                self._probe_boundary_path(client, target["url"], path, semaphore)
                            )
                    exposed = await asyncio.gather(*boundary_tasks, return_exceptions=True)
                    for exp in exposed:
                        if isinstance(exp, dict) and exp.get("exposed"):
                            boundary_exposures.append(exp)

            # Stage 3: Risk Assessment & WAF Footprinting
            risk_summary = self._assess_attack_surface_risk(active_subdomains, boundary_exposures)
            report_md = self._format_markdown_report(
                domain=domain_clean,
                subdomains=subdomain_results,
                exposures=boundary_exposures,
                risk=risk_summary,
            )

            return SkillResult(
                success=True,
                data=report_md,
                metadata={
                    "target_domain": domain_clean,
                    "total_probed": len(SUPER_WORDLIST),
                    "active_endpoints": len(active_subdomains),
                    "boundary_exposures_found": len(boundary_exposures),
                    "risk_score": risk_summary["risk_score"],
                    "risk_level": risk_summary["risk_level"],
                    "endpoints": subdomain_results,
                    "exposures": boundary_exposures,
                },
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Super recon execution failed: {str(exc)}")

    async def _probe_subdomain(
        self,
        client: httpx.AsyncClient,
        sub: str,
        base_domain: str,
        semaphore: asyncio.Semaphore,
    ) -> dict[str, Any]:
        async with semaphore:
            full_domain = f"{sub}.{base_domain}"
            url = f"https://{full_domain}"
            try:
                resp = await client.get(url)
                title = self._extract_title(resp.text)
                server = resp.headers.get("Server", "Unknown")
                waf = self._detect_waf_cdn(resp.headers)
                return {
                    "subdomain": full_domain,
                    "url": str(resp.url),
                    "status_code": resp.status_code,
                    "status": f"{resp.status_code} {resp.reason_phrase or ''}".strip(),
                    "server": server,
                    "waf_cdn": waf,
                    "title": title,
                }
            except Exception:
                try:
                    url_http = f"http://{full_domain}"
                    resp = await client.get(url_http)
                    title = self._extract_title(resp.text)
                    server = resp.headers.get("Server", "Unknown")
                    waf = self._detect_waf_cdn(resp.headers)
                    return {
                        "subdomain": full_domain,
                        "url": str(resp.url),
                        "status_code": resp.status_code,
                        "status": f"{resp.status_code} {resp.reason_phrase or ''}".strip(),
                        "server": server,
                        "waf_cdn": waf,
                        "title": title,
                    }
                except Exception:
                    return {
                        "subdomain": full_domain,
                        "url": url,
                        "status_code": 0,
                        "status": "Down",
                        "server": "N/A",
                        "waf_cdn": "None",
                        "title": "Unreachable",
                    }

    async def _probe_boundary_path(
        self,
        client: httpx.AsyncClient,
        base_url: str,
        path: str,
        semaphore: asyncio.Semaphore,
    ) -> dict[str, Any]:
        async with semaphore:
            target_url = f"{base_url.rstrip('/')}{path}"
            try:
                resp = await client.get(target_url)
                exposed = resp.status_code in (200, 301, 302, 401, 403)
                severity = "CRITICAL" if path in ("/.env", "/.git/HEAD") and resp.status_code == 200 else "MEDIUM"
                return {
                    "path": path,
                    "full_url": target_url,
                    "status_code": resp.status_code,
                    "exposed": exposed,
                    "severity": severity if exposed else "LOW",
                }
            except Exception:
                return {"path": path, "full_url": target_url, "status_code": 0, "exposed": False, "severity": "NONE"}

    def _detect_waf_cdn(self, headers: httpx.Headers) -> str:
        h_str = " ".join([f"{k}:{v}" for k, v in headers.items()]).lower()
        if "cloudflare" in h_str or "cf-ray" in h_str:
            return "Cloudflare WAF/CDN"
        elif "cloudfront" in h_str or "x-amz-cf-id" in h_str:
            return "AWS CloudFront"
        elif "akamai" in h_str or "akamaighost" in h_str:
            return "Akamai CDN"
        elif "fastly" in h_str:
            return "Fastly CDN"
        elif "nginx" in h_str:
            return "Nginx Reverse Proxy"
        return "Direct / Unknown"

    def _extract_title(self, html: str) -> str:
        match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip()[:50]
        return "No Title"

    def _assess_attack_surface_risk(self, active: list[dict], exposures: list[dict]) -> dict[str, Any]:
        crit_exposures = [e for e in exposures if e.get("severity") == "CRITICAL"]
        med_exposures = [e for e in exposures if e.get("severity") == "MEDIUM"]

        score = 100 - (len(crit_exposures) * 40 + len(med_exposures) * 15 + len(active) * 2)
        score = max(0, min(100, score))

        if score >= 85:
            level = "SAFE (Low Risk)"
        elif score >= 65:
            level = "MODERATE (Notice Required)"
        elif score >= 40:
            level = "HIGH (Action Required)"
        else:
            level = "CRITICAL (Immediate Remediation Needed)"

        return {"risk_score": score, "risk_level": level, "critical_count": len(crit_exposures)}

    def _format_markdown_report(self, domain: str, subdomains: list[dict], exposures: list[dict], risk: dict) -> str:
        active = [r for r in subdomains if r["status_code"] > 0]
        report = [
            f"# ⚡ Super-Intelligent Attack Surface Recon: `{domain}`",
            f"**Security Risk Level:** `{risk['risk_level']}` | **Risk Score:** `{risk['risk_score']}/100`",
            f"**Total Probed:** {len(subdomains)} | **Active Endpoints:** {len(active)} | **Exposures:** {len(exposures)}",
            "",
            "### 🌐 Discovered Active Endpoints & CDN/WAF Footprint",
            "| Subdomain | HTTP Status | WAF / Proxy | Page Title |",
            "| :--- | :---: | :--- | :--- |",
        ]

        if active:
            for r in active:
                t = r['title'].replace("|", "\\|")
                report.append(f"| `{r['subdomain']}` | `{r['status']}` | {r['waf_cdn']} | {t} |")
        else:
            report.append("| None | - | - | - |")

        if exposures:
            report.extend([
                "",
                "### 🚨 Sensitive Boundary Exposures & Probes",
                "| Exposed Path | Severity | Target URL | HTTP Status |",
                "| :--- | :---: | :--- | :---: |",
            ])
            for exp in exposures:
                report.append(f"| `{exp['path']}` | **{exp['severity']}** | `{exp['full_url']}` | `{exp['status_code']}` |")

        report.extend([
            "",
            "---",
            "*Super-Intelligent Reconnaissance completed with non-destructive, high-speed async workers.*",
        ])

        return "\n".join(report)
