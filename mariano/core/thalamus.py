"""MARIANO Core — TCMM Thalamus Gating Module."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import structlog
from google import genai

from mariano.config import get_settings
from mariano.core.neuromodulator import Neuromodulator

log = structlog.get_logger(__name__)


class ThalamusGating:
    """Simulates the biological Thalamus to gate sensory/tool inputs to the Cortex (Gemini)."""

    _instance: ThalamusGating | None = None

    def __init__(self) -> None:
        self.settings = get_settings()
        self.signatures_path = self.settings.mariano_data_dir / "thalamus_signatures.json"
        self._signatures: Dict[str, List[float]] = {}
        self._load_signatures()

    @property
    def client(self) -> genai.Client:
        current_key = self.settings.active_gemini_api_key or self.settings.gemini_api_key
        if getattr(self, "_cached_client", None) is None or current_key != getattr(self, "_cached_key", None):
            self._cached_client = genai.Client(api_key=current_key)
            self._cached_key = current_key
        return self._cached_client

    @classmethod
    def get_instance(cls) -> ThalamusGating:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_signatures(self) -> None:
        if self.signatures_path.exists():
            try:
                self._signatures = json.loads(self.signatures_path.read_text(encoding="utf-8"))
            except Exception as e:
                log.error("thalamus.load_failed", error=str(e))
        else:
            self._signatures = {}

    def save_signatures(self) -> None:
        self.signatures_path.parent.mkdir(parents=True, exist_ok=True)
        self.signatures_path.write_text(json.dumps(self._signatures, indent=2), encoding="utf-8")

    async def get_embedding(self, text: str) -> List[float]:
        """Fetch embedding vector from Gemini embedding model."""
        try:
            import asyncio
            response = await asyncio.to_thread(
                self.client.models.embed_content,
                model="gemini-embedding-001",
                contents=text,
            )
            return response.embeddings[0].values
        except Exception as exc:
            log.error("thalamus.embedding_failed", error=str(exc))
            # Fallback to random normalized vector if API fails to prevent blocking
            vec = np.random.randn(768)
            return (vec / np.linalg.norm(vec)).tolist()

    async def register_skill_signature(self, skill_name: str, description: str) -> None:
        """Embed and register a skill description vector as its synaptic anchor."""
        if skill_name in self._signatures:
            return
        log.info("thalamus.register_anchor", skill=skill_name)
        embedding = await self.get_embedding(description)
        self._signatures[skill_name] = embedding
        self.save_signatures()

    def get_signature(self, skill_name: str) -> np.ndarray | None:
        vec = self._signatures.get(skill_name)
        return np.array(vec) if vec else None

    def update_signature(self, skill_name: str, new_sig: np.ndarray) -> None:
        self._signatures[skill_name] = new_sig.tolist()
        self.save_signatures()

    async def filter_active_skills(
        self, query: str, skills: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Gates skills using cosine similarity.
        Only allows tools exceeding Serotonin-regulated threshold.
        """
        nm = Neuromodulator.get_instance()
        threshold = nm.get_routing_threshold()
        
        # Calculate Query Embedding
        query_vec = np.array(await self.get_embedding(query))
        query_norm = np.linalg.norm(query_vec)

        if query_norm == 0:
            return skills, 0.0

        scores = []
        for s in skills:
            name = s["name"]
            sig = self.get_signature(name)
            if sig is None:
                # If no signature exists, dynamically create one
                desc = s.get("description", name)
                await self.register_skill_signature(name, desc)
                sig = self.get_signature(name)

            if sig is not None:
                # Guard: dimension mismatch means stale cached embedding → regenerate
                if sig.shape[0] != query_vec.shape[0]:
                    log.warning(
                        "thalamus.dim_mismatch",
                        skill=name,
                        cached=sig.shape[0],
                        expected=query_vec.shape[0],
                    )
                    desc = s.get("description", name)
                    del self._signatures[name]   # evict stale entry
                    await self.register_skill_signature(name, desc)
                    sig = self.get_signature(name)

                if sig is not None and sig.shape[0] == query_vec.shape[0]:
                    sig_norm = np.linalg.norm(sig)
                    if sig_norm > 0:
                        sim = float(np.dot(query_vec, sig) / (query_norm * sig_norm))
                        scores.append((s, sim))
                    else:
                        scores.append((s, 0.0))
                else:
                    scores.append((s, 0.0))
            else:
                scores.append((s, 0.0))

        # Sort by similarity
        scores.sort(key=lambda x: x[1], reverse=True)
        best_score = scores[0][1] if scores else 0.0

        # GABA Gating / Lateral Inhibition:
        # Filter tools below routing threshold.
        active = [s for s, sim in scores if sim >= threshold]

        # Homeostatic Guard: Ensure at least the top 3 relevant tools are active
        if len(active) < 3:
            active = [s for s, _ in scores[:3]]

        # Dynamic ACh limiting: restrict maximum active tools based on complexity
        limit = nm.get_cache_limit(base=6)
        active = active[:limit]

        log.info(
            "thalamus.gating_complete",
            threshold=threshold,
            best_score=round(best_score, 3),
            activated=len(active),
            suppressed=len(skills) - len(active),
        )
        
        # Check curiosity trigger condition
        if best_score < 0.25:
            nm.surge_curiosity(0.35)

        return active, best_score
