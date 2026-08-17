# Hekki AI Assistant & Telephony Bridge Workspace Customizations & Rules

These rules apply specifically to all AI coding agents working on the Hekki-Assistant workspace.

---

## 📜 1. Core Architectural & System Constraints

### A. Strict File Length Limit (Max 500 Lines Per File — NO Monster Files)
* **Under 500 Lines:** Every single file (`.js`, `.html`, `.css`, `.py`, `.rs`) **MUST strictly remain under 500 lines**.
* **Modular Splitting:** Whenever any file approaches or exceeds 500 lines, you must immediately split it into clean, single-responsibility modular files and import them appropriately.

### B. Automatic Evolution Ledger Logging
* Whenever you modify or upgrade the codebase (creating pages, adding features, editing client styles, or introducing skills), you **MUST** automatically append a structured record to `data/evolution_log.json` before ending your turn.

### C. NO Outlines & NO Box-Shadows Rule (Flat Clean Aesthetic)
* **Zero Borders & Zero Shadows:** NEVER add visible borders, outlines, or box-shadows to cards, icons, buttons, search inputs, tables, status badges, or container elements (`border: none !important; box-shadow: none !important;`).
* **Background Tint Separation:** Use solid white (`#FFFFFF`) or soft neutral tints (`#F8FAFC`, `#F1F3F6`, `#EFF6FF`, `#1E1E1E`, `#121214`) to separate UI elements and cards, giving a modern, flat, borderless aesthetic.

---

## 🎨 2. Master Centralized Token Engine (`base/1_variables_theme.css`)

**All design variables across all themes (Light, Dark, OLED) are controlled from ONE single file:**  
📍 Path: `mariano/web/static/css/base/1_variables_theme.css`

**NEVER hardcode hex/rgb colors, shadows, borders, or font properties in individual CSS files.** Always use the centralized CSS custom properties:

### Token Categories & Mappings:
| Category | CSS Token Variable | Purpose / Usage |
| :--- | :--- | :--- |
| **Surfaces & BG** | `var(--bg)` / `var(--bg-app)` | Outer window & application background |
| | `var(--bg-surface)` | Main panel & conversation view surface |
| | `var(--bg-card)` / `var(--card)` | Elevated cards, popup menus, and modal dialogs |
| | `var(--bg-card-secondary)` | Secondary cards, promo callouts |
| | `var(--sidebar-bg)` | Left sidebar rail & modal nav column |
| | `var(--input-bg)` | Form text inputs, search bars, textareas, tags |
| | `var(--hover)` | Hover state fill on items, rows, dropdown options |
| | `var(--bg-active)` | Active item highlight, listening state fill |
| **Typography** | `var(--font)` | Primary font family (`'Open Sans', sans-serif`) |
| | `var(--font-mono)` | Monospace font family (`'JetBrains Mono', monospace`) |
| | `var(--fs-xs)` (11px) | Badges, captions, timestamps, micro-tags |
| | `var(--fs-sm)` (12px) | Subtitles, helper text, card meta |
| | `var(--fs-base)` (13.5px) | Standard body text, table content, form labels |
| | `var(--fs-lg)` (15px) | Section titles, chat bubble message body |
| | `var(--fs-xl)` (17px) | Card headers, modal titles |
| | `var(--fs-2xl)` (19px) | **MAX heading size** for primary page titles |
| **Text Colors** | `var(--text-primary)` / `var(--text)` | Primary high-contrast content text |
| | `var(--text-2)` / `var(--text-secondary)` | Secondary descriptions, subheadings |
| | `var(--text-3)` / `var(--text-tertiary)` | Subdued captions, placeholders, inactive icons |
| **Buttons** | `var(--btn-primary-bg)` / `var(--btn-primary-text)` | Primary action buttons (save, confirm, run) |
| | `var(--btn-secondary-bg)` / `var(--btn-secondary-text)` | Secondary neutral buttons (cancel, back, filter) |
| | `var(--btn-pill-bg)` / `var(--btn-pill-text)` | Pill-shaped auxiliary buttons |
| **Badges & Chips** | `var(--chip-bg)` / `var(--chip-text)` | Default status badges & attachment chips |
| | `var(--chip-active-bg)` / `var(--chip-active-text)` | Active filter chips & selected options |
| | `var(--chip-accent-bg)` / `var(--chip-accent-text)` | Highlighted tag badges & system prompts |
| **Accents** | `var(--accent-primary)` | Vibrant Blue brand accent (`#2563EB`) |
| | `var(--accent-tint)` | Translucent blue fill for badges and active pills |
| **Radii & Borders** | `var(--radius-xs)` (4px), `var(--radius-sm)` (8px), `var(--radius-md)` (12px), `var(--radius-lg)` (16px), `var(--radius-pill)` (9999px) | Corner rounding tokens |
| | `var(--shadow)` | Always `none !important` |
| | `var(--border)` / `var(--border-subtle)` | Subtle dividers (`border-bottom: 1px solid var(--border-subtle)`) |

---

## 🗂️ 3. 5-Layer Modular CSS Directory & File Structure

The entire CSS architecture is organized into 5 strict layers. Keep this structure clean and never create unlinked standalone stylesheets:

