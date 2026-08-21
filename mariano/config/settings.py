"""Hekki — Configuration layer. All settings from environment."""
from __future__ import annotations

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

import sys

BASE_DIR = Path(__file__).resolve().parent.parent.parent

if getattr(sys, 'frozen', False):
    DATA_DIR = Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "hekki" / "data"
    ENV_FILES = [
        Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "hekki" / ".env",
        Path.cwd() / ".env"
    ]
else:
    DATA_DIR = BASE_DIR / "data"
    ENV_FILES = [
        BASE_DIR / ".env",
        Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "hekki" / ".env",
        Path.cwd() / ".env"
    ]

SKILLS_DIR = BASE_DIR / "mariano" / "skills"

_GLOBAL_DYNAMIC_CACHE: dict = {}
_GLOBAL_DYNAMIC_CACHE_TS: float = 0.0


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # AI Brain Setup
    gemini_api_key: str = Field("", description="Gemini API key")
    mariano_model: str = Field("gemini-3.5-flash-lite", description="Gemini model name")

    # Data Paths
    mariano_data_dir: Path = Field(default=DATA_DIR)
    mariano_log_level: str = Field("INFO")

    # Optional Keys
    news_api_key: str = Field("", description="NewsAPI key (optional)")

    # Unconstrained Execution Profile
    max_steps: int = Field(35, description="High step limit for deep autonomous loops")
    short_term_window: int = Field(40, description="Deep context message window")
    temperature: float = Field(0.2, description="Lower temperature for highly precise code generation")

    @property
    def hekki_data_dir(self) -> Path:
        return self.mariano_data_dir

    @property
    def hekki_model(self) -> str:
        return self.mariano_model

    @property
    def hekki_log_level(self) -> str:
        return self.mariano_log_level

    @property
    def chroma_dir(self) -> Path:
        return self.mariano_data_dir / "chroma"

    @property
    def sqlite_path(self) -> Path:
        return self.mariano_data_dir / "hekki.db"

    @property
    def logs_dir(self) -> Path:
        return self.mariano_data_dir / "logs"

    @property
    def evolved_skills_dir(self) -> Path:
        if getattr(sys, 'frozen', False):
            return Path(os.environ.get("APPDATA", os.path.expanduser("~"))) / "hekki" / "evolved_skills"
        return SKILLS_DIR / "evolved_skills"

    @property
    def dynamic_config(self) -> dict:
        global _GLOBAL_DYNAMIC_CACHE, _GLOBAL_DYNAMIC_CACHE_TS
        import json
        import time
        now = time.time()
        # 2-second in-memory cache to prevent disk thrashing in tight execution loops
        if _GLOBAL_DYNAMIC_CACHE and (now - _GLOBAL_DYNAMIC_CACHE_TS < 2.0):
            return _GLOBAL_DYNAMIC_CACHE

        path = self.mariano_data_dir / "dynamic_settings.json"
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    _GLOBAL_DYNAMIC_CACHE = data
                    _GLOBAL_DYNAMIC_CACHE_TS = now
                    return data
            except Exception:
                pass
        return _GLOBAL_DYNAMIC_CACHE or {}

    def save_dynamic_config(self, config: dict) -> None:
        global _GLOBAL_DYNAMIC_CACHE, _GLOBAL_DYNAMIC_CACHE_TS
        import json
        import time
        self.mariano_data_dir.mkdir(parents=True, exist_ok=True)
        path = self.mariano_data_dir / "dynamic_settings.json"
        existing = dict(self.dynamic_config)
        existing.update(config)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
            _GLOBAL_DYNAMIC_CACHE = existing
            _GLOBAL_DYNAMIC_CACHE_TS = time.time()
        except Exception as e:
            import structlog
            structlog.get_logger(__name__).error("settings.save_dynamic_config_failed", error=str(e))


    @property
    def active_model(self) -> str:
        # Fallback to both hekki_model and mariano_model for safety
        return self.dynamic_config.get("hekki_model", self.dynamic_config.get("mariano_model", self.mariano_model))

    @property
    def active_reasoning_mode(self) -> str:
        return self.dynamic_config.get("reasoning_mode", "fast")

    @property
    def active_gemini_api_key(self) -> str:
        # User-entered dynamically overrides env variable
        return self.dynamic_config.get("gemini_api_key", self.gemini_api_key)

    @property
    def active_news_api_key(self) -> str:
        return self.dynamic_config.get("news_api_key", self.news_api_key)

    @property
    def active_use_ollama(self) -> bool:
        return self.dynamic_config.get("use_local_gateway", self.dynamic_config.get("use_ollama", False))

    @property
    def active_ollama_model(self) -> str:
        return self.dynamic_config.get("local_model", self.dynamic_config.get("ollama_model", "qwen2.5-coder"))

    @property
    def active_ollama_base_url(self) -> str:
        return self.dynamic_config.get("local_base_url", self.dynamic_config.get("ollama_base_url", "http://localhost:11434"))

    @property
    def active_run_in_background(self) -> bool:
        return self.dynamic_config.get("run_in_background", True)

    @property
    def active_auto_start(self) -> bool:
        return self.dynamic_config.get("auto_start", False)


from functools import lru_cache

@lru_cache
def get_settings() -> Settings:
    return Settings()


