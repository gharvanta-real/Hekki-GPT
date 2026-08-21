"""Thermodynamics Peng-Robinson Equation of State solver module."""
from __future__ import annotations
import numpy as np

TRL_NOTE = "*Calculated numerically; NOT measured in lab. TRL 1-2 (Theoretical/Simulation only).*"


def run_thermodynamics_eos(params: dict) -> dict:
    """
    Peng-Robinson EOS: P = RT/(V-b) - a(T)/(V^2 + 2bV - b^2)
    Compressibility factor Z, fugacity coefficient, phase envelope estimation.
    """
    T_K   = float(params.get("temperature_k", 350.0))
    P_bar = float(params.get("pressure_bar", 100.0))
    Tc_K  = float(params.get("critical_temp_k", 647.1))   # default: water
    Pc_bar= float(params.get("critical_pressure_bar", 220.64))
    omega = float(params.get("acentric_factor", 0.345))    # water

    R = 83.14  # bar·cm³/(mol·K)
    Tr = T_K / Tc_K
    Pr = P_bar / Pc_bar

    kappa = 0.37464 + 1.54226 * omega - 0.26992 * omega**2
    alpha = (1 + kappa * (1 - np.sqrt(Tr)))**2

    a  = 0.45724 * R**2 * Tc_K**2 / Pc_bar
    b  = 0.07780 * R * Tc_K / Pc_bar
    aT = a * alpha

    A = aT * P_bar / (R * T_K)**2
    B = b * P_bar / (R * T_K)

    coeffs = [1, -(1 - B), (A - 3*B**2 - 2*B), -(A*B - B**2 - B**3)]
    roots_complex = np.roots(coeffs)
    roots_real = [r.real for r in roots_complex if abs(r.imag) < 1e-6 and r.real > B]

    Z_vapor = max(roots_real) if roots_real else None
    Z_liquid = min(roots_real) if len(roots_real) > 1 else None

    def fugacity_coeff(Z):
        ln_phi = (Z - 1) - np.log(Z - B) - A / (2*np.sqrt(2)*B) * np.log(
            (Z + (1 + np.sqrt(2))*B) / (Z + (1 - np.sqrt(2))*B)
        )
        return float(np.exp(ln_phi))

    results = {
        "T_K": T_K, "P_bar": P_bar, "Tr": round(Tr, 4), "Pr": round(Pr, 4),
        "a_bar_cm6_mol2": round(aT, 4), "b_cm3_mol": round(b, 4),
        "A": round(A, 6), "B": round(B, 6),
    }

    if Z_vapor is not None:
        results["Z_vapor"] = round(Z_vapor, 6)
        results["fugacity_coeff_vapor"] = round(fugacity_coeff(Z_vapor), 6)
        Vm_vapor = Z_vapor * R * T_K / P_bar
        results["molar_volume_vapor_cm3_mol"] = round(Vm_vapor, 4)
    if Z_liquid is not None and Z_liquid != Z_vapor:
        results["Z_liquid"] = round(Z_liquid, 6)
        results["fugacity_coeff_liquid"] = round(fugacity_coeff(Z_liquid), 6)
        Vm_liquid = Z_liquid * R * T_K / P_bar
        results["molar_volume_liquid_cm3_mol"] = round(Vm_liquid, 4)

    phase = "two-phase" if Z_liquid else "single-phase (vapor)"
    results["phase"] = phase

    return {
        "solver": "Peng-Robinson EOS (1976), cubic Z solved via numpy.roots, fugacity via ln-phi formula",
        "inputs": {
            "substance_defaults": "Water (adjustable via Tc, Pc, omega)",
            "T_K": T_K, "P_bar": P_bar, "Tc_K": Tc_K,
            "Pc_bar": Pc_bar, "omega": omega
        },
        "results": results,
        "trl": TRL_NOTE,
    }
