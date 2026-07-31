import pytest
from mariano.skills.core_skills.run_command.skill import RunCommandSkill

@pytest.mark.asyncio
async def test_run_command_execution(tmp_path):
    skill = RunCommandSkill()

    # 1. Test standard echo command
    res_echo = await skill.execute(command="echo Hello Hekki", cwd=str(tmp_path))
    assert res_echo.success
    assert "Hello Hekki" in res_echo.data

    # 2. Test python inline script execution (e.g. creating/deleting a file)
    test_file = tmp_path / "scratch_delete_me.txt"
    test_file.write_text("temporary data", encoding="utf-8")
    assert test_file.exists()

    cmd_python_del = f'python -c "import os; os.remove(r\'{test_file}\')"'
    res_py = await skill.execute(command=cmd_python_del, cwd=str(tmp_path))
    assert res_py.success
    assert not test_file.exists()
