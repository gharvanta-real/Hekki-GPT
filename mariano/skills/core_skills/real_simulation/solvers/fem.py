"""FEM 2D Plane Stress solver module."""
from __future__ import annotations
import numpy as np
from scipy import sparse

TRL_NOTE = "*Calculated numerically; NOT measured in lab. TRL 1-2 (Theoretical/Simulation only).*"


def run_fem_structural(params: dict) -> dict:
    """
    2D Plane-stress FEM on a rectangular plate with quadrilateral elements.
    Real method: bilinear Q4 elements, Gaussian quadrature, sparse assembly, Dirichlet BC.
    """
    E      = float(params.get("youngs_modulus_gpa", 200.0)) * 1e9   # Pa
    nu     = float(params.get("poisson_ratio", 0.3))
    width  = float(params.get("width_m", 0.1))       # m
    height = float(params.get("height_m", 0.05))
    force  = float(params.get("load_n", 10000.0))    # N (applied on top edge)
    nx     = int(params.get("mesh_nx", 10))
    ny     = int(params.get("mesh_ny", 5))

    # Plane stress D matrix
    D = (E / (1 - nu**2)) * np.array([
        [1,  nu, 0],
        [nu, 1,  0],
        [0,  0,  (1 - nu) / 2]
    ])

    dx = width / nx
    dy = height / ny
    n_nodes = (nx + 1) * (ny + 1)
    n_dof = 2 * n_nodes

    K = sparse.lil_matrix((n_dof, n_dof))
    F = np.zeros(n_dof)

    # Q4 Gaussian quadrature points
    gp = 1.0 / np.sqrt(3)
    gauss_pts  = [(-gp, -gp), (gp, -gp), (gp, gp), (-gp, gp)]
    gauss_wgts = [1.0, 1.0, 1.0, 1.0]

    def node_id(i, j):
        return j * (nx + 1) + i

    for ex in range(nx):
        for ey in range(ny):
            n0 = node_id(ex,   ey)
            n1 = node_id(ex+1, ey)
            n2 = node_id(ex+1, ey+1)
            n3 = node_id(ex,   ey+1)
            elem_nodes = [n0, n1, n2, n3]
            dofs = []
            for n in elem_nodes:
                dofs += [2*n, 2*n+1]

            Ke = np.zeros((8, 8))

            for (xi, eta), w in zip(gauss_pts, gauss_wgts):
                dN_dxi  = 0.25 * np.array([-(1-eta), (1-eta), (1+eta), -(1+eta)])
                dN_deta = 0.25 * np.array([-(1-xi),  -(1+xi), (1+xi),   (1-xi)])

                J = np.array([
                    [dN_dxi  @ [0, dx, dx, 0],   dN_dxi  @ [0, 0, dy, dy]],
                    [dN_deta @ [0, dx, dx, 0],    dN_deta @ [0, 0, dy, dy]],
                ])
                detJ = np.linalg.det(J)
                invJ = np.linalg.inv(J)

                dN_dx = invJ[0, 0] * dN_dxi + invJ[0, 1] * dN_deta
                dN_dy = invJ[1, 0] * dN_dxi + invJ[1, 1] * dN_deta

                B = np.zeros((3, 8))
                for k in range(4):
                    B[0, 2*k]   = dN_dx[k]
                    B[1, 2*k+1] = dN_dy[k]
                    B[2, 2*k]   = dN_dy[k]
                    B[2, 2*k+1] = dN_dx[k]

                Ke += w * detJ * (B.T @ D @ B)

            for i, gi in enumerate(dofs):
                for j, gj in enumerate(dofs):
                    K[gi, gj] += Ke[i, j]

    # Apply distributed force on top edge
    top_nodes = [node_id(i, ny) for i in range(nx + 1)]
    fy_per_node = force / (nx + 1)
    for n in top_nodes:
        F[2*n + 1] += fy_per_node

    # Apply Dirichlet BC: fix bottom edge (u=0, v=0)
    fixed_dofs = []
    for i in range(nx + 1):
        n = node_id(i, 0)
        fixed_dofs += [2*n, 2*n+1]

    K_csc = K.tocsc()
    free_dofs = [d for d in range(n_dof) if d not in set(fixed_dofs)]

    K_free = K_csc[np.ix_(free_dofs, free_dofs)]
    F_free = F[free_dofs]

    U_free = sparse.linalg.spsolve(K_free, F_free)

    U = np.zeros(n_dof)
    for i, d in enumerate(free_dofs):
        U[d] = U_free[i]

    u_vec = U[0::2]
    v_vec = U[1::2]
    max_disp = float(np.max(np.sqrt(u_vec**2 + v_vec**2)))
    max_vert = float(np.max(np.abs(v_vec)))

    return {
        "solver": "FEM 2D Plane Stress (Q4 elements, Gaussian quadrature, scipy.sparse.linalg.spsolve)",
        "inputs": {
            "E_GPa": E / 1e9, "nu": nu, "width_m": width,
            "height_m": height, "load_N": force, "mesh": f"{nx}x{ny} Q4 elements"
        },
        "results": {
            "max_displacement_mm": round(max_disp * 1000, 6),
            "max_vertical_deflection_mm": round(max_vert * 1000, 6),
            "n_dof": n_dof,
        },
        "trl": TRL_NOTE,
    }
