"""Skills management routes."""
from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel
from mariano.skills._registry.registry import SkillRegistry

router = APIRouter()


class SkillToggleRequest(BaseModel):
    name: str
    enabled: bool


@router.get("/api/skills")
async def get_skills():
    """Exposes all loaded expert skills."""
    return SkillRegistry.get_instance().get_manifests(include_disabled=True)


@router.post("/api/skills/toggle")
async def toggle_skill(req: SkillToggleRequest):
    """Enable or disable a specific skill."""
    try:
        SkillRegistry.get_instance().set_enabled(req.name, req.enabled)
        return {"success": True, "name": req.name, "enabled": req.enabled}
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("skill_toggle_failed", error=str(e))
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to toggle skill")


@router.post("/api/skills/clean")
async def clean_skills():
    """Resets call statistics for all skills."""
    try:
        SkillRegistry.get_instance().clean_stats()
        return {"success": True}
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("skill_clean_failed", error=str(e))
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to clean skill stats")
