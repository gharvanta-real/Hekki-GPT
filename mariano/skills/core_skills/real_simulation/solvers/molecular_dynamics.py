"""Molecular Dynamics simulation solver module."""
from __future__ import annotations
import numpy as np

TRL_NOTE = "*Calculated numerically; NOT measured in lab. TRL 1-2 (Theoretical/Simulation only).*"


def run_molecular_dynamics(params: dict) -> dict:
    """
    N-body molecular dynamics using velocity Verlet integration.
    Lennard-Jones 12-6 potential: U(r) = 4ε[(σ/r)^12 - (σ/r)^6]
    Reduced units: ε=1, σ=1, m=1.
    """
    n_atoms  = int(params.get("n_atoms", 64))
    n_steps  = int(params.get("n_steps", 500))
    dt       = float(params.get("timestep_fs", 2.0)) * 1e-15   # convert to seconds concept
    temp     = float(params.get("temperature_k", 300.0))
    epsilon  = float(params.get("lj_epsilon_eV", 0.01))  # eV
    sigma    = float(params.get("lj_sigma_angstrom", 3.4)) * 1e-10  # m
    box_size = float(params.get("box_size_angstrom", 20.0)) * 1e-10  # m

    dt_reduced = 0.002  # reduced time units (standard for LJ MD)
    n_steps = min(n_steps, 2000)  # cap for performance

    kb = 1.380649e-23  # J/K
    np.random.seed(42)

    # Initialize positions on simple cubic lattice
    n_side = int(np.ceil(n_atoms ** (1/3)))
    spacing = 1.0 / n_side  # reduced units
    positions = []
    for i in range(n_side):
        for j in range(n_side):
            for k in range(n_side):
                if len(positions) < n_atoms:
                    positions.append([i * spacing, j * spacing, k * spacing])
    pos = np.array(positions[:n_atoms])  # reduced units, box = [0,1]^3

    # Initialize velocities from Maxwell-Boltzmann (kBT in reduced units = T*)
    T_reduced = temp * kb / epsilon / 1.602e-19  # kBT / ε (reduced temperature)
    vel = np.random.randn(n_atoms, 3) * np.sqrt(T_reduced)
    vel -= vel.mean(axis=0)  # zero momentum

    def lj_forces_and_energy(pos_):
        """Compute LJ forces and potential energy using minimum image convention."""
        f = np.zeros_like(pos_)
        pe = 0.0
        for i in range(n_atoms):
            for j in range(i + 1, n_atoms):
                rij = pos_[j] - pos_[i]
                # Minimum image
                rij -= np.round(rij)
                r2 = np.dot(rij, rij)
                if r2 < 0.01:  # avoid singularity
                    continue
                r2_inv = 1.0 / r2
                r6_inv = r2_inv ** 3
                r12_inv = r6_inv ** 2
                u = 4.0 * (r12_inv - r6_inv)
                pe += u
                fij = 24.0 * (2 * r12_inv - r6_inv) * r2_inv
                f[i] -= fij * rij
                f[j] += fij * rij
        return f, pe

    # Velocity Verlet integration
    forces, pe = lj_forces_and_energy(pos)
    ke_history = []
    pe_history = []
    temp_history = []

    for step in range(n_steps):
        pos += vel * dt_reduced + 0.5 * forces * dt_reduced**2
        pos = pos % 1.0  # PBC

        new_forces, pe = lj_forces_and_energy(pos)

        vel += 0.5 * (forces + new_forces) * dt_reduced
        forces = new_forces

        ke = 0.5 * np.sum(vel**2)
        T_inst = 2.0 * ke / (3.0 * n_atoms)  # reduced temperature

        if step % 50 == 0:
            ke_history.append(round(float(ke), 4))
            pe_history.append(round(float(pe), 4))
            temp_history.append(round(float(T_inst), 4))

    final_ke = float(0.5 * np.sum(vel**2))
    final_pe = float(pe)
    final_temp = float(2.0 * final_ke / (3.0 * n_atoms))

    return {
        "solver": "Velocity Verlet MD, Lennard-Jones 12-6 potential, periodic boundary conditions",
        "inputs": {
            "n_atoms": n_atoms,
            "n_steps": n_steps,
            "dt_reduced": dt_reduced,
            "T_reduced_target": round(T_reduced, 4),
            "epsilon_eV": epsilon,
            "sigma_angstrom": sigma * 1e10,
        },
        "results": {
            "final_kinetic_energy_reduced": round(final_ke, 4),
            "final_potential_energy_reduced": round(final_pe, 4),
            "total_energy_reduced": round(final_ke + final_pe, 4),
            "final_temperature_reduced": round(final_temp, 4),
            "temperature_sampled": temp_history[-5:] if temp_history else [],
            "pe_sampled": pe_history[-5:] if pe_history else [],
        },
        "trl": TRL_NOTE,
    }