```
mariano/web/static/
├── theme.css                             ← Master stylesheet bundle (linked in index.html)
└── css/
    ├── 1_variables.css                   ← Layer 1: Forwards base/1_variables_theme.css
    ├── base.css                          ← Layer 2: Bundle for base resets
    │   └── base/
    │       ├── 1_variables_theme.css     ← 🌟 MASTER DESIGN TOKEN ENGINE (Light/Dark/OLED)
    │       ├── 2_typography_resets.css   ← Open Sans scale, resets, input hierarchy
    │       └── 3_animations_utilities.css← Micro-animations, transitions, helper classes
    ├── layout.css                        ← Layer 3: Bundle for layout modules
    │   └── layout/
    │       ├── 0_desktop_topnav.css      ← Top navigation bar & breadcrumbs
    │       ├── 1_structure.css           ← Main app layout container & grid
    │       ├── 2_sidebar_dock.css        ← Sidebar dock bounds
    │       ├── 3_sidebar_nav.css         ← Sidebar core rail & collapse transitions (<500 lines)
    │       ├── 3b_sidebar_items.css      ← Navigation items, recents, active pills (<500 lines)
    │       ├── 4_main_containers.css     ← Chat container & scroll areas
    │       ├── 5_hud_pane.css            ← HUD floating panel
    │       ├── 6a_pills.css              ← UI pills and header action chips
    │       └── 6b_user_menu.css          ← Floating user menu & tools
    ├── 4_components.css                  ← Layer 4: Global flat UI components (zero shadows)
    ├── system_panels.css                 ← Floating system cards, modals & dropdown popups
    ├── chat.css                          ← Bundle for chat conversation sub-modules
    │   └── chat/
    │       ├── 1_chat_layout.css
    │       ├── 2a_home_welcome.css
    │       ├── 2b_home_suggestions.css
    │       ├── 3a_message_bubbles.css
    │       ├── 6_dropdowns.css
    │       ├── 8b_live_terminal.css
    │       ├── 8c_image_gallery.css
    │       ├── 8d1_lightbox.css
    │       ├── 8d2_chips.css
    │       ├── 8e_snippet_modal.css
    │       ├── 9a_canvas_layout.css
    │       ├── 9b_canvas_widgets.css
    │       ├── 10_chat_minimap.css
    │       ├── 11_debate_mode.css
    │       └── 12_computer_vision_hud.css
    ├── coder.css                         ← Coding workspace & IDE pane bundle
    │   └── coder/
    │       ├── 1_coder_layout.css
    │       ├── 2_coder_editor.css
    │       └── 3_coder_terminal.css
    ├── debate.css                        ← Arena debate mode styling bundle
    │   └── debate/
    │       ├── 1a_debate_layout.css
    │       ├── 1b_debate_cards.css
    │       ├── 1c_debate_stream.css
    │       ├── 3a_reader_mode.css
    │       └── 3b_reader_sidebar.css
    └── settings.css                      ← Settings pane bundle
        └── settings/
            ├── 1_settings_base.css       ← Settings navigation, sections & cards
            ├── 1a_settings_controls.css  ← Form rows, inputs, selects, pill buttons
            └── 2_settings_gateway.css    ← Gateway, MCP and skill management
```

---

## 🚫 4. Strict Design Rules & Anti-Regression Checklist

Before saving changes to any HTML, CSS, or JS file, verify every item on this checklist:

### 1. Typography Rules:
* **Font Family:** `Open Sans`, sans-serif (or `JetBrains Mono` for code).
* **Header Limit:** Page title max **19px** (`font-weight: 600`). Never make headings 24px+ or overly bold.
* **No Pure UPPERCASE:** Never use `text-transform: uppercase` in headers, category labels, or badges. Always use natural **Title Case** or **Sentence Case**.

### 2. Styling Rules:
* **No Hardcoded Hex Colors:** Do NOT write `#1E1E1E`, `#FFFFFF`, `#F1F3F6`, `#2563EB` directly inside component CSS. Always use `var(--bg-card)`, `var(--text-primary)`, `var(--input-bg)`, `var(--hover)`, `var(--accent-primary)`.
* **Zero Box Shadows:** Do NOT add `box-shadow: 0 4px 20px ...` or neon glowing shadows. Every element must use flat background fills (`box-shadow: none !important;`).
* **Zero Card Borders:** Card separation is achieved purely via background contrast (e.g. `#FFFFFF` card on `#F6F7F9` page in light mode, or `#1E1E1E` card on `#121214` in dark mode).

### 3. DOM & Template Rules:
* **Single Master CSS Link:** In `index.html`, only `<link rel="stylesheet" href="/static/theme.css?v=...">` should be loaded in `<head>`. Do not add duplicate standalone stylesheet `<link>` tags.
* **Single Lightbox Modal:** The image preview modal is `#image-lightbox-modal` (managed via `mariano/web/static/js/chat/dialogs.js`). Never duplicate `#image-lightbox` in HTML.
* **Internal Package Name:** Keep the Python directory named `mariano/` (do not rename to `hekki/` to avoid breaking 100+ import statements).

### 4. File Length & Modularity:
* Ensure all files are **under 500 lines**. If a file exceeds 500 lines, immediately split it.
* Log all changes to `data/evolution_log.json`.
