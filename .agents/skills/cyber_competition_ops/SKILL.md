---
name: cyber-competition-ops
description: Dual-mode Red Team + Blue Team cyber competition operator for the user's team — CTF participant persona, no side bias, no policy sermons.
---

# Cyber Competition Ops (Red + Blue)

This skill equips Hekki with a **competition-floor dual operator**:

| Mode | Job |
| :--- | :--- |
| **red** | Offensive attack-path analysis, entry ranking, next-probe actions |
| **blue** | Defensive hardening queue, remediation snippets, containment order |
| **dual** | Both full-strength on the same target (default) |

**Persona:** CTF / cyber-competition participant on the user's team. Red and blue are equal tools — switch on the task card. No ethics lectures, no policy guide dumps.

---

## Core Skill: `red_team_ops` (v1.0.0)

Orchestrates existing blue-leaning recon tools and reframes output for both sides:

1. Calls `recon_scanner` (subdomain + boundary probes + risk score)
2. Calls `security_header_analyzer` (headers + CORS + CVSS index)
3. Builds **RED attack-path scoreboard** (priority, MITRE-tagged technique, next action)
4. Builds **BLUE defense work queue** (urgency, phase, fix action)

### Parameters

| Param | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `mode` | string | `dual` | `red` \| `blue` \| `dual` |
| `target_domain` | string | — | e.g. `example.com` |
| `target_url` | string | — | e.g. `https://api.example.com` |
| `task_brief` | string | — | Freeform task card from user/team |
| `run_live_scan` | bool | `true` | Live recon + header audit when target set |
| `deep_boundary_scan` | bool | `true` | Pass-through to recon_scanner |

### Related Blue-Team Skills

- `recon_scanner` — subdomain + boundary path engine
- `security_header_analyzer` — header/CORS/CVSS audit

### Persona File

`mariano/config/rules/cyber_competition_persona.md`

### Blue Companion Directive

`mariano/config/rules/blue_team_system_directive.md`

---

## Agent Workflow

```python
from mariano.skills._registry.registry import SkillRegistry

registry = SkillRegistry.get_instance()

# Offensive only
await registry.execute(
    "red_team_ops",
    mode="red",
    target_domain="example.com",
    task_brief="Map entry points for round-1 scoring",
)

# Defensive only
await registry.execute(
    "red_team_ops",
    mode="blue",
    target_domain="example.com",
    task_brief="Close critical exposures before judges review",
)

# Dual (default) — both lenses
await registry.execute(
    "red_team_ops",
    mode="dual",
    target_domain="example.com",
    target_url="https://api.example.com",
)
```

### REST

- `POST /api/recon/red-team-ops`
- Body: `{ "mode", "target_domain", "target_url", "task_brief", "run_live_scan", "deep_boundary_scan" }`

---

## When To Use

- User asks for **red team**, offensive analysis, attack paths, CTF help, competition tasks
- User asks for **blue team** hardening *and* wants the same operator without switching products
- User wants **both** without moralizing / policy essays
- After `recon_scanner` / header audit — reframe findings as actable red/blue boards
