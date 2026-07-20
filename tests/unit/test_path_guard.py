"""
Unit tests for Upgraded PathGuard boundaries and security exclusions.
Verifies git, env, SSH keys, and certificate blocking rules.
"""
from __future__ import annotations
import tempfile
from pathlib import Path
import pytest
from mariano.core.workspace import PathGuard

def test_path_guard_standard_scoping():
    with tempfile.TemporaryDirectory() as tmpdir:
        PathGuard.set_active_project("project_a", project_path=tmpdir)
        
        # Valid path
        valid_path = PathGuard.secure_path("src/main.py")
        assert valid_path == Path(tmpdir).resolve() / "src" / "main.py"
        
        # Escape path violation
        with pytest.raises(PermissionError) as exc_info:
            PathGuard.secure_path("../../../etc/passwd")
        assert "resolves outside the active project workspace" in str(exc_info.value)
        
        # Cleanup
        PathGuard.set_active_project(None)

def test_path_guard_blocked_components():
    with tempfile.TemporaryDirectory() as tmpdir:
        PathGuard.set_active_project("project_a", project_path=tmpdir)
        
        # Attempt to access .git folder components
        with pytest.raises(PermissionError) as exc_info:
            PathGuard.secure_path(".git/config")
        assert "Access to blocked directory component" in str(exc_info.value)
        
        with pytest.raises(PermissionError) as exc_info:
            PathGuard.secure_path("src/submodule/.git/HEAD")
        assert "Access to blocked directory component" in str(exc_info.value)
        
        # Cleanup
        PathGuard.set_active_project(None)

def test_path_guard_blocked_files_and_extensions():
    with tempfile.TemporaryDirectory() as tmpdir:
        PathGuard.set_active_project("project_a", project_path=tmpdir)
        
        # Blocked .env file
        with pytest.raises(PermissionError) as exc_info:
            PathGuard.secure_path("src/config/.env")
        assert "Access to sensitive file matching" in str(exc_info.value)
        
        # Blocked SSH keys
        with pytest.raises(PermissionError) as exc_info:
            PathGuard.secure_path("keys/id_rsa_backup")
        assert "Access to sensitive file matching" in str(exc_info.value)
        
        # Blocked SSL certificates / keys
        with pytest.raises(PermissionError) as exc_info:
            PathGuard.secure_path("certs/domain.key")
        assert "Access to cryptographic key/certificate file" in str(exc_info.value)
        
        with pytest.raises(PermissionError) as exc_info:
            PathGuard.secure_path("ssl/domain.pem")
        assert "Access to cryptographic key/certificate file" in str(exc_info.value)
        
        # Cleanup
        PathGuard.set_active_project(None)
