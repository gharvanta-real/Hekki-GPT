"""MARIANO Core — Workspace isolation engine and path guard."""
from __future__ import annotations
import contextvars
from pathlib import Path
from mariano.config.settings import get_settings

# Thread-safe/Async-safe context variable to store the active project workspace ID
# If None, the agent runs in self-evolution/admin mode with host-level access
active_project_context: contextvars.ContextVar[str | None] = contextvars.ContextVar("active_project", default=None)

# Stores the *actual* filesystem path of the active project (may be an external user folder).
# When set, secure_path() uses this root instead of the internal sandbox directory.
active_project_path_context: contextvars.ContextVar[str | None] = contextvars.ContextVar("active_project_path", default=None)

class PathGuard:
    @staticmethod
    def get_active_project() -> str | None:
        return active_project_context.get()

    @staticmethod
    def get_active_project_path() -> str | None:
        """Returns the explicit filesystem path of the active project (if set)."""
        return active_project_path_context.get()

    @staticmethod
    def set_active_project(project_id: str | None, project_path: str | None = None) -> None:
        """
        Set the active project context.

        Args:
            project_id:   The project name / identifier (e.g. "my-app").
            project_path: Optional *absolute* filesystem path to the project root.
                          When provided, secure_path() will scope all relative paths
                          against this directory instead of the internal sandbox.
        """
        active_project_context.set(project_id)
        active_project_path_context.set(project_path)

    @staticmethod
    def secure_path(raw_path: str | Path) -> Path:
        """
        Resolves path and validates that it remains inside the scoped project workspace.

        Resolution order:
          1. If no active project → Base Mode: unrestricted host access.
          2. If an explicit project_path was set (external user folder) → use that as root.
          3. Otherwise → resolve relative to the internal sandbox folder
             at <data_dir>/workspaces/<project_id>.
        """
        project_id = active_project_context.get()
        if not project_id:
            # Base System/Self-evolution mode: allow unrestricted access to host files
            return Path(raw_path).resolve()

        # Prefer an explicit external project root (set when user browses to a folder)
        explicit_path = active_project_path_context.get()
        if explicit_path and Path(explicit_path).is_absolute():
            workspaces_root = Path(explicit_path).resolve()
        else:
            # Fall back to internal sandbox for projects without an explicit path
            settings = get_settings()
            workspaces_root = (settings.mariano_data_dir / "workspace" / project_id).resolve()

        workspaces_root.mkdir(parents=True, exist_ok=True)

        raw_p = Path(raw_path)
        if not raw_p.is_absolute():
            target_path = (workspaces_root / raw_p).resolve()
        else:
            target_path = raw_p.resolve()

        # Security validation: check if the resolved path is inside the project workspace directory
        if not target_path.is_relative_to(workspaces_root):
            raise PermissionError(
                f"Security Violation: Path '{raw_path}' resolves outside the active project workspace sandbox: '{workspaces_root}'"
            )

        # ----------------------------------------------------
        # WORKSPACE BOUNDARY EXCLUSIONS (SHURI vs STARK DEBATE)
        # Prevent access to credentials, git internals, ssh keys, or sensitive files
        # ----------------------------------------------------
        BLOCKED_PATH_COMPONENTS = {".git", ".ssh"}
        BLOCKED_FILE_PATTERNS = {".env", "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"}
        BLOCKED_EXTENSIONS = {".pem", ".key", ".pfx", ".cer"}

        for part in target_path.parts:
            if part in BLOCKED_PATH_COMPONENTS:
                raise PermissionError(
                    f"Security Violation: Access to blocked directory component '{part}' is restricted."
                )

        name = target_path.name.lower()
        for pattern in BLOCKED_FILE_PATTERNS:
            if pattern in name:
                raise PermissionError(
                    f"Security Violation: Access to sensitive file matching '{name}' is restricted."
                )

        if target_path.suffix.lower() in BLOCKED_EXTENSIONS:
            raise PermissionError(
                f"Security Violation: Access to cryptographic key/certificate file '{target_path.name}' is restricted."
            )

        return target_path
