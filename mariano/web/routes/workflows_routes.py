"""Workflows REST API Router — CRUD, run triggers & execution status logs."""
from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from mariano.core.workflow_engine import WorkflowEngine

router = APIRouter(prefix="/api/workflows", tags=["Workflows"])


@router.get("")
async def list_workflows():
    engine = WorkflowEngine.get_instance()
    return {"workflows": engine.list_workflows()}


@router.post("")
async def create_or_update_workflow(payload: Dict[str, Any]):
    engine = WorkflowEngine.get_instance()
    wf = engine.save_workflow(payload)
    return {"status": "ok", "workflow": wf}


@router.delete("/{wf_id}")
async def delete_workflow(wf_id: str):
    engine = WorkflowEngine.get_instance()
    success = engine.delete_workflow(wf_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"status": "deleted", "id": wf_id}


@router.post("/{wf_id}/run")
async def run_workflow(wf_id: str):
    engine = WorkflowEngine.get_instance()
    try:
        run_record = await engine.execute_workflow(wf_id)
        return {"status": "started", "run": run_record}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/runs/{run_id}")
async def get_run_status(run_id: str):
    engine = WorkflowEngine.get_instance()
    run = engine.get_run_status(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"run": run}


@router.get("/runs")
async def get_history():
    engine = WorkflowEngine.get_instance()
    return {"runs": engine.get_history()}
