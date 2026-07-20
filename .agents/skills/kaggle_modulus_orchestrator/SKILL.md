---
name: kaggle-modulus-orchestrator
description: Orchestrate NVIDIA Modulus physics AI simulations on Kaggle, trigger notebook execution, download predicted coordinates, and save/load simulation history locally.
---

# Kaggle Modulus Orchestrator Workspace Skill

This skill allows the agent to dynamically map debate conclusions (geometry, temperatures, electrochemical properties) into parameter files, trigger physics-informed neural network (PINN) simulation solves on Kaggle via the Kaggle API, download the result coordinate grids, and manage design logs locally.

## Supported Operations
1. **Map Design Parameters**: Use `parameter_mapper.py` to format parameters into the correct structure for the NVIDIA Modulus solvers.
2. **Interact with Kaggle**: Use `kaggle_api.py` to trigger remote executions and download output datasets containing predictions.
3. **Manage Local History**: Use `local_store.py` to save, list, and read historical simulation runs and metadata.

## Script Usage
The supporting python scripts are stored in the `scripts/` directory under this skill root. Refer to individual files for API specifications.
