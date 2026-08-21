"""Solvers package for real_simulation skill."""
from .fem import run_fem_structural, TRL_NOTE
from .cfd import run_cfd
from .molecular_dynamics import run_molecular_dynamics
from .kinetics import run_reaction_kinetics
from .thermo import run_thermodynamics_eos
from .heat_quantum import run_heat_transfer, run_quantum

SOLVER_MAP = {
    "fem_structural": run_fem_structural,
    "cfd_navier_stokes": run_cfd,
    "molecular_dynamics": run_molecular_dynamics,
    "reaction_kinetics": run_reaction_kinetics,
    "thermodynamics_eos": run_thermodynamics_eos,
    "heat_transfer": run_heat_transfer,
    "quantum": run_quantum,
}

__all__ = ["SOLVER_MAP", "TRL_NOTE"]
