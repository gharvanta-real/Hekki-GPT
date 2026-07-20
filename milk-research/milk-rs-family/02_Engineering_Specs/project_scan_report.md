# 🔍 Hekki Project Scan & Architecture Report

This report presents a complete scan of the Hekki desktop assistant codebase, mapping the system architecture, core engine, frontend components, and dependencies.

---

## 🏷️ Brand & Package Naming Alignment
As documented in [HEKKI_CONTEXT.md](file:///d:/mariano/HEKKI_CONTEXT.md), **Hekki** is the official user-facing name for this conversational research assistant application. The codebase contains references to `mariano` (the previous name), which remains the internal Python package name to prevent import breakage (e.g. `from mariano.core...`). All new user-facing titles, window labels, and configurations refer strictly to **Hekki**.

---

## 🏗️ Folder and Directory Architecture
The repository structure is structured as follows:

```
Hekki (Root Directory)
├── electron_main.js          # Electron boot script, spawns the backend process
├── package.json              # NPM dependencies, Electron configuration, and build scripts
├── pyproject.toml            # Python backend metadata, build system, and requirements
├── run_web.py                # Fast API entry point for the compiled PyInstaller distribution
├── build_backend.py          # PyInstaller compilation script producing hekki_backend.exe
├── main.py                   # Alternative entry point (launches Terminal UI or Telegram Bot)
├── HEKKI_CONTEXT.md          # Naming rules, deprecated features, and system policies
│
├── data/                     # Persistent database, settings, logs, and workspace directories
│   ├── hekki.db              # SQLite Database containing chat logs, episodes, and task reports
│   ├── user_feedback_data.csv# CSV storing cognitive profiler feedback analytics
│   ├── dynamic_settings.json # Dynamically editable configurations (Gemini keys, active model)
│   ├── evolution_log.json    # JSON array listing developer evolution upgrades
│   └── workspace/            # Default directory containing user files
│
├── mariano/                  # Core Python backend module
│   ├── config/               # Settings definitions and system prompt variables
│   ├── core/                 # Limbic emotion engine, sentinel background threads, planning modules
│   │   ├── agent/            # Agent definition and ReAct processing loop
│   │   ├── debate/           # Multi-agent debate orchestration logic
│   │   ├── cognitive_profiler.py # Analyzes user input sentiment and adjusts chemicals
│   │   ├── neuromodulator.py # Limbic Chemistry Controller (focus, affection, fear, anger)
│   │   └── sentinel.py       # Telegram-based background hardware monitoring alert daemon
│   ├── gemini/               # API interface wrapping Google Generative AI
│   ├── memory/               # Short-term and SQLite long-term memory managers
│   ├── web/                  # FastAPI router hosting HTTP endpoint actions & WebSocket pipeline
│   │   └── static/           # Single Page App frontend (index.html, base.css, main.js)
│   └── skills/               # Core tools (web scraper, stock tickers, deep research, physics)
│
└── tests/                    # Agent validation suite and test outcomes
    ├── test_report.md        # Report detailing results of test cases
    └── unit/                 # Unit tests (e.g. physics solver verification)
```

---

## 🧠 Core Backend Architecture & Cognitive Engine

### 1. Limbic Chemical Neuromodulator & Emotion Engine
One of Hekki's most distinct features is its simulated limbic emotional state, implemented in [neuromodulator.py](file:///d:/mariano/mariano/core/neuromodulator.py). It models five core chemical values that decay back to baselines or surge depending on agent success or feedback:
*   **Dopamine (DA):** Measures focus. Surges on successful steps; decays slowly. High DA narrows tool routing and lowers temperature.
*   **Serotonin (5HT):** Stability metric. Decreases on failed steps or negative user sentiment.
*   **Acetylcholine (ACh):** Working memory utilization. Increases with step complexity and latency. Higher ACh expands the context sliding window size.
*   **Affection:** Positive relationship index with the user. Boosted by positive sentiment keywords (e.g., *love*, *thanks*, *great*). Decreases anger and fear.
*   **Fear:** System danger alerts. Increases on critical failures or threat keywords. Drops temperature to standard deterministic bounds (e.g. `0.05`) to enforce extreme caution.
*   **Anger:** Frustration marker. Increases on consecutive errors or critical negative feedback. Alters agent directives to be robotic and terse.

The dynamic state is formatted inside the terminal HUD or web dashboard interface using the [format_hud](file:///d:/mariano/mariano/core/neuromodulator.py#L126-L139) method.

### 2. The ReAct Execution Loop & Guardrails
The agent core resides in [agent.py](file:///d:/mariano/mariano/core/agent/agent.py#L41) and executes via [react.py](file:///d:/mariano/mariano/core/agent/react.py#L77). 
Key loop features include:
*   **Cognitive Profiler Hook:** Inspects user sentiment on inputs to trigger emotion shifts (affection boost vs. anger/fear spike).
*   **Homeostatic Sleep/Consolidation:** The user can command the agent to "sleep", calling [SynapticConsolidator](file:///d:/mariano/mariano/core/consolidation.py) to reset chemical levels and adjust synaptic weights.
*   **Redundancy Loop Guard:** Tracks identical tool signatures. If a tool is executed with duplicate parameters twice in a row, the loop breaks to avoid token waste.
*   **Failure Guard:** If a specific tool fails consecutively 3 times, the execution halts to prevent loop deadlock.

### 3. Persistent Memory Layer
Memory is managed by [memory_manager.py](file:///d:/mariano/mariano/memory/memory_manager.py#L16) and backed by [episodic_store.py](file:///d:/mariano/mariano/memory/episodic/episodic_store.py#L72) utilizing `aiosqlite`.
The SQLite schema consists of:
*   `memories`: Vector-search simulated keyword matching table.
*   `episodes`: Logs user inputs, tool actions, and successful results.
*   `task_log`: Logs specific tool runs and paths accessed.
*   `chat_sessions` & `chat_messages`: Persistent storage for UI conversations.

---

## 🌐 Web HUD Server & Frontend Pipeline

The server defined in [app.py](file:///d:/mariano/mariano/web/app.py) handles HTTP requests and WebSocket lines:
*   **Hot-Reload File Watcher:** Spawns a background task ([watch_static_files](file:///d:/mariano/mariano/web/app.py#L37-L87)) that detects changes in JS/CSS assets and triggers a frontend reload automatically.
*   **Dynamic UI Event Pipe:** [watch_ui_events](file:///d:/mariano/mariano/web/app.py#L88-L123) monitors `static/ui_events.jsonl` to push live custom layouts/cards from running python skills directly into the browser DOM.
*   **WebSocket Controller:** Handled by [websocket_endpoint](file:///d:/mariano/mariano/web/app.py#L358-L545). Channels real-time messages, audio base64 buffers for transcription, state sync, and debate playground events.
*   **Debate Playground:** Orchestrates the two-engine debate system. Connects separate models to argue on a topic while allowing user message injection and control.

---

## 🛠️ Integrated Skills Registry

All tools are loaded by [discovery.py](file:///d:/mariano/mariano/skills/_registry/discovery.py#L32) and stored in [registry.py](file:///d:/mariano/mariano/skills/_registry/registry.py#L15).
Key core skills available in the directory [core_skills/](file:///d:/mariano/mariano/skills/core_skills) include:
1.  `file_manager`: Local file editor and directory reader.
2.  `web_search`: DuckDuckGo wrapper for online lookups.
3.  `web_scraper`: Extracts markdown from target HTML URLs.
4.  `stock_data` / `news_fetch`: Live finance and headline streams.
5.  `deep_research`: Extended research loops.
6.  `physics_solver`: Interacts with OpenFOAM, Elmer FEM, and LAMMPS. **IMPORTANT:** This skill runs simulations and outputs results tagged strictly under **TRL 1-2** boundaries, denoting theoretical calculations (*"Calculated via [Solver] simulation; NOT measured in lab."*).

---

## 🧪 Testing Suite
Hekki includes a test suite under [tests/](file:///d:/mariano/tests/) validating path isolation sandbox rules (`PathGuard`), commands, database interactions, and neuromodulator homeostatic shifts.
The latest test reports can be found in [test_report.md](file:///d:/mariano/tests/test_report.md).
