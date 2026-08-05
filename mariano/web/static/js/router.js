/**
 * router.js — Single source of truth for page/pane switching.
 *
 * Rules:
 *  1. Always call _hideAllPanes() first — guarantees zero overlap.
 *  2. Then show the one target pane.
 *  3. Adjust shared chrome (sidebar-nav, app-pane, resizer).
 *
 * Pages: 'chat' | 'workspace' | 'skills' | 'changelog' | 'debate'
 */

const PAGES = ['chat', 'workspace', 'skills', 'changelog', 'debate', 'images'];

class Router {
  constructor() {
    this._currentPage = 'chat';
    this._onNavigateCallbacks = {};
    this._onLeaveCallbacks = {};
    // Track right-panel open state so it survives page switches
    this._rightPanelOpen = false;
  }

  /**
   * Register a callback for when a specific page becomes active.
   * @param {string} page
   * @param {Function} callback
   */
  onNavigate(page, callback) {
    this._onNavigateCallbacks[page] = callback;
  }

  /**
   * Register a callback for when a specific page is LEFT (navigated away from).
   * Called before _hideAllPanes() to allow cleanup of DOM/state.
   * @param {string} page
   * @param {Function} callback
   */
  onLeave(page, callback) {
    this._onLeaveCallbacks[page] = callback;
  }

  _fireLeaveCallbacks(leavingPage) {
    if (this._onLeaveCallbacks[leavingPage]) {
      try { this._onLeaveCallbacks[leavingPage](); } catch(e) { console.warn('[Router] onLeave error:', e); }
    }
  }

