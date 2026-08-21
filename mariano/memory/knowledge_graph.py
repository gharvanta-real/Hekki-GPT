"""MARIANO Memory — Interactive Knowledge Graph & Concept Relation Engine.
Extracts semantic triples (Subject -> Predicate -> Object) and generates node/link graph data.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
import structlog

log = structlog.get_logger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
GRAPH_FILE = PROJECT_ROOT / "data" / "knowledge_graph.json"


class KnowledgeGraphEngine:
    _instance: Optional[KnowledgeGraphEngine] = None

    def __init__(self):
        self._nodes: List[Dict[str, Any]] = []
        self._links: List[Dict[str, Any]] = []
        self._ensure_storage()
        self._load_graph()

    @classmethod
    def get_instance(cls) -> KnowledgeGraphEngine:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _ensure_storage(self) -> None:
        GRAPH_FILE.parent.mkdir(parents=True, exist_ok=True)
        if not GRAPH_FILE.exists():
            self._seed_default_graph()

    def _seed_default_graph(self) -> None:
        nodes = [
            {"id": "c_hekki", "label": "Hekki Assistant", "category": "Core", "radius": 22, "color": "#71717a", "notes": "Autonomous AI Agent platform & local desktop runtime."},
            {"id": "c_agent", "label": "Agentic Loop", "category": "Architecture", "radius": 16, "color": "#10b981", "notes": "ReAct tool execution, planner, observer & memory."},
            {"id": "c_memory", "label": "Memory Ledger", "category": "Memory", "radius": 15, "color": "#8b5cf6", "notes": "Semantic SQLite vector store and persistent profile facts."},
            {"id": "c_skills", "label": "Modular Skills", "category": "Execution", "radius": 15, "color": "#f59e0b", "notes": "Decoupled capability modules registered with Gemini Tools API."},
            {"id": "c_mcp", "label": "MCP Protocol", "category": "Integration", "radius": 16, "color": "#06b6d4", "notes": "Model Context Protocol bridge for GitHub, Slack, Notion, Postgres."},
            {"id": "c_vision", "label": "Computer Vision", "category": "Sensory", "radius": 14, "color": "#ec4899", "notes": "Screen capture, OCR, visual inspection & floating HUD."},
            {"id": "c_debate", "label": "Multi-Persona Debate", "category": "Reasoning", "radius": 15, "color": "#6366f1", "notes": "3-agent adversarial consensus protocol."},
            {"id": "c_coder", "label": "Coder FSM", "category": "Development", "radius": 15, "color": "#14b8a6", "notes": "Full autonomous coding assistant with file patch generator."},
            {"id": "c_workflows", "label": "Workflow Engine", "category": "Automation", "radius": 15, "color": "#f43f5e", "notes": "Multi-step automated DAG pipelines and agentic triggers."},
            {"id": "c_graph", "label": "Knowledge Graph", "category": "Intelligence", "radius": 16, "color": "#eab308", "notes": "Interactive conceptual relationship explorer & mind-map."},
            {"id": "c_python", "label": "Python & FastAPI", "category": "Technology", "radius": 13, "color": "#64748b", "notes": "High performance async web and orchestration backend."},
            {"id": "c_gemini", "label": "Google Gemini 3.1", "category": "Model", "radius": 17, "color": "#a1a1aa", "notes": "Multimodal reasoning LLM with function calling."}
        ]

        links = [
            {"source": "c_hekki", "target": "c_agent", "label": "orchestrates"},
            {"source": "c_hekki", "target": "c_gemini", "label": "powered by"},
            {"source": "c_agent", "target": "c_skills", "label": "invokes"},
            {"source": "c_agent", "target": "c_memory", "label": "reads & updates"},
            {"source": "c_skills", "target": "c_mcp", "label": "integrates via"},
            {"source": "c_agent", "target": "c_vision", "label": "observes via"},
            {"source": "c_agent", "target": "c_debate", "label": "resolves with"},
            {"source": "c_agent", "target": "c_coder", "label": "spawns"},
            {"source": "c_hekki", "target": "c_workflows", "label": "schedules"},
            {"source": "c_memory", "target": "c_graph", "label": "visualizes into"},
            {"source": "c_hekki", "target": "c_python", "label": "built on"},
            {"source": "c_coder", "target": "c_python", "label": "analyzes"}
        ]

        data = {"nodes": nodes, "links": links}
        GRAPH_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def _load_graph(self) -> None:
        if GRAPH_FILE.exists():
            try:
                data = json.loads(GRAPH_FILE.read_text(encoding="utf-8"))
                self._nodes = data.get("nodes", [])
                self._links = data.get("links", [])
            except Exception as err:
                log.error("graph.load_failed", error=str(err))

    def _save_graph(self) -> None:
        try:
            data = {"nodes": self._nodes, "links": self._links}
            GRAPH_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as err:
            log.error("graph.save_failed", error=str(err))

    def get_graph(self) -> Dict[str, Any]:
        return {
            "nodes": self._nodes,
            "links": self._links,
            "categories": list(set(n.get("category", "General") for n in self._nodes)),
            "stats": {
                "total_nodes": len(self._nodes),
                "total_links": len(self._links)
            }
        }

    def add_node(self, node: Dict[str, Any]) -> Dict[str, Any]:
        if "id" not in node or not node["id"]:
            node["id"] = f"node_{uuid.uuid4().hex[:8]}"
        if "radius" not in node:
            node["radius"] = 14
        if "color" not in node:
            node["color"] = "#71717a"
        self._nodes.append(node)
        self._save_graph()
        return node

    def add_link(self, link: Dict[str, Any]) -> Dict[str, Any]:
        self._links.append(link)
        self._save_graph()
        return link

    def search_nodes(self, query: str) -> List[Dict[str, Any]]:
        q = query.lower()
        return [
            n for n in self._nodes
            if q in n.get("label", "").lower()
            or q in n.get("category", "").lower()
            or q in n.get("notes", "").lower()
        ]
