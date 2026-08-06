<p align="center">
  <img src="assets/hekki.png" width="110" alt="Hekki Logo"/>
</p>

<h1 align="center">Hekki AI Assistant</h1>

<p align="center">
  <em>A locally-running, privacy-first AI desktop agent — built for power users.</em>
</p>

<p align="center">
  <a href="https://github.com/gharvanta-real/Hekki-GPT/stargazers"><img src="https://img.shields.io/github/stars/gharvanta-real/Hekki-GPT?style=flat-square&color=2563eb" alt="Stars"/></a>
  <a href="https://github.com/gharvanta-real/Hekki-GPT/commits/main"><img src="https://img.shields.io/github/last-commit/gharvanta-real/Hekki-GPT?style=flat-square&color=2563eb" alt="Last Commit"/></a>
  <img src="https://img.shields.io/badge/platform-Windows-2563eb?style=flat-square" alt="Platform"/>
  <img src="https://img.shields.io/badge/stack-Electron%20%2B%20FastAPI%20%2B%20Python-2563eb?style=flat-square" alt="Stack"/>
  <img src="https://img.shields.io/badge/license-MIT-2563eb?style=flat-square" alt="License"/>
</p>

---

Hekki is a **standalone Windows desktop AI assistant** that runs entirely on your machine. It bundles a Python (FastAPI) agentic backend with an Electron desktop shell, giving you a Perplexity-class research experience combined with full local computer automation — with zero data leaving your device.

