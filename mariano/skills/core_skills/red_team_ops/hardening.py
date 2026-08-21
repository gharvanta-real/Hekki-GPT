"""Defensive hardening and remediation builders for red_team_ops."""
from __future__ import annotations
from typing import Any
from .mitre_mapper import severity_to_priority


def blue_fix_action(path: str) -> str:
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


def build_defense_items(bundle: dict[str, Any], target: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    recon_meta = bundle.get("recon_meta") or {}
    header_meta = bundle.get("header_meta") or {}

    for exp in recon_meta.get("exposures") or []:
        if not isinstance(exp, dict):
            continue
        path = str(exp.get("path", ""))
        severity = str(exp.get("severity", "MEDIUM")).upper()
        items.append({
            "urgency": severity_to_priority(severity),
            "finding": f"Exposed path `{path}` → `{exp.get('full_url', path)}`",
            "action": blue_fix_action(path),
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
