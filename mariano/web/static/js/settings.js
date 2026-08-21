/* === SETTINGS MODULE — Hekki ===
 * All settings are real and persisted.
 * Backend fields  → /api/settings (GET + POST)
 * Client-only     → localStorage
 */

import {
  applyReadingSettings,
  syncReadingUI,
  initReadingListeners,
  applyNavVisibility,
  syncNavVisibilityUI,
  loadActiveSkills
} from './settings_display.js';

let _settingsBound = false;

export function initSettings(setGreetingCallback) {
  if (_settingsBound) return;
  _settingsBound = true;

  const $ = id => document.getElementById(id);

  const openSettingsPage = () => {
    document.getElementById('user-menu-dropdown')?.classList.add('hidden');
    if (window.router) {
      window.router.navigate('settings');
    }
  };

  window._loadSettingsOnPage = () => {
    loadAllSettings();
    loadActiveSkills();
    applyNavVisibility();
    syncNavVisibilityUI();
    const _fk = localStorage.getItem('hekki_font') || 'segoe-ui';
    const _fontSel = document.getElementById('settings-font-family');
    if (_fontSel) _fontSel.value = _fk;
    if (window.lucide) setTimeout(() => lucide.createIcons(), 50);
  };

  $('btn-open-settings')?.addEventListener('click', openSettingsPage);
  $('btn-user-settings')?.addEventListener('click', openSettingsPage);
  $('btn-back-settings')?.addEventListener('click', () => {
    if (window.router) {
      window.router.navigate('chat');
    }
  });

  // ── Nav switching ─────────────────────────────────────────────────────
  document.querySelectorAll('.modal-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const sec = $('section-' + btn.dataset.section);
      if (sec) sec.classList.add('active');
    });
  });

  // ── Settings Search Filter ─────────────────────────────────────────────
  $('settings-search')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.modal-nav-item').forEach(btn => {
      const text = btn.textContent.toLowerCase();
      const secId = btn.dataset.section;
      const sec = $('section-' + secId);
      const secText = sec ? sec.textContent.toLowerCase() : '';
      if (!query || text.includes(query) || secText.includes(query)) {
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
      }
    });
  });

  // ── Save indicator flash ──────────────────────────────────────────────
  function flashSaved() {
    const ind = $('settings-save-indicator');
    if (!ind) return;
    ind.style.opacity = '1';
    setTimeout(() => { ind.style.opacity = '0'; }, 2000);
  }

  // ── Theme (localStorage & backend) ────────────────────────────────────
  const VALID_THEMES = ['dark', 'light', 'oled', 'catppuccin'];
  let savedTheme = localStorage.getItem('hekki_theme') || 'dark';
  if (!VALID_THEMES.includes(savedTheme)) savedTheme = 'dark';
  localStorage.setItem('hekki_theme', savedTheme);
  if (window._applyThemeGlobal) {
    window._applyThemeGlobal(savedTheme, document.getElementById('btn-user-theme'));
  }
  document.querySelectorAll('.theme-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === savedTheme);
    b.addEventListener('click', () => {
      document.querySelectorAll('.theme-opt').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      localStorage.setItem('hekki_theme', b.dataset.theme);
      
      if (window._applyThemeGlobal) {
        window._applyThemeGlobal(b.dataset.theme, document.getElementById('btn-user-theme'));
      }
      if (window.electronAPI?.setTheme) {
        window.electronAPI.setTheme(b.dataset.theme);
      }
      
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: b.dataset.theme })
      }).catch(err => console.error("Failed to sync theme settings to backend:", err));

      const iconEl = $('btn-theme')?.querySelector('[data-lucide]');
      if (iconEl) {
        const lucideName = (b.dataset.theme === 'light') ? 'sun' : 'moon';
        iconEl.setAttribute('data-lucide', lucideName);
        if (window.lucide) lucide.createIcons();
      }
    });
  });

  // ── Font Family ───────────────────────────────────────────────────────
  const FONT_MAP = {
    'google-sans': { font: '"Google Sans", "Google Sans Flex", "Open Sans", sans-serif', serif: '"Google Sans", sans-serif', ai: '"Google Sans", sans-serif' },
    'segoe-ui': { font: '"Segoe WPC", "Segoe UI", -apple-system-body, ui-sans-serif, sans-serif', serif: '"Segoe WPC", "Segoe UI", sans-serif', ai: '"Segoe WPC", "Segoe UI", sans-serif' },
    'inter': { font: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', serif: '"Inter", sans-serif', ai: '"Inter", sans-serif' },
    'plus-jakarta': { font: '"Plus Jakarta Sans", "Inter", sans-serif', serif: '"Plus Jakarta Sans", sans-serif', ai: '"Plus Jakarta Sans", sans-serif' },
    'outfit': { font: '"Outfit", "Plus Jakarta Sans", sans-serif', serif: '"Outfit", sans-serif', ai: '"Outfit", sans-serif' },
    'open-sans': { font: '"Open Sans", "Google Sans", sans-serif', serif: '"Open Sans", "Google Sans", sans-serif', ai: '"Open Sans", "Google Sans", sans-serif' },
    'roboto': { font: '"Roboto", "Open Sans", sans-serif', serif: '"Roboto", sans-serif', ai: '"Roboto", sans-serif' },
    'system': { font: '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", sans-serif', serif: '-apple-system-body, sans-serif', ai: '-apple-system-body, sans-serif' },
    'jetbrains-mono': { font: '"JetBrains Mono", "Fira Code", monospace', serif: '"JetBrains Mono", monospace', ai: '"JetBrains Mono", monospace' },
    'fira-code': { font: '"Fira Code", "JetBrains Mono", monospace', serif: '"Fira Code", monospace', ai: '"Fira Code", monospace' },
    'anthropic': { font: '"anthropic-sans", system-ui, sans-serif', serif: '"anthropic-serif", Georgia, serif', ai: '"anthropic-serif", Georgia, serif' }
  };

  function applyFont(key) {
    const cfg = FONT_MAP[key] || FONT_MAP['segoe-ui'] || FONT_MAP['system'];
    document.documentElement.style.setProperty('--font', cfg.font);
    document.documentElement.style.setProperty('--font-sans', cfg.font);
    document.documentElement.style.setProperty('--font-serif', cfg.serif);
    document.documentElement.style.setProperty('--font-ai', cfg.ai);
  }

  const fontSel = $('settings-font-family');
  if (fontSel) {
    const savedFont = localStorage.getItem('hekki_font') || 'segoe-ui';
    fontSel.value = savedFont;
    applyFont(savedFont);

    fontSel.addEventListener('change', () => {
      const key = fontSel.value;
      localStorage.setItem('hekki_font', key);
      applyFont(key);
    });
  }

  // ── API key visibility toggle ─────────────────────────────────────────
  $('btn-toggle-key-visibility')?.addEventListener('click', () => {
    const inp = $('settings-gemini-key');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    const icon = $('btn-toggle-key-visibility').querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', inp.type === 'password' ? 'eye' : 'eye-off');
      if (window.lucide) lucide.createIcons();
    }
  });

  // ── Load all settings from backend ───────────────────────────────────
  async function loadAllSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('fetch failed');
      const cfg = await res.json();

      // Identity
      const userName = $('settings-user-name');
      const userInstructions = $('settings-user-instructions');
      if (userName) userName.value = cfg.user_name || '';
      if (userInstructions) userInstructions.value = cfg.user_instructions || '';

      const userLabel = cfg.user_name ? cfg.user_name : 'User Account';
      document.querySelectorAll('.user-menu-header').forEach(el => { el.textContent = userLabel; });
      if (cfg.user_name && setGreetingCallback) setGreetingCallback(cfg.user_name);

      // API key
      const gkey = $('settings-gemini-key');
      if (gkey) {
        gkey.value = cfg.gemini_api_key || '';
        updateKeyStatus(cfg.gemini_api_key);
      }

      // Model
      const modelSel = $('settings-hekki-model');
      if (modelSel && cfg.hekki_model) {
        let found = false;
        for (let opt of modelSel.options) {
          if (opt.value === cfg.hekki_model) { opt.selected = true; found = true; break; }
        }
        if (!found) {
          const opt = new Option(cfg.hekki_model, cfg.hekki_model, true, true);
          modelSel.add(opt);
        }
      }

      // Reasoning mode
      if (cfg.reasoning_mode) {
        ['settings-reasoning-mode', 'settings-reasoning-mode-sec'].forEach(id => {
          const reasonSel = $(id);
          if (reasonSel) {
            for (let opt of reasonSel.options) {
              if (opt.value === cfg.reasoning_mode) { opt.selected = true; break; }
            }
          }
        });
      }

      // Ollama / Local Gateway
      const useOllama = $('settings-use-ollama');
      const ollamaModel = $('settings-ollama-model');
      const ollamaUrl = $('settings-ollama-url');
      if (useOllama) useOllama.checked = !!(cfg.use_local_gateway || cfg.use_ollama);
      if (ollamaModel) ollamaModel.value = cfg.local_model || cfg.ollama_model || '';
      if (ollamaUrl) ollamaUrl.value = cfg.local_base_url || cfg.ollama_base_url || 'http://localhost:11434';
      fetchLocalModels(cfg.local_base_url || cfg.ollama_base_url);

      // Run in Background Toggle
      const runBg = $('settings-run-background');
      if (runBg) {
        runBg.checked = cfg.run_in_background !== false;
      }

      // Start with Windows Toggle
      const autoStartToggle = $('settings-auto-start');
      if (autoStartToggle) {
        if (window.electronAPI?.getAutoStart) {
          try {
            const isAutoStart = await window.electronAPI.getAutoStart();
            autoStartToggle.checked = !!isAutoStart;
          } catch (e) {
            autoStartToggle.checked = !!cfg.auto_start;
          }
        } else {
          autoStartToggle.checked = !!cfg.auto_start;
        }
      }

      // Computer Vision Floating HUD toggle
      const visionHudToggle = $('settings-vision-hud');
      if (visionHudToggle) {
        visionHudToggle.checked = localStorage.getItem('hekki_vision_hud_enabled') !== 'false';
      }

      const fontDropdown = $('settings-font-family');
      if (fontDropdown) {
        fontDropdown.value = localStorage.getItem('hekki_font') || 'system';
      }

    } catch (err) {
      console.error('[Settings] Load failed:', err);
    }
  }

  async function fetchLocalModels(urlOverride = null) {
    const baseUrl = urlOverride || $('settings-ollama-url')?.value.trim() || 'http://localhost:11434';
    const dropdown = $('settings-local-model-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">Fetching installed models...</option>';
    try {
      const res = await fetch(`/api/local_models?base_url=${encodeURIComponent(baseUrl)}`);
      if (!res.ok) throw new Error('Failed to fetch local models');
      const data = await res.json();

      dropdown.innerHTML = '';
      if (data.models && data.models.length > 0) {
        let activeVal = data.active_model || $('settings-ollama-model')?.value || '';
        let matched = false;
        data.models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          if (m === activeVal) { opt.selected = true; matched = true; }
          dropdown.appendChild(opt);
        });
        if (!matched && activeVal) {
          const opt = document.createElement('option');
          opt.value = activeVal;
          opt.textContent = activeVal;
          opt.selected = true;
          dropdown.insertBefore(opt, dropdown.firstChild);
        }
      } else {
        dropdown.innerHTML = '<option value="">No local models detected</option>';
      }
    } catch (err) {
      console.error('[Settings] Fetch local models failed:', err);
      dropdown.innerHTML = '<option value="">Error connecting to local server</option>';
    }
  }

  function updateKeyStatus(key) {
    const statusEl = $('api-key-status');
    if (!statusEl) return;
    if (key && key.length > 8) {
      statusEl.textContent = `Completed Key set (${key.slice(0, 6)}...)`;
      statusEl.style.color = '#16a34a';
    } else {
      statusEl.textContent = 'No key configured. Hekki cannot respond without a Gemini API key.';
      statusEl.style.color = '#dc2626';
    }
  }

  // ── Save to backend ───────────────────────────────────────────────────
  async function save(payload) {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      flashSaved();
      if (window.updateModelPills) window.updateModelPills();
    } catch (err) {
      console.error('[Settings] Save failed:', err);
    }
  }

  // ── Event Handlers ───────────────────────────────────────────────────
  $('btn-save-identity')?.addEventListener('click', () => {
    const name = $('settings-user-name')?.value.trim() || '';
    const instructions = $('settings-user-instructions')?.value.trim() || '';
    save({ user_name: name, user_instructions: instructions });
    const userLabel = name || 'User Account';
    document.querySelectorAll('.user-menu-header').forEach(el => { el.textContent = userLabel; });
    if (setGreetingCallback) setGreetingCallback(name);
  });

  $('settings-gemini-key')?.addEventListener('change', e => {
    const key = e.target.value.trim();
    save({ gemini_api_key: key });
    updateKeyStatus(key);
  });

  $('settings-hekki-model')?.addEventListener('change', e => save({ hekki_model: e.target.value }));

  ['settings-reasoning-mode', 'settings-reasoning-mode-sec'].forEach(id => {
    $(id)?.addEventListener('change', e => {
      const val = e.target.value;
      ['settings-reasoning-mode', 'settings-reasoning-mode-sec'].forEach(otherId => {
        const sel = $(otherId);
        if (sel) sel.value = val;
      });
      save({ reasoning_mode: val });
    });
  });

  $('settings-use-ollama')?.addEventListener('change', e => {
    save({ use_ollama: e.target.checked, use_local_gateway: e.target.checked });
  });

  $('settings-ollama-model')?.addEventListener('change', e => {
    const val = e.target.value.trim();
    save({ ollama_model: val, local_model: val });
  });

  $('settings-local-model-dropdown')?.addEventListener('change', e => {
    const val = e.target.value;
    const modelInput = $('settings-ollama-model');
    if (modelInput) modelInput.value = val;
    save({ ollama_model: val, local_model: val });
  });

  let localUrlDebounceTimer = null;
  $('settings-ollama-url')?.addEventListener('input', e => {
    const val = e.target.value.trim();
    if (localUrlDebounceTimer) clearTimeout(localUrlDebounceTimer);
    localUrlDebounceTimer = setTimeout(() => {
      if (val.length >= 7) {
        save({ ollama_base_url: val, local_base_url: val });
        fetchLocalModels(val);
      }
    }, 400);
  });

  $('settings-ollama-url')?.addEventListener('change', e => {
    const val = e.target.value.trim();
    save({ ollama_base_url: val, local_base_url: val });
    fetchLocalModels(val);
  });

  $('btn-fetch-local-models')?.addEventListener('click', () => fetchLocalModels());

  // ── Run in Background Toggle Handler ──────────────────────────────────
  $('settings-run-background')?.addEventListener('change', e => {
    const isChecked = e.target.checked;
    save({ run_in_background: isChecked });
    if (window.electronAPI?.setRunInBackground) {
      window.electronAPI.setRunInBackground(isChecked);
    }
    if (window.showToast) {
      window.showToast('Background Mode', isChecked ? 'Hekki will keep running in system tray on close' : 'Hekki will exit completely when closed', 2500);
    }
  });

  // ── Start with Windows Toggle Handler ─────────────────────────────────
  $('settings-auto-start')?.addEventListener('change', async e => {
    const isChecked = e.target.checked;
    save({ auto_start: isChecked });
    if (window.electronAPI?.setAutoStart) {
      try {
        await window.electronAPI.setAutoStart(isChecked);
      } catch (err) {
        console.error("Failed to update auto start in electron:", err);
      }
    }
    if (window.showToast) {
      window.showToast('Startup', isChecked ? 'Start with Windows enabled' : 'Start with Windows disabled', 2500);
    }
  });

  $('settings-vision-hud')?.addEventListener('change', e => {
    const isChecked = e.target.checked;
    localStorage.setItem('hekki_vision_hud_enabled', isChecked ? 'true' : 'false');
    if (isChecked) {
      window.VisionHUD?.enable();
      if (window.showToast) window.showToast('Computer Vision', 'Floating Vision HUD Enabled', 2000);
    } else {
      window.VisionHUD?.disable();
      if (window.showToast) window.showToast('Computer Vision', 'Floating Vision HUD Disabled', 2000);
    }
  });

  // Initialize display settings, nav visibility & reading listeners
  applyReadingSettings();
  syncReadingUI();
  initReadingListeners();
  applyNavVisibility();
  syncNavVisibilityUI();

  window.applyNavVisibility = applyNavVisibility;
  window.syncNavVisibilityUI = syncNavVisibilityUI;
}
