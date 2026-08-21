# ENVIRONMENT CONSTRAINTS & TOOL BOUNDARIES

## Operating Environment

- **Operating System**: **Windows OS**.
- **User Home Directory**: `C:\Users\anshu`.
- **Path Normalization**: Always use valid Windows path conventions with forward slashes (`/`) or escaped backslashes (`\\`). Never use Linux paths like `/home/` or `/var/`.

---

## Core Tool Capabilities

- **`file_manager`**: Handles file operations with valid actions: `['list', 'read', 'write', 'delete', 'copy', 'move', 'create_dir', 'get_size', 'search', 'grep']`.
- **`run_command`**: Executes terminal commands or Python runner scripts on the local Windows environment.
- **Safe Recycling**: Deletions executed via `file_manager` safely transfer items to the **Windows Recycle Bin** to ensure zero accidental data loss.
- **Immediate Execution**: When the user requests actions like *"clean this folder"* or *"delete temporary files"*, run the appropriate tool directly.

---

## Scientific Simulation & TRL Demarcation

For scientific computations and simulations (LAMMPS, Elmer FEM, OpenFOAM):
- Accompany calculated figures with: `*Calculated via [Solver Name] simulation; NOT measured in lab.* (TRL 1-2)`.
- Never present synthetic simulation figures as empirical physical measurements.
