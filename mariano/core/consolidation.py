"""MARIANO Core — TCMM Synaptic Memory Consolidation Engine."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import aiosqlite
import numpy as np
import structlog

from mariano.config import get_settings
from mariano.core.thalamus import ThalamusGating

log = structlog.get_logger(__name__)


class SynapticConsolidator:
    """Offline Synaptic Consolidation. Commences Hebbian weight tuning on sleep cycles."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.db_path = self.settings.sqlite_path
        self.thalamus = ThalamusGating.get_instance()
        self.ledger_path = self.settings.mariano_data_dir / "logs" / "evolution_ledger.md"

    async def consolidate(self) -> dict:
        """Runs the Slow-Wave Sleep consolidation cycle over recent experiences."""
        log.info("consolidation.start_cycle")
        
        # 1. Fetch recent episodes
        episodes = []
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(
                    "SELECT * FROM episodes ORDER BY created_at DESC LIMIT 20"
                )
                episodes = await cursor.fetchall()
        except Exception as e:
            log.error("consolidation.db_read_failed", error=str(e))
            return {"status": "failed", "error": "Database access error"}

        if not episodes:
            log.info("consolidation.empty_buffer", count=0)
            return {"status": "skipped", "reason": "No recent episodes found."}

        log.info("consolidation.replaying_episodes", count=len(episodes))

        tuned_skills = set()
        
        # 2. Hebbian Plasticity Signature Tuning
        for ep in episodes:
            query = ep["user_input"]
            tools_used_str = ep["tools_used"]
            success = bool(ep["success"])

            if not query or not tools_used_str:
                continue

            try:
                tools_used = json.loads(tools_used_str)
            except Exception:
                continue

            if not tools_used:
                continue

            # Embed query text
            query_vec = np.array(await self.thalamus.get_embedding(query))
            query_norm = np.linalg.norm(query_vec)
            if query_norm == 0:
                continue
            query_vec /= query_norm

            for skill in tools_used:
                sig = self.thalamus.get_signature(skill)
                if sig is None:
                    continue

                sig_norm = np.linalg.norm(sig)
                if sig_norm == 0:
                    continue
                sig /= sig_norm

                # Attraction (Positive feedback / Success)
                if success:
                    # Pull anchor closer to query semantic cluster
                    new_sig = 0.90 * sig + 0.10 * query_vec
                # Repulsion (Failure)
                else:
                    # Push anchor away from failure query cluster
                    new_sig = 1.05 * sig - 0.05 * query_vec

                # Normalize new signature vector
                new_norm = np.linalg.norm(new_sig)
                if new_norm > 0:
                    new_sig /= new_norm

                # Save updated signature vector back to Thalamus registry
                self.thalamus.update_signature(skill, new_sig)
                tuned_skills.add(skill)

        # 3. Log to evolution ledger (Append-only write-lock logs)
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        ledger_entry = (
            f"\n### 💤 [{timestamp}] Sleep Consolidation Complete\n"
            f"- Commenced offline slow-wave synaptic consolidation loop.\n"
            f"- Experiences replayed: {len(episodes)}\n"
            f"- Adjusted synaptic signature weights for expert columns: `{', '.join(tuned_skills)}` (Hebbian Plasticity).\n"
            f"──────────────────────────────────────────────────\n"
        )
        with open(self.ledger_path, "a", encoding="utf-8") as ledger:
            ledger.write(ledger_entry)

        log.info("consolidation.complete", adjusted_skills=list(tuned_skills))
        return {
            "status": "success",
            "episodes_processed": len(episodes),
            "adjusted_signatures": list(tuned_skills),
        }
