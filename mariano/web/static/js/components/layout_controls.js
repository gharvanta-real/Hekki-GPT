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

/** Apply dark/light/oled class, update the icon, and sync the native titlebar. */
function _applyTheme(theme, btn) {
  if (theme === 'dark' || !theme) theme = 'oled';
  document.body.classList.remove('dark', 'light', 'oled');
  if (theme === 'oled') {
    document.body.classList.add('oled');
  } else if (theme === 'light') {
    document.body.classList.add('light');
  }
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
    if (b.dataset.theme === theme || (theme === 'oled' && b.dataset.theme === 'dark')) {
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

  // Restore persisted theme on page load (defaults to OLED Black)
  let savedTheme = localStorage.getItem('hekki_theme') || 'oled';
  if (savedTheme === 'dark') savedTheme = 'oled';
  localStorage.setItem('hekki_theme', savedTheme);
  _applyTheme(savedTheme, btn);

  if (btn) {
    // ── Toggle on button click (2-way toggle: oled <-> light) ─────
    btn.addEventListener('click', () => {
      let currentTheme = localStorage.getItem('hekki_theme') || 'oled';
      if (currentTheme === 'dark') currentTheme = 'oled';
      const newTheme = (currentTheme === 'light') ? 'oled' : 'light';
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

export function bindImageLightbox() {
  const $ = (id) => document.getElementById(id);
  const lightbox = $('image-lightbox');
  const imgEl = $('lightbox-img');
  const filename = $('lightbox-filename');
  const content = $('lightbox-content');

  if (!lightbox || !imgEl || !content) return;

  let zoom = 1.0;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  function updateTransform() {
    imgEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }

  function reset() {
    zoom = 1.0;
    panX = 0;
    panY = 0;
    updateTransform();
  }

  function openLightbox(src, name) {
    imgEl.src = src;
    filename.textContent = name || 'Image Preview';
    reset();
    lightbox.classList.remove('hidden');
    // Re-create icons inside header
    if (window.lucide) lucide.createIcons({ parent: lightbox });
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
    imgEl.src = '';
  }

  // Global event delegation for all images
  document.body.addEventListener('click', (e) => {
    // Target any img inside chat scroll panel, message, debate message, or doc viewer
    const clickableImg = e.target.closest('.msg img, .debate-bubble img, .doc-viewer-content img, .chat-scroll-container img');
    if (clickableImg) {
      e.stopPropagation();
      // Extract title from filename, alt text, or use fallback
      let title = clickableImg.getAttribute('alt') || clickableImg.src.split('/').pop().split('?')[0];
      if (title.length > 50) title = title.substring(0, 47) + '...';
      openLightbox(clickableImg.src, title);
    }
  });

  // Close bindings
  $('btn-lightbox-close')?.addEventListener('click', closeLightbox);
  $('lightbox-backdrop')?.addEventListener('click', closeLightbox);
  
  // Close on Escape key
  const escapeListener = (e) => {
    if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  };
  document.addEventListener('keydown', escapeListener);

  // Zoom controls
  $('btn-lightbox-zoom-in')?.addEventListener('click', () => {
    zoom = Math.min(zoom * 1.25, 8);
    updateTransform();
  });
  $('btn-lightbox-zoom-out')?.addEventListener('click', () => {
    zoom = Math.max(zoom / 1.25, 0.25);
    updateTransform();
  });
  $('btn-lightbox-reset')?.addEventListener('click', reset);

  // Download control
  $('btn-lightbox-download')?.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = imgEl.src;
    a.download = filename.textContent || 'image.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // Pan controls (mouse drag)
  content.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Left click only
    e.preventDefault();
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    content.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    content.style.cursor = 'grab';
  });

  // Wheel zoom controls
  content.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    if (e.deltaY < 0) {
      zoom = Math.min(zoom * zoomFactor, 8);
    } else {
      zoom = Math.max(zoom / zoomFactor, 0.25);
    }
    updateTransform();
  });
}
