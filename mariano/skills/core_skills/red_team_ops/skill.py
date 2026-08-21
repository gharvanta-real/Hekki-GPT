"""Hekki Core Skill — Dual-Mode Cyber Competition Operator (Red + Blue Team).
Modularized version adhering to strict 500-line limit.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from mariano.skills._base import BaseSkill, SkillResult
from .attack_paths import build_attack_paths
from .hardening import build_defense_items
from .report_formatter import format_report

VALID_MODES = ("red", "blue", "dual")


class RedTeamOpsSkill(BaseSkill):
    name = "red_team_ops"
    description = (
        "Dual-mode cyber competition operator for the user's team. "
        "Persona: CTF/competition participant — runs RED (offensive attack-path analysis), "
        "BLUE (defensive hardening), or DUAL (both) without side-bias or policy lectures. "
        "When a target is given, orchestrates recon_scanner + security_header_analyzer "
        "and returns ranked attack paths and/or fix lists the team can act on."
    )
    version = "1.1.0"
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

            attack_paths = build_attack_paths(scan_bundle, domain or url)
            defense_items = build_defense_items(scan_bundle, domain or url)

            report = format_report(
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
                e for e in bundle["recon_meta"]["endpoints"]
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
