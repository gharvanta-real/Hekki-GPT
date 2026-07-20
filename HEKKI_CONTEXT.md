# HEKKI — Project Context for AI Agents

> **Read this first before touching any file in this codebase.**
> This document exists so that AI agents (like Antigravity, Copilot, Cursor, etc.) don't get confused by naming inconsistencies in the project.

---

## 🏷️ What is Hekki?

**Hekki** is a personal AI desktop assistant application — a locally-running, installable Windows `.exe` app that wraps a Python (FastAPI) backend with an Electron frontend.

- **User-facing name**: `Hekki`
- **Previous name (DEPRECATED)**: `MARIANO` — this name is dead. Do NOT use it in new code, UI strings, comments, or config.
- **Logo**: `assets/hekki.png` and `assets/hekki.ico` (gradient blue→purple→pink circular logo)
- **App window title**: `Hekki`
- **Installer name**: `Hekki Setup x.x.x.exe`

---

## 🗂️ Codebase Naming — Why You See "mariano" Everywhere

The **Python package folder is still named `mariano/`**. This is intentional and NOT a mistake.

Renaming it would break 100+ `from mariano.xxx import ...` statements across every Python file. The internal package name is a **code-level implementation detail** — it has nothing to do with the user-facing brand name.

### Rule for agents:
| Context | Correct name to use |
|---|---|
| UI strings, HTML, window titles | `Hekki` |
| Python `import` statements | `mariano` (do NOT change) |
| Python module paths (`mariano/config/`, etc.) | `mariano/...` (do NOT change) |
| New config keys, env vars | Use `hekki_` prefix |
| Data directories (`%APPDATA%/`) | `hekki/` |
| Database file | `hekki.db` |
| Backend compiled exe | `hekki_backend.exe` |
| Electron productName / shortcut | `Hekki` |
| `package.json` name field | `hekki-desktop` |

---

## 🏗️ Architecture Overview

```
Hekki (Desktop App)
├── electron_main.js         ← Electron entry point, spawns Python backend
├── package.json             ← App config, electron-builder settings
├── assets/
│   ├── hekki.png            ← Official logo (PNG)
│   └── hekki.ico            ← Official logo (ICO, multi-size for Windows)
├── mariano/                 ← Python package (internal name, do NOT rename)
│   ├── web/
│   │   ├── app.py           ← FastAPI app
│   │   └── static/          ← Frontend (HTML, CSS, JS)
│   │       ├── index.html   ← Main UI (single-page app)
│   │       ├── hekki.png    ← Logo served to browser
│   │       └── main.js      ← JS entry point
│   ├── config/
│   │   ├── settings.py      ← Pydantic settings (hekki_* field names)
│   │   └── system_prompt.py ← AI identity: "You are Hekki"
│   ├── gemini/
│   │   └── client.py        ← Gemini API client
│   ├── skills/              ← Modular tool skills (file_manager, web_search, etc.)
│   └── core/                ← Neuromodulator, cognitive profiler, rate limiter
├── run_web.py               ← Backend entry point (used by PyInstaller)
├── build_backend.py         ← Compiles Python → hekki_backend.exe via PyInstaller
└── data/                    ← Runtime data (SQLite DB, logs, chroma)
    └── hekki.db
```

---

## 🤖 AI Identity (System Prompt)

The AI inside Hekki identifies itself as:

> **"You are Hekki — a high-fidelity conversational research and analysis AI intelligence layer."**

- If a user asks "what are you?" → answer as **Hekki**
- If the system prompt says MARIANO → that is **outdated**, update it
- Language: Hekki responds in the same language as the user (Hindi, Hinglish, English, etc.)

---

## 🚫 Removed Features (Do NOT Re-add)

These features were fully removed. Do not reference them in code, JS, or system prompts:

| Feature | Status | Files affected |
|---|---|---|
| **3D Simulation (Three.js / WebGL)** | ❌ Removed | `simulation_ops` skill deleted, `chat-simulation-viewer` HTML removed, Three.js CDN removed |
| **Window control buttons** (min/max/close in UI) | ❌ Removed | Native OS frame is used instead |
| **`simulation_ops` skill** | ❌ Deleted | `mariano/skills/core_skills/simulation_ops/` — folder gone |

---

## ⚙️ Build Process

```
Step 1:  python build_backend.py   →  builds backend_dist/hekki_backend.exe
Step 2:  npm run build:app         →  builds dist/Hekki Setup x.x.x.exe
Step 3:  Copy installer to D:\     →  final deliverable
```

> **Do NOT run the build unless the user explicitly asks.**

---

## 📦 Key Config Values

```json
// package.json
{
  "name": "hekki-desktop",
  "build": {
    "appId": "com.hekki.assistant",
    "productName": "Hekki",
    "icon": "assets/hekki.ico"
  }
}
```

```python
# mariano/config/settings.py
hekki_model: str       # Gemini model name
hekki_data_dir: Path   # %APPDATA%/hekki/data
hekki_log_level: str   # Logging level
```

```python
# mariano/config/system_prompt.py
SYSTEM_PROMPT = "You are Hekki — ..."
```

---

## 🧠 Agent Rules Summary

1. **Hekki = user-facing brand name** → use in UI, titles, messages
2. **`mariano/` = internal Python package** → never rename, always import as `mariano`
3. **No 3D simulation** → it's gone, don't bring it back
4. **API key is optional on boot** → app starts without key, prompts user in Settings
5. **Data lives in `%APPDATA%/hekki/`** when packaged as `.exe`
6. **Logo files**: `assets/hekki.ico` (Electron), `mariano/web/static/hekki.png` (browser)
7. **Do NOT build** unless user explicitly requests it
8. **Physics Solver & TRL Demarcation**: The `physics_solver` skill runs LAMMPS, Elmer FEM, and OpenFOAM simulations. All results from it must be explicitly marked as: `*Calculated via [Solver Name] simulation; NOT measured in lab.* (TRL 1-2)` because they are purely computational and lack empirical lab test reports (which would be TRL 3-4 under ASTM standards).
