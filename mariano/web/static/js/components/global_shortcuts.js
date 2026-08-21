/**
 * global_shortcuts.js — Desktop application standard keyboard shortcuts engine
 */

export function bindGlobalShortcuts() {
  // Shortcut pill buttons on the welcome screen
  document.querySelectorAll('.shortcut').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.textContent.trim();
      const input = document.getElementById('chat-input') || document.getElementById('chat-input-conv');
      if (input) {
        input.focus();
        input.value = label + ': ';
        input.dispatchEvent(new Event('input'));
      }
    });
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;
    const key = e.key.toLowerCase();

    // 1. Ctrl + K / Cmd + K -> Open Global Search
    if (isCmdOrCtrl && key === 'k') {
      e.preventDefault();
      document.getElementById('search-modal-backdrop')?.classList.remove('hidden');
      document.getElementById('search-input-modal')?.focus();
      return;
    }

    // 2. Ctrl + N / Cmd + N -> Start New Chat
    if (isCmdOrCtrl && key === 'n' && !isShift) {
      e.preventDefault();
      document.getElementById('btn-new-chat-dock')?.click() || document.getElementById('mode-home')?.click();
      return;
    }

    // 3. Ctrl + , / Cmd + , -> Open Settings
    if (isCmdOrCtrl && (key === ',' || e.keyCode === 188)) {
      e.preventDefault();
      if (window.router) window.router.navigate('settings');
      return;
    }

    // 4. Ctrl + Shift + L / Cmd + Shift + L -> Toggle Theme (Light / Dark)
    if (isCmdOrCtrl && isShift && key === 'l') {
      e.preventDefault();
      document.getElementById('btn-user-theme')?.click();
      return;
    }

    // 5. Escape -> Close active floating popups, dropdowns, and modals
    if (e.key === 'Escape') {
      let closed = false;

      const searchModal = document.getElementById('search-modal-backdrop');
      if (searchModal && !searchModal.classList.contains('hidden')) {
        searchModal.classList.add('hidden');
        closed = true;
      }

      document.querySelectorAll('.user-menu-dropdown:not(.hidden), .topnav-dropdown-menu:not(.hidden), .attach-dropdown:not(.hidden), .cad-grid-dropdown-menu:not(.hidden)').forEach(d => {
        d.classList.add('hidden');
        d.style.display = 'none';
        closed = true;
      });

      const lightbox = document.getElementById('img-lightbox-overlay');
      if (lightbox && !lightbox.classList.contains('hidden')) {
        lightbox.classList.add('hidden');
        closed = true;
      }

      if (closed) e.preventDefault();
    }
  });
}
