/* === DESKTOP EXE TOP NAVIGATION BAR & MENU CONTROLLER === */
document.addEventListener('DOMContentLoaded', () => {
  const isElectron = window.electronAPI?.isElectron || navigator.userAgent.toLowerCase().includes('electron');
  if (isElectron) {
    document.documentElement.classList.add('is-electron');
  } else {
    return; // Do not initialize topnav in plain web browser mode
  }

  const topnav = document.getElementById('desktop-topnav');
  if (!topnav) return;

  // ── Close all open topnav dropdowns ────────────────────────────────────────
  function closeAllTopnavMenus() {
    document.querySelectorAll('.topnav-dropdown-menu').forEach(menu => {
      menu.classList.add('hidden');
    });
    document.querySelectorAll('.topnav-menu-btn').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  // ── Toggle menu dropdown ────────────────────────────────────────────────────
  document.querySelectorAll('.topnav-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.menu;
      const targetMenu = document.getElementById(targetId);
      const isAlreadyOpen = targetMenu && !targetMenu.classList.contains('hidden');

      closeAllTopnavMenus();

      if (targetMenu && !isAlreadyOpen) {
        targetMenu.classList.remove('hidden');
        btn.classList.add('active');
      }
    });
  });

  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    if (!topnav.contains(e.target)) {
      closeAllTopnavMenus();
    }
  });

  // ── Handle Action Commands ──────────────────────────────────────────────────
  document.querySelectorAll('.topnav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllTopnavMenus();
      const action = item.dataset.action;
      if (!action) return;

      switch (action) {
        case 'new-agent':
        case 'new-chat':
          document.getElementById('btn-new-chat-dock')?.click() || document.getElementById('mode-home')?.click();
          break;
        case 'open-folder':
          document.getElementById('btn-attach-home')?.click() || document.getElementById('btn-attach-conv')?.click();
          break;
        case 'new-terminal':
        case 'open-ide':
          document.getElementById('mode-coder')?.click();
          break;
        case 'new-browser':
          document.getElementById('mode-coder')?.click();
          break;
        case 'open-settings':
          document.getElementById('btn-user-settings')?.click() || document.getElementById('btn-open-settings')?.click();
          break;
        case 'quit':
        case 'exit':
          window.close();
          break;
        case 'undo':
          document.execCommand('undo');
          break;
        case 'redo':
          document.execCommand('redo');
          break;
        case 'cut':
          document.execCommand('cut');
          break;
        case 'copy':
          document.execCommand('copy');
          break;
        case 'paste':
          if (navigator.clipboard?.readText) {
            navigator.clipboard.readText().then(text => {
              document.execCommand('insertText', false, text);
            }).catch(() => document.execCommand('paste'));
          } else {
            document.execCommand('paste');
          }
          break;
        case 'select-all':
          document.execCommand('selectAll');
          break;
        case 'reload':
          window.location.reload();
          break;
        case 'toggle-sidebar':
          document.getElementById('btn-sidebar-collapse')?.click();
          break;
        case 'toggle-theme':
          document.getElementById('btn-user-theme')?.click();
          break;
        case 'fullscreen':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
        case 'shortcuts':
        case 'docs':
        case 'about':
          document.getElementById('btn-open-settings')?.click();
          setTimeout(() => {
            const targetSection = action === 'shortcuts' ? 'shortcuts' : 'about';
            document.querySelector(`.modal-nav-item[data-section="${targetSection}"]`)?.click();
          }, 150);
          break;
        default:
          console.log('[TopNav Action]', action);
      }
    });
  });
});
