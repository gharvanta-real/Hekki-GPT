"""MARIANO — Skill manifest schema and I/O."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


@dataclass
class SkillManifest:
    name: str
    description: str
    version: str = "1.0.0"
    author: str = "mariano-core"
    evolved: bool = False
    tags: list[str] = field(default_factory=list)
    parameters: dict = field(default_factory=dict)
    dependencies: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    performance: dict = field(default_factory=lambda: {
        "avg_latency_ms": 0.0,
        "success_rate": 1.0,
        "call_count": 0,
    })

    @classmethod
    def from_file(cls, path: Path) -> "SkillManifest":
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    def to_file(self, path: Path) -> None:
        path.write_text(
            json.dumps(self.__dict__, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def to_dict(self) -> dict:
        return self.__dict__.copy()
