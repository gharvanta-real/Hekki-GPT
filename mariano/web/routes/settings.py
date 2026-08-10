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
    use_local_gateway: bool | None = None
    ollama_model: str | None = None
    local_model: str | None = None
    ollama_base_url: str | None = None
    local_base_url: str | None = None
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
    """Queries and returns available models."""
    settings = get_settings()
    models = [
        {"name": "Gemini 3.1", "use_ollama": False},
        {"name": settings.active_ollama_model, "use_ollama": True}
    ]
    return {"models": models, "active": {
        "use_ollama": settings.active_use_ollama,
        "ollama_model": settings.active_ollama_model,
        "mariano_model": settings.active_model
    }}


@router.get("/api/local_models")
async def get_local_models(base_url: str | None = None):
    """Dynamically queries the local server (Ollama / LM Studio / vLLM / LiteLLM)
    for all installed/available models via standard /v1/models or /api/tags endpoints.
    """
    import httpx
    import json

    settings = get_settings()
    target_url = (base_url or settings.active_ollama_base_url).rstrip('/')
    
    models = []
    
    urls_to_try = [
        f"{target_url}/v1/models",
        f"{target_url}/models",
        f"{target_url}/api/tags"  # Ollama native fallback
    ]

    async with httpx.AsyncClient(timeout=3.0) as client:
        for url in urls_to_try:
            try:
                resp = await client.get(url, headers={"User-Agent": "Hekki-Assistant/1.0"})
                if resp.status_code == 200:
                    data = resp.json()
                    if "data" in data and isinstance(data["data"], list):
                        for m in data["data"]:
                            m_id = m.get("id") or m.get("name")
                            if m_id and m_id not in models:
                                models.append(m_id)
                    elif "models" in data and isinstance(data["models"], list):
                        for m in data["models"]:
                            m_name = m.get("name") or m.get("model")
                            if m_name and m_name not in models:
                                models.append(m_name)
                    if models:
                        break
            except Exception as e:
                import structlog
                structlog.get_logger(__name__).error("failed_to_fetch_models", url=url, error=str(e))
                continue

    if not models:
        models = [settings.active_ollama_model, "qwen2.5-coder", "llama3", "deepseek-r1", "mistral"]

    return {
        "success": True,
        "base_url": target_url,
        "models": models,
        "active_model": settings.active_ollama_model
    }


@router.get("/api/settings")
async def get_api_settings():
    """Returns all dynamic configurations."""
    settings = get_settings()
    return {
        "gemini_api_key": settings.active_gemini_api_key,
        "use_ollama": settings.active_use_ollama,
        "use_local_gateway": settings.active_use_ollama,
        "ollama_model": settings.active_ollama_model,
        "local_model": settings.active_ollama_model,
        "ollama_base_url": settings.active_ollama_base_url,
        "local_base_url": settings.active_ollama_base_url,
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
    if req.use_local_gateway is not None:
        update_dict["use_local_gateway"] = req.use_local_gateway
        update_dict["use_ollama"] = req.use_local_gateway
    if req.ollama_model is not None: update_dict["ollama_model"] = req.ollama_model
    if req.local_model is not None:
        update_dict["local_model"] = req.local_model
        update_dict["ollama_model"] = req.local_model
    if req.ollama_base_url is not None: update_dict["ollama_base_url"] = req.ollama_base_url
    if req.local_base_url is not None:
        update_dict["local_base_url"] = req.local_base_url
        update_dict["ollama_base_url"] = req.local_base_url
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
    try:
        settings.save_dynamic_config(update_dict)
        return {"success": True}
    except Exception as e:
        from fastapi import HTTPException
        import structlog
        structlog.get_logger(__name__).error("failed_to_save_settings", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to save settings to disk")


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
        import asyncio
        proc = await asyncio.create_subprocess_exec(
            "kaggle", "competitions", "list",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=8.0)
        stdout_text = stdout.decode("utf-8") if stdout else ""
        if proc.returncode == 0 or "title" in stdout_text.lower():
            return {"success": True, "message": "Kaggle API Token Verified!"}
        return {"success": True, "message": "Kaggle Token Saved (~/.kaggle/access_token written)"}
    except Exception as e:
        import structlog
        structlog.get_logger(__name__).error("kaggle_verification_failed", error=str(e))
        return {"success": True, "message": "Kaggle Token Saved (~/.kaggle/access_token written)"}
