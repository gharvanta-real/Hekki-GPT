"""Recon, security audit, and red-team ops routes."""
from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel
from mariano.skills._registry.registry import SkillRegistry

router = APIRouter()


class ReconScanRequest(BaseModel):
    target_domain: str
    deep_boundary_scan: bool = True


class SecurityAuditRequest(BaseModel):
    target_url: str


class RedTeamOpsRequest(BaseModel):
    mode: str = "dual"
    target_domain: str = ""
    target_url: str = ""
    task_brief: str = ""
    run_live_scan: bool = True
    deep_boundary_scan: bool = True


@router.post("/api/recon/scan")
async def api_recon_scan(req: ReconScanRequest):
    """Super-Intelligent Subdomain & Attack Surface Recon Scan."""
    res = await SkillRegistry.get_instance().execute(
        "recon_scanner", target_domain=req.target_domain, deep_boundary_scan=req.deep_boundary_scan)
    return {"success": res.success, "report": res.data, "metadata": res.metadata, "error": res.error}


@router.post("/api/recon/audit-headers")
async def api_security_audit(req: SecurityAuditRequest):
    """Security Header & Vulnerability Vector Audit."""
    res = await SkillRegistry.get_instance().execute("security_header_analyzer", target_url=req.target_url)
    return {"success": res.success, "report": res.data, "metadata": res.metadata, "error": res.error}


@router.post("/api/recon/red-team-ops")
async def api_red_team_ops(req: RedTeamOpsRequest):
    """Dual-mode cyber competition operator (Red / Blue / Dual)."""
    res = await SkillRegistry.get_instance().execute(
        "red_team_ops", mode=req.mode, target_domain=req.target_domain,
        target_url=req.target_url, task_brief=req.task_brief,
        run_live_scan=req.run_live_scan, deep_boundary_scan=req.deep_boundary_scan)
    return {"success": res.success, "report": res.data, "metadata": res.metadata, "error": res.error}
