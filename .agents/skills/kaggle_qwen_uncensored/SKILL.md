---
name: kaggle-qwen-uncensored
description: Orchestrate and run uncensored Qwen LLM models (Qwen2.5-Coder / Qwen2.5-32B) on Kaggle GPUs via Kaggle API with automatic kernel push and response generation.
---

# Kaggle Uncensored Qwen Orchestrator Workspace Skill

This skill enables Hekki Assistant to offload uncensored LLM inference, heavy code generation, and complex reasoning to uncensored **Qwen models** running on Kaggle GPU hardware (Tesla T4 / P100 / L4).

## Workflows

1. **Verify Credentials**: Check `KAGGLE_API_TOKEN` / `KAGGLE_USERNAME` in `.env` or `~/.kaggle/access_token`.
2. **Push GPU Kernel**: Use `mariano/core/kaggle_qwen_orchestrator.py` or `/api/kaggle/qwen/start` to push `kaggle/qwen_kernel/qwen_server.py`.
3. **Execute & Poll Status**: Monitor kernel status with `orchestrator.get_kernel_status()`.
4. **Generate Output**: Interact with the active Kaggle Qwen model endpoint.
