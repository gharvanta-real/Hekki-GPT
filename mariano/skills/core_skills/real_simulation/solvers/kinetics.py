"""Reaction kinetics stiff ODE solver module."""
from __future__ import annotations
import numpy as np
from scipy import integrate

TRL_NOTE = "*Calculated numerically; NOT measured in lab. TRL 1-2 (Theoretical/Simulation only).*"


def run_reaction_kinetics(params: dict) -> dict:
    """
    Integrates a chemical reaction network using scipy LSODA (stiff ODE solver).
    Default: A → B → C consecutive reactions with Arrhenius rate constants.
    """
    T         = float(params.get("temperature_k", 500.0))
    Ea1_kJmol = float(params.get("activation_energy_1_kJ_mol", 80.0))
    Ea2_kJmol = float(params.get("activation_energy_2_kJ_mol", 120.0))
    A1        = float(params.get("pre_exponential_1", 1e13))
    A2        = float(params.get("pre_exponential_2", 1e13))
    t_end_s   = float(params.get("time_end_s", 100.0))
    C_A0      = float(params.get("initial_conc_A_mol_L", 1.0))
    n_points  = 200

    R = 8.314  # J/mol/K
    k1 = A1 * np.exp(-Ea1_kJmol * 1000 / (R * T))
    k2 = A2 * np.exp(-Ea2_kJmol * 1000 / (R * T))

    def odes(t, y):
        cA, cB, cC = y
        dA = -k1 * cA
        dB =  k1 * cA - k2 * cB
        dC =  k2 * cB
        return [dA, dB, dC]

    t_span = (0, t_end_s)
    t_eval = np.linspace(0, t_end_s, n_points)
    y0     = [C_A0, 0.0, 0.0]

    sol = integrate.solve_ivp(odes, t_span, y0, method="LSODA",
                               t_eval=t_eval, rtol=1e-8, atol=1e-10)

    if not sol.success:
        return {"error": sol.message, "trl": TRL_NOTE}

    cA_final = float(sol.y[0, -1])
    cB_final = float(sol.y[1, -1])
    cC_final = float(sol.y[2, -1])
    t_half_1 = np.log(2) / k1

    i_max_B   = int(np.argmax(sol.y[1]))
    t_max_B   = float(sol.t[i_max_B])
    cB_max    = float(sol.y[1, i_max_B])

    return {
        "solver": "scipy.integrate.solve_ivp (LSODA, stiff ODE), A→B→C Arrhenius kinetics",
        "inputs": {
            "T_K": T,
            "k1_s_inv": f"{k1:.4e}",
            "k2_s_inv": f"{k2:.4e}",
            "Ea1_kJ_mol": Ea1_kJmol,
            "Ea2_kJ_mol": Ea2_kJmol,
            "C_A0_mol_L": C_A0,
            "t_end_s": t_end_s,
        },
        "results": {
            "C_A_final_mol_L": round(cA_final, 6),
            "C_B_final_mol_L": round(cB_final, 6),
            "C_C_final_mol_L": round(cC_final, 6),
            "A_conversion_pct": round((1 - cA_final / C_A0) * 100, 2),
            "t_half_A_s": round(t_half_1, 4),
            "t_max_B_s": round(t_max_B, 4),
            "C_B_max_mol_L": round(cB_max, 6),
            "mass_balance_check": round(cA_final + cB_final + cC_final, 6),
        },
        "trl": TRL_NOTE,
    }
