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

    // Reset state
    $('home-screen')?.classList.remove('hidden');
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

  $('mode-playground')?.addEventListener('click', () => {
    router.navigateTo('debate');
  });



  //  Expert Skills 
  $('nav-skills-btn')?.addEventListener('click', () => {
    router.navigateTo('skills');
  });

  //  Debate Playground 
  $('btn-nav-playground')?.addEventListener('click', () => {
    router.navigateTo('debate');
  });


  //  Plugins & MCP Connectors Hub
  $('btn-nav-plugins')?.addEventListener('click', () => {
    router.navigateTo('plugins');
  });

  //  Images Gallery 
  $('btn-nav-images')?.addEventListener('click', () => {
    router.navigateTo('images');
  });

  //  Main Topnav Back Button 
  $('btn-main-back')?.addEventListener('click', () => {
    router.navigateTo('chat');
  });


  //  User Profile Dropdown 
  const userProfileBtn = $('btn-sidebar-user-profile');
  const userMenuDropdown = $('user-menu-dropdown');
  if (userProfileBtn && userMenuDropdown) {
    userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenuDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!userMenuDropdown.contains(e.target)) {
        userMenuDropdown.classList.add('hidden');
      }
    });
    
    // Bind Plugins & Connectors button
    const userPluginsBtn = $('btn-user-plugins');
    if (userPluginsBtn) {
      userPluginsBtn.addEventListener('click', () => {
        router.navigateTo('plugins');
      });
    }

    // Bind Skills & Capabilities button
    const userSkillsBtn = $('btn-user-skills');
    if (userSkillsBtn) {
      userSkillsBtn.addEventListener('click', () => {
        router.navigateTo('skills');
      });
    }

    // Also close on any item click
    userMenuDropdown.querySelectorAll('.user-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        if (item.id !== 'btn-user-theme') {
          userMenuDropdown.classList.add('hidden');
        }
      });
    });
  }

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
