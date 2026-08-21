"""
MARIANO Core Skill — Real Physics & Chemistry Simulation Engine
===============================================================
Runs ACTUAL numerical computations via scipy/numpy solvers.
Solvers are modularized in the `solvers/` package.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from mariano.skills._base import BaseSkill, SkillResult
from .solvers import SOLVER_MAP, TRL_NOTE


class RealSimulationSkill(BaseSkill):
    name = "real_simulation"
    description = (
        "Runs REAL numerical physics and chemistry simulations using scipy/numpy solvers. "
        "Not Python script approximations — actual implemented numerical methods: "
        "FEM structural (Q4 sparse assembly), CFD Navier-Stokes (finite difference), "
        "Molecular Dynamics (Verlet + Lennard-Jones), Chemical Kinetics (Arrhenius ODE/LSODA), "
        "Thermodynamics EOS (Peng-Robinson), Heat Transfer (Crank-Nicolson), "
        "Quantum Mechanics (exact analytical particle-in-box, harmonic oscillator, H-like atom). "
        "All results are TRL 1-2 (numerically computed, NOT lab-measured). "
        "Use to generate quantitative data to support or challenge claims in scientific debates."
    )
    version = "1.1.0"
    tags    = ["simulation", "physics", "chemistry", "fem", "cfd", "molecular-dynamics",
               "thermodynamics", "quantum", "kinetics", "heat-transfer"]

    def get_parameters_schema(self) -> dict:
        return {
            "solver": {
                "type": "string",
                "description": (
                    "Which simulation to run. Options: "
                    "'fem_structural' (FEM structural analysis), "
                    "'cfd_navier_stokes' (CFD fluid dynamics), "
                    "'molecular_dynamics' (N-body MD with Lennard-Jones), "
                    "'reaction_kinetics' (Arrhenius ODE A→B→C), "
                    "'thermodynamics_eos' (Peng-Robinson EOS), "
                    "'heat_transfer' (Crank-Nicolson transient conduction), "
                    "'quantum' (exact particle-in-box / harmonic oscillator / hydrogen-like atom)"
                ),
                "enum": list(SOLVER_MAP.keys()),
                "required": True,
            },
            "parameters": {
                "type": "object",
                "description": (
                    "Solver-specific input parameters as key-value pairs. Examples: "
                    "fem_structural: {youngs_modulus_gpa:200, poisson_ratio:0.3, load_n:10000, width_m:0.1, height_m:0.05, mesh_nx:10, mesh_ny:5} | "
                    "cfd_navier_stokes: {reynolds_number:100, grid_nx:41, grid_ny:41, iterations:500} | "
                    "molecular_dynamics: {n_atoms:32, n_steps:300, temperature_k:300, lj_epsilon_eV:0.01, lj_sigma_angstrom:3.4} | "
                    "reaction_kinetics: {temperature_k:500, activation_energy_1_kJ_mol:80, activation_energy_2_kJ_mol:120, time_end_s:100} | "
                    "thermodynamics_eos: {temperature_k:350, pressure_bar:100, critical_temp_k:647.1, critical_pressure_bar:220.64, acentric_factor:0.345} | "
                    "heat_transfer: {thermal_conductivity_W_mK:16, density_kg_m3:7800, specific_heat_J_kgK:500, length_m:0.1, T_left_C:800, T_right_C:25, time_end_s:60} | "
                    "quantum: {system:'particle_in_box', box_length_nm:1.0, n_levels:5} or {system:'hydrogen', atomic_number_Z:6, n_levels:5}"
                ),
            },
        }

    async def execute(self, solver: str, parameters: dict | None = None) -> SkillResult:
        if solver not in SOLVER_MAP:
            return SkillResult(
                success=False, data=None,
                error=f"Unknown solver '{solver}'. Available: {list(SOLVER_MAP.keys())}"
            )
        params = parameters or {}
        try:
            result_dict = await asyncio.to_thread(SOLVER_MAP[solver], params)
            output = (
                f"## Real Simulation Result — {solver.replace('_', ' ').upper()}\n\n"
                f"**Solver Method:** {result_dict.get('solver', solver)}\n\n"
                f"**Inputs:**\n```json\n{json.dumps(result_dict.get('inputs', params), indent=2)}\n```\n\n"
                f"**Computed Results:**\n```json\n{json.dumps(result_dict.get('results', result_dict), indent=2)}\n```\n\n"
                f"**{result_dict.get('trl', TRL_NOTE)}**\n"
            )
            return SkillResult(
                success=True,
                data=output,
                metadata={"solver": solver, "params": params, "raw": result_dict},
            )
        except Exception as exc:
            return SkillResult(
                success=False, data=None,
                error=f"Solver '{solver}' failed: {str(exc)[:300]}"
            )
