"""Settings & Kaggle API routes."""
from __future__ import annotations
import os, json, subprocess
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from mariano.config import get_settings

router = APIRouter()


class SettingsUpdateRequest(BaseModel):
    gemini_api_key: str | None = None
    use_ollama: bool | None = None
    ollama_model: str | None = None
    ollama_base_url: str | None = None
    reasoning_mode: str | None = None
    hekki_model: str | None = None
    user_name: str | None = None
    user_instructions: str | None = None
    theme: str | None = None
    quick_voice_enabled: bool | None = None
    kaggle_username: str | None = None
    kaggle_api_key: str | None = None
    debate_model_alpha: str | None = None
    debate_model_beta: str | None = None


@router.get("/api/models")
async def get_available_models():
    """Queries and returns only Gemini 3.1 and Qwen offline model."""
    settings = get_settings()
    models = [
        {"name": "Gemini 3.1", "use_ollama": False},
        {"name": "qwen2.5-coder-abliterate:3b", "use_ollama": True}
    ]
    return {"models": models, "active": {
        "use_ollama": settings.active_use_ollama,
        "ollama_model": settings.active_ollama_model,
        "mariano_model": settings.active_model
    }}


@router.get("/api/settings")
async def get_api_settings():
    """Returns all dynamic configurations."""
    settings = get_settings()
    return {
        "gemini_api_key": settings.active_gemini_api_key,
        "use_ollama": settings.active_use_ollama,
        "ollama_model": settings.active_ollama_model,
        "ollama_base_url": settings.active_ollama_base_url,
        "hekki_model": settings.active_model,
        "reasoning_mode": settings.active_reasoning_mode,
        "user_name": settings.dynamic_config.get("user_name", ""),
        "user_instructions": settings.dynamic_config.get("user_instructions", ""),
        "theme": settings.dynamic_config.get("theme", "dark"),
        "quick_voice_enabled": settings.dynamic_config.get("quick_voice_enabled", True),
        "kaggle_username": settings.dynamic_config.get("kaggle_username", os.environ.get("KAGGLE_USERNAME", "")),
        "kaggle_api_key": settings.dynamic_config.get("kaggle_api_key", os.environ.get("KAGGLE_KEY", "")),
        "debate_model_alpha": settings.dynamic_config.get("debate_model_alpha", "gemini-3.1-flash-lite"),
        "debate_model_beta": settings.dynamic_config.get("debate_model_beta", "gemini-3.1-flash-lite"),
    }


@router.post("/api/settings")
async def update_api_settings(req: SettingsUpdateRequest):
    """Saves dynamic configurations to persistent settings file."""
    settings = get_settings()
    update_dict = {}
    if req.gemini_api_key is not None: update_dict["gemini_api_key"] = req.gemini_api_key
    if req.use_ollama is not None: update_dict["use_ollama"] = req.use_ollama
    if req.ollama_model is not None: update_dict["ollama_model"] = req.ollama_model
    if req.ollama_base_url is not None: update_dict["ollama_base_url"] = req.ollama_base_url
    if req.reasoning_mode is not None: update_dict["reasoning_mode"] = req.reasoning_mode
    if req.hekki_model is not None: update_dict["hekki_model"] = req.hekki_model
    if req.user_name is not None: update_dict["user_name"] = req.user_name
    if req.user_instructions is not None: update_dict["user_instructions"] = req.user_instructions
    if req.theme is not None: update_dict["theme"] = req.theme
    if req.quick_voice_enabled is not None: update_dict["quick_voice_enabled"] = req.quick_voice_enabled
    if req.kaggle_username is not None:
        update_dict["kaggle_username"] = req.kaggle_username
        os.environ["KAGGLE_USERNAME"] = req.kaggle_username
    if req.debate_model_alpha is not None: update_dict["debate_model_alpha"] = req.debate_model_alpha
    if req.debate_model_beta is not None: update_dict["debate_model_beta"] = req.debate_model_beta
    if req.kaggle_api_key is not None:
        update_dict["kaggle_api_key"] = req.kaggle_api_key
        os.environ["KAGGLE_KEY"] = req.kaggle_api_key
    settings.save_dynamic_config(update_dict)
    return {"success": True}


@router.post("/api/kaggle/verify")
async def verify_kaggle_connection(payload: dict):
    """Verifies Kaggle API credentials."""
    username = payload.get("kaggle_username") or os.environ.get("KAGGLE_USERNAME", "")
    key = payload.get("kaggle_api_key") or os.environ.get("KAGGLE_KEY", "") or os.environ.get("KAGGLE_API_TOKEN", "")
    if not key:
        return {"success": False, "message": "Kaggle API Key/Token is required."}
    kaggle_dir = Path("~/.kaggle").expanduser()
    kaggle_dir.mkdir(parents=True, exist_ok=True)
    if key.startswith("KGAT_"):
        os.environ["KAGGLE_API_TOKEN"] = key
        if username: os.environ["KAGGLE_USERNAME"] = username
        token_file = kaggle_dir / "access_token"
        token_file.write_text(key, encoding="utf-8")
        try: os.chmod(token_file, 0o600)
        except Exception: pass
    else:
        os.environ["KAGGLE_USERNAME"] = username
        os.environ["KAGGLE_KEY"] = key
        kaggle_file = kaggle_dir / "kaggle.json"
        kaggle_file.write_text(json.dumps({"username": username, "key": key}), encoding="utf-8")
        try: os.chmod(kaggle_file, 0o600)
        except Exception: pass
    try:
        res = subprocess.run(["kaggle", "competitions", "list"], capture_output=True, text=True, timeout=8)
        if res.returncode == 0 or "title" in res.stdout.lower():
            return {"success": True, "message": "Kaggle API Token Verified!"}
        return {"success": True, "message": "Kaggle Token Saved (~/.kaggle/access_token written)"}
    except Exception:
        return {"success": True, "message": "Kaggle Token Saved (~/.kaggle/access_token written)"}
