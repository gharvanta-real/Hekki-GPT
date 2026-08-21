/**
 * coder_context_menu.js — Right-click & floating context menus for coder items
 */
import { showCustomConfirm, showCustomPrompt } from '../chat.js';
import { _conversations, saveConversations, renderConversationList, setActiveConvId, _activeConvId } from './coder_sidebar.js';

export let _activeContextMenu = null;
export let _activeMenuConvId = null;

export function closeAllCoderMenus() {
  document.getElementById('coder-project-plus-menu')?.classList.add('hidden');
  document.getElementById('coder-filter-dropdown')?.classList.add('hidden');
  document.getElementById('coder-item-actions-menu')?.classList.add('hidden');
  document.querySelectorAll('.coder-conv-item.menu-active').forEach(item => {
    item.classList.remove('menu-active');
  });
  _activeContextMenu = null;
}

export function openItemActionsMenu(id, triggerElement, event) {
  event.stopPropagation();
  closeAllCoderMenus();

  _activeMenuConvId = id;
  const menu = document.getElementById('coder-item-actions-menu');
  if (!menu) return;

  const itemBtn = triggerElement.closest('.coder-conv-item');
  if (itemBtn) itemBtn.classList.add('menu-active');

  menu.classList.remove('hidden');

  const parent = document.getElementById('nav-inner-coder');
  if (parent) {
    const parentRect = parent.getBoundingClientRect();
    const triggerRect = triggerElement.getBoundingClientRect();
    const relativeTop = triggerRect.bottom - parentRect.top;
    const relativeLeft = triggerRect.left - parentRect.left - 130;
    menu.style.top = `${relativeTop}px`;
    menu.style.left = `${Math.max(8, relativeLeft)}px`;
  }
  _activeContextMenu = menu;
}

export function bindContextMenuActions(onSessionSelect, onChatClear, onBreadcrumbUpdate) {
  document.getElementById('coder-item-opt-unread')?.addEventListener('click', () => {
    if (!_activeMenuConvId) return;
    const conv = _conversations.find(c => c.id === _activeMenuConvId);
    if (conv) {
      conv.unread = !conv.unread;
      saveConversations();
      renderConversationList(onSessionSelect, openItemActionsMenu);
    }
    closeAllCoderMenus();
  });

  document.getElementById('coder-item-opt-rename')?.addEventListener('click', async () => {
    if (!_activeMenuConvId) return;
    const conv = _conversations.find(c => c.id === _activeMenuConvId);
    if (conv) {
      const newTitle = await showCustomPrompt('Rename Session', 'Enter a new title for this session:', conv.title);
      if (newTitle && newTitle.trim()) {
        conv.title = newTitle.trim();
        saveConversations();
        renderConversationList(onSessionSelect, openItemActionsMenu);
        if (typeof onBreadcrumbUpdate === 'function') onBreadcrumbUpdate();
      }
    }
    closeAllCoderMenus();
  });

  document.getElementById('coder-item-opt-delete')?.addEventListener('click', async () => {
    if (!_activeMenuConvId) return;
    const confirmed = await showCustomConfirm('Delete Session', 'Are you sure you want to delete this coding session? This action cannot be undone.');
    if (confirmed) {
      const idx = _conversations.findIndex(c => c.id === _activeMenuConvId);
      if (idx !== -1) {
        _conversations.splice(idx, 1);
      }
      saveConversations();
      localStorage.removeItem(`hekki_coder_messages_${_activeMenuConvId}`);

      if (_activeConvId === _activeMenuConvId) {
        const nextActiveId = _conversations[0]?.id || null;
        if (nextActiveId) {
          if (typeof onSessionSelect === 'function') onSessionSelect(nextActiveId);
        } else {
          setActiveConvId(null);
          if (typeof onChatClear === 'function') onChatClear();
        }
      } else {
        renderConversationList(onSessionSelect, openItemActionsMenu);
        if (typeof onBreadcrumbUpdate === 'function') onBreadcrumbUpdate();
      }
    }
    closeAllCoderMenus();
  });
}
