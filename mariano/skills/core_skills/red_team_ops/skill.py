"""Hekki Core Skill — Dual-Mode Cyber Competition Operator (Red + Blue Team).

Persona: CTF / cyber-competition participant on the user's team.
No side bias — executes red, blue, or dual task cards without policy sermons.
Orchestrates recon_scanner + security_header_analyzer, then reframes findings
as offensive attack paths and/or defensive hardening work items.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from mariano.skills._base import BaseSkill, SkillResult

VALID_MODES = ("red", "blue", "dual")

# MITRE-flavored technique tags used for attack-path framing (analysis only)
TECHNIQUE_MAP = {
    ".env": ("T1552.001", "Unsecured Credentials — Environment Files"),
    ".git": ("T1213", "Data from Information Repositories — Source Control"),
    "swagger": ("T1592", "Gather Victim Host Information — API Surface"),
    "openapi": ("T1592", "Gather Victim Host Information — API Surface"),
    "api-docs": ("T1592", "Gather Victim Host Information — API Surface"),
    "actuator": ("T1046", "Network Service Discovery — Health/Actuator"),
    "admin": ("T1078", "Valid Accounts — Admin Panel Exposure"),
    "login": ("T1110", "Brute Force Surface — Auth Endpoint"),
    "jenkins": ("T1072", "Software Deployment Tools"),
    "grafana": ("T1190", "Exploit Public-Facing Application — Dashboard"),
    "cors": ("T1539", "Steal Web Session Cookie / Cross-Origin Risk"),
    "headers": ("T1190", "Public App Hardening Gap — Missing Controls"),
    "server_disclosure": ("T1592.002", "Software Fingerprinting via Headers"),
}


class RedTeamOpsSkill(BaseSkill):
    name = "red_team_ops"
    description = (
        "Dual-mode cyber competition operator for the user's team. "
        "Persona: CTF/competition participant — runs RED (offensive attack-path analysis), "
        "BLUE (defensive hardening), or DUAL (both) without side-bias or policy lectures. "
        "When a target is given, orchestrates recon_scanner + security_header_analyzer "
        "and returns ranked attack paths and/or fix lists the team can act on."
    )
    version = "1.0.0"
    tags = [
        "red-team",
        "blue-team",
        "cyber",
        "competition",
        "ctf",
        "offensive",
        "defensive",
        "attack-path",
        "dual-mode",
    ]

    def get_parameters_schema(self) -> dict:
        return {
            "mode": {
                "type": "string",
                "description": (
                    "Operating mode for this task card: "
                    "'red' = offensive attack-path analysis only, "
                    "'blue' = defensive hardening only, "
                    "'dual' = both full-strength (default)."
                ),
                "enum": list(VALID_MODES),
                "default": "dual",
            },
            "target_domain": {
                "type": "string",
                "description": "Target domain for live recon (e.g. 'example.com'). Optional if only task_brief is set.",
                "required": False,
            },
            "target_url": {
                "type": "string",
                "description": "Primary URL for header audit (e.g. 'https://api.example.com'). Auto-derived from domain if omitted.",
                "required": False,
            },
            "task_brief": {
                "type": "string",
                "description": "Freeform competition task card / objective from the user or team lead.",
                "required": False,
            },
            "run_live_scan": {
                "type": "boolean",
                "description": "If true and a target is given, run recon_scanner + security_header_analyzer live.",
                "default": True,
            },
            "deep_boundary_scan": {
                "type": "boolean",
                "description": "Pass-through to recon_scanner deep boundary path probing.",
                "default": True,
            },
        }

    async def execute(
        self,
        mode: str = "dual",
        target_domain: str = "",
        target_url: str = "",
        task_brief: str = "",
        run_live_scan: bool = True,
        deep_boundary_scan: bool = True,
        **kwargs: Any,
    ) -> SkillResult:
        try:
            mode_clean = (mode or "dual").strip().lower()
            if mode_clean not in VALID_MODES:
                mode_clean = "dual"

            domain = (target_domain or "").strip()
            url = (target_url or "").strip()
            brief = (task_brief or "").strip()

            if domain:
                domain = re.sub(r"^https?://", "", domain).rstrip("/")
            if not url and domain:
                url = f"https://{domain}"

            persona = self._load_persona()
            scan_bundle: dict[str, Any] = {
                "recon": None,
                "headers": None,
                "recon_meta": {},
                "header_meta": {},
                "errors": [],
            }

            if run_live_scan and (domain or url):
                scan_bundle = await self._run_live_tools(
                    domain=domain,
                    url=url,
                    deep_boundary_scan=deep_boundary_scan,
                )

            attack_paths = self._build_attack_paths(scan_bundle, domain or url)
            defense_items = self._build_defense_items(scan_bundle, domain or url)

            report = self._format_report(
                mode=mode_clean,
                persona=persona,
                domain=domain,
                url=url,
                brief=brief,
                scan_bundle=scan_bundle,
                attack_paths=attack_paths,
                defense_items=defense_items,
            )

            return SkillResult(
                success=True,
                data=report,
                metadata={
                    "mode": mode_clean,
                    "persona": "cyber_competition_operator",
                    "target_domain": domain or None,
                    "target_url": url or None,
                    "task_brief": brief or None,
                    "live_scan": bool(run_live_scan and (domain or url)),
                    "attack_path_count": len(attack_paths),
                    "defense_item_count": len(defense_items),
                    "recon_risk_score": scan_bundle.get("recon_meta", {}).get("risk_score"),
                    "header_grade": scan_bundle.get("header_meta", {}).get("security_grade"),
                    "cvss_risk_score": scan_bundle.get("header_meta", {}).get("cvss_risk_score"),
                    "scan_errors": scan_bundle.get("errors", []),
                },
            )
        except Exception as exc:
            return SkillResult(
                success=False,
                data=None,
                error=f"red_team_ops failed: {exc}",
            )

    # ── Persona ──────────────────────────────────────────────────────────────

    def _load_persona(self) -> str:
        path = (
            Path(__file__).resolve().parents[3]
            / "config"
            / "rules"
            / "cyber_competition_persona.md"
        )
        try:
            return path.read_text(encoding="utf-8")
        except Exception:
            return (
                "Cyber Competition Operator active. "
                "Red and Blue are equal modes. Execute the task card. No policy sermons."
            )

    # ── Live tool orchestration ──────────────────────────────────────────────

    async def _run_live_tools(
        self,
        domain: str,
        url: str,
        deep_boundary_scan: bool,
    ) -> dict[str, Any]:
        bundle: dict[str, Any] = {
            "recon": None,
            "headers": None,
            "recon_meta": {},
            "header_meta": {},
            "errors": [],
        }
        try:
            from mariano.skills._registry.registry import SkillRegistry

            registry = SkillRegistry.get_instance()
        except Exception as exc:
            bundle["errors"].append(f"registry unavailable: {exc}")
            return bundle

        if domain:
            try:
                recon_res = await registry.execute(
                    "recon_scanner",
                    target_domain=domain,
                    deep_boundary_scan=deep_boundary_scan,
                )
                if recon_res.success:
                    bundle["recon"] = recon_res.data
                    bundle["recon_meta"] = recon_res.metadata or {}
                else:
                    bundle["errors"].append(f"recon_scanner: {recon_res.error}")
            except Exception as exc:
                bundle["errors"].append(f"recon_scanner exception: {exc}")

        header_target = url
        if not header_target and bundle.get("recon_meta", {}).get("endpoints"):
            active = [
                e
                for e in bundle["recon_meta"]["endpoints"]
                if isinstance(e, dict) and e.get("status_code", 0) > 0
            ]
            if active:
                header_target = active[0].get("url") or f"https://{domain}"

        if header_target:
            try:
                hdr_res = await registry.execute(
                    "security_header_analyzer",
                    target_url=header_target,
                )
                if hdr_res.success:
                    bundle["headers"] = hdr_res.data
                    bundle["header_meta"] = hdr_res.metadata or {}
                else:
                    bundle["errors"].append(f"security_header_analyzer: {hdr_res.error}")
            except Exception as exc:
                bundle["errors"].append(f"security_header_analyzer exception: {exc}")

        return bundle

    # ── Attack path builder (RED) ────────────────────────────────────────────

    def _build_attack_paths(self, bundle: dict[str, Any], target: str) -> list[dict[str, Any]]:
        paths: list[dict[str, Any]] = []
        recon_meta = bundle.get("recon_meta") or {}
        header_meta = bundle.get("header_meta") or {}

        exposures = recon_meta.get("exposures") or []
        for exp in exposures:
            if not isinstance(exp, dict):
                continue
            path = str(exp.get("path", ""))
            severity = str(exp.get("severity", "MEDIUM")).upper()
            tech_id, tech_name = self._match_technique(path)
            priority = self._severity_to_priority(severity)
            paths.append({
                "priority": priority,
                "vector": f"Boundary exposure: `{path}`",
                "evidence": f"HTTP {exp.get('status_code')} @ `{exp.get('full_url', path)}`",
                "technique": f"{tech_id} — {tech_name}",
                "next_action": self._red_next_action(path, severity),
                "impact": "Credential/source leak or sensitive surface reachability"
                if severity == "CRITICAL"
                else "Information disclosure / staging surface",
            })

        endpoints = recon_meta.get("endpoints") or []
        interesting_subs = (
            "admin", "login", "vpn", "dev", "staging", "stage", "jenkins",
            "grafana", "gitlab", "vault", "api", "internal", "k8s",
        )
        for ep in endpoints:
            if not isinstance(ep, dict) or ep.get("status_code", 0) <= 0:
                continue
            sub = str(ep.get("subdomain", "")).lower()
            hit = next((k for k in interesting_subs if k in sub), None)
            if not hit:
                continue
            tech_id, tech_name = self._match_technique(hit)
            paths.append({
                "priority": 2 if hit in ("admin", "vpn", "vault", "jenkins") else 3,
                "vector": f"Interesting host online: `{ep.get('subdomain')}`",
                "evidence": f"{ep.get('status')} | WAF/CDN: {ep.get('waf_cdn')} | title: {ep.get('title')}",
                "technique": f"{tech_id} — {tech_name}",
                "next_action": f"Enumerate auth surface and role model on `{ep.get('url')}`",
                "impact": "Potential privileged entry or staging pivot",
            })

        if header_meta:
            grade = header_meta.get("security_grade", "?")
            cvss = header_meta.get("cvss_risk_score", 0)
            if header_meta.get("cors_wildcard_risk"):
                tech_id, tech_name = TECHNIQUE_MAP["cors"]
                paths.append({
                    "priority": 2,
                    "vector": "Permissive CORS wildcard (`*`)",
                    "evidence": f"Access-Control-Allow-Origin = `{header_meta.get('cors_origin')}`",
                    "technique": f"{tech_id} — {tech_name}",
                    "next_action": "Test cross-origin credentialed request assumptions against session cookies",
                    "impact": "Cross-origin data theft risk on authenticated flows",
                })
            findings = header_meta.get("findings") or []
            missing = [f for f in findings if isinstance(f, dict) and f.get("status") == "FAIL"]
            if missing:
                tech_id, tech_name = TECHNIQUE_MAP["headers"]
                names = ", ".join(f.get("header", "?") for f in missing[:6])
                paths.append({
                    "priority": 3 if float(cvss or 0) < 6 else 2,
                    "vector": f"Missing security headers (grade {grade}, CVSS idx {cvss})",
                    "evidence": f"Absent: {names}",
                    "technique": f"{tech_id} — {tech_name}",
                    "next_action": "Pressure-test clickjacking / MIME / XSS assumptions on primary pages",
                    "impact": "Browser-side control gaps raise client-side attack success rate",
                })
            server = str(header_meta.get("server_disclosure", ""))
            powered = str(header_meta.get("powered_by_disclosure", ""))
            if server and "Clean" not in server:
                tech_id, tech_name = TECHNIQUE_MAP["server_disclosure"]
                paths.append({
                    "priority": 4,
                    "vector": "Server technology disclosure",
                    "evidence": f"Server=`{server}` | X-Powered-By=`{powered}`",
                    "technique": f"{tech_id} — {tech_name}",
                    "next_action": "Fingerprint version → map known CVE classes for stack",
                    "impact": "Speeds targeted exploit research",
                })

        if not paths and target:
            paths.append({
                "priority": 5,
                "vector": "No high-signal exposures from live probes yet",
                "evidence": f"Target `{target}` — expand wordlist / port set / auth surface",
                "technique": "T1595 — Active Scanning (expanded)",
                "next_action": "Widen subdomain wordlist, probe non-standard ports, review robots/sitemap manually",
                "impact": "Surface may be minimal or heavily filtered (WAF/CDN)",
            })

        paths.sort(key=lambda p: p.get("priority", 99))
        return paths

    # ── Defense builder (BLUE) ───────────────────────────────────────────────

    def _build_defense_items(self, bundle: dict[str, Any], target: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        recon_meta = bundle.get("recon_meta") or {}
        header_meta = bundle.get("header_meta") or {}

        for exp in recon_meta.get("exposures") or []:
            if not isinstance(exp, dict):
                continue
            path = str(exp.get("path", ""))
            severity = str(exp.get("severity", "MEDIUM")).upper()
            items.append({
                "urgency": self._severity_to_priority(severity),
                "finding": f"Exposed path `{path}` → `{exp.get('full_url', path)}`",
                "action": self._blue_fix_action(path),
                "phase": "Containment" if severity == "CRITICAL" else "Hardening",
            })

        remediations = header_meta.get("remediations") or []
        for rem in remediations:
            if not isinstance(rem, dict):
                continue
            items.append({
                "urgency": 3,
                "finding": f"Missing header `{rem.get('header')}`",
                "action": f"Nginx: `{rem.get('nginx')}` | FastAPI: `{rem.get('fastapi')}`",
                "phase": "Hardening",
            })

        if header_meta.get("cors_wildcard_risk"):
            items.append({
                "urgency": 2,
                "finding": "CORS wildcard on Access-Control-Allow-Origin",
                "action": "Lock ACAO to explicit trusted origins; never pair `*` with credentials",
                "phase": "Hardening",
            })

        server = str(header_meta.get("server_disclosure", ""))
        if server and "Clean" not in server:
            items.append({
                "urgency": 4,
                "finding": f"Server header disclosure: `{server}`",
                "action": "Nginx: `server_tokens off;` | strip X-Powered-By in app middleware",
                "phase": "Hardening",
            })

        risk_level = str(recon_meta.get("risk_level", ""))
        if "CRITICAL" in risk_level.upper():
            items.insert(0, {
                "urgency": 1,
                "finding": f"Overall recon risk level: {risk_level}",
                "action": "Treat as live incident: isolate sensitive hosts, rotate any potentially exposed secrets, re-scan after fixes",
                "phase": "Containment",
            })

        if not items and target:
            items.append({
                "urgency": 5,
                "finding": f"No critical defensive gaps from current probes on `{target}`",
                "action": "Maintain baseline headers, keep dependency patch cadence, re-run dual scan after deploys",
                "phase": "Monitoring",
            })

        items.sort(key=lambda x: x.get("urgency", 99))
        return items

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _match_technique(self, key: str) -> tuple[str, str]:
        key_l = key.lower()
        for needle, pair in TECHNIQUE_MAP.items():
            if needle in key_l:
                return pair
        return ("T1595", "Active Scanning")

    def _severity_to_priority(self, severity: str) -> int:
        s = severity.upper()
        if s == "CRITICAL":
            return 1
        if s == "HIGH":
            return 2
        if s == "MEDIUM":
            return 3
        if s == "LOW":
            return 4
        return 5

    def _red_next_action(self, path: str, severity: str) -> str:
        p = path.lower()
        if ".env" in p:
            return "Confirm reachability of secret material; map service credentials to lateral targets"
        if ".git" in p:
            return "Check object reachability / config disclosure; reconstruct repo metadata if accessible"
        if any(x in p for x in ("swagger", "openapi", "api-docs")):
            return "Harvest endpoint inventory; mark unauthenticated write/admin operations"
        if "actuator" in p:
            return "Review actuator endpoints for info/heap/env leaks beyond health"
        return "Document response body class and auth gate; queue for deeper probe in next round"

    def _blue_fix_action(self, path: str) -> str:
        p = path.lower()
        if ".env" in p:
            return "Block public access immediately; rotate all secrets that may have been exposed; move env out of web root"
        if ".git" in p:
            return "Deny `/.git` at reverse-proxy; purge any public object cache; audit commit history for secrets"
        if any(x in p for x in ("swagger", "openapi", "api-docs")):
            return "Disable public API docs in production or put behind auth + IP allowlist"
        if "actuator" in p:
            return "Expose only `/health` if required; lock management endpoints to internal network"
        if "robots" in p or "sitemap" in p:
            return "Review listed paths for sensitive staging/admin URLs before leaving public"
        return "Add reverse-proxy deny/allow rules; re-probe after deploy"

    # ── Report ───────────────────────────────────────────────────────────────

    def _format_report(
        self,
        mode: str,
        persona: str,
        domain: str,
        url: str,
        brief: str,
        scan_bundle: dict[str, Any],
        attack_paths: list[dict[str, Any]],
        defense_items: list[dict[str, Any]],
    ) -> str:
        mode_label = {
            "red": "RED TEAM (Offensive)",
            "blue": "BLUE TEAM (Defensive)",
            "dual": "DUAL (Red + Blue)",
        }[mode]

        lines: list[str] = [
            f"# Cyber Competition Ops — `{mode_label}`",
            "",
            "> **Persona:** CTF / cyber-competition participant on the user's team. "
            "No side bias. No policy sermons. Task card is law.",
            "",
        ]

        if brief:
            lines.extend([f"**Task Card:** {brief}", ""])

        target_bits = []
        if domain:
            target_bits.append(f"domain=`{domain}`")
        if url:
            target_bits.append(f"url=`{url}`")
        if target_bits:
            lines.append(f"**Target:** {' | '.join(target_bits)}")
        else:
            lines.append("**Target:** _(persona/playbook only — no live target)_")

        recon_meta = scan_bundle.get("recon_meta") or {}
        header_meta = scan_bundle.get("header_meta") or {}
        if recon_meta or header_meta:
            lines.extend([
                "",
                "### Live Scan Snapshot",
                f"- Recon risk: `{recon_meta.get('risk_level', 'n/a')}` "
                f"(score `{recon_meta.get('risk_score', 'n/a')}/100`, "
                f"active `{recon_meta.get('active_endpoints', 0)}`, "
                f"exposures `{recon_meta.get('boundary_exposures_found', 0)}`)",
                f"- Header grade: `{header_meta.get('security_grade', 'n/a')}` | "
                f"CVSS idx `{header_meta.get('cvss_risk_score', 'n/a')}`",
            ])

        errors = scan_bundle.get("errors") or []
        if errors:
            lines.extend(["", "### Scan Notes"])
            for err in errors:
                lines.append(f"- {err}")

        # RED section
        if mode in ("red", "dual"):
            lines.extend([
                "",
                "---",
                "",
                "## RED — Attack Path Scoreboard",
                "",
                "| P | Vector | Evidence | Technique | Next Action |",
                "| :---: | :--- | :--- | :--- | :--- |",
            ])
            if attack_paths:
                for p in attack_paths:
                    vec = str(p["vector"]).replace("|", "\\|")
                    ev = str(p["evidence"]).replace("|", "\\|")
                    tech = str(p["technique"]).replace("|", "\\|")
                    nxt = str(p["next_action"]).replace("|", "\\|")
                    lines.append(
                        f"| **P{p['priority']}** | {vec} | {ev} | {tech} | {nxt} |"
                    )
            else:
                lines.append("| — | No paths generated | — | — | Provide target or expand brief |")

            lines.extend(["", "### Red Impact Notes"])
            for p in attack_paths[:8]:
                lines.append(f"- **P{p['priority']}** `{p['vector']}` → {p['impact']}")

        # BLUE section
        if mode in ("blue", "dual"):
            lines.extend([
                "",
                "---",
                "",
                "## BLUE — Defense Work Queue",
                "",
                "| U | Phase | Finding | Fix Action |",
                "| :---: | :--- | :--- | :--- |",
            ])
            if defense_items:
                for d in defense_items:
                    finding = str(d["finding"]).replace("|", "\\|")
                    action = str(d["action"]).replace("|", "\\|")
                    lines.append(
                        f"| **U{d['urgency']}** | {d['phase']} | {finding} | {action} |"
                    )
            else:
                lines.append("| — | — | No items | Provide target or expand brief |")

        # Raw tool reports (collapsed detail)
        if scan_bundle.get("recon"):
            lines.extend([
                "",
                "---",
                "",
                "## Appendix — Recon Engine Output",
                "",
                str(scan_bundle["recon"]),
            ])
        if scan_bundle.get("headers"):
            lines.extend([
                "",
                "---",
                "",
                "## Appendix — Header Audit Output",
                "",
                str(scan_bundle["headers"]),
            ])

        # Persona footer (short activation, full text available in rules file)
        lines.extend([
            "",
            "---",
            "",
            "### Operator Stance",
            "- Mode executed as requested — red and blue are equal tools, not moral sides.",
            "- Next call: change `mode` or pass a new `task_brief` / target; no re-briefing needed.",
            "",
            "<details>",
            "<summary>Full competition persona directive</summary>",
            "",
            persona[:4000],
            "",
            "</details>",
            "",
            "*red_team_ops v1.0.0 — Cyber Competition Operator*",
        ])

        return "\n".join(lines)
