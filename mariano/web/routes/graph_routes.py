"""Knowledge Graph REST API Router — Nodes, links, search & concept extraction."""
from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter
from mariano.memory.knowledge_graph import KnowledgeGraphEngine

router = APIRouter(prefix="/api/graph", tags=["Knowledge Graph"])


@router.get("")
async def get_full_graph():
    engine = KnowledgeGraphEngine.get_instance()
    return engine.get_graph()


@router.post("/nodes")
async def add_node(node: Dict[str, Any]):
    engine = KnowledgeGraphEngine.get_instance()
    res = engine.add_node(node)
    return {"status": "ok", "node": res}


@router.post("/links")
async def add_link(link: Dict[str, Any]):
    engine = KnowledgeGraphEngine.get_instance()
    res = engine.add_link(link)
    return {"status": "ok", "link": res}


@router.get("/search")
async def search_graph(q: str = ""):
    engine = KnowledgeGraphEngine.get_instance()
    matches = engine.search_nodes(q)
    return {"query": q, "results": matches}
