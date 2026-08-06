/* === SETTINGS MODULE — Hekki ===
 * All settings are real and persisted.
 * Backend fields  → /api/settings (GET + POST)
 * Client-only     → localStorage (theme only)
 */

export function initSettings(setGreetingCallback) {
  const $ = id => document.getElementById(id);
  const modal   = $('settings-modal');
  const openBtn = $('btn-open-settings');
  const closeBtn = $('btn-close-settings');
  if (!modal) return;

  // ── Open / Close ─────────────────────────────────────────────────────
  const openModal = () => {
    modal.classList.remove('hidden');
    loadAllSettings();
    loadActiveSkills();
  };
  openBtn?.addEventListener('click', openModal);
  $('btn-user-settings')?.addEventListener('click', openModal);

  closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.add('hidden'); });

  // ── Nav switching ─────────────────────────────────────────────────────
  modal.querySelectorAll('.modal-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.modal-nav-item').forEach(b => b.classList.remove('active'));
      modal.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const sec = $('section-' + btn.dataset.section);
      if (sec) sec.classList.add('active');
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
  let savedTheme = localStorage.getItem('hekki_theme') || 'oled';
  if (savedTheme === 'dark') savedTheme = 'oled';
  if (window._applyThemeGlobal) {
    window._applyThemeGlobal(savedTheme, document.getElementById('btn-user-theme'));
  }
  modal.querySelectorAll('.theme-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === savedTheme);
    b.addEventListener('click', () => {
      modal.querySelectorAll('.theme-opt').forEach(x => x.classList.remove('active'));
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

      // Also sync greeting in main view
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
      const reasonSel = $('settings-reasoning-mode');
      if (reasonSel && cfg.reasoning_mode) {
        for (let opt of reasonSel.options) {
          if (opt.value === cfg.reasoning_mode) { opt.selected = true; break; }
        }
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

      // Kaggle GPU
      const kUser = $('settings-kaggle-user');
      const kKey = $('settings-kaggle-key');
      if (kUser) kUser.value = cfg.kaggle_username || '';
      if (kKey) kKey.value = cfg.kaggle_api_key || '';
      updateKaggleStatus(cfg.kaggle_username, cfg.kaggle_api_key);

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
  $('settings-reasoning-mode')?.addEventListener('change', e => {
    save({ reasoning_mode: e.target.value });
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

  // ── Kaggle GPU Accelerator ────────────────────────────────────────────
  function updateKaggleStatus(user, key) {
    const textEl = $('kaggle-status-text');
    const badgeEl = $('kaggle-status-badge')?.querySelector('span');
    if (!textEl) return;
    if (user && key) {
      textEl.textContent = `Configured (${user})`;
      textEl.style.color = '#16a34a';
      if (badgeEl) badgeEl.style.background = '#16a34a';
    } else {
      textEl.textContent = 'Not Verified';
      textEl.style.color = 'var(--text-3)';
      if (badgeEl) badgeEl.style.background = '#888';
    }
  }

  $('btn-toggle-kaggle-visibility')?.addEventListener('click', () => {
    const inp = $('settings-kaggle-key');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    const icon = $('btn-toggle-kaggle-visibility').querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', inp.type === 'password' ? 'eye' : 'eye-off');
      if (window.lucide) lucide.createIcons();
    }
  });

  $('btn-save-kaggle')?.addEventListener('click', () => {
    const user = $('settings-kaggle-user')?.value.trim() || '';
    const key = $('settings-kaggle-key')?.value.trim() || '';
    save({ kaggle_username: user, kaggle_api_key: key });
    updateKaggleStatus(user, key);
  });

  $('btn-test-kaggle')?.addEventListener('click', async () => {
    const user = $('settings-kaggle-user')?.value.trim() || '';
    const key = $('settings-kaggle-key')?.value.trim() || '';
    const textEl = $('kaggle-status-text');
    const badgeEl = $('kaggle-status-badge')?.querySelector('span');
    if (textEl) { textEl.textContent = 'Testing API Connection...'; textEl.style.color = '#3b82f6'; }
    if (badgeEl) badgeEl.style.background = '#3b82f6';

    try {
      const res = await fetch('/api/kaggle/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kaggle_username: user, kaggle_api_key: key })
      });
      const data = await res.json();
      if (data.success) {
        if (textEl) { textEl.textContent = data.message; textEl.style.color = '#16a34a'; }
        if (badgeEl) badgeEl.style.background = '#16a34a';
        save({ kaggle_username: user, kaggle_api_key: key });
      } else {
        if (textEl) { textEl.textContent = data.message || 'Verification Failed'; textEl.style.color = '#dc2626'; }
        if (badgeEl) badgeEl.style.background = '#dc2626';
      }
    } catch (e) {
      if (textEl) { textEl.textContent = 'Connection error'; textEl.style.color = '#dc2626'; }
      if (badgeEl) badgeEl.style.background = '#dc2626';
    }
  });

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
        card.innerHTML = `
          <i data-lucide="${iconName}" class="skill-icon"></i>
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
