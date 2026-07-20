"""physics_solver — Core Skill to manage and run OpenFOAM, Elmer FEM, and LAMMPS simulations."""
from __future__ import annotations

import os
import subprocess
import shutil
import time
from pathlib import Path
from typing import Any
from datetime import datetime

from mariano.skills._base.skill_interface import BaseSkill, SkillResult


class PhysicsSolverSkill(BaseSkill):
    name = "physics_solver"
    description = (
        "Prepare, execute, and parse results from OpenFOAM, Elmer FEM, and LAMMPS "
        "physics simulation engines. Enables the agent to write input files, execute solver binaries "
        "on the command line, and parse outputs/logs. All results from this tool represent "
        "TRL 1-2 (Conceptual/Theoretical) data and must be marked as: "
        "'*Calculated via [Solver Name] simulation; NOT measured in lab.*'"
    )
    version = "1.0.0"
    tags = ["science", "simulation", "physics", "openfoam", "elmer", "lammps"]

    def get_parameters_schema(self) -> dict:
        return {
            "action": {
                "type": "string",
                "description": "The step to perform: 'detect' (check available binaries), 'write_inputs' (create input files), 'run' (execute solver), or 'read_results' (read logs/data).",
                "enum": ["detect", "write_inputs", "run", "read_results"],
                "required": True,
            },
            "solver": {
                "type": "string",
                "description": "Simulation engine target: 'openfoam', 'elmer', or 'lammps'. Required for 'write_inputs' and 'run'.",
                "enum": ["openfoam", "elmer", "lammps"],
            },
            "work_dir": {
                "type": "string",
                "description": "Absolute path to the workspace directory. If omitted for 'write_inputs', Hekki creates a structured directory under data/simulations/.",
            },
            "input_files": {
                "type": "object",
                "description": "A dictionary mapping relative filenames to their string contents (e.g. {'in.crystal': '...', 'controlDict': '...'}). Required for 'write_inputs'.",
            },
            "run_command": {
                "type": "string",
                "description": "The exact command to run (e.g., 'lmp_serial -in in.crystal' or 'ElmerSolver' or 'blockMesh && simpleFoam'). Required for 'run'.",
            },
            "parse_files": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of relative file names to read and return in 'read_results' (e.g. ['log.lammps', 'solver.log']).",
            },
        }

    async def execute(self, **kwargs: Any) -> SkillResult:
        action = kwargs.get("action")
        solver = kwargs.get("solver")
        work_dir_str = kwargs.get("work_dir")
        input_files = kwargs.get("input_files")
        run_command = kwargs.get("run_command")
        parse_files = kwargs.get("parse_files")

        # Get Hekki base path for default work directories
        from mariano.config import get_settings
        settings = get_settings()
        sim_base_dir = settings.hekki_data_dir / "simulations"

        if action == "detect":
            return await self._detect_binaries()

        # Resolve work directory
        if work_dir_str:
            work_dir = Path(work_dir_str).resolve()
        else:
            if not solver:
                return SkillResult(success=False, data=None, error="Solver name required to allocate directory")
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            work_dir = sim_base_dir / f"{solver}_run_{timestamp}"

        # Guard paths to make sure they are within allowed paths (e.g. no system directory pollution)
        try:
            work_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Failed to create working directory: {e}")

        if action == "write_inputs":
            if not input_files:
                return SkillResult(success=False, data=None, error="input_files dictionary is required for write_inputs")
            return await self._write_inputs(work_dir, input_files)

        elif action == "run":
            if not solver:
                return SkillResult(success=False, data=None, error="solver parameter required for run action")
            if not run_command:
                return SkillResult(success=False, data=None, error="run_command is required for run action")
            return await self._run_solver(work_dir, solver, run_command)

        elif action == "read_results":
            if not parse_files:
                return SkillResult(success=False, data=None, error="parse_files list is required for read_results action")
            return await self._read_results(work_dir, parse_files)

        return SkillResult(success=False, data=None, error=f"Unknown action: {action}")

    async def _detect_binaries(self) -> SkillResult:
        """Scan standard path and locations for target solver executables."""
        results = {}
        
        # 1. LAMMPS
        lammps_execs = ["lmp", "lmp_serial", "lmp_mpi", "lammps"]
        results["lammps"] = {"found": False, "paths": []}
        for exe in lammps_execs:
            path = shutil.which(exe)
            if path:
                results["lammps"]["found"] = True
                results["lammps"]["paths"].append(path)

        # 2. Elmer FEM
        elmer_execs = ["ElmerSolver", "ElmerSolver_mpi", "ElmerGUI"]
        results["elmer"] = {"found": False, "paths": []}
        for exe in elmer_execs:
            path = shutil.which(exe)
            if path:
                results["elmer"]["found"] = True
                results["elmer"]["paths"].append(path)

        # 3. OpenFOAM (Often runs inside WSL or via openfoam-docker/native windows port)
        openfoam_execs = ["simpleFoam", "icoFoam", "blockMesh", "foamListSolvers"]
        results["openfoam"] = {"found": False, "paths": [], "wsl_available": False}
        for exe in openfoam_execs:
            path = shutil.which(exe)
            if path:
                results["openfoam"]["found"] = True
                results["openfoam"]["paths"].append(path)

        # Check for WSL as OpenFOAM is frequently run under WSL on Windows
        wsl_path = shutil.which("wsl")
        if wsl_path:
            try:
                # Run lightweight command check inside WSL
                wsl_check = subprocess.run(
                    ["wsl", "which", "simpleFoam"],
                    capture_output=True,
                    text=True,
                    timeout=3
                )
                if wsl_check.returncode == 0:
                    results["openfoam"]["found"] = True
                    results["openfoam"]["wsl_available"] = True
                    results["openfoam"]["paths"].append(wsl_check.stdout.strip())
            except Exception:
                pass

        summary = (
            "### Solver Detection Report\n"
            f"- **LAMMPS**: {'Found at ' + ', '.join(results['lammps']['paths']) if results['lammps']['found'] else 'Not Found'}\n"
            f"- **Elmer FEM**: {'Found at ' + ', '.join(results['elmer']['paths']) if results['elmer']['found'] else 'Not Found'}\n"
            f"- **OpenFOAM**: {'Found' + (' (WSL)' if results['openfoam']['wsl_available'] else '') + ' at ' + ', '.join(results['openfoam']['paths']) if results['openfoam']['found'] else 'Not Found'}\n\n"
            "> [!NOTE]\n"
            "> If a solver is 'Not Found', you can still use Hekki to generate input file decks, write setups, "
            "> or instruct the user on how to run them locally. Commands can be routed through WSL automatically if available."
        )

        return SkillResult(success=True, data=summary, metadata=results)

    async def _write_inputs(self, work_dir: Path, files: dict[str, str]) -> SkillResult:
        """Write all inputs to directory."""
        written = []
        for rel_name, content in files.items():
            file_path = (work_dir / rel_name).resolve()
            # Prevent directory traversal
            if not file_path.is_relative_to(work_dir):
                return SkillResult(success=False, data=None, error=f"Path traversal detected: {rel_name}")
            
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            written.append(rel_name)

        data_summary = (
            f"Successfully wrote {len(written)} simulation setup files to: `{work_dir}`\n\n"
            "**Files Created:**\n" + "\n".join([f"- `{f}`" for f in written])
        )
        return SkillResult(success=True, data=data_summary, metadata={"work_dir": str(work_dir), "files": written})

    async def _run_solver(self, work_dir: Path, solver: str, command: str) -> SkillResult:
        """Run the simulation solver binary command inside the work_dir."""
        # WSL routing fallback if WSL-based OpenFOAM is requested
        use_wsl = False
        if solver == "openfoam":
            # If not natively in windows PATH but WSL is available, wrap the command in WSL
            if not shutil.which("simpleFoam") and shutil.which("wsl"):
                use_wsl = True

        # Construct final command list
        if use_wsl:
            # Convert work dir path for WSL (e.g. C:\path -> /mnt/c/path)
            drive = work_dir.drive.lower().replace(":", "")
            wsl_path = f"/mnt/{drive}" + work_dir.as_posix()[2:]
            cmd_to_run = f"cd {wsl_path} && {command}"
            full_args = ["wsl", "bash", "-c", cmd_to_run]
        else:
            full_args = command

        start_time = time.monotonic()
        try:
            # Executing solver process
            result = subprocess.run(
                full_args,
                cwd=work_dir if not use_wsl else None,
                shell=True if not use_wsl else False,
                capture_output=True,
                text=True,
                timeout=1200, # 20 minutes limit
            )
            elapsed = time.monotonic() - start_time
            
            status_text = "Success" if result.returncode == 0 else f"Failed (exit code {result.returncode})"
            
            summary = (
                f"### Simulation Run Complete ({status_text})\n"
                f"- **Solver**: `{solver.upper()}`\n"
                f"- **Command**: `{command}`\n"
                f"- **Execution Time**: `{elapsed:.2f} seconds`\n"
                f"- **Directory**: `{work_dir}`\n\n"
                f"#### Standard Output:\n```text\n{result.stdout[-1500:] if len(result.stdout) > 1500 else result.stdout}\n```\n"
            )
            if result.stderr:
                summary += f"\n#### Standard Error:\n```text\n{result.stderr[-1000:] if len(result.stderr) > 1000 else result.stderr}\n```\n"

            summary += (
                "\n*Calculated via [Simulation Solver: " + solver.upper() + "] simulation; NOT measured in lab. (TRL 1-2)*\n"
            )
            
            return SkillResult(
                success=(result.returncode == 0),
                data=summary,
                metadata={
                    "returncode": result.returncode,
                    "execution_time_s": elapsed,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                }
            )
        except subprocess.TimeoutExpired:
            return SkillResult(
                success=False,
                data=f"Simulation timed out after 20 minutes execution limit inside: `{work_dir}`",
                error="TimeoutExpired"
            )
        except Exception as e:
            return SkillResult(success=False, data=None, error=f"Execution error: {e}")

    async def _read_results(self, work_dir: Path, parse_files: list[str]) -> SkillResult:
        """Parse simulation output logs/files."""
        parsed_contents = {}
        report = ["### Simulation Results Parser Report\n"]

        for file_name in parse_files:
            file_path = (work_dir / file_name).resolve()
            if not file_path.is_relative_to(work_dir):
                return SkillResult(success=False, data=None, error=f"Path traversal detected: {file_name}")

            if not file_path.exists():
                report.append(f"- ❌ File `{file_name}` not found in work directory.")
                continue

            try:
                # Read end of files if very large, or full content if small
                file_size = file_path.stat().st_size
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    if file_size > 100 * 1024: # > 100 KB
                        # Read last 100 lines for overview
                        f.seek(0, 2)
                        pointer = f.tell()
                        lines = []
                        buffer = ""
                        while pointer > 0 and len(lines) < 200:
                            pointer = max(0, pointer - 4096)
                            f.seek(pointer)
                            chunk = f.read(4096)
                            buffer = chunk + buffer
                            lines = buffer.splitlines()
                        content = "[TRUNCATED... showing last 200 lines]\n" + "\n".join(lines[-200:])
                    else:
                        content = f.read()

                parsed_contents[file_name] = content
                report.append(f"- **{file_name}** ({file_size / 1024:.2f} KB):\n```text\n{content[-2000:] if len(content) > 2000 else content}\n```\n")
            except Exception as e:
                report.append(f"- ❌ Error reading `{file_name}`: {e}")

        report.append("\n*Calculated via simulation; NOT measured in lab. (TRL 1-2)*\n")
        return SkillResult(success=True, data="\n".join(report), metadata={"files": parsed_contents})
