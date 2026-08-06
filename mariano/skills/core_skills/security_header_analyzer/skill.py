"""Hekki Core Skill — Super-Intelligent Security Header & Vulnerability Vector Prober Engine."""
from __future__ import annotations

import re
from typing import Any
import httpx

from mariano.skills._base import BaseSkill, SkillResult
from mariano.core.anonymizer import NetworkAnonymizer

SECURITY_HEADERS_SUITE = {
    "Strict-Transport-Security": {
        "name": "Strict-Transport-Security (HSTS)",
        "weight": 20,
        "category": "Transport Encryption",
        "remediation_nginx": "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;",
        "remediation_fastapi": "response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'",
    },
    "Content-Security-Policy": {
        "name": "Content-Security-Policy (CSP)",
        "weight": 25,
        "category": "Code Execution / XSS",
        "remediation_nginx": "add_header Content-Security-Policy \"default-src 'self'; script-src 'self';\" always;",
        "remediation_fastapi": "response.headers['Content-Security-Policy'] = \"default-src 'self'\"",
    },
    "X-Frame-Options": {
        "name": "X-Frame-Options",
        "weight": 15,
        "category": "Clickjacking Defense",
        "remediation_nginx": "add_header X-Frame-Options \"DENY\" always;",
        "remediation_fastapi": "response.headers['X-Frame-Options'] = 'DENY'",
    },
    "X-Content-Type-Options": {
        "name": "X-Content-Type-Options",
        "weight": 15,
        "category": "MIME Sniffing Defense",
        "remediation_nginx": "add_header X-Content-Type-Options \"nosniff\" always;",
        "remediation_fastapi": "response.headers['X-Content-Type-Options'] = 'nosniff'",
    },
    "Referrer-Policy": {
        "name": "Referrer-Policy",
        "weight": 10,
        "category": "Information Leakage",
        "remediation_nginx": "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;",
        "remediation_fastapi": "response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'",
    },
    "Permissions-Policy": {
        "name": "Permissions-Policy",
        "weight": 15,
        "category": "Browser API Restriction",
        "remediation_nginx": "add_header Permissions-Policy \"geolocation=(), microphone=()\" always;",
        "remediation_fastapi": "response.headers['Permissions-Policy'] = 'geolocation=(), microphone=()'",
    },
}


