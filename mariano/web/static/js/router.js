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

const PAGES = ['chat', 'workspace', 'skills', 'changelog', 'debate', 'images', 'plugins', 'history', 'settings'];

class Router {
  constructor() {
    this._currentPage = 'chat';
    this._onNavigateCallbacks = {};
    this._onLeaveCallbacks = {};
    // Track right-panel open state so it survives page switches
    this._rightPanelOpen = false;
    // Global component refresh hooks — run on EVERY navigation, even same-page
    this._refreshHooks = [];
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
   * Register a component refresh hook that fires on EVERY navigation (same-page included).
   * Use this to keep model pills, slash chips, input state synced without hard refresh.
   * @param {Function} fn
   */
  onRefresh(fn) {
    this._refreshHooks.push(fn);
  }

  /** Force all refresh hooks to run immediately (call after dynamic DOM changes). */
  forceRefresh() {
    this._refreshHooks.forEach(fn => { try { fn(this._currentPage); } catch(e) { console.warn('[Router] refresh hook error:', e); } });
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
      'coder-pane',
      'images-pane',
      'hekkicad-pane',
      'plugins-pane',
      'workflows-pane',
      'graph-pane',
      'history-pane',
      'settings-pane',
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

    // Force-hide settings inner nav panel
    const innerSettings = document.getElementById('nav-inner-settings');
    if (innerSettings) {
      innerSettings.style.display = 'none';
    }

    // Restore sidebar nav header (collapse button & nav arrows)
    const navHeader = document.querySelector('#sidebar-nav .nav-header');
    if (navHeader) {
      navHeader.style.display = 'flex';
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
    // If same page: still fire refresh hooks so components re-sync (no hard refresh needed)
    if (this._currentPage === page) {
      this.forceRefresh();
      return;
    }
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
    document.body.setAttribute('data-page', page);
    
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
        const navHeaderChat = document.querySelector('#sidebar-nav .nav-header');
        if (navHeaderChat) navHeaderChat.style.display = 'flex';
        const toggleBtn = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtn) toggleBtn.style.display = '';
        if (innerChat) innerChat.style.display = 'flex';
        const innerSettings = document.getElementById('nav-inner-settings');
        if (innerSettings) innerSettings.style.display = 'none';
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
        if (!window.imagesPageInstance && !window._loadingImagesPage) {
          window._loadingImagesPage = true;
          import('/static/js/pages/images_page.js?v=207').then(({ ImagesPage }) => {
            window.imagesPageInstance = new ImagesPage(window.showToast);
            window.imagesPageInstance.mount(document.getElementById('images-pane'));
          }).catch(err => console.error('Failed to load ImagesPage:', err))
            .finally(() => window._loadingImagesPage = false);
        } else if (window.imagesPageInstance) {
          window.imagesPageInstance.refresh();
        }
        break;

      case 'plugins':
        this._showPane('plugins-pane', 'flex');
        if (titlebarEl) titlebarEl.style.display = 'none';
        document.getElementById('sidebar-nav')?.classList.remove('collapsed');
        const toggleBtnPlugins = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtnPlugins) toggleBtnPlugins.style.display = '';
        if (innerChat) innerChat.style.display = 'flex';
        if (innerCoder) {
          innerCoder.style.display = 'none';
          innerCoder.style.visibility = 'hidden';
          innerCoder.style.pointerEvents = 'none';
        }
        if (window.updateTitleBreadcrumb) {
          window.updateTitleBreadcrumb('Plugins & Connectors', '');
        }
        if (!window.pluginsPageInstance && !window._loadingPluginsPage) {
          window._loadingPluginsPage = true;
          import('/static/js/pages/plugins_page.js?v=205').then(({ PluginsPage }) => {
            window.pluginsPageInstance = new PluginsPage(window.showToast);
            window.pluginsPageInstance.mount(document.getElementById('plugins-pane'));
          }).catch(err => console.error('Failed to load PluginsPage:', err))
            .finally(() => window._loadingPluginsPage = false);
        } else if (window.pluginsPageInstance) {
          window.pluginsPageInstance.refresh();
        }
        break;

      case 'workflows':
        this._showPane('workflows-pane', 'flex');
        if (titlebarEl) titlebarEl.style.display = 'none';
        document.getElementById('sidebar-nav')?.classList.remove('collapsed');
        const toggleBtnWf = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtnWf) toggleBtnWf.style.display = '';
        if (innerChat) innerChat.style.display = 'flex';
        if (innerCoder) {
          innerCoder.style.display = 'none';
          innerCoder.style.visibility = 'hidden';
          innerCoder.style.pointerEvents = 'none';
        }
        if (window.updateTitleBreadcrumb) {
          window.updateTitleBreadcrumb('Workflows Studio', '');
        }
        import('/static/js/pages/workflows_page.js?v=' + Date.now()).then(({ WorkflowsPage }) => {
          const pane = document.getElementById('workflows-pane');
          if (pane) {
            window.workflowsPageInstance = new WorkflowsPage(window.showToast);
            window.workflowsPageInstance.mount(pane);
          }
        }).catch(err => console.error('Failed to load WorkflowsPage:', err));
        break;

