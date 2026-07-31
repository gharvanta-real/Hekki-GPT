import pytest
import shutil
from pathlib import Path
from mariano.skills.core_skills.file_manager.skill import FileManagerSkill

@pytest.mark.asyncio
async def test_file_manager_full_actions(tmp_path):
    skill = FileManagerSkill()
    
    # 1. Test create_dir
    dir_path = tmp_path / "test_folder"
    res_mkdir = await skill.execute(action="create_dir", path=str(dir_path))
    assert res_mkdir.success
    assert dir_path.is_dir()

    # 2. Test write
    file_path = dir_path / "hello.txt"
    res_write = await skill.execute(action="write", path=str(file_path), content="Hello Hekki")
    assert res_write.success
    assert file_path.read_text(encoding="utf-8") == "Hello Hekki"

    # 3. Test get_size
    res_size = await skill.execute(action="get_size", path=str(file_path))
    assert res_size.success
    assert res_size.metadata["size_bytes"] == len("Hello Hekki")

    # 4. Test copy
    copy_path = dir_path / "hello_copy.txt"
    res_copy = await skill.execute(action="copy", path=str(file_path), destination=str(copy_path))
    assert res_copy.success
    assert copy_path.exists()

    # 5. Test move
    moved_path = dir_path / "hello_moved.txt"
    res_move = await skill.execute(action="move", path=str(copy_path), destination=str(moved_path))
    assert res_move.success
    assert not copy_path.exists()
    assert moved_path.exists()

    # 6. Test delete file
    res_del_file = await skill.execute(action="delete", path=str(moved_path))
    assert res_del_file.success
    assert not moved_path.exists()

    # 7. Test delete dir
    res_del_dir = await skill.execute(action="delete", path=str(dir_path))
    assert res_del_dir.success
    assert not dir_path.exists()
