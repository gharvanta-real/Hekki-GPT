/* === SETTINGS DISPLAY & ACCESSIBILITY MODULE — Hekki ===
 * Handles reading scale, high contrast, typography, and nav visibility.
 */

export function applyReadingSettings() {
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

  document.querySelectorAll('.ai-message, .msg-content, .message-content').forEach(el => {
    el.style.lineHeight = lineHeight;
    el.style.letterSpacing = letterSpacing;
  });

  document.querySelectorAll('.msg-content, .message-wrap, .chat-message-container').forEach(el => {
    el.style.maxWidth = msgWidth;
  });

  document.body.classList.toggle('hekki-msg-tint', msgTint);

  if (dyslexiaFont) {
    root.style.setProperty('--font', '"OpenDyslexic", "Comic Sans MS", cursive, sans-serif');
  }

  document.body.classList.toggle('hekki-high-contrast', highContrast);
  document.body.classList.toggle('hekki-reduce-motion', reduceMotion);
  document.body.classList.toggle('hekki-focus-mode', focusMode);
}

export function syncReadingUI() {
  const $ = id => document.getElementById(id);
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

export function initReadingListeners() {
  const $ = id => document.getElementById(id);

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
}

export function applyNavVisibility() {
  const $ = id => document.getElementById(id);
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

export function syncNavVisibilityUI() {
  const $ = id => document.getElementById(id);
  const bindToggle = (chkId, key) => {
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

  bindToggle('toggle-nav-history',    'hekki_nav_visible_history');
  bindToggle('toggle-nav-plugins',    'hekki_nav_visible_plugins');
  bindToggle('toggle-nav-skills',     'hekki_nav_visible_skills');
  bindToggle('toggle-nav-images',     'hekki_nav_visible_images');
  bindToggle('toggle-nav-workflows',  'hekki_nav_visible_workflows');
  bindToggle('toggle-nav-graph',      'hekki_nav_visible_graph');
  bindToggle('toggle-nav-playground', 'hekki_nav_visible_playground');
}

export async function loadActiveSkills() {
  const grid = document.getElementById('skills-grid');
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
