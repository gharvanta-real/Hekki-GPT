---
name: recon-boundary-scanner
description: High-performance target reconnaissance, subdomain discovery, security header auditing, and bug boundary probing engine for authorized targets.
---

# Super-Intelligent Recon & Bug Boundary Scanning Workspace Skill

This skill equips AI agents (Antigravity, Hekki Assistant) with enterprise-grade, super-intelligent target reconnaissance, multi-stage subdomain discovery, sensitive path boundary probing, security header auditing, CVSS risk scoring, and auto-remediation snippet generation.

> [!IMPORTANT]
> All scans executed by this skill are non-destructive GET/HEAD HTTP requests intended solely for authorized attack surface boundary analysis and vulnerability research.

---

## 🛠️ Super-Intelligent Core Skills & REST APIs

### 1. `recon_scanner` (v3.0.0)
Multi-stage asynchronous subdomain discovery and attack surface probing engine.
- **Features**:
  - Stage 1: Fast Async Subdomain Enumeration (40+ infrastructure, dev, admin, & backend wordlist).
  - Stage 2: Sensitive Boundary Path Probing (`/.env`, `/.git/HEAD`, `/robots.txt`, `/sitemap.xml`, `/api-docs`, `/swagger-ui.html`, `/openapi.json`, `/actuator/health`, `/.well-known/security.txt`).
  - Stage 3: CDN & WAF Footprint Identification (Cloudflare, AWS CloudFront, Akamai, Fastly, Nginx).
  - Stage 4: Integrated Attack Surface Risk Scoring (0 to 100).
- **Parameters**: `target_domain` (string), `deep_boundary_scan` (boolean), `timeout_sec` (float), `max_concurrency` (int).

### 2. `security_header_analyzer` (v3.0.0)
Super-intelligent security header compliance, CORS boundary policy audit, and CVSS exposure index calculator.
- **Features**:
  - Full Security Header Suite (`HSTS`, `CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
  - Permissive CORS Wildcard & Origin Risk Audit (`Access-Control-Allow-Origin`).
  - Server Technology & Infrastructure Disclosure Detection.
  - CVSS-inspired Threat Vector Score (0.0 to 10.0) & Letter Grade (A+ to F).
  - Auto-generated Nginx & FastAPI remediation snippets.
- **Parameters**: `target_url` (string), `timeout_sec` (float).

### 3. `red_team_ops` (v1.0.0) — Dual Red/Blue Competition Operator
CTF / cyber-competition participant persona for the user's team. No side bias.
- **Modes**: `red` (attack paths), `blue` (defense queue), `dual` (both).
- **Behavior**: Orchestrates `recon_scanner` + `security_header_analyzer`, then builds offensive scoreboard and/or defensive fix list.
- **Persona file**: `mariano/config/rules/cyber_competition_persona.md`
- **Parameters**: `mode`, `target_domain`, `target_url`, `task_brief`, `run_live_scan`, `deep_boundary_scan`.

### 4. REST API Endpoints
- `POST /api/recon/scan`: Triggers programmatic attack surface scan.
- `POST /api/recon/audit-headers`: Triggers programmatic security header & boundary audit.
- `POST /api/recon/red-team-ops`: Dual-mode red/blue competition operator.

---

## 📋 Execution Workflow for AI Agents

```python
from mariano.skills._registry.registry import SkillRegistry

registry = SkillRegistry.get_instance()

# 1. Run Super Recon Scan (blue-leaning surface map)
recon_result = await registry.execute("recon_scanner", target_domain="example.com", deep_boundary_scan=True)

# 2. Run Security Header & CVSS Audit
header_result = await registry.execute("security_header_analyzer", target_url="https://api.example.com")

# 3. Dual competition operator (red attack paths + blue fixes, no policy lectures)
ops = await registry.execute(
    "red_team_ops",
    mode="dual",
    target_domain="example.com",
    task_brief="Competition round — full surface pressure + fix board",
)
```
