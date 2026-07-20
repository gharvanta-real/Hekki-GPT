"""
Unit tests for the Hekki Coder Engine.
Tests the FSM, ASTGuard, DiffPatcher, and MemoryMappedBridge.
"""
from __future__ import annotations
import os
import tempfile
from pathlib import Path
import pytest

from mariano.coder_engine.fsm import CoderFSM, CoderState
from mariano.coder_engine.ast_guard import ASTGuard
from mariano.coder_engine.diff_patcher import DiffPatcher
from mariano.coder_engine.ipc_bridge import MemoryMappedBridge

# 1. Test FSM Transitions and Token Budgeting
def test_coder_fsm_budget_and_transitions():
    # Setup FSM with small token limit (100)
    fsm = CoderFSM(file_size_tokens=100, budget_multiplier=3.0)
    assert fsm.state == CoderState.IDLE
    assert fsm.remaining_budget == 300

    # Test valid transition
    assert fsm.transition_to(CoderState.ANALYZING, "Started analysis")
    assert fsm.state == CoderState.ANALYZING

    # Test invalid transition
    assert not fsm.transition_to(CoderState.APPLYING, "Illegal jump")
    assert fsm.state == CoderState.ANALYZING

    # Consume some tokens
    fsm.consume_tokens(100)
    assert fsm.remaining_budget == 200

    # Record error and check penalty escalation
    fsm.record_error("Syntax check failed")
    assert fsm.state == CoderState.ERROR
    assert fsm.error_count == 1
    # Effective cost: 100 * 1.5 = 150. Remaining budget: 300 - 150 = 150
    assert fsm.remaining_budget == 150

    # Reset
    fsm.reset()
    assert fsm.state == CoderState.IDLE
    assert fsm.tokens_consumed == 0
    assert fsm.error_count == 0

# 2. Test AST Guard Parsing and Sibling Suggestion
def test_ast_guard_python_parsing():
    content = (
        "class TestWorker:\n"
        "    def execute_work(self):\n"
        "        pass\n"
        "\n"
        "    def run_tests(self):\n"
        "        pass\n"
        "\n"
        "def helper_func():\n"
        "    pass\n"
    )
    
    guard = ASTGuard(file_path="mock_file.py", content=content)
    assert len(guard.nodes) >= 4
    
    # Verify nodes
    class_node = guard.verify_node("TestWorker")
    assert class_node is not None
    assert class_node.type == "class"
    
    func_node = guard.verify_node("execute_work")
    assert func_node is not None
    assert func_node.type == "function"
    assert func_node.parent == "TestWorker"

    # Test suggestions for hallucinated path
    suggestions = guard.get_sibling_suggestions("execute_work_v2")
    assert "execute_work" in suggestions
    assert "run_tests" in suggestions

def test_ast_guard_fallback_parsing():
    content = (
        "class MockInterface {\n"
        "  async executeTask() {\n"
        "  }\n"
        "}\n"
    )
    guard = ASTGuard(file_path="mock_file.js", content=content)
    class_node = guard.verify_node("MockInterface")
    assert class_node is not None
    
    func_node = guard.verify_node("executeTask")
    assert func_node is not None

# 3. Test DiffPatcher Transactional Patching & Rollback
def test_diff_patcher_transactions():
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "app.py"
        original_code = (
            "def calculate(a, b):\n"
            "    return a + b\n"
        )
        test_file.write_text(original_code, encoding="utf-8")

        patcher = DiffPatcher(str(test_file))
        
        # Test applying a successful patch
        patched = patcher.apply_patch(
            old_content="return a + b",
            new_content="return a * b"
        )
        assert patched
        assert patcher.verify_syntax()

        # Commit patch
        assert patcher.commit()
        
        # Verify changes on disk
        updated_code = test_file.read_text(encoding="utf-8")
        assert "return a * b" in updated_code

        # Test applying an invalid syntax patch causing automatic rollback
        patcher2 = DiffPatcher(str(test_file))
        patched_invalid = patcher2.apply_patch(
            old_content="return a * b",
            new_content="return a * ((" # Syntax error
        )
        assert patched_invalid
        assert not patcher2.verify_syntax()
        
        # Commit should fail and trigger rollback
        assert not patcher2.commit()
        
        # Verify original state remains
        restored_code = test_file.read_text(encoding="utf-8")
        assert "return a * b" in restored_code