      case 'graph':
        this._showPane('graph-pane', 'flex');
        if (titlebarEl) titlebarEl.style.display = 'none';
        document.getElementById('sidebar-nav')?.classList.remove('collapsed');
        const toggleBtnGr = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtnGr) toggleBtnGr.style.display = '';
        if (innerChat) innerChat.style.display = 'flex';
        if (innerCoder) {
          innerCoder.style.display = 'none';
          innerCoder.style.visibility = 'hidden';
          innerCoder.style.pointerEvents = 'none';
        }
        if (window.updateTitleBreadcrumb) {
          window.updateTitleBreadcrumb('Knowledge Graph', '');
        }
        import('/static/js/pages/graph_page.js?v=' + Date.now()).then(({ GraphPage }) => {
          const pane = document.getElementById('graph-pane');
          if (pane) {
            window.graphPageInstance = new GraphPage(window.showToast);
            window.graphPageInstance.mount(pane);
          }
        }).catch(err => console.error('Failed to load GraphPage:', err));
        break;

      case 'history':
        this._showPane('history-pane', 'flex');
        if (titlebarEl) titlebarEl.style.display = 'none';
        document.getElementById('sidebar-nav')?.classList.remove('collapsed');
        const toggleBtnHist = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtnHist) toggleBtnHist.style.display = '';
        if (innerChat) innerChat.style.display = 'flex';
        if (innerCoder) {
          innerCoder.style.display = 'none';
          innerCoder.style.visibility = 'hidden';
          innerCoder.style.pointerEvents = 'none';
        }
        if (window.updateTitleBreadcrumb) {
          window.updateTitleBreadcrumb('Search Chats', '');
        }
        window._loadingHistoryPage = true;
        import('/static/js/pages/history_page.js?v=' + Date.now()).then(({ HistoryPage }) => {
          const pane = document.getElementById('history-pane');
          if (pane) pane.innerHTML = '';
          window.historyPageInstance = new HistoryPage(window.chatSessionManager);
          window.historyPageInstance.mount(pane);
        }).catch(err => console.error('Failed to load HistoryPage:', err))
          .finally(() => window._loadingHistoryPage = false);
        break;

      case 'settings':
        this._showPane('settings-pane', 'flex');
        if (titlebarEl) titlebarEl.style.display = 'none';
        document.getElementById('sidebar-nav')?.classList.remove('hide-sidebar');
        const navHeaderSet = document.querySelector('#sidebar-nav .nav-header');
        if (navHeaderSet) navHeaderSet.style.display = 'none';
        const toggleBtnSet = document.getElementById('btn-sidebar-toggle-main');
        if (toggleBtnSet) toggleBtnSet.style.display = 'none';
        if (innerChat) innerChat.style.display = 'none';
        if (innerCoder) {
          innerCoder.style.display = 'none';
          innerCoder.style.visibility = 'hidden';
          innerCoder.style.pointerEvents = 'none';
        }
        const innerSettingsSet = document.getElementById('nav-inner-settings');
        if (innerSettingsSet) innerSettingsSet.style.display = 'flex';
        if (window.updateTitleBreadcrumb) {
          window.updateTitleBreadcrumb('Settings', '');
        }
        if (window._loadSettingsOnPage) window._loadSettingsOnPage();
        if (window.lucide) {
          setTimeout(() => lucide.createIcons(), 50);
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
        
        if (returnBtn) returnBtn.style.display = 'none';
        break;
    }

    // Show the return to chat chevron on non-chat pages if it exists
    if (page !== 'chat') {
      if (returnBtn) returnBtn.style.display = '';
    }

    // (Floating drawer toggle and right drawer logic removed)

    // Step 3: Sync dock + nav button active states
    this._syncDockActiveState(page);

    // Step 4: Fire registered navigate callbacks
    if (this._onNavigateCallbacks[page]) {
      this._onNavigateCallbacks[page]();
    }

    // Step 4b: Fire all global refresh hooks
    this.forceRefresh();

    // Step 5: Re-apply theme from localStorage — safety net in case any
    // event listener was lost. Zero-cost; just a classList toggle.
    const savedTheme = localStorage.getItem('hekki_theme') || 'dark';
    document.body.classList.remove('dark', 'oled', 'light');
    document.body.classList.add(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
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
    const coderBtn      = document.getElementById('btn-nav-coder');
    const historyBtn    = document.getElementById('btn-nav-chat-history');

    skillsBtn?.classList.toggle('active', page === 'skills');
    coderBtn?.classList.toggle('active', page === 'coder');
    historyBtn?.classList.toggle('active', page === 'history');

    // Main titlebar back button
    const mainBackBtn = document.getElementById('btn-main-back');
    if (mainBackBtn) {
      mainBackBtn.style.display = 'none';
    }
  }

  navigate(targetPage, subView = null) {
    return this.navigateTo(targetPage, subView);
  }
}

// Singleton export
export const router = new Router();
window.router = router;
window._router = router;

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
