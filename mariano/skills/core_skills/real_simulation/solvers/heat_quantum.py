"""Heat transfer and quantum mechanics solvers module."""
from __future__ import annotations
import numpy as np
from scipy import linalg

TRL_NOTE = "*Calculated numerically; NOT measured in lab. TRL 1-2 (Theoretical/Simulation only).*"


def run_heat_transfer(params: dict) -> dict:
    """
    1D transient heat conduction using Crank-Nicolson implicit scheme.
    PDE: ρCp ∂T/∂t = k ∂²T/∂x²
    Boundary conditions: T(0,t) = T_left, T(L,t) = T_right
    """
    k    = float(params.get("thermal_conductivity_W_mK", 16.0))  # Steel default
    rho  = float(params.get("density_kg_m3", 7800.0))
    Cp   = float(params.get("specific_heat_J_kgK", 500.0))
    L    = float(params.get("length_m", 0.1))
    T_left  = float(params.get("T_left_C", 800.0))
    T_right = float(params.get("T_right_C", 25.0))
    T_init  = float(params.get("T_initial_C", 25.0))
    t_end   = float(params.get("time_end_s", 60.0))
    nx      = int(params.get("grid_nx", 50))

    alpha = k / (rho * Cp)  # thermal diffusivity
    dx = L / (nx - 1)
    dt = t_end / 200.0
    r  = alpha * dt / dx**2

    T = np.full(nx, T_init)
    T[0]  = T_left
    T[-1] = T_right

    diag  = np.full(nx - 2, 1 + r)
    lower = np.full(nx - 3, -r / 2)
    upper = np.full(nx - 3, -r / 2)

    A_mat = np.diag(diag) + np.diag(lower, -1) + np.diag(upper, 1)

    t_snapshots = {}
    snap_times  = [t_end * 0.1, t_end * 0.25, t_end * 0.5, t_end]
    snap_idx    = 0

    n_steps = int(t_end / dt)
    for step in range(n_steps):
        T_int = T[1:-1]
        rhs = r/2 * np.roll(T_int, 1) + (1 - r) * T_int + r/2 * np.roll(T_int, -1)
        rhs[0]  += r/2 * T_left
        rhs[-1] += r/2 * T_right

        T[1:-1] = linalg.solve(A_mat, rhs)
        T[0]    = T_left
        T[-1]   = T_right

        t_now = (step + 1) * dt
        if snap_idx < len(snap_times) and t_now >= snap_times[snap_idx]:
            midpt = int(nx // 2)
            t_snapshots[f"t={snap_times[snap_idx]:.1f}s"] = {
                "T_midpoint_C": round(float(T[midpt]), 2),
                "T_profile_sample_C": [round(float(T[i]), 2) for i in range(0, nx, nx//5)]
            }
            snap_idx += 1

    T_midpoint_final = float(T[nx // 2])
    dT_dx_left = (T[1] - T[0]) / dx  # °C/m
    q_flux_left = -k * dT_dx_left    # W/m²

    return {
        "solver": "Crank-Nicolson implicit scheme (scipy.linalg.solve), 1D transient heat conduction",
        "inputs": {
            "k_W_mK": k, "rho_kg_m3": rho, "Cp_J_kgK": Cp,
            "alpha_m2_s": round(alpha, 8), "L_m": L,
            "T_left_C": T_left, "T_right_C": T_right,
            "t_end_s": t_end, "grid": nx, "dt_s": round(dt, 6),
            "Fourier_number": round(alpha * t_end / L**2, 4),
        },
        "results": {
            "T_midpoint_final_C": round(T_midpoint_final, 2),
            "heat_flux_left_W_m2": round(q_flux_left, 2),
            "snapshots": t_snapshots,
        },
        "trl": TRL_NOTE,
    }


def run_quantum(params: dict) -> dict:
    """
    Exact analytical quantum mechanics:
    - Particle in a box: E_n = n²π²ℏ²/(2mL²)
    - Quantum harmonic oscillator: E_n = ℏω(n + 1/2)
    - Hydrogen-like energy levels: E_n = -13.6 eV Z²/n²
    """
    system  = params.get("system", "particle_in_box")
    n_max   = int(params.get("n_levels", 5))
    L_nm    = float(params.get("box_length_nm", 1.0))
    omega_THz = float(params.get("frequency_THz", 100.0))
    Z       = int(params.get("atomic_number_Z", 1))

    hbar = 1.054571817e-34  # J·s
    m_e  = 9.10938e-31       # kg
    eV   = 1.602176634e-19   # J/eV

    if system == "particle_in_box":
        L = L_nm * 1e-9
        levels = {}
        for n in range(1, n_max + 1):
            En_J = (n**2 * np.pi**2 * hbar**2) / (2 * m_e * L**2)
            En_eV = En_J / eV
            levels[f"n={n}"] = {
                "energy_eV": round(En_eV, 6),
                "energy_J": f"{En_J:.4e}",
                "wavelength_nm": round(2 * L_nm / n, 4),
            }
        dE = levels[f"n=2"]["energy_eV"] - levels[f"n=1"]["energy_eV"]
        return {
            "solver": "Exact analytical — Particle in a Box (1D infinite potential well)",
            "inputs": {"L_nm": L_nm, "n_levels": n_max, "m": "electron mass"},
            "results": {
                "energy_levels": levels,
                "E2_minus_E1_eV": round(dE, 6),
                "photon_wavelength_nm": round(1239.8 / dE, 2),
            },
            "trl": TRL_NOTE,
        }

    elif system == "harmonic_oscillator":
        omega = omega_THz * 1e12 * 2 * np.pi
        levels = {}
        for n in range(n_max):
            En_J = hbar * omega * (n + 0.5)
            En_eV = En_J / eV
            levels[f"n={n}"] = {"energy_eV": round(En_eV, 8), "energy_J": f"{En_J:.4e}"}
        ZPE = hbar * omega * 0.5 / eV
        return {
            "solver": "Exact analytical — Quantum Harmonic Oscillator E_n = ℏω(n+½)",
            "inputs": {"omega_THz": omega_THz, "omega_rad_s": f"{omega:.4e}"},
            "results": {"energy_levels": levels, "zero_point_energy_eV": round(ZPE, 8)},
            "trl": TRL_NOTE,
        }

    else:  # hydrogen-like
        levels = {}
        for n in range(1, n_max + 1):
            En_eV = -13.6 * Z**2 / n**2
            levels[f"n={n}"] = {
                "energy_eV": round(En_eV, 6),
                "ionization_from_this_level_eV": round(-En_eV, 6),
            }
        return {
            "solver": "Exact analytical — Hydrogen-like atom E_n = -13.6·Z²/n² eV",
            "inputs": {"Z": Z, "n_levels": n_max},
            "results": {
                "energy_levels": levels,
                "ionization_energy_eV": round(13.6 * Z**2, 4),
                "ground_state_radius_pm": round(52.9 / Z, 4),
            },
            "trl": TRL_NOTE,
        }
