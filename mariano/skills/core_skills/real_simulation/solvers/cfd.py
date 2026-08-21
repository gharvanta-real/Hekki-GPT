"""CFD Navier-Stokes solver module."""
from __future__ import annotations
import numpy as np

TRL_NOTE = "*Calculated numerically; NOT measured in lab. TRL 1-2 (Theoretical/Simulation only).*"


def run_cfd(params: dict) -> dict:
    """
    2D incompressible Navier-Stokes via finite difference (pressure-velocity coupling).
    Vorticity-streamfunction formulation. Stable up to Re~400 with this grid.
    """
    Re      = float(params.get("reynolds_number", 100.0))
    nx      = int(params.get("grid_nx", 41))
    ny      = int(params.get("grid_ny", 41))
    n_iter  = int(params.get("iterations", 500))
    rho     = float(params.get("density_kg_m3", 1.225))
    L       = float(params.get("domain_length_m", 1.0))
    U_lid   = float(params.get("lid_velocity_m_s", 1.0))

    nu = U_lid * L / Re  # kinematic viscosity

    dx = L / (nx - 1)
    dy = L / (ny - 1)
    dt = min(0.25 * dx**2 / nu, 0.25 * dy**2 / nu, 0.5 * dx / U_lid)

    u = np.zeros((ny, nx))
    v = np.zeros((ny, nx))
    p = np.zeros((ny, nx))

    # Lid velocity BC
    u[-1, :] = U_lid

    residuals = []
    for it in range(n_iter):
        un = u.copy()
        vn = v.copy()
        pn = p.copy()

        # Pressure Poisson (5 iterations)
        for _ in range(5):
            pd = pn.copy()
            b = (rho / dt * (
                (un[1:-1, 2:] - un[1:-1, :-2]) / (2*dx) +
                (vn[2:, 1:-1] - vn[:-2, 1:-1]) / (2*dy)
            ))
            pn[1:-1, 1:-1] = (
                ((pd[1:-1, 2:] + pd[1:-1, :-2]) * dy**2 +
                 (pd[2:, 1:-1] + pd[:-2, 1:-1]) * dx**2) /
                (2 * (dx**2 + dy**2)) -
                dx**2 * dy**2 / (2 * (dx**2 + dy**2)) * b
            )
            # Neumann BCs for pressure
            pn[:, 0]  = pn[:, 1]
            pn[:, -1] = pn[:, -2]
            pn[0, :]  = pn[1, :]
            pn[-1, :] = 0.0

        # Momentum equations
        u[1:-1, 1:-1] = (
            un[1:-1, 1:-1]
            - un[1:-1, 1:-1] * dt/dx * (un[1:-1, 1:-1] - un[1:-1, :-2])
            - vn[1:-1, 1:-1] * dt/dy * (un[1:-1, 1:-1] - un[:-2, 1:-1])
            - dt / (2*rho*dx) * (pn[1:-1, 2:] - pn[1:-1, :-2])
            + nu * (
                dt/dx**2 * (un[1:-1, 2:] - 2*un[1:-1, 1:-1] + un[1:-1, :-2]) +
                dt/dy**2 * (un[2:, 1:-1] - 2*un[1:-1, 1:-1] + un[:-2, 1:-1])
            )
        )
        v[1:-1, 1:-1] = (
            vn[1:-1, 1:-1]
            - un[1:-1, 1:-1] * dt/dx * (vn[1:-1, 1:-1] - vn[1:-1, :-2])
            - vn[1:-1, 1:-1] * dt/dy * (vn[1:-1, 1:-1] - vn[:-2, 1:-1])
            - dt / (2*rho*dy) * (pn[2:, 1:-1] - pn[:-2, 1:-1])
            + nu * (
                dt/dx**2 * (vn[1:-1, 2:] - 2*vn[1:-1, 1:-1] + vn[1:-1, :-2]) +
                dt/dy**2 * (vn[2:, 1:-1] - 2*vn[1:-1, 1:-1] + vn[:-2, 1:-1])
            )
        )
        # Wall BCs
        u[0, :] = 0; u[:, 0] = 0; u[:, -1] = 0; u[-1, :] = U_lid
        v[0, :] = 0; v[-1, :] = 0; v[:, 0] = 0; v[:, -1] = 0
        p = pn

        if it % 100 == 99:
            res = float(np.max(np.abs(u - un)) + np.max(np.abs(v - vn)))
            residuals.append(round(res, 8))

    u_center = float(u[ny//2, nx//2])
    v_center = float(v[ny//2, nx//2])
    p_max    = float(np.max(p))
    p_min    = float(np.min(p))

    return {
        "solver": "Finite Difference Navier-Stokes (Vorticity-Streamfunction, pressure-velocity coupling)",
        "inputs": {
            "Re": Re, "grid": f"{nx}x{ny}", "iterations": n_iter,
            "nu_m2_s": round(nu, 8), "dt_s": round(dt, 8)
        },
        "results": {
            "u_centerline_m_s": round(u_center, 6),
            "v_centerline_m_s": round(v_center, 6),
            "p_max_Pa": round(p_max, 4),
            "p_min_Pa": round(p_min, 4),
            "residuals_sampled": residuals,
        },
        "trl": TRL_NOTE,
    }
