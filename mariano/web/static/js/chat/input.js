/* === chat/input.js — Input binding, scroll, clear helpers, shared state === */
import { attachmentManager } from '../components/attachment_manager.js';

// Shared mutable state (exported for session.js to access)
export let activeChatId = localStorage.getItem('hekki_active_chat_id') || null;
export let globalSendCallback = null;

export function setActiveChatId(id) {
  activeChatId = id;
  if (id) {
    localStorage.setItem('hekki_active_chat_id', id);
  } else {
    localStorage.removeItem('hekki_active_chat_id');
  }
}

export function setGlobalSendCallback(cb) {
  globalSendCallback = cb;
}

export function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function scrollChat() {
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

export function clearInputs() {
  ['chat-input', 'chat-input-conv'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.style.height = 'auto'; }
  });
  document.getElementById('btn-submit-home')?.classList.add('hidden');
  document.getElementById('btn-submit-conv')?.classList.add('hidden');
}

export function clearChatLogs() {
  const col = document.getElementById('chat-col');
  if (col) {
    Array.from(col.children).forEach(child => {
      if (child.id !== 'home-screen') {
        child.remove();
      }
    });
  }
}

/** Formats ISO timestamp to human readable shorthand */
export function formatTime(timestamp) {
  if (!timestamp) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function bindInputs(sendCallback, ChatSessionManager) {
  globalSendCallback = sendCallback;
  const $ = id => document.getElementById(id);

  const adjustHeight = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleInputToggle = (textarea, submitBtnId) => {
    adjustHeight(textarea);
    const submitBtn = $(submitBtnId);
    if (textarea.value.trim() !== '' || attachmentManager.hasFiles()) {
      submitBtn?.classList.remove('hidden');
    } else {
      submitBtn?.classList.add('hidden');
    }

  };

  $('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      let text = $('chat-input').value.trim();
      if (!text && !attachmentManager.hasFiles()) return;
      if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
      sendCallback(text);
    }
  });

  $('chat-input-conv')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      let text = $('chat-input-conv').value.trim();
      if (!text && !attachmentManager.hasFiles()) return;
      if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
      sendCallback(text);
    }
  });

  $('chat-input')?.addEventListener('input', () => handleInputToggle($('chat-input'), 'btn-submit-home'));
  $('chat-input-conv')?.addEventListener('input', () => handleInputToggle($('chat-input-conv'), 'btn-submit-conv'));

  $('btn-submit-home')?.addEventListener('click', () => {
    let text = $('chat-input').value.trim();
    if (!text && !attachmentManager.hasFiles()) return;
    if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
    sendCallback(text);
  });

  $('btn-submit-conv')?.addEventListener('click', () => {
    let text = $('chat-input-conv').value.trim();
    if (!text && !attachmentManager.hasFiles()) return;
    if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
    sendCallback(text);
  });

  // Bind Expert Debate mode pill toggle
  $('btn-debate-pill')?.addEventListener('click', () => {
    const activeInput = $('chat-input-conv') && $('chat-input-conv').offsetParent !== null 
      ? $('chat-input-conv') 
      : $('chat-input');
    if (activeInput) {
      if (!activeInput.value.startsWith('/debate')) {
        activeInput.value = '/debate ' + activeInput.value.trim();
      }
      activeInput.focus();
      handleInputToggle(activeInput, activeInput.id === 'chat-input-conv' ? 'btn-submit-conv' : 'btn-submit-home');
    }
  });

  // Render chats list or skeleton loaders on startup load
  if (ChatSessionManager.getChats().length === 0) {
    const chatList = document.getElementById('recent-list');
    if (chatList) {
      chatList.innerHTML = Array(3).fill(0).map(() => `
        <div style="display:flex; align-items:center; gap:8px; padding:6px 12px; opacity:0.8;">
          <div class="skeleton-shimmer skeleton-circle" style="width:20px; height:20px; opacity:0.15; flex-shrink:0;"></div>
          <div class="skeleton-shimmer skeleton-bar" style="width:100px; height:11px; opacity:0.15; margin:0;"></div>
        </div>
      `).join('');
    }
  } else {
    ChatSessionManager.renderChatsList();
  }

  // Asynchronously fetch chats from SQLite server database to populate localStorage cache on startup
  fetch('/api/chats')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data && Array.isArray(data.chats)) {
        localStorage.setItem('hekki_chats', JSON.stringify(data.chats));
        ChatSessionManager.renderChatsList();
        const activeId = localStorage.getItem('hekki_active_chat_id');
        if (activeId) {
          ChatSessionManager.loadChat(activeId);
        }
      }
    })
    .catch(err => {
      console.warn("Failed to load chats from server database, falling back to local storage cache:", err);
    });
}
