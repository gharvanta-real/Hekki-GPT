"""
agy_auto_setup.py — Zero-Config Antigravity CLI Environment Setup
Detects agy binary. If missing, exposes a download guide for public users.
Strictly under 100 lines.
"""

from __future__ import annotations
import os
import shutil
import logging

logger = logging.getLogger("Hekki.AgyAutoSetup")

AGY_DOWNLOAD_URL = "https://antigravity.dev"
AGY_INSTALL_GUIDE = (
    "Install Antigravity CLI:\n"
    "  Windows: Download from https://antigravity.dev\n"
    "  Mac/Linux: curl -sSL https://antigravity.dev/install.sh | bash"
)

class AgyAutoSetup:

    @staticmethod
    def find_agy_path() -> str | None:
        """Locate agy binary anywhere on the system."""
        found = shutil.which("agy")
        if found:
            return found
        candidates = [
            os.path.join(os.path.expanduser("~"), "AppData", "Local", "agy", "bin", "agy.exe"),
            os.path.join(os.path.expanduser("~"), ".gemini", "antigravity", "bin", "agy.exe"),
            os.path.join(os.path.expanduser("~"), ".gemini", "antigravity", "bin", "agy"),
            os.path.join(os.path.expanduser("~"), ".local", "bin", "agy"),
            "/usr/local/bin/agy",
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return None

    @staticmethod
    def ensure_environment_ready() -> dict:
        """
        Called on every Hekki Code page load.
        Returns health status. Does not block the page load.
        """
        agy_path = AgyAutoSetup.find_agy_path()

        if agy_path:
            logger.info(f"[AgyAutoSetup] Found agy at: {agy_path}")
            return {
                "ready": True,
                "agy_path": agy_path,
                "message": "Antigravity Engine is active & ready.",
            }

        logger.warning("[AgyAutoSetup] agy binary not found on system.")
        return {
            "ready": False,
            "agy_path": None,
            "message": "Antigravity CLI not installed.",
            "install_guide": AGY_INSTALL_GUIDE,
            "download_url": AGY_DOWNLOAD_URL,
        }
