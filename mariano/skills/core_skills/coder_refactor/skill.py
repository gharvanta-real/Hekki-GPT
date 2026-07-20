"""MARIANO Core Skill — Transactional AST Coder Refactor."""
from __future__ import annotations
from mariano.skills._base import BaseSkill, SkillResult
from mariano.coder_engine.ast_guard import ASTGuard
from mariano.coder_engine.diff_patcher import DiffPatcher
from mariano.coder_engine.fsm import CoderFSM, CoderState
from mariano.core.workspace import PathGuard
import structlog

log = structlog.get_logger(__name__)

class CoderRefactorSkill(BaseSkill):
    name = "coder_refactor"
    description = (
        "Applies a safe, transactional AST-aware code replacement (patch) on a local file. "
        "Performs pre-flight symbol checks and automatic rollback if compilation/syntax verification fails."
    )
    version = "1.0.0"
    tags = ["code", "refactor", "patch", "edit", "write"]

    def get_parameters_schema(self) -> dict:
        return {
            "file_path": {
                "type": "string",
                "description": "Path to the source code file to edit (relative to project root).",
                "required": True
            },
            "old_content": {
                "type": "string",
                "description": "The exact string block of code to be replaced.",
                "required": True
            },
            "new_content": {
                "type": "string",
                "description": "The new replacement string block of code.",
                "required": True
            },
            "verify_symbol": {
                "type": "string",
                "description": "Optional name of function or class to verify pre-flight in the AST.",
                "required": False
            }
        }

    async def execute(
        self,
        file_path: str,
        old_content: str,
        new_content: str,
        verify_symbol: str | None = None
    ) -> SkillResult:
        try:
            # Secure path resolution via Hekki workspace PathGuard
            resolved_path = PathGuard.secure_path(file_path)

            if not resolved_path.exists():
                return SkillResult(
                    success=False,
                    data=None,
                    error=f"Target file does not exist: {file_path}"
                )

            with open(resolved_path, "r", encoding="utf-8") as f:
                content = f.read()

            # --- Initialize FSM for refactor lifecycle tracking ---
            file_size_tokens = max(200, len(content) // 4)
            fsm = CoderFSM(file_size_tokens=file_size_tokens)
            fsm.transition_to(CoderState.ANALYZING, "Agent-initiated refactor: reading file")
            fsm.consume_tokens(file_size_tokens)

            # 1. Pre-flight verification using ASTGuard
            if verify_symbol:
                guard = ASTGuard(str(resolved_path), content)
                node_info = guard.verify_node(verify_symbol)
                if not node_info:
                    siblings = guard.get_sibling_suggestions(verify_symbol)
                    siblings_str = ", ".join(siblings) if siblings else "None"
                    fsm.record_error(f"Symbol '{verify_symbol}' not found")
                    return SkillResult(
                        success=False,
                        data=None,
                        error=(
                            f"Pre-flight AST Verification Failed: Symbol '{verify_symbol}' was not found in {file_path}. "
                            f"Did you mean one of these? [{siblings_str}]"
                        )
                    )
                log.info("coder_refactor.preflight_passed", symbol=verify_symbol)

            # 2. VALIDATING — Setup DiffPatcher sandbox transaction
            fsm.transition_to(CoderState.VALIDATING, "Pre-flight passed, preparing sandbox patch")
            patcher = DiffPatcher(str(resolved_path))

            # 3. Apply patch in isolated sandbox replica
            if not patcher.apply_patch(old_content, new_content):
                patcher.cleanup()
                fsm.record_error("Patch target string not found")
                return SkillResult(
                    success=False,
                    data=None,
                    error="Patch Failed: The target old_content was not found in the file."
                )

            # 4. APPLYING — Atomic commit (syntax check + swap / rollback on failure)
            fsm.transition_to(CoderState.APPLYING, "Syntax valid, committing atomically")
            success = patcher.commit()
            if not success:
                error_msg = "Refactor Failed: Patched code has syntax errors. Atomic rollback triggered."
                if patcher.last_error:
                    error_msg += f" Diagnostics: {patcher.last_error}"
                fsm.record_error("Commit syntax check failed")
                return SkillResult(success=False, data=None, error=error_msg)

            # 5. IDLE — Success
            fsm.consume_tokens(len(new_content) // 4)
            fsm.transition_to(CoderState.IDLE, "Refactor committed successfully")
            log.info(
                "coder_refactor.execution_success",
                file_path=file_path,
                fsm_state=fsm.state.value,
                tokens_consumed=fsm.tokens_consumed,
            )
            return SkillResult(
                success=True,
                data=f"Successfully refactored {file_path}! Changes committed atomically.",
                metadata={
                    "file_path": file_path,
                    "fsm_state": fsm.state.value,
                    "tokens_consumed": fsm.tokens_consumed,
                    "remaining_budget": fsm.remaining_budget,
                }
            )

        except Exception as e:
            log.error("coder_refactor.execution_exception", error=str(e))
            return SkillResult(success=False, data=None, error=str(e))