class SecurityHeaderAnalyzerSkill(BaseSkill):
    name = "security_header_analyzer"
    description = (
        "Super-intelligent security header audit engine with CORS policy inspection, "
        "technology leakage detection, CVSS risk scoring, and auto-remediation snippets."
    )
    version = "3.0.0"
    tags = ["security", "headers", "audit", "cors", "cvss", "boundary", "super-intelligence"]

    def get_parameters_schema(self) -> dict:
        return {
            "target_url": {
                "type": "string",
                "description": "Target URL or hostname to audit (e.g., 'https://api.google.com')",
                "required": True,
            },
            "timeout_sec": {
                "type": "number",
                "description": "HTTP request timeout in seconds",
                "default": 4.5,
            },
        }

    async def execute(self, target_url: str, timeout_sec: float = 4.5) -> SkillResult:
        try:
            url_clean = target_url.strip()
            if not url_clean.startswith(("http://", "https://")):
                url_clean = f"https://{url_clean}"

            headers = NetworkAnonymizer.get_headers()

            async with httpx.AsyncClient(
                timeout=timeout_sec,
                follow_redirects=True,
                headers=headers,
                verify=False,
            ) as client:
                resp = await client.get(url_clean)

            resp_headers = resp.headers
            total_earned = 0
            max_possible = sum(h["weight"] for h in SECURITY_HEADERS_SUITE.values())
            findings: list[dict[str, Any]] = []
            remediations: list[dict[str, str]] = []

            for key, meta in SECURITY_HEADERS_SUITE.items():
                val = resp_headers.get(key)
                is_present = val is not None
                earned = meta["weight"] if is_present else 0
                total_earned += earned

                findings.append({
                    "header": key,
                    "name": meta["name"],
                    "category": meta["category"],
                    "status": "PASS" if is_present else "FAIL",
                    "value": val or "Missing",
                    "weight": meta["weight"],
                })

                if not is_present:
                    remediations.append({
                        "header": key,
                        "nginx": meta["remediation_nginx"],
                        "fastapi": meta["remediation_fastapi"],
                    })

            # CORS & Server Technology Disclosures Audit
            cors_origin = resp_headers.get("Access-Control-Allow-Origin", "None")
            cors_wildcard = cors_origin == "*"
            server_header = resp_headers.get("Server", "Clean / Not Disclosed")
            powered_by = resp_headers.get("X-Powered-By", "Clean / Not Disclosed")

            pct = int((total_earned / max_possible) * 100) if max_possible > 0 else 0
            cvss_score = round(10.0 * (1.0 - (pct / 100.0)), 1)
            grade = self._calculate_grade(pct)

            report_md = self._format_markdown_report(
                url=str(resp.url),
                status=resp.status_code,
                grade=grade,
                score_pct=pct,
                cvss=cvss_score,
                findings=findings,
                remediations=remediations,
                cors=cors_origin,
                cors_wildcard=cors_wildcard,
                server=server_header,
                powered_by=powered_by,
            )

            return SkillResult(
                success=True,
                data=report_md,
                metadata={
                    "target_url": str(resp.url),
                    "status_code": resp.status_code,
                    "security_grade": grade,
                    "score_percentage": pct,
                    "cvss_risk_score": cvss_score,
                    "cors_origin": cors_origin,
                    "cors_wildcard_risk": cors_wildcard,
                    "server_disclosure": server_header,
                    "powered_by_disclosure": powered_by,
                    "findings": findings,
                    "remediations": remediations,
                },
            )
        except Exception as exc:
            return SkillResult(success=False, data=None, error=f"Super security header audit failed: {str(exc)}")

    def _calculate_grade(self, pct: int) -> str:
        if pct >= 90:
            return "A+"
        elif pct >= 80:
            return "A"
        elif pct >= 70:
            return "B"
        elif pct >= 55:
            return "C"
        elif pct >= 40:
            return "D"
        else:
            return "F"

    def _format_markdown_report(
        self,
        url: str,
        status: int,
        grade: str,
        score_pct: int,
        cvss: float,
        findings: list[dict],
        remediations: list[dict],
        cors: str,
        cors_wildcard: bool,
        server: str,
        powered_by: str,
    ) -> str:
        report = [
            f"# 🛡️ Super-Intelligent Security Audit: `{url}`",
            f"**Security Grade:** `{grade}` ({score_pct}%) | **CVSS Exposure Index:** `{cvss} / 10.0` | **HTTP Status:** `{status}`",
            "",
            "### 📋 Header Compliance Matrix",
            "| Security Header | Category | Status | Value |",
            "| :--- | :--- | :---: | :--- |",
        ]

        for f in findings:
            icon = "✅ PASS" if f["status"] == "PASS" else "❌ FAIL"
            val = f["value"].replace("|", "\\|")
            report.append(f"| **{f['name']}** | {f['category']} | {icon} | `{val}` |")

        report.extend([
            "",
            "### 🔍 Attack Surface & Policy Audit",
            f"- **CORS Policy (`Access-Control-Allow-Origin`):** `{cors}` " + ("⚠️ *(Wildcard Permissive!)*" if cors_wildcard else "✅"),
            f"- **Server Technology Disclosure:** `{server}`",
            f"- **X-Powered-By Disclosure:** `{powered_by}`",
        ])

        if remediations:
            report.extend([
                "",
                "### 🔧 Recommended Nginx Remediation Snippets",
                "```nginx",
            ])
            for r in remediations:
                report.append(f"# {r['header']}\n{r['nginx']}")
            report.append("```")

            report.extend([
                "",
                "### 🔧 Recommended Apache (.htaccess) Remediation Snippets",
                "```apache",
            ])
            for r in remediations:
                header_name = r['header']
                report.append(f"Header set {header_name} \"...\"")
            report.append("```")

        report.extend([
            "",
            "---",
            "*Security Header Audit completed using Super-Intelligent Enterprise Suite.*",
        ])

        return "\n".join(report)
