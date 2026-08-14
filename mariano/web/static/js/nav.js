/**
 * nav.js  Dock button event bindings ONLY.
 *
 * Does NOT control pane visibility directly.
 * All navigation goes through router.js.
 */

import { router } from '/static/js/router.js';
import { resetActiveChat, clearChatLogs } from './chat.js';











































let _navBound = false;

export function bindNavigation(tabs, showToast, inConversationStateRef) {
  // Guard: only bind once. The sidebar HTML is never rebuilt so this is safe.
  if (_navBound) return;
  _navBound = true;

  const $ = id => document.getElementById(id);

  const handleNewChat = () => {
    clearChatLogs();

    localStorage.removeItem('hekki_active_project');
    localStorage.removeItem('hekki_active_project_path');

    // Reset debate running state
    window._debateRunning = false;

    // Reset state — must also clear inline style set by debate_mode.js
    const homeScreen = $('home-screen');
    if (homeScreen) {
      homeScreen.style.display = '';   // clear inline style from debate_mode.js
      homeScreen.classList.remove('hidden');
    }
    $('bottom-input-bar')?.classList.add('hidden');
    inConversationStateRef.val = false;
    resetActiveChat();

    // Navigate to chat via router
    router.navigateTo('chat');

    $('chat-input')?.focus();
    showToast('New Chat', 'Conversation reset successfully.', 2500);
  };

  $('btn-new-chat')?.addEventListener('click', () => handleNewChat());

  //  Chat (Home) 
  $('mode-home')?.addEventListener('click', () => {
    router.navigateTo('chat');
  });

  $('btn-return-chat-nav')?.addEventListener('click', () => {
    router.navigateTo('chat');
  });

  $('btn-nav-back')?.addEventListener('click', () => {
    window.history.back();
  });

  $('btn-nav-forward')?.addEventListener('click', () => {
    window.history.forward();
  });





  //  Expert Skills 
  $('nav-skills-btn')?.addEventListener('click', () => {
    router.navigateTo('skills');
  });




  //  Plugins & MCP Connectors Hub
  $('btn-nav-plugins')?.addEventListener('click', () => {
    router.navigateTo('plugins');
  });

  //  Images Gallery 
  $('btn-nav-images')?.addEventListener('click', () => {
    router.navigateTo('images');
  });

  //  Chat History — navigate to center Chat History page
  $('btn-nav-chat-history')?.addEventListener('click', () => {
    router.navigateTo('history');
  });

  //  Main Topnav Back Button 
  $('btn-main-back')?.addEventListener('click', () => {
    router.navigateTo('chat');
  });


  //  User Profile Dropdown — Global Event Delegation Engine
  document.addEventListener('click', (e) => {
    const userMenu = $('user-menu-dropdown') || $('debate-user-menu-dropdown');
    const profileBtn = e.target.closest('#btn-sidebar-user-profile, .sidebar-user-profile, #btn-debate-sidebar-user-profile');

    if (profileBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (userMenu) {
        const isHidden = userMenu.classList.contains('hidden');
        // Close other dropdowns first
        document.querySelectorAll('.user-menu-dropdown, .topnav-dropdown-menu, .attach-dropdown, .cad-grid-dropdown-menu').forEach(d => {
          if (d !== userMenu) {
            d.classList.add('hidden');
            d.style.display = 'none';
          }
        });

        if (isHidden) {
          userMenu.classList.remove('hidden');
          userMenu.style.display = 'flex';
        } else {
          userMenu.classList.add('hidden');
          userMenu.style.display = 'none';
        }
      }
      return;
    }

    // Delegated click handler for items inside user menu dropdown
    const menuItem = e.target.closest('.user-menu-item');
    if (menuItem) {
      const itemId = menuItem.id;

      if (itemId === 'btn-user-settings' || itemId === 'btn-debate-user-settings') {
        if (userMenu) { userMenu.classList.add('hidden'); userMenu.style.display = 'none'; }
        router.navigateTo('settings');
      } else if (itemId === 'btn-user-plugins' || itemId === 'btn-debate-user-plugins') {
        if (userMenu) { userMenu.classList.add('hidden'); userMenu.style.display = 'none'; }
        router.navigateTo('plugins');
      } else if (itemId === 'btn-user-skills' || itemId === 'btn-debate-user-skills') {
        if (userMenu) { userMenu.classList.add('hidden'); userMenu.style.display = 'none'; }
        router.navigateTo('skills');
      } else if (itemId !== 'btn-user-theme' && itemId !== 'btn-debate-user-theme') {
        if (userMenu) { userMenu.classList.add('hidden'); userMenu.style.display = 'none'; }
      }
      return;
    }

    // Close user menu if click is outside profile button & dropdown
    if (userMenu && !userMenu.contains(e.target)) {
      userMenu.classList.add('hidden');
      userMenu.style.display = 'none';
    }
  });

  //  CAD Grid Menu Dropdown 
  const gridMenuBtn = $('cad-grid-menu-btn');
  const gridDropdownMenu = $('cad-grid-dropdown-menu');
  if (gridMenuBtn && gridDropdownMenu) {
    gridMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      gridDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!gridDropdownMenu.contains(e.target)) {
        gridDropdownMenu.classList.add('hidden');
      }
    });

    gridDropdownMenu.querySelectorAll('.cad-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        gridDropdownMenu.classList.add('hidden');
      });
    });
  }
}
