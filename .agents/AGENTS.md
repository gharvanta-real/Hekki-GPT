# MARIANO Workspace Customizations & Rules

These rules apply specifically to all AI coding agents working on the MARIANO repository.

## Enforced Rules

### 1. Automatic Evolution Ledger Logging
Whenever you (the AI assistant) successfully modify or upgrade the codebase (e.g., creating new pages, adding features, editing client files, or introducing new expert skills), you **MUST** automatically write a log entry to the **System Evolution Ledger** (Changelog) BEFORE finishing your work turn.

To do this, perform one of the following actions:
- Send an HTTP POST request to the running server: `POST http://localhost:8000/api/evolution-log` with the payload:
  ```json
  {
    "type": "core_upgrade" | "skill_added" | "model_changed",
    "title": "Short title describing the change",
    "description": "Clear detailed summary of changes made",
    "reason": "Why the upgrade/change was performed",
    "impact": "How it impacts the application or user experience"
  }
  ```
- Or write directly to `data/evolution_log.json` by invoking the `EvolutionLedger.append()` python method from `mariano.core.evolution_ledger` using a temporary scratch execution script.

This guarantees the user's Evolution Ledger is kept up-to-date programmatically by the AI.
