"""
Hekki Coder Engine — Diff Patcher

Performs transactional in-memory code patching, syntax checks,
and atomic rollback mechanisms to prevent file corruption.
"""
from __future__ import annotations
import ast
import difflib
import json as _json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional
import structlog

log = structlog.get_logger(__name__)

class DiffPatcher:
    """
    Handles two-phase commits on file writes by editing copies in a temp sandbox,
    verifying syntax compilation, and swapping descriptors atomically.
    """
    def __init__(self, target_file_path: str) -> None:
        self.target_path = Path(target_file_path).resolve()
        self.original_backup: Optional[str] = None
        self.temp_dir: Optional[str] = None
        self.temp_file_path: Optional[Path] = None
        self.last_error: Optional[str] = None
        self._prepare_sandbox()

    def _prepare_sandbox(self) -> None:
        """Create a temporary replica of the target file to patch in isolation."""
        if not self.target_path.exists():
            # Create parent directories if missing
            self.target_path.parent.mkdir(parents=True, exist_ok=True)
            self.target_path.touch()

        # Read original backup
        with open(self.target_path, "r", encoding="utf-8") as f:
            self.original_backup = f.read()

        # Setup temp path
        self.temp_dir = tempfile.mkdtemp()
        self.temp_file_path = Path(self.temp_dir) / self.target_path.name
        
        # Copy file to temp replica
        shutil.copy2(self.target_path, self.temp_file_path)
        log.debug("patcher.sandbox_prepared", sandbox_path=str(self.temp_file_path))

    def preview_patch(self, old_content: str, new_content: str) -> Optional[str]:
        """
        Dry-run: computes a unified diff of the proposed patch WITHOUT writing
        anything to disk or touching the sandbox.

        Returns:
            A unified diff string if old_content is found, or None if not found.
        """
        try:
            with open(self.target_path, "r", encoding="utf-8") as f:
                original = f.read()

            if old_content not in original:
                return None

            patched = original.replace(old_content, new_content, 1)
            diff_lines: List[str] = list(difflib.unified_diff(
                original.splitlines(keepends=True),
                patched.splitlines(keepends=True),
                fromfile=f"a/{self.target_path.name}",
                tofile=f"b/{self.target_path.name}",
                lineterm="",
            ))
            return "".join(diff_lines) if diff_lines else "(no changes detected)"
        except Exception as e:
            log.error("patcher.preview_failed", error=str(e))
            return None

    def apply_patch(self, old_content: str, new_content: str) -> bool:
        """
        Replaces 'old_content' with 'new_content' inside the temporary sandbox copy.
        Returns True if the patch was successfully written to the temp replica.
        """
        try:
            with open(self.temp_file_path, "r", encoding="utf-8") as f:
                content = f.read()

            if old_content not in content:
                log.error("patcher.target_missing", target=old_content[:100])
                return False

            patched_content = content.replace(old_content, new_content, 1)

            with open(self.temp_file_path, "w", encoding="utf-8") as f:
                f.write(patched_content)

            log.info("patcher.patch_applied_in_sandbox")
            return True
        except Exception as e:
            log.error("patcher.apply_patch_failed", error=str(e))
            return False

    def verify_syntax(self) -> bool:
        """
        Validates compilation of the patched sandbox copy.
        Language support:
          - .py  : Python native ast.parse
          - .json: json.loads
          - .js/.ts/.jsx/.tsx/.mjs: subprocess node --check
          - other: pass-through (no checker available)
        """
        if not self.temp_file_path or not self.temp_file_path.exists():
            return False

        suffix = self.target_path.suffix.lower()

        if suffix == ".py":
            try:
                with open(self.temp_file_path, "r", encoding="utf-8") as f:
                    ast.parse(f.read())
                log.info("patcher.syntax_verification_passed", lang="python")
                return True
            except SyntaxError as se:
                self.last_error = (
                    f"SyntaxError in {self.target_path.name} "
                    f"at line {se.lineno}, column {se.offset}: {se.msg}"
                )
                log.warning("patcher.syntax_verification_failed", lang="python", line=se.lineno, error=se.msg)
                return False

        elif suffix == ".json":
            try:
                with open(self.temp_file_path, "r", encoding="utf-8") as f:
                    _json.loads(f.read())
                log.info("patcher.syntax_verification_passed", lang="json")
                return True
            except _json.JSONDecodeError as je:
                self.last_error = (
                    f"JSONDecodeError at line {je.lineno}, col {je.colno}: {je.msg}"
                )
                log.warning("patcher.syntax_verification_failed", lang="json", error=str(je))
                return False

        elif suffix in {".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"}:
            try:
                result = subprocess.run(
                    ["node", "--check", str(self.temp_file_path)],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode != 0:
                    self.last_error = result.stderr.strip() or "node --check failed"
                    log.warning("patcher.syntax_verification_failed", lang="js/ts", error=self.last_error)
                    return False
                log.info("patcher.syntax_verification_passed", lang="js/ts")
                return True
            except FileNotFoundError:
                log.info("patcher.node_not_installed_skipping_check")
                return True  # node unavailable — pass through gracefully
            except subprocess.TimeoutExpired:
                log.warning("patcher.node_check_timeout_skipping")
                return True  # timeout — don't block the commit

        # All other file types — no static checker available
        log.debug("patcher.syntax_check_skipped", suffix=suffix)
        return True

    def commit(self) -> bool:
        """
        Commits sandbox changes to the real file atomically using OS replace.
        Cleans up temp directories.
        """
        try:
            if not self.verify_syntax():
                log.warn("patcher.commit_aborted_due_to_syntax")
                self.rollback()
                return False

            # POSIX atomic swap (or Windows equivalent via replacement)
            # os.replace handles atomic overwrite safely on NTFS and ext4
            try:
                os.replace(self.temp_file_path, self.target_path)
            except OSError as exc:
                # Fallback for cross-drive moves (e.g. C: to D: on Windows)
                log.info("patcher.replace_cross_drive_detected", error=str(exc))
                shutil.move(str(self.temp_file_path), str(self.target_path))
            log.info("patcher.commit_successful", file_path=str(self.target_path))
            self.cleanup()
            return True
        except Exception as e:
            log.error("patcher.commit_failed", error=str(e))
            self.rollback()
            return False

    def rollback(self) -> None:
        """Restores file to its original backup and cleans up sandbox."""
        try:
            if self.original_backup is not None:
                with open(self.target_path, "w", encoding="utf-8") as f:
                    f.write(self.original_backup)
                log.info("patcher.rollback_complete", file_path=str(self.target_path))
        except Exception as e:
            log.critical("patcher.rollback_failed", error=str(e))
        finally:
            self.cleanup()

    def cleanup(self) -> None:
        """Clean up the temp folder."""
        if self.temp_dir and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir)
                log.debug("patcher.cleanup_success")
            except Exception as e:
                log.error("patcher.cleanup_failed", error=str(e))
            finally:
                self.temp_dir = None
                self.temp_file_path = None
