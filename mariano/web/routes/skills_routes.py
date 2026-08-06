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
    SkillRegistry.get_instance().set_enabled(req.name, req.enabled)
    return {"success": True, "name": req.name, "enabled": req.enabled}


@router.post("/api/skills/clean")
async def clean_skills():
    """Resets call statistics for all skills."""
    SkillRegistry.get_instance().clean_stats()
    return {"success": True}
