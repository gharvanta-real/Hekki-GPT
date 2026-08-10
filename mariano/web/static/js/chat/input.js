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
  document.querySelectorAll('.ref-hover-tooltip').forEach(el => el.remove());
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

let _inputsBound = false;

export function bindInputs(sendCallback, ChatSessionManager) {
  if (_inputsBound) {
    globalSendCallback = sendCallback;
    return;
  }
  _inputsBound = true;
  globalSendCallback = sendCallback;
  const $ = id => document.getElementById(id);

  const adjustHeight = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleInputToggle = (textarea, submitBtnId, stopBtnId) => {
    adjustHeight(textarea);
    const submitBtn = $(submitBtnId);
    const stopBtn = $(stopBtnId);

    if (window.isGenerating) {
      submitBtn?.classList.add('hidden');
      stopBtn?.classList.remove('hidden');
      return;
    }

    stopBtn?.classList.add('hidden');
    if (textarea.value.trim() !== '' || attachmentManager.hasFiles()) {
      submitBtn?.classList.remove('hidden');
    } else {
      submitBtn?.classList.add('hidden');
    }
  };

  const getFullPromptText = (textareaId) => {
    let text = $(textareaId)?.value.trim() || '';
    const activeTag = window.slashMenu?.getActiveTag();
    if (activeTag) {
      text = activeTag.cmd + ' ' + text;
      window.slashMenu.clearSlashTag();
    }
    return text.trim();
  };

  $('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (window.isGenerating) {
        $('btn-stop-gen')?.click();
        return;
      }
      let text = getFullPromptText('chat-input');
      if (!text && !attachmentManager.hasFiles()) return;
      if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
      if (window.sounds && window.sounds.playSend) window.sounds.playSend();
      sendCallback(text);
    }
  });

  $('chat-input-conv')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (window.isGenerating) {
        $('btn-stop-gen-conv')?.click();
        return;
      }
      let text = getFullPromptText('chat-input-conv');
      if (!text && !attachmentManager.hasFiles()) return;
      if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
      if (window.sounds && window.sounds.playSend) window.sounds.playSend();
      sendCallback(text);
    }
  });

  $('chat-input')?.addEventListener('input', () => handleInputToggle($('chat-input'), 'btn-submit-home', 'btn-stop-gen'));
  $('chat-input-conv')?.addEventListener('input', () => handleInputToggle($('chat-input-conv'), 'btn-submit-conv', 'btn-stop-gen-conv'));

  $('btn-submit-home')?.addEventListener('click', () => {
    let text = getFullPromptText('chat-input');
    if (!text && !attachmentManager.hasFiles()) return;
    if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
    if (window.sounds && window.sounds.playSend) window.sounds.playSend();
    sendCallback(text);
  });

  $('btn-submit-conv')?.addEventListener('click', () => {
    let text = getFullPromptText('chat-input-conv');
    if (!text && !attachmentManager.hasFiles()) return;
    if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
    if (window.sounds && window.sounds.playSend) window.sounds.playSend();
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
      handleInputToggle(
        activeInput,
        activeInput.id === 'chat-input-conv' ? 'btn-submit-conv' : 'btn-submit-home',
        activeInput.id === 'chat-input-conv' ? 'btn-stop-gen-conv' : 'btn-stop-gen'
      );
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