  /**
   * Hide every managed pane — call this before showing any new pane.
   * This is the core fix that prevents overlap.
   */
  _hideAllPanes() {
    // Save right-panel state before collapsing so we can restore it later
    const appPane = document.getElementById('app-pane');
    if (appPane) {
      this._rightPanelOpen = !appPane.classList.contains('hidden-pane');
    }

    // chat-pane uses .hidden to hide
    const chatPane = document.getElementById('chat-pane');
    if (chatPane) {
      chatPane.classList.add('hidden');
      chatPane.style.display = 'none';
    }

    const panesUsingVisible = [
      'skills-pane',
      'debate-pane',
      'coder-pane',
      'images-pane',
      'hekkicad-pane',
    ];
    panesUsingVisible.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('visible');
        el.style.display = 'none';
      }
    });


    // Force-hide the coder inner nav panel completely (prevents DOM bleed)
    const innerCoder = document.getElementById('nav-inner-coder');
    if (innerCoder) {
      innerCoder.style.display = 'none';
      innerCoder.style.visibility = 'hidden';
      innerCoder.style.pointerEvents = 'none';
    }

    const cadActions = document.getElementById('cad-titlebar-actions');
    if (cadActions) cadActions.style.display = 'none';


    // Always collapse shared right-side chrome
    document.getElementById('app-pane')?.classList.add('hidden-pane');
    document.getElementById('app-pane-resizer')?.classList.add('hidden-pane');
    document.getElementById('btn-expand-app-pane')?.classList.add('hidden');
  }

  /**
   * Show a pane by both class and explicit style — safe against inline style overrides.
   */
  _showPane(id, displayValue = 'flex') {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('visible');
      el.style.display = displayValue;
    }
  }

  /**
   * Navigate to a page by name.
   * @param {'chat'|'skills'|'changelog'|'debate'} page
   */
  navigateTo(page) {
    if (this._currentPage === page) return;
    const leavingPage = this._currentPage;
    this._currentPage = page;

    // Step 0: Fire leave callbacks before hiding — allows cleanup
    this._fireLeaveCallbacks(leavingPage);

    // Step 1: Hide everything — no overlap possible after this
    this._hideAllPanes();

    // Set data-page attribute to allow CSS selectors to target active page
    const workspaceEl = document.getElementById('workspace');
    if (workspaceEl) {
      workspaceEl.setAttribute('data-page', page);
    }
    
    const titlebarEl = document.getElementById('titlebar');
    if (titlebarEl) titlebarEl.style.display = 'none';

    const sidebarNav = document.getElementById('sidebar-nav');
    if (sidebarNav) {
      sidebarNav.classList.remove('hide-sidebar');
    }

    const returnBtn = document.getElementById('btn-return-chat-nav');
    if (returnBtn) {
      if (page === 'chat') {
        returnBtn.style.display = 'none';
      } else {
        returnBtn.style.display = 'inline-flex';
      }
    }

    // Step 2: Show only the target pane + adjust sidebar chrome
    const innerChat = document.getElementById('nav-inner-chat');
    const innerCoder = document.getElementById('nav-inner-coder');

    switch (page) {
      case 'chat': {
        const cp = document.getElementById('chat-pane');
        if (cp) { cp.classList.remove('hidden'); cp.style.display = ''; }
        document.getElementById('sidebar-nav')?.classList.remove('collapsed');
        const toggleBtn = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtn) toggleBtn.style.display = '';
        if (innerChat) innerChat.style.display = 'flex';
        // Ensure coder subpanel is fully gone (triple-hide)
        if (innerCoder) {
          innerCoder.style.display = 'none';
          innerCoder.style.visibility = 'hidden';
          innerCoder.style.pointerEvents = 'none';
        }
        // Restore right panel to the state it was in before leaving Chat
        const appPaneChat = document.getElementById('app-pane');
        const resizerChat = document.getElementById('app-pane-resizer');
        const expandBtn   = document.getElementById('btn-expand-app-pane');
        if (appPaneChat && resizerChat) {
          if (this._rightPanelOpen) {
            appPaneChat.classList.remove('hidden-pane');
            resizerChat.classList.remove('hidden-pane');
            if (expandBtn) expandBtn.classList.add('hidden');
          } else {
            appPaneChat.classList.add('hidden-pane');
            resizerChat.classList.add('hidden-pane');
          }
        }
        // Clear breadcrumb — chat page has no project path
        if (window.updateTitleBreadcrumb) window.updateTitleBreadcrumb('', '');
        break;
      }

      case 'skills':
        this._showPane('skills-pane');
        document.getElementById('sidebar-nav')?.classList.remove('collapsed');
        const toggleBtnSkills = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtnSkills) toggleBtnSkills.style.display = '';
        if (innerChat) innerChat.style.display = 'flex';
        // Ensure coder subpanel is fully gone
        if (innerCoder) {
          innerCoder.style.display = 'none';
          innerCoder.style.visibility = 'hidden';
          innerCoder.style.pointerEvents = 'none';
        }
        if (window.updateTitleBreadcrumb) {
          window.updateTitleBreadcrumb('Skills', '');
        }
        break;

      case 'debate':
        this._showPane('debate-pane');
        if (sidebarNav) {
          sidebarNav.classList.add('hide-sidebar');
        }
        if (titlebarEl) titlebarEl.style.display = 'none';
        const toggleBtnDebate = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtnDebate) toggleBtnDebate.style.display = 'none';
        if (window.updateTitleBreadcrumb) {
          window.updateTitleBreadcrumb('Debate Playground', '');
        }
        break;


      case 'images':
        this._showPane('images-pane', 'flex');
        if (titlebarEl) titlebarEl.style.display = 'none';
        document.getElementById('sidebar-nav')?.classList.remove('collapsed');
        const toggleBtnImages = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtnImages) toggleBtnImages.style.display = '';
        if (innerChat) innerChat.style.display = 'flex';
        if (innerCoder) {
          innerCoder.style.display = 'none';
          innerCoder.style.visibility = 'hidden';
          innerCoder.style.pointerEvents = 'none';
        }
        if (window.updateTitleBreadcrumb) {
          window.updateTitleBreadcrumb('Images', '');
        }
        if (!window.imagesPageInstance) {
          import('/static/js/pages/images_page.js').then(({ ImagesPage }) => {
            window.imagesPageInstance = new ImagesPage(window.showToast);
            window.imagesPageInstance.mount(document.getElementById('images-pane'));
          }).catch(err => console.error('Failed to load ImagesPage:', err));
        } else {
          window.imagesPageInstance.refresh();
        }
        break;




      default:
        // Fallback: show chat
        const cp2 = document.getElementById('chat-pane');
        if (cp2) { cp2.classList.remove('hidden'); cp2.style.display = ''; }
        document.getElementById('sidebar-nav')?.classList.remove('collapsed');
        const toggleBtnDef = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtnDef) toggleBtnDef.style.display = '';
        if (innerChat) innerChat.style.display = 'flex';
        if (innerCoder) innerCoder.style.display = 'none';
        
        const returnBtn = document.getElementById('btn-return-chat-nav');
        if (returnBtn) returnBtn.style.display = 'none';
        break;
    }

    // Show the return to chat chevron on non-chat pages if it exists
    if (page !== 'chat') {
      const returnBtn = document.getElementById('btn-return-chat-nav');
      if (returnBtn) returnBtn.style.display = '';
    }

    // (Floating drawer toggle and right drawer logic removed)

    // Step 3: Sync dock + nav button active states
    this._syncDockActiveState(page);

    // Step 4: Fire registered callbacks
    if (this._onNavigateCallbacks[page]) {
      this._onNavigateCallbacks[page]();
    }

    // Step 5: Re-apply theme from localStorage — safety net in case any
    // event listener was lost. Zero-cost; just a classList toggle.
    const savedTheme = localStorage.getItem('hekki_theme') || 'dark';
    document.body.classList.remove('dark', 'oled');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
    } else if (savedTheme === 'oled') {
      document.body.classList.add('oled');
    }
  }

  /**
   * Get the currently active page name.
   */
  get currentPage() {
    return this._currentPage;
  }

  _syncDockActiveState(page) {
    const MAP = {
      chat:      'mode-home',
      debate:    'mode-playground',
      coder:     'mode-coder',
    };

    // Remove active from all dock items
    Object.values(MAP).forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });

    // Add active to the current page's dock item
    const activeId = MAP[page];
    if (activeId) {
      document.getElementById(activeId)?.classList.add('active');
    }

    // Sidebar nav action buttons
    const skillsBtn     = document.getElementById('nav-skills-btn');
    const playgroundBtn = document.getElementById('btn-nav-playground');
    const coderBtn      = document.getElementById('btn-nav-coder');

    skillsBtn?.classList.toggle('active', page === 'skills');
    playgroundBtn?.classList.toggle('active', page === 'debate');
    coderBtn?.classList.toggle('active', page === 'coder');

    // Main titlebar back button
    const mainBackBtn = document.getElementById('btn-main-back');
    if (mainBackBtn) {
      if (page === 'debate') {
        mainBackBtn.style.display = 'inline-flex';
      } else {
        mainBackBtn.style.display = 'none';
      }
    }
  }
}

// Singleton export
export const router = new Router();

/**
 * Call once at app boot to ensure pane state matches the default page ('chat').
 * Needed because navigateTo() has a same-page guard and won't fire on first load.
 */
export function initRouterState() {
  const r = router;
  r._hideAllPanes();
  // Restore chat pane as visible default
  const chatPane = document.getElementById('chat-pane');
  if (chatPane) { chatPane.classList.remove('hidden'); chatPane.style.display = ''; }
  const innerChat = document.getElementById('nav-inner-chat');
  if (innerChat) innerChat.style.display = 'flex';
  // Clear breadcrumb for initial chat page
  if (window.updateTitleBreadcrumb) window.updateTitleBreadcrumb('', '');
  r._syncDockActiveState('chat');
}