- **100% Local & Private** — your conversations, files, and keys stay on-device
- **25 Built-in Tool Skills** — web search, code execution, file management, desktop automation, stock data, security scanning, and more
- **Multi-Model Support** — Gemini, Claude, and easily extensible to any provider
- **Packaged as a 1-click Windows Installer** (`Hekki Setup 1.0.0.exe`)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quickstart](#quickstart)
- [Build from Source](#build-from-source)
- [Skill Inventory](#skill-inventory)
- [Configuration](#configuration)
- [Changelog](#changelog)

---

## Features

### 🧠 Agentic Intelligence
- **ReAct Loop** — full Plan → Tool Call → Observe → Respond reasoning cycle
- **Intent Classifier** — routes every query to the optimal tool or conversation path
- **Neuromodulator** — AI persona and tone adapts dynamically to conversation context
- **Cognitive Profiler** — builds a persistent behavioral model of the user over time
- **Curiosity Learner** — autonomously expands its own knowledge base between sessions
- **Local Memory + Consolidation** — stores and recalls facts, preferences, and past context

### 💬 Chat UI
- **Universal Slash Command Menu** — `/web`, `/code`, `/image`, `/pdf`, `/debate` — keyboard-first with `Ctrl+K` palette
- **Faded Tag Chip Conversion** — `/web` becomes a `[ /web × ]` pill in the input bar, keeping your prompt clean
- **Inline Citation Hover Cards** — hover any external link to see source domain, category badge (`🏛️ Official`, `📰 News`, `📚 Ref`), and snippet preview
- **Thread Forking (`🔀`)** — branch any conversation at any message point; parallel branches appear in the sidebar
- **AI Thinking Process Accordion** — collapsible `▼ Thinking Process` block for supported reasoning models
- **Live Canvas** — open any AI-generated HTML, code, or Mermaid diagram in an interactive preview panel

### 🛠️ Tool Skills (25 Built-in)
Web search · Deep research · Academic papers · News · Stock data · Image generation · Image analysis · Code refactor · Command execution · File management · Safe delete (Recycle Bin) · Desktop computer use · Weather · Wikipedia · Translator · Reminders · Morning briefing · Memory ops · Expert debate · Physics solver · Data analyzer · Security recon · Header analyzer · Real simulation · Web scraper

### 🔒 Privacy & Control
- All computation runs locally — no telemetry, no cloud sync
- **Permission Modes** — Ask First (Safe), Auto-Approve (Fast), Super Permission (Full OS access with Recycle Bin safety)
- **Sentinel Guard Layer** — blocks dangerous actions based on active permission policy

---

## Architecture

```
Hekki Desktop App
├── electron_main.js          ← Electron shell, IPC bridge, splash screen
├── preload.js                ← Context bridge (renderer ↔ main)
├── splash.html               ← Animated boot splash
├── assets/
│   ├── hekki.png             ← Logo (PNG)
│   └── hekki.ico             ← Logo (ICO, multi-resolution)
│
├── mariano/                  ← Python backend package
│   ├── web/
│   │   ├── app.py            ← FastAPI application
│   │   └── static/           ← Frontend (HTML/CSS/JS, single-page app)
│   ├── core/
│   │   ├── agent/
│   │   │   ├── agent.py      ← Master orchestrator
│   │   │   ├── react.py      ← ReAct reasoning loop
│   │   │   └── intent.py     ← Query intent classifier
│   │   ├── thalamus.py       ← Central routing & context assembly
│   │   ├── neuromodulator.py ← Adaptive persona modulation
│   │   ├── cognitive_profiler.py ← User behavioral model
│   │   ├── curiosity_learner.py  ← Autonomous knowledge expansion
│   │   ├── computer_use.py   ← Desktop automation (pyautogui + mss)
│   │   ├── live_audio.py     ← Real-time voice I/O
│   │   ├── sentinel.py       ← Safety & permission enforcement
│   │   └── rate_limiter.py   ← Per-provider token budget control
│   ├── skills/
│   │   └── core_skills/      ← 25 modular tool skills
│   └── providers/
│       └── gemini_models.py  ← Multi-model provider abstraction
│
├── run_web.py                ← Backend entry point (PyInstaller target)
├── build_backend.py          ← Compiles Python → hekki_backend.exe
└── data/
    └── hekki.db              ← SQLite (chats, memory, settings)
```

---

## Quickstart

### Prerequisites
- Windows 10/11 (x64)
- Python 3.10+
- Node.js 18+
- A Gemini or Claude API key

### Option A — Install from Release

Download `Hekki Setup 1.0.0.exe` from [Releases](https://github.com/gharvanta-real/Hekki-GPT/releases) and run the installer.

### Option B — Run in Development Mode

**1. Clone the repository**
```bash
git clone https://github.com/gharvanta-real/Hekki-GPT.git
cd Hekki-GPT
```

**2. Install Python dependencies**
```bash
pip install -r requirements.txt
```

**3. Set your API key**
```env
# .env in project root
GEMINI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_claude_key   # optional
```

**4. Start the backend**
```bash
python run_web.py
```

**5. Launch the Electron shell** (separate terminal)
```bash
npm install
npm start
```

---

## Build from Source

Produces a standalone `Hekki Setup x.x.x.exe` installer (~197 MB).

**Step 1 — Compile Python backend**
```bash
python build_backend.py
# Output: backend_dist/hekki_backend.exe
```

**Step 2 — Package Electron + NSIS installer**
```bash
npx electron-builder --win nsis
# Output: dist/Hekki Setup 1.0.0.exe
```

---

## Skill Inventory

| Skill | Description |
| :--- | :--- |
| `web_search` | DuckDuckGo / SerpAPI real-time web search |
| `web_scraper` | Full-page HTML scraping and extraction |
| `deep_research` | Multi-source synthesis and structured report generation |
| `academic_search` | arXiv, Google Scholar paper search |
| `news_fetch` | Live news feed aggregation |
| `wikipedia_search` | Structured Wikipedia article extraction |
| `stock_data` | Live market price, volume, and financial data |
| `generate_image` | AI image generation via Gemini Imagen |
| `image_analysis` | Multi-modal visual understanding |
| `coder_refactor` | Context-aware code editing and refactoring |
| `run_command` | PowerShell / bash command execution |
| `file_manager` | File CRUD, directory traversal, search |
| `safe_recycler` | Move files to Recycle Bin (recoverable safe delete) |
| `computer_use` | Full desktop automation — click, type, screenshot any app |
| `reminder` | Scheduled notification alerts |
| `morning_briefing` | Daily automated digest (news + weather + calendar) |
| `memory_ops` | Store and recall persistent user facts |
| `expert_debate` | Multi-persona structured debate orchestration |
| `real_simulation` | Physics simulation runner |
| `physics_solver` | LaTeX math and physics equation solving |
| `data_analyzer` | CSV / JSON data analysis and summary |
| `translator` | Multi-language translation |
| `weather` | Live weather and forecast data |
| `recon_scanner` | Subdomain discovery, port scanning, security audit |
| `security_header_analyzer` | OWASP-grade HTTP security header analysis |

---

## Configuration

```env
# .env — project root
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_claude_api_key   # optional
SERP_API_KEY=your_serpapi_key           # optional
HEKKI_LOG_LEVEL=INFO
```

Model, permissions, and UI preferences are configurable via **Settings** (`⚙️ → Settings`) inside the app.

---

## Changelog

Full timestamped log: [`data/evolution_log.json`](data/evolution_log.json)

| Date | Change |
| :--- | :--- |
| 2026-08-06 | Windows NSIS installer — `Hekki Setup 1.0.0.exe` (196 MB) |
| 2026-08-06 | Citation hover cards with source category badges (`🏛️ Official`, `📰 News`, `📚 Ref`) |
| 2026-08-06 | Thread Forking — branch any conversation at any message (`🔀`) |
| 2026-08-06 | Faded slash command tag chips — `/web` → `[ /web × ]` in input bar |
| 2026-08-06 | Bottom-right AI response source domain chips with favicons |
| 2026-08-06 | Universal slash command palette with `Ctrl+K` |

---

## License

MIT © [gharvanta-real](https://github.com/gharvanta-real)
