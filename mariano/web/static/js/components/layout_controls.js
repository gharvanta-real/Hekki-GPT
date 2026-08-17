let _sidebarBound = false;

export function bindSidebarToggle() {
  if (_sidebarBound) return;
  _sidebarBound = true;

  const $ = (id) => document.getElementById(id);
  const nav = $('sidebar-nav');

  // Restore persisted collapsed state
  if (localStorage.getItem('hekki_sidebar_collapsed') === '1') {
    nav?.classList.add('collapsed');
    _updateCollapseIcon(true);
  }

  const toggle = () => {
    if ($('debate-pane')?.classList.contains('visible')) return;
    const isNowCollapsed = nav?.classList.toggle('collapsed');
    localStorage.setItem('hekki_sidebar_collapsed', isNowCollapsed ? '1' : '0');
    _updateCollapseIcon(isNowCollapsed);
    // Re-render lucide icons after class changes
    if (window.lucide) setTimeout(() => lucide.createIcons(), 50);
  };

  // Header toggle buttons (existing)
  $('btn-sidebar-toggle')?.addEventListener('click', toggle);
  $('btn-sidebar-toggle-nav')?.addEventListener('click', toggle);
  $('btn-sidebar-toggle-main')?.addEventListener('click', toggle);

  // New collapse buttons
  $('btn-sidebar-collapse')?.addEventListener('click', toggle);
}

function _updateCollapseIcon(isCollapsed) {
  ['btn-sidebar-collapse'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const icon = btn.querySelector('i[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
      if (window.lucide) lucide.createIcons();
    }
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  });
}

export function bindTitlebarActions() {
  const $ = (id) => document.getElementById(id);
  $('btn-menu-dock')?.addEventListener('click', () => {
    $('btn-open-settings')?.click();
  });

  $('btn-toggle-sub-sidebar')?.addEventListener('click', () => {
    const debateLayout = document.querySelector('.debate-layout');
    if (debateLayout) {
      debateLayout.classList.toggle('collapsed-sidebar');
    }
  });

  const toggleRightPanel = () => {
    const appPane = $('app-pane');
    const resizer = $('app-pane-resizer');
    if (appPane && resizer) {
      const isHidden = appPane.classList.contains('hidden-pane');
      if (isHidden) {
        appPane.classList.remove('hidden-pane');
        resizer.classList.remove('hidden-pane');
      } else {
        appPane.classList.add('hidden-pane');
        resizer.classList.add('hidden-pane');
      }
      window.dispatchEvent(new Event('resize'));
    }
  };

  $('btn-toggle-drawer')?.addEventListener('click', toggleRightPanel);
}

/**
 * Notify the Electron main process of a theme change so the native
 * Windows titlebar (caption bar) colours update in real time.
 * No-op when running in a plain browser (window.electronAPI won't exist).
 */
function _notifyElectronTheme(isDark) {
  if (window.electronAPI?.setTheme) {
    window.electronAPI.setTheme(isDark ? 'dark' : 'light');
  }
}

function _applyTheme(theme, btn) {
  if (!theme || theme === 'oled') theme = 'dark';
  document.body.classList.remove('dark', 'light', 'oled');
  document.documentElement.removeAttribute('data-theme');

  document.body.classList.add(theme);
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('hekki_theme', theme);

  // Keep native Windows titlebar in sync
  _notifyElectronTheme(theme !== 'light');
  if (btn) {
    const icon = btn.querySelector('[data-lucide]');
    if (icon) {
      const lucideName = (theme === 'light') ? 'sun' : 'moon';
      icon.setAttribute('data-lucide', lucideName);
      if (window.lucide) lucide.createIcons();
    }
  }
  // Sync settings modal theme-opt pills if modal is open
  document.querySelectorAll('.theme-opt').forEach(b => {
    if (b.dataset.theme === theme) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

// Expose globally so settings.js can call the same logic
window._applyThemeGlobal = _applyTheme;

let _themeBound = false;

export function bindThemeToggle() {
  if (_themeBound) return;
  _themeBound = true;

  const $ = (id) => document.getElementById(id);
  const btn = $('btn-user-theme');

  // Restore persisted theme on page load (defaults to Cursor Dark)
  let savedTheme = localStorage.getItem('hekki_theme') || 'dark';
  if (savedTheme === 'oled') savedTheme = 'dark';
  localStorage.setItem('hekki_theme', savedTheme);
  _applyTheme(savedTheme, btn);

  if (btn) {
    // ── Toggle on button click (Clean 2-State: dark <-> light) ─────
    btn.addEventListener('click', () => {
      let currentTheme = localStorage.getItem('hekki_theme') || 'dark';
      if (currentTheme === 'oled') currentTheme = 'dark';
      const newTheme = (currentTheme === 'light') ? 'dark' : 'light';
      localStorage.setItem('hekki_theme', newTheme);
      _applyTheme(newTheme, btn);

      // Sync theme to backend settings
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme })
      }).catch(err => console.error("Failed to sync theme settings to backend:", err));
    });
  }
}

/** Update the titlebar breadcrumb — call whenever project/chat changes */
export function updateTitleBreadcrumb(projectName, chatTitle) {
  const el = document.getElementById('titlebar-breadcrumb');
  if (!el) return;
  if (!projectName && !chatTitle) {
    el.textContent = '';
    return;
  }
  if (projectName && chatTitle) {
    el.innerHTML = `<span class="tb-bc-project">${projectName}</span><span class="tb-bc-sep">/</span><span class="tb-bc-chat">${chatTitle}</span>`;
  } else if (projectName) {
    el.innerHTML = `<span class="tb-bc-project">${projectName}</span>`;
  } else {
    el.innerHTML = `<span class="tb-bc-chat">${chatTitle}</span>`;
  }
}
window.updateTitleBreadcrumb = updateTitleBreadcrumb;

import { openImageLightbox } from '../chat/dialogs.js';

export function bindImageLightbox() {
  // Global event delegation for all images to open the unified lightbox
  document.body.addEventListener('click', (e) => {
    const clickableImg = e.target.closest('.msg img, .debate-bubble img, .doc-viewer-content img, .chat-scroll-container img');
    if (clickableImg) {
      e.stopPropagation();
      openImageLightbox(clickableImg.src, clickableImg.src);
    }
  });
}
