/* === chat/input.js — Input binding, scroll, clear helpers, shared state === */
import { attachmentManager } from '../components/attachment_manager.js';
import { updateInputStatsIndicator } from './input_stats.js';
import { isDebateModeActive, handleInlineDebateSubmit, initInlineDebateMode } from './debate_mode.js?v=215';

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
    if (el) { 
      el.value = ''; 
      el.style.height = 'auto'; 
      updateCapsuleLayoutState(el);
    }
  });
  document.getElementById('chat-input-stats-badge')?.remove();
  document.getElementById('chat-input-conv-stats-badge')?.remove();
  if (window.setGeneratingState) {
    window.setGeneratingState(window.isGenerating);
  }
}

export function updateCapsuleLayoutState(textarea) {
  if (!textarea) return;
  const capsule = textarea.closest('#input-capsule, #input-capsule-conv, .home-capsule, #coder-input-capsule, #debate-input-capsule');
  if (!capsule) return;

  const val = textarea.value || '';
  const previewArea = capsule.querySelector('.input-preview-area');
  const hasAttachments = previewArea && !previewArea.classList.contains('hidden') && previewArea.children.length > 0;
  
  // Switch to multi-line card layout if text contains newline (\n), exceeds 80 characters, or has attachments
  const isMulti = val.includes('\n') || (val.length > 80) || hasAttachments;

  requestAnimationFrame(() => {
    if (isMulti) {
      if (!capsule.classList.contains('is-multiline')) {
        capsule.classList.add('is-multiline');
        capsule.classList.remove('is-single-line');
      }
    } else {
      if (!capsule.classList.contains('is-single-line')) {
        capsule.classList.remove('is-multiline');
        capsule.classList.add('is-single-line');
      }
      textarea.scrollTop = 0;
    }
  });
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
  // Reset any inline style that debate_mode.js may have set on home-screen
  // so that classList-based show/hide works correctly after a debate.
  const homeScreen = document.getElementById('home-screen');
  if (homeScreen) homeScreen.style.display = '';
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

export function setGeneratingState(isGen) {
  window.isGenerating = !!isGen;

  ['chat-input', 'chat-input-conv'].forEach(inputId => {
    const isConv = inputId === 'chat-input-conv';
    const submitBtn = document.getElementById(isConv ? 'btn-submit-conv' : 'btn-submit-home');
    const stopBtn = document.getElementById(isConv ? 'btn-stop-gen-conv' : 'btn-stop-gen');
    const voiceBtn = document.getElementById(isConv ? 'btn-voice-conv' : 'btn-voice');
    const textarea = document.getElementById(inputId);
    const hasText = !!(textarea?.value?.trim());

    if (window.isGenerating) {
      // Always hide voice mic while generating
      voiceBtn?.classList.add('hidden');
      // Always show stop button while generating
      stopBtn?.classList.remove('hidden');
      // Only show send if user has typed something (allow sending new query mid-gen)
      if (hasText) {
        submitBtn?.classList.remove('hidden');
      } else {
        submitBtn?.classList.add('hidden');
      }
    } else {
      stopBtn?.classList.add('hidden');
      voiceBtn?.classList.remove('hidden');
      submitBtn?.classList.remove('hidden');
    }
  });
}
window.setGeneratingState = setGeneratingState;

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
    if (!textarea) return;
    adjustHeight(textarea);
    const submitBtn = $(submitBtnId);
    const stopBtn = $(stopBtnId);
    const hasText = !!(textarea.value?.trim());

    if (window.isGenerating) {
      // Stop always visible during generation
      stopBtn?.classList.remove('hidden');
      // Send: visible only if user has typed text (to allow new query mid-gen)
      if (hasText) {
        submitBtn?.classList.remove('hidden');
      } else {
        submitBtn?.classList.add('hidden');
      }
    } else {
      stopBtn?.classList.add('hidden');
      submitBtn?.classList.remove('hidden');
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

  const triggerSend = (text) => {
    const lower = (text || '').toLowerCase().trim();
    const isDebateCmd = lower.startsWith('/debate') || isDebateModeActive();
    if (isDebateCmd) {
      const topic = text.replace(/^\/debate\s*/i, '').trim();
      if (topic) {
        handleInlineDebateSubmit(topic);
      }
      clearInputs();
      return;
    }
    sendCallback(text);
  };

  initInlineDebateMode();

  $('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      let text = getFullPromptText('chat-input');
      if (!text && !attachmentManager.hasFiles()) {
        if (window.isGenerating) {
          $('btn-stop-gen')?.click();
        }
        return;
      }
      if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
      if (window.sounds && window.sounds.playSend) window.sounds.playSend();
      triggerSend(text);
    }
  });

  $('chat-input-conv')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      let text = getFullPromptText('chat-input-conv');
      if (!text && !attachmentManager.hasFiles()) {
        if (window.isGenerating) {
          $('btn-stop-gen-conv')?.click();
        }
        return;
      }
      if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
      if (window.sounds && window.sounds.playSend) window.sounds.playSend();
      triggerSend(text);
    }
  });

  $('chat-input')?.addEventListener('input', () => {
    handleInputToggle($('chat-input'), 'btn-submit-home', 'btn-stop-gen');
    updateInputStatsIndicator('chat-input', 'chat-input-stats-badge');
    updateCapsuleLayoutState($('chat-input'));
  });

  $('chat-input-conv')?.addEventListener('input', () => {
    handleInputToggle($('chat-input-conv'), 'btn-submit-conv', 'btn-stop-gen-conv');
    updateInputStatsIndicator('chat-input-conv', 'chat-input-conv-stats-badge');
    updateCapsuleLayoutState($('chat-input-conv'));
  });

  ['chat-input', 'chat-input-conv'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      updateCapsuleLayoutState(el);
      ['keyup', 'change', 'paste'].forEach(evt => {
        el.addEventListener(evt, () => setTimeout(() => updateCapsuleLayoutState(el), 10));
      });
    }
  });


  $('btn-submit-home')?.addEventListener('click', () => {
    let text = getFullPromptText('chat-input');
    if (!text && !attachmentManager.hasFiles()) return;
    if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
    if (window.sounds && window.sounds.playSend) window.sounds.playSend();
    triggerSend(text);
  });

  $('btn-submit-conv')?.addEventListener('click', () => {
    let text = getFullPromptText('chat-input-conv');
    if (!text && !attachmentManager.hasFiles()) return;
    if (!text && attachmentManager.hasFiles()) text = "Analyze attached file(s)";
    if (window.sounds && window.sounds.playSend) window.sounds.playSend();
    triggerSend(text);
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
        // MERGE server chats with local — don't overwrite.
        // Local-only chats (e.g. playground sessions not yet synced) must be preserved.
        const localChats = JSON.parse(localStorage.getItem('hekki_chats') || '[]');
        const serverMap = new Map(data.chats.map(c => [c.id, c]));
        // Keep local chats that server doesn't know about, use server version for shared ones
        const localOnly = localChats.filter(c => !serverMap.has(c.id));
        const merged = [...localOnly, ...data.chats];
        localStorage.setItem('hekki_chats', JSON.stringify(merged));
        ChatSessionManager.renderChatsList();
        // Skip restoring the active chat if a debate is currently streaming —
        // loadChat() calls clearChatLogs() which would wipe the live debate UI.
        if (!window._debateRunning) {
          const activeId = localStorage.getItem('hekki_active_chat_id');
          if (activeId) {
            ChatSessionManager.loadChat(activeId);
          }
        }
      }
    })
    .catch(err => {
      console.warn("Failed to load chats from server database, falling back to local storage cache:", err);
    });
}
