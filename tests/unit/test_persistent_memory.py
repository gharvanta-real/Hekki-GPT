import os
import shutil
import tempfile
import pytest
from mariano.core.persistent_memory import PersistentMemoryManager

def test_persistent_memory_crud_and_hashing():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_memory.json")
    try:
        mem = PersistentMemoryManager(storage_path=db_path)
        
        # Test Set
        hash1 = mem.set("user_language", "Hinglish", category="preferences", priority=5)
        hash2 = mem.set("project_rule", "Never exceed 500 lines per file", category="rules", priority=5)
        
        assert hash1 != hash2
        assert mem.get("user_language") == "Hinglish"
        assert mem.get("non_existent", "default_val") == "default_val"
        
        # Test Search
        results = mem.search("Hinglish")
        assert len(results) == 1
        assert results[0]["key"] == "user_language"
        
        # Test Prompt Context Generation
        prompt_ctx = mem.get_prompt_context()
        assert "<ACTIVE_PERSISTENT_MEMORY>" in prompt_ctx
        assert "[PREFERENCES] user_language: Hinglish" in prompt_ctx
        assert "[RULES] project_rule: Never exceed 500 lines per file" in prompt_ctx
        
        # Test Reload from storage
        mem2 = PersistentMemoryManager(storage_path=db_path)
        assert mem2.get("user_language") == "Hinglish"
        assert mem2.compute_state_hash() == mem.compute_state_hash()
        
        # Test Delete
        assert mem.delete("user_language") is True
        assert mem.get("user_language") is None
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    pytest.main(["-v", __file__])
