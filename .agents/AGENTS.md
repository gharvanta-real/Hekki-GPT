# Hekki AI Assistant & Telephony Bridge Workspace Customizations & Rules

These rules apply specifically to all AI coding agents working on the Hekki-Assistant workspace.

---

## 📜 Enforced System & Architectural Rules

### 1. Automatic Evolution Ledger Logging
Whenever you (the AI assistant) successfully modify or upgrade the codebase (e.g., creating new pages, adding features, editing client files, or introducing new expert skills), you **MUST** automatically write a log entry to the **System Evolution Ledger** (Changelog) BEFORE finishing your work turn.

To do this:
- Append directly to `data/evolution_log.json` by invoking `EvolutionLedger.append()` or writing a structured JSON record.

---

### 2. Strict File Length Limit (No Monster Files)
* **Maximum 500 Lines Per File:** Never write monolithic or giant files. Every single file (JavaScript, HTML, CSS, Python, Rust) MUST remain **under 500 lines**.
* **Modular Code Splitting:** If any file approaches or exceeds 500 lines, refactor and split it into clean, single-responsibility modular files.

---

### 3. NO Outlines / NO Shadows Rule (Flat Background Fills Only)
* **Zero Borders & Zero Shadows:** NEVER add visible borders, outlines, or box-shadows to cards, icons, buttons, search inputs, tables, status badges, or container elements (`border: none !important; box-shadow: none !important;`).
* **Background Tint Separation:** Use solid white (`#FFFFFF`) or soft neutral tints (`#F8FAFC`, `#F1F5F9`, `#EFF6FF`) to separate UI elements and cards, giving a modern, flat, borderless, frameless aesthetic.

---

### 4. 5-Layer CSS Modular Tokenization Architecture
Do not write monolithic CSS files. All styling MUST be organized into 5 strict tokenization layers to ensure rapid UI changes and maintainability:

1. `1_variables.css` — Design Tokens, CSS custom properties, Color palettes, Spacing scales.
2. `2_base.css` — CSS Resets, Open Sans Typography scale, Font families, Root defaults.
3. `3_layout.css` — Left Sidebar layout, Top KPI Header, Grid structures, Main content container bounds.
4. `4_components.css` — Cards, Data Tables, Status Badges, Search Inputs, Action Buttons, Pagination.
5. `5_animations.css` — Transitions, Pulsing active indicators, Micro-animations.

---

### 5. Color Palette & Typography Specifications
* **Font Family:** `Open Sans`, sans-serif (Google Fonts).
* **Typography Hierarchy:**
  - Page Headers / Primary Titles: Max **19px** (Mid-Bold `font-weight: 600`).
  - Section Titles / Card Headers: **14px-15px** (`600`).
  - Body Text / Table Content: **12px-13px** (`400-500`).
  - Badges / Subtitles / Captions: Min **10px-11px** (Mid-Bold `500-600`).
  - **No Pure UPPERCASE:** Never use pure uppercase in headings or badges. Use proper Sentence / Title Case.
* **Primary Background / Cards:** `#FFFFFF` (Pure Clean White, Borderless, Flat).
* **Secondary Surface / Background Tint:** `#F6F7F9` (Soft Light Slate Grey).
* **Primary Accent Color:** `#2563EB` / `#3B82F6` (Vibrant Clean Blue).
* **Active Item Highlight:** Pure white rounded pill background (`#FFFFFF`) over `#F6F7F9` background.
