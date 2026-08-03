"""
Kaggle Qwen Uncensored Orchestrator.
Manages Kaggle GPU Kernel deployments for running uncensored Qwen models via Kaggle API.
"""

from __future__ import annotations

import os
import json
import subprocess
from pathlib import Path
from typing import Any, Dict

import structlog

log = structlog.get_logger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
KERNEL_DIR = BASE_DIR / "kaggle" / "qwen_kernel"


class KaggleQwenOrchestrator:
    """Orchestrates launching and interacting with Uncensored Qwen models on Kaggle GPUs."""

    _instance: KaggleQwenOrchestrator | None = None

    @classmethod
    def get_instance(cls) -> KaggleQwenOrchestrator:
        if cls._instance is None:
            cls._instance = KaggleQwenOrchestrator()
        return cls._instance

    def __init__(self) -> None:
        self.kernel_slug = "hekki-uncensored-qwen-t4x2"

    def check_credentials(self) -> Dict[str, Any]:
        """Check whether Kaggle username & API key/token are configured."""
        token = os.environ.get("KAGGLE_API_TOKEN")
        user = os.environ.get("KAGGLE_USERNAME")
        key = os.environ.get("KAGGLE_KEY")

        kaggle_dir = Path("~/.kaggle").expanduser()
        token_exists = (kaggle_dir / "access_token").exists() or bool(token)
        json_exists = (kaggle_dir / "kaggle.json").exists() or bool(user and key)

        authenticated = token_exists or json_exists

        return {
            "authenticated": authenticated,
            "username": user or "Kaggle User",
            "has_api_token": token_exists,
            "has_kaggle_json": json_exists,
        }

    def push_qwen_kernel(self) -> Dict[str, Any]:
        """Pushes the Qwen GPU kernel script to Kaggle using kaggle-cli."""
        creds = self.check_credentials()
        if not creds["authenticated"]:
            return {
                "success": False,
                "message": "Kaggle API credentials not found. Please configure Kaggle API Token in Settings or .env.",
            }

        if not KERNEL_DIR.exists():
            return {"success": False, "message": f"Kernel directory {KERNEL_DIR} missing."}

        try:
            cmd = ["kaggle", "kernels", "push", "-p", str(KERNEL_DIR)]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if res.returncode == 0:
                log.info("kaggle_qwen.push_success", output=res.stdout)
                return {
                    "success": True,
                    "message": "Successfully pushed Uncensored Qwen GPU kernel to Kaggle!",
                    "output": res.stdout.strip(),
                }
            else:
                log.error("kaggle_qwen.push_error", error=res.stderr)
                return {
                    "success": False,
                    "message": f"Kaggle push failed: {res.stderr.strip()}",
                }
        except Exception as e:
            log.exception("kaggle_qwen.push_exception", error=str(e))
            return {"success": False, "message": f"Exception during Kaggle push: {str(e)}"}

    def get_kernel_status(self) -> Dict[str, Any]:
        """Fetch execution status of the pushed Kaggle Qwen GPU kernel."""
        creds = self.check_credentials()
        if not creds["authenticated"]:
            return {"success": False, "status": "UNAUTHENTICATED"}

        try:
            cmd = ["kaggle", "kernels", "status", f"{creds['username']}/{self.kernel_slug}"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if res.returncode == 0:
                return {"success": True, "status": res.stdout.strip()}
            return {"success": False, "status": "UNKNOWN", "error": res.stderr.strip()}
        except Exception as e:
            return {"success": False, "status": "ERROR", "error": str(e)}
