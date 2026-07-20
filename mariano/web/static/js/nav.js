/**
 * nav.js â€” Dock button event bindings ONLY.
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

  // ── Chat (Home) ───────────────────────────────────────
  $('mode-home')?.addEventListener('click', () => {
    router.navigateTo('chat');
  });

  $('btn-return-chat-nav')?.addEventListener('click', () => {
    router.navigateTo('chat');
  });

  $('mode-playground')?.addEventListener('click', () => {
    router.navigateTo('debate');
  });



  // ── Expert Skills ────────────────────────────────────
  $('nav-skills-btn')?.addEventListener('click', () => {
    router.navigateTo('skills');
  });

  // ── Debate Playground ─────────────────────────────────
  $('btn-nav-playground')?.addEventListener('click', () => {
    router.navigateTo('debate');
  });

  // ── Coder IDE ────────────────────────────────────────
  $('btn-nav-coder')?.addEventListener('click', () => {
    router.navigateTo('coder');
  });

  // ── Main Topnav Back Button ──────────────────────────
  $('btn-main-back')?.addEventListener('click', () => {
    router.navigateTo('chat');
  });

  // ── User Profile Dropdown ──────────────────────────────
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
    
    // Also close on any item click (except theme, handled locally if needed, but let's close on theme too)
    userMenuDropdown.querySelectorAll('.user-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        // Keep open for theme toggle? No, standard is to close or keep open. Let's keep open for theme toggle.
        if (item.id !== 'btn-user-theme') {
          userMenuDropdown.classList.add('hidden');
        }
      });
    });
  }
}
