"""MARIANO — BaseSkill abstract class. All skills implement this."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class SkillResult:
    """Standardized result from any skill execution."""
    success: bool
    data: Any
    error: str | None = None
    execution_time_ms: float = 0.0
    metadata: dict = field(default_factory=dict)

    def to_text(self) -> str:
        if not self.success:
            err = self.error if self.error else "Execution failed"
            if self.data and isinstance(self.data, str) and self.data.strip():
                return f"ERROR: {err}\n\nOutput:\n{self.data}"
            return f"ERROR: {err}"
        if isinstance(self.data, str):
            return self.data
        if isinstance(self.data, (dict, list)):
            import json
            return json.dumps(self.data, indent=2, ensure_ascii=False)
        return str(self.data)


class BaseSkill(ABC):
    """Abstract base class for all MARIANO skills."""

    # Subclasses must define these
    name: str = ""
    description: str = ""
    version: str = "1.0.0"
    tags: list[str] = []

    def __init__(self) -> None:
        self._call_count = 0
        self._error_count = 0
        self._total_time_ms = 0.0

    @abstractmethod
    async def execute(self, **kwargs: Any) -> SkillResult:
        """Execute the skill with given parameters. Must be overridden."""
        ...

    async def stream_execute(self, **kwargs: Any):
        """Optional async generator for skills that can stream live output.
        Yields (tag, value) tuples where tag is 'log' or 'done'.
        Default: not supported (returns None)."""
        return
        yield  # Make it an async generator

    @abstractmethod
    def get_parameters_schema(self) -> dict:
        """Return parameter schema dict. Used for Gemini tool registration."""
        ...

    def to_manifest_dict(self) -> dict:
        """Return manifest dict for Gemini tool calling registration."""
        return {
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "parameters": self.get_parameters_schema(),
            "tags": self.tags,
            "stats": self.get_stats(),
        }

    def get_stats(self) -> dict:
        avg_time = (
            self._total_time_ms / self._call_count
            if self._call_count > 0
            else 0.0
        )
        success_rate = (
            (self._call_count - self._error_count) / self._call_count
            if self._call_count > 0
            else 1.0
        )
        return {
            "call_count": self._call_count,
            "error_count": self._error_count,
            "avg_latency_ms": round(avg_time, 2),
            "success_rate": round(success_rate, 3),
        }

    async def safe_execute(self, **kwargs: Any) -> SkillResult:
        """Execute with timing, error handling, and stats tracking."""
        import time
        start = time.monotonic()
        self._call_count += 1
        try:
            result = await self.execute(**kwargs)
            elapsed = (time.monotonic() - start) * 1000
            result.execution_time_ms = elapsed
            self._total_time_ms += elapsed
            
            from mariano.core.anonymizer import DataSanitizer
            if isinstance(result.data, str):
                result.data = DataSanitizer.redact(result.data)
            if isinstance(result.error, str):
                result.error = DataSanitizer.redact(result.error)

            if not result.success:
                self._error_count += 1
            return result
        except Exception as exc:
            elapsed = (time.monotonic() - start) * 1000
            self._error_count += 1
            self._total_time_ms += elapsed
            from mariano.core.anonymizer import DataSanitizer
            err_msg = DataSanitizer.redact(str(exc))
            return SkillResult(
                success=False,
                data=None,
                error=err_msg,
                execution_time_ms=elapsed,
            )
