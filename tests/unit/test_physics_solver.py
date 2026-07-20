"""Unit tests for the PhysicsSolverSkill class."""
from __future__ import annotations

import os
import shutil
import unittest
from pathlib import Path

# Add project root to path
import sys
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

os.environ["GEMINI_API_KEY"] = "MOCK_KEY"

from mariano.skills.core_skills.physics_solver.skill import PhysicsSolverSkill


class TestPhysicsSolver(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.skill = PhysicsSolverSkill()
        self.test_dir = project_root / "data" / "simulations" / "test_run_unit"

    def tearDown(self):
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir, ignore_errors=True)

    async def test_detect(self):
        """Test binary detection action runs without errors."""
        res = await self.skill.execute(action="detect")
        self.assertTrue(res.success)
        self.assertIn("Solver Detection Report", res.data)
        self.assertIn("lammps", res.metadata)

    async def test_write_inputs(self):
        """Test writing inputs for a simulation run."""
        input_files = {
            "in.crystal": "# LAMMPS input\nunits metal\natom_style atomic\n",
            "controlDict": "/* OpenFOAM control */\napplication icoFoam;\n"
        }
        res = await self.skill.execute(
            action="write_inputs",
            solver="lammps",
            work_dir=str(self.test_dir),
            input_files=input_files
        )
        self.assertTrue(res.success)
        self.assertTrue((self.test_dir / "in.crystal").exists())
        self.assertTrue((self.test_dir / "controlDict").exists())

    async def test_read_results(self):
        """Test parsing files from a simulation run directory."""
        # Create mock results
        self.test_dir.mkdir(parents=True, exist_ok=True)
        log_content = "Step Temp Press\n0 300.0 1.0\n100 295.5 0.98\n"
        with open(self.test_dir / "log.lammps", "w", encoding="utf-8") as f:
            f.write(log_content)

        res = await self.skill.execute(
            action="read_results",
            work_dir=str(self.test_dir),
            parse_files=["log.lammps"]
        )
        self.assertTrue(res.success)
        self.assertIn("log.lammps", res.metadata["files"])
        self.assertEqual(res.metadata["files"]["log.lammps"], log_content)
        self.assertIn("TRL 1-2", res.data)


if __name__ == "__main__":
    unittest.main()