# 4. Test MemoryMappedBridge for Zero-Copy sharing
def test_memory_mapped_bridge():
    with tempfile.TemporaryDirectory() as tmpdir:
        mmap_file = Path(tmpdir) / "shared_mem.dat"
        bridge = MemoryMappedBridge(str(mmap_file), size_bytes=100)
        
        payload = b"Hekki Coder Engine Payload Test"
        assert bridge.write_payload(payload)
        
        # Read back
        read_payload = bridge.read_payload()
        assert read_payload == payload
        
        bridge.close()

# 5. Test DiffPatcher verify_syntax for JSON files
def test_diff_patcher_json_syntax_check():
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "config.json"
        valid_json = '{"name": "hekki", "version": "1.0"}'
        test_file.write_text(valid_json, encoding="utf-8")

        patcher = DiffPatcher(str(test_file))
        patcher.apply_patch('"version": "1.0"', '"version": "2.0"')
        assert patcher.verify_syntax()  # valid JSON should pass
        patcher.cleanup()

        # Now test invalid JSON
        patcher2 = DiffPatcher(str(test_file))
        patcher2.apply_patch('"version": "1.0"', '"version": {broken json')
        assert not patcher2.verify_syntax()  # broken JSON should fail
        assert patcher2.last_error is not None
        patcher2.cleanup()

# 6. Test DiffPatcher verify_syntax pass-through for unknown types
def test_diff_patcher_unknown_type_passthrough():
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "readme.md"
        test_file.write_text("# Hello World\n", encoding="utf-8")

        patcher = DiffPatcher(str(test_file))
        patcher.apply_patch("# Hello World", "# Updated Title")
        # Markdown has no checker: must return True (pass-through)
        assert patcher.verify_syntax()
        patcher.cleanup()

# 7. Test ASTGuard end_lineno bug fix (was end_line, always returned start_line)
def test_ast_guard_end_lineno_fix():
    content = (
        "class BigClass:\n"
        "    def method_one(self):\n"
        "        x = 1\n"
        "        return x\n"
        "\n"
        "    def method_two(self):\n"
        "        pass\n"
    )
    guard = ASTGuard(file_path="test.py", content=content)
    cls_node = guard.verify_node("BigClass")
    assert cls_node is not None
    # With the fix, end_line should be 7 (last line of class), not 1 (start_line)
    assert cls_node.end_line > cls_node.start_line

# 8. Test ASTNodeInfo children default_factory fix (was bare `list` type, bug)
def test_ast_node_info_children_default():
    from mariano.coder_engine.ast_guard import ASTNodeInfo
    # Creating two separate instances must not share the same children list
    node_a = ASTNodeInfo(name="A", type="class", start_line=1, end_line=5)
    node_b = ASTNodeInfo(name="B", type="class", start_line=6, end_line=10)
    node_a.children.append("child_of_a")
    assert "child_of_a" not in node_b.children  # Bug: would fail if children=list

# 9. Test DiffPatcher preview_patch dry-run
def test_diff_patcher_preview_patch():
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "sample.py"
        original = "def greet():\n    return 'hello'\n"
        test_file.write_text(original, encoding="utf-8")

        patcher = DiffPatcher(str(test_file))

        # Should return a unified diff string
        diff = patcher.preview_patch("return 'hello'", "return 'world'")
        assert diff is not None
        assert "-" in diff and "+" in diff  # Must contain removal and addition lines

        # File on disk must NOT have changed
        assert test_file.read_text(encoding="utf-8") == original

        # Non-existent old_content must return None
        diff_none = patcher.preview_patch("DOES NOT EXIST", "anything")
        assert diff_none is None

        patcher.cleanup()

# 10. Test ASTGuard list_all_symbols API
def test_ast_guard_list_all_symbols():
    content = (
        "class Router:\n"
        "    def get(self): pass\n"
        "    def post(self): pass\n"
    )
    guard = ASTGuard(file_path="router.py", content=content)
    symbols = guard.list_all_symbols()
    names = [s["name"] for s in symbols]
    assert "Router" in names
    assert "get" in names
    assert "post" in names
    # All entries must have required fields
    for s in symbols:
        assert "name" in s and "type" in s and "start_line" in s and "end_line" in s


