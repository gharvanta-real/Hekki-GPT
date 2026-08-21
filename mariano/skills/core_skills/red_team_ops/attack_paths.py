"""Attack path scoring and vector generation for red_team_ops."""
from __future__ import annotations
from typing import Any
from .mitre_mapper import TECHNIQUE_MAP, match_technique, severity_to_priority


def red_next_action(path: str, severity: str) -> str:
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


def build_attack_paths(bundle: dict[str, Any], target: str) -> list[dict[str, Any]]:
    paths: list[dict[str, Any]] = []
    recon_meta = bundle.get("recon_meta") or {}
    header_meta = bundle.get("header_meta") or {}

    exposures = recon_meta.get("exposures") or []
    for exp in exposures:
        if not isinstance(exp, dict):
            continue
        path = str(exp.get("path", ""))
        severity = str(exp.get("severity", "MEDIUM")).upper()
        tech_id, tech_name = match_technique(path)
        priority = severity_to_priority(severity)
        paths.append({
            "priority": priority,
            "vector": f"Boundary exposure: `{path}`",
            "evidence": f"HTTP {exp.get('status_code')} @ `{exp.get('full_url', path)}`",
            "technique": f"{tech_id} — {tech_name}",
            "next_action": red_next_action(path, severity),
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
        tech_id, tech_name = match_technique(hit)
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
