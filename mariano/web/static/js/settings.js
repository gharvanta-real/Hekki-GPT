/* === SETTINGS MODULE — Hekki ===
 * All settings are real and persisted.
 * Backend fields  → /api/settings (GET + POST)
 * Client-only     → localStorage (theme only)
 */

let _settingsBound = false;

export function initSettings(setGreetingCallback) {
  if (_settingsBound) return;
  _settingsBound = true;

  const $ = id => document.getElementById(id);
  const pane = $('settings-pane');

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
  let savedTheme = localStorage.getItem('hekki_theme') || 'dark';
  if (savedTheme === 'oled') savedTheme = 'dark';
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
      // Notify Electron to update the native Windows titlebar colour
      if (window.electronAPI?.setTheme) {
        window.electronAPI.setTheme(b.dataset.theme);
      }
      
      // Sync theme to backend settings
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: b.dataset.theme })
      }).catch(err => console.error("Failed to sync theme settings to backend:", err));

      // sync titlebar icon
      const iconEl = $('btn-theme')?.querySelector('[data-lucide]');
      if (iconEl) {
        const lucideName = (b.dataset.theme === 'light') ? 'sun' : 'moon';
        iconEl.setAttribute('data-lucide', lucideName);
        if (window.lucide) lucide.createIcons();
      }
    });
  });

  function applyTheme(theme) {
    if (window._applyThemeGlobal) {
      window._applyThemeGlobal(theme, document.getElementById('btn-user-theme'));
    }
  }

  // ── Font Family (localStorage) ─────────────────────────────────────────
  const FONT_MAP = {
    'google-sans': {
      font:  '"Google Sans", "Google Sans Flex", "Open Sans", sans-serif',
      serif: '"Google Sans", "Google Sans Flex", sans-serif',
      ai:    '"Google Sans", "Google Sans Flex", sans-serif'
    },
    'segoe-ui': {
      font:  '"Segoe WPC", "Segoe UI", -apple-system-body, ui-sans-serif, "system-ui", sans-serif',
      serif: '"Segoe WPC", "Segoe UI", sans-serif',
      ai:    '"Segoe WPC", "Segoe UI", sans-serif'
    },
    'inter': {
      font:  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      serif: '"Inter", sans-serif',
      ai:    '"Inter", sans-serif'
    },
    'plus-jakarta': {
      font:  '"Plus Jakarta Sans", "Inter", sans-serif',
      serif: '"Plus Jakarta Sans", sans-serif',
      ai:    '"Plus Jakarta Sans", sans-serif'
    },
    'outfit': {
      font:  '"Outfit", "Plus Jakarta Sans", sans-serif',
      serif: '"Outfit", sans-serif',
      ai:    '"Outfit", sans-serif'
    },
    'open-sans': {
      font:  '"Open Sans", "Google Sans", sans-serif',
      serif: '"Open Sans", "Google Sans", sans-serif',
      ai:    '"Open Sans", "Google Sans", sans-serif'
    },
    'roboto': {
      font:  '"Roboto", "Open Sans", sans-serif',
      serif: '"Roboto", sans-serif',
      ai:    '"Roboto", sans-serif'
    },
    'system': {
      font:  '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"',
      serif: '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"',
      ai:    '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"'
    },
    'jetbrains-mono': {
      font:  '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      serif: '"JetBrains Mono", monospace',
      ai:    '"JetBrains Mono", monospace'
    },
    'fira-code': {
      font:  '"Fira Code", "JetBrains Mono", ui-monospace, monospace',
      serif: '"Fira Code", monospace',
      ai:    '"Fira Code", monospace'
    },
    'anthropic': {
      font:  '"anthropic-sans", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      serif: '"anthropic-serif", "Anthropic Serif Fallback Georgia", Georgia, "Times New Roman", serif',
      ai:    '"anthropic-serif", "Anthropic Serif Fallback Georgia", Georgia, "Times New Roman", serif'
    }
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

      // Also sync greeting & user menu header in main view
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
        // Try to match existing option, otherwise add it
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

      // Quick Voice Overlay toggle
      const quickVoice = $('settings-quick-voice');
      if (quickVoice) quickVoice.checked = cfg.quick_voice_enabled !== false;

      // Computer Vision Floating HUD toggle
      const visionHudToggle = $('settings-vision-hud');
      if (visionHudToggle) {
        const isEnabled = localStorage.getItem('hekki_vision_hud_enabled') !== 'false';
        visionHudToggle.checked = isEnabled;
      }



      // Re-sync font dropdown from localStorage (client-only setting)
      const fontDropdown = $('settings-font-family');
      if (fontDropdown) {
        const savedFontKey = localStorage.getItem('hekki_font') || 'system';
        fontDropdown.value = savedFontKey;
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
          if (m === activeVal) {
            opt.selected = true;
            matched = true;
          }
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
      statusEl.textContent = `completed Key set (${key.slice(0, 6)}...)`;
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

  // ── Identity — explicit Save button ───────────────────────────────────
  $('btn-save-identity')?.addEventListener('click', () => {
    const name = $('settings-user-name')?.value.trim() || '';
    const instructions = $('settings-user-instructions')?.value.trim() || '';
    save({ user_name: name, user_instructions: instructions });
    const userLabel = name || 'User Account';
    document.querySelectorAll('.user-menu-header').forEach(el => { el.textContent = userLabel; });
    if (setGreetingCallback) setGreetingCallback(name);
  });

  // ── API key — on blur / Enter ─────────────────────────────────────────
  $('settings-gemini-key')?.addEventListener('change', e => {
    const key = e.target.value.trim();
    save({ gemini_api_key: key });
    updateKeyStatus(key);
  });

  // ── Model — on change ────────────────────────────────────────────────
  $('settings-hekki-model')?.addEventListener('change', e => {
    save({ hekki_model: e.target.value });
  });

  // ── Reasoning mode — on change ────────────────────────────────────────
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

  // ── Local Gateway / Ollama — on change ────────────────────────────────
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
  $('btn-fetch-local-models')?.addEventListener('click', () => {
    fetchLocalModels();
  });

  // ── Quick Voice Overlay toggle ────────────────────────────────────────
  $('settings-quick-voice')?.addEventListener('change', e => {
    save({ quick_voice_enabled: e.target.checked });
  });

  // ── Computer Vision Floating HUD toggle ──────────────────────────────────
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



  // ── Reading & Display Settings ────────────────────────────────────────
  function applyReadingSettings() {
    const textSize       = localStorage.getItem('hekki_text_size')       || '1.0';
    const lineHeight     = localStorage.getItem('hekki_line_height')     || '1.6';
    const letterSpacing  = localStorage.getItem('hekki_letter_spacing')  || '0em';
    const msgWidth       = localStorage.getItem('hekki_msg_width')       || '720px';
    const msgTint        = localStorage.getItem('hekki_msg_tint')        === 'true';
    const dyslexiaFont   = localStorage.getItem('hekki_dyslexia_font')   === 'true';
    const highContrast   = localStorage.getItem('hekki_high_contrast')   === 'true';
    const reduceMotion   = localStorage.getItem('hekki_reduce_motion')   === 'true';
    const focusMode      = localStorage.getItem('hekki_focus_mode')      === 'true';

    const root = document.documentElement;
    root.style.setProperty('--reading-font-scale', textSize);
    root.style.setProperty('--reading-line-height', lineHeight);
    root.style.setProperty('--reading-letter-spacing', letterSpacing);
    root.style.setProperty('--reading-msg-width', msgWidth);
    root.style.fontSize = (parseFloat(textSize) * 100) + '%';

    // Line height on AI messages
    document.querySelectorAll('.ai-message, .msg-content, .message-content').forEach(el => {
      el.style.lineHeight = lineHeight;
      el.style.letterSpacing = letterSpacing;
    });

    // Message max-width
    document.querySelectorAll('.msg-content, .message-wrap, .chat-message-container').forEach(el => {
      el.style.maxWidth = msgWidth;
    });

    // AI tint
    document.body.classList.toggle('hekki-msg-tint', msgTint);

    // Dyslexia font
    if (dyslexiaFont) {
      root.style.setProperty('--font', '"OpenDyslexic", "Comic Sans MS", cursive, sans-serif');
    }

    // High contrast
    document.body.classList.toggle('hekki-high-contrast', highContrast);

    // Reduce motion
    document.body.classList.toggle('hekki-reduce-motion', reduceMotion);

    // Focus mode
    document.body.classList.toggle('hekki-focus-mode', focusMode);
  }

  // Apply on boot
  applyReadingSettings();

  // Sync UI dropdowns/toggles from localStorage
  function syncReadingUI() {
    const setVal = (id, key) => { const el = $(id); if (el) el.value = localStorage.getItem(key) || el.value; };
    const setChk = (id, key) => { const el = $(id); if (el) el.checked = localStorage.getItem(key) === 'true'; };
    setVal('settings-text-size',      'hekki_text_size');
    setVal('settings-line-height',    'hekki_line_height');
    setVal('settings-letter-spacing', 'hekki_letter_spacing');
    setVal('settings-msg-width',      'hekki_msg_width');
    setChk('settings-msg-tint',       'hekki_msg_tint');
    setChk('settings-dyslexia-font',  'hekki_dyslexia_font');
    setChk('settings-high-contrast',  'hekki_high_contrast');
    setChk('settings-reduce-motion',  'hekki_reduce_motion');
    setChk('settings-focus-mode',     'hekki_focus_mode');
  }
  syncReadingUI();

  // Wire up change events
  $('settings-text-size')?.addEventListener('change', e => {
    localStorage.setItem('hekki_text_size', e.target.value);
    applyReadingSettings();
  });
  $('settings-line-height')?.addEventListener('change', e => {
    localStorage.setItem('hekki_line_height', e.target.value);
    applyReadingSettings();
  });
  $('settings-letter-spacing')?.addEventListener('change', e => {
    localStorage.setItem('hekki_letter_spacing', e.target.value);
    applyReadingSettings();
  });
  $('settings-msg-width')?.addEventListener('change', e => {
    localStorage.setItem('hekki_msg_width', e.target.value);
    applyReadingSettings();
  });
  $('settings-msg-tint')?.addEventListener('change', e => {
    localStorage.setItem('hekki_msg_tint', e.target.checked);
    document.body.classList.toggle('hekki-msg-tint', e.target.checked);
  });
  $('settings-dyslexia-font')?.addEventListener('change', e => {
    localStorage.setItem('hekki_dyslexia_font', e.target.checked);
    if (e.target.checked) {
      document.documentElement.style.setProperty('--font', '"OpenDyslexic", "Comic Sans MS", cursive, sans-serif');
    } else {
      const savedFont = localStorage.getItem('hekki_font') || 'segoe-ui';
      const FONT_FAMILIES = {
        'segoe-ui': '"Segoe WPC", "Segoe UI", ui-sans-serif, sans-serif',
        'google-sans': '"Google Sans", "Open Sans", sans-serif',
        'inter': '"Inter", -apple-system, sans-serif',
        'open-sans': '"Open Sans", sans-serif',
        'roboto': '"Roboto", sans-serif',
        'system': '-apple-system, ui-sans-serif, sans-serif'
      };
      document.documentElement.style.setProperty('--font', FONT_FAMILIES[savedFont] || FONT_FAMILIES['segoe-ui']);
    }
    if (window.showToast) window.showToast('Reading', e.target.checked ? 'OpenDyslexic font enabled' : 'Font reset', 2000);
  });
  $('settings-high-contrast')?.addEventListener('change', e => {
    localStorage.setItem('hekki_high_contrast', e.target.checked);
    document.body.classList.toggle('hekki-high-contrast', e.target.checked);
    if (window.showToast) window.showToast('Display', e.target.checked ? 'High Contrast on' : 'High Contrast off', 2000);
  });
  $('settings-reduce-motion')?.addEventListener('change', e => {
    localStorage.setItem('hekki_reduce_motion', e.target.checked);
    document.body.classList.toggle('hekki-reduce-motion', e.target.checked);
    if (window.showToast) window.showToast('Display', e.target.checked ? 'Animations disabled' : 'Animations enabled', 2000);
  });
  $('settings-focus-mode')?.addEventListener('change', e => {
    localStorage.setItem('hekki_focus_mode', e.target.checked);
    document.body.classList.toggle('hekki-focus-mode', e.target.checked);
    if (window.showToast) window.showToast('Display', e.target.checked ? 'Focus Mode on — sidebar hidden' : 'Focus Mode off', 2500);
  });

  // ── Sidebar & Pages Visibility Logic ──────────────────────────────────
  function applyNavVisibility() {
    const isVisible = (key) => localStorage.getItem(key) !== 'false';
    const setDisplay = (id, visible, displayVal = 'inline-flex') => {
      const el = $(id);
      if (el) {
        el.classList.toggle('nav-item-hidden', !visible);
        if (visible) {
          el.style.setProperty('display', displayVal, 'important');
        } else {
          el.style.setProperty('display', 'none', 'important');
        }
      }
    };

    setDisplay('btn-nav-chat-history', isVisible('hekki_nav_visible_history'));
    setDisplay('btn-nav-plugins',      isVisible('hekki_nav_visible_plugins'));
    setDisplay('nav-skills-btn',       isVisible('hekki_nav_visible_skills'));
    setDisplay('btn-nav-images',       isVisible('hekki_nav_visible_images'));
    setDisplay('btn-nav-workflows',    isVisible('hekki_nav_visible_workflows'));
    setDisplay('btn-nav-graph',        isVisible('hekki_nav_visible_graph'));
    setDisplay('nav-section-playground', isVisible('hekki_nav_visible_playground'), 'block');
  }

  function syncNavVisibilityUI() {
    const bindToggle = (chkId, key, domId, displayVal = 'inline-flex') => {
      const chk = $(chkId);
      if (!chk) return;
      chk.checked = localStorage.getItem(key) !== 'false';
      chk.onchange = () => {
        localStorage.setItem(key, chk.checked ? 'true' : 'false');
        applyNavVisibility();
        if (window.showToast) {
          const label = chk.closest('.settings-row')?.querySelector('.row-label')?.textContent || 'Page Link';
          window.showToast('Sidebar', `${label} ${chk.checked ? 'enabled' : 'hidden from sidebar'}`, 2000);
        }
      };
    };

    bindToggle('toggle-nav-history',    'hekki_nav_visible_history',    'btn-nav-chat-history');
    bindToggle('toggle-nav-plugins',    'hekki_nav_visible_plugins',    'btn-nav-plugins');
    bindToggle('toggle-nav-skills',     'hekki_nav_visible_skills',     'nav-skills-btn');
    bindToggle('toggle-nav-images',     'hekki_nav_visible_images',     'btn-nav-images');
    bindToggle('toggle-nav-workflows',  'hekki_nav_visible_workflows',  'btn-nav-workflows');
    bindToggle('toggle-nav-graph',      'hekki_nav_visible_graph',      'btn-nav-graph');
    bindToggle('toggle-nav-playground', 'hekki_nav_visible_playground', 'nav-section-playground', 'block');
  }

  window.applyNavVisibility = applyNavVisibility;
  window.syncNavVisibilityUI = syncNavVisibilityUI;

  // Apply visibility on boot
  applyNavVisibility();
  syncNavVisibilityUI();

  // ── Skills grid ───────────────────────────────────────────────────────
  async function loadActiveSkills() {
    const grid = $('skills-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="color:var(--text-3);grid-column:1/-1;text-align:center;padding:20px">Loading skills...</div>';
    try {
      const res = await fetch('/api/skills');
      if (!res.ok) throw new Error('fetch failed');
      const skills = await res.json();
      grid.innerHTML = '';
      if (!skills || skills.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-3);grid-column:1/-1;text-align:center;padding:20px">No active skills registered.</div>';
        return;
      }
      skills.forEach(s => {
        const name = s.name.toLowerCase();
        const iconMap = {
          search: 'search', web: 'globe', scrape: 'globe', code: 'code', run: 'code',
          stock: 'trending-up', news: 'newspaper', system: 'cpu', info: 'cpu',
          excel: 'table', weather: 'cloud-sun', file: 'folder', pdf: 'file-text',
          calc: 'calculator', translate: 'languages', wiki: 'book-open',
          research: 'microscope', briefing: 'sun', morning: 'sun',
          reminder: 'bell', alarm: 'bell', image: 'image', vision: 'image',
          evolver: 'aperture', ui: 'layout', generate: 'wand-sparkles',
        };
        let iconName = 'compass';
        for (const [key, icon] of Object.entries(iconMap)) {
          if (name.includes(key)) { iconName = icon; break; }
        }
        const card = document.createElement('div');
        card.className = 'skill-card';
        const iconHtml = iconName === 'trending-up' 
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 32 32" fill="currentColor" class="skill-icon" style="width:18px;height:18px;"><path d="M4 28h24v2H2z"/><path d="M22 6l3.59 3.59-6.59 6.59-4-4L4 23.17 5.41 24.59l9-9 4 4 8-8L30 15v-9z"/></svg>`
          : `<i data-lucide="${iconName}" class="skill-icon"></i>`;
        card.innerHTML = `
          ${iconHtml}
          <div class="skill-name">${s.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
          <div class="skill-ver">v${s.version || '1.0.0'}</div>
          <div class="skill-badge active-badge">Active</div>
        `;
        grid.appendChild(card);
      });
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('[Skills] Load failed:', err);
      grid.innerHTML = '<div style="color:var(--text-3);grid-column:1/-1;text-align:center;padding:20px">Error loading skills.</div>';
    }
  }
}
