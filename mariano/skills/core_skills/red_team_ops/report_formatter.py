"""Report markdown formatter for red_team_ops skill."""
from __future__ import annotations
from typing import Any


def format_report(
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

    # Raw tool reports
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
        "*red_team_ops v1.1.0 — Cyber Competition Operator*",
    ])

    return "\n".join(lines)
