/* === chat/session.js — ChatSessionManager: CRUD, load, render list === */
import { showCustomConfirm, showCustomPrompt, openImageLightbox } from './dialogs.js';
import { scrollChat, clearChatLogs, setActiveChatId as _setActive, escapeHtml } from './input.js';
import { createMessageElement, createToolGroupCard } from './messages.js';
import { enhanceImagePreviews } from './media.js';
import { renderPlaygroundList, renderRecentChatsList, closeAllDropdowns, buildDropdown, getLatestActivityTime, isPlaygroundChat } from './session_sidebar.js';

let _activeChatId = localStorage.getItem('hekki_active_chat_id') || localStorage.getItem('mariano_active_chat_id') || null;
let _globalSendCallback = null;

export const ChatSessionManager = {
  getActiveChatId() { return _activeChatId; },

  setActiveChatId(id) {
    _activeChatId = id;
    _setActive(id);
    if (id) {
      localStorage.setItem('hekki_active_chat_id', id);
      localStorage.setItem('mariano_active_chat_id', id);
      const chat = this.getChats().find(c => c.id === id);
      if (chat && window.updateTitleBreadcrumb) {
        window.updateTitleBreadcrumb(chat.project || localStorage.getItem('hekki_active_project'), chat.title);
      }
    } else {
      localStorage.removeItem('hekki_active_chat_id');
      localStorage.removeItem('mariano_active_chat_id');
      if (window.updateTitleBreadcrumb) {
        window.updateTitleBreadcrumb(localStorage.getItem('hekki_active_project'), '');
      }
    }
  },

  setSendCallback(cb) { _globalSendCallback = cb; },
  getSendCallback() { return _globalSendCallback; },

  getChats() {
    try {
      const raw = JSON.parse(localStorage.getItem('hekki_chats') || '[]');
      return raw.map(c => {
        if (c.id && String(c.id).startsWith('playground_')) {
          c.isPlayground = true;
        }
        // Any debate chat must be treated as Playground regardless of ID prefix
        if (c.isDebate) {
          c.isPlayground = true;
        }
        return c;
      });
    } catch { return []; }
  },

  saveChats(chats) {
    localStorage.setItem('hekki_chats', JSON.stringify(chats));
    localStorage.setItem('mariano_chats', JSON.stringify(chats));
    if (window.isServerOffline) return;
    fetch('/api/chats/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chats })
    }).catch(() => {
      // [M-3] Show subtle non-blocking warning on sync failure
      if (window.showToast) showToast('Sync Warning', 'Chat sync failed — local copy saved.', 3500);
    });
  },

  createChat(initialText) {
    const chats = this.getChats();
    const rawClean = (initialText || '').replace(/^🔀\s*/, '').replace(/^\/(?:debate|detective|web|code|pdf|image)\s*/i, '').trim();
    const textToUse = rawClean || (initialText || '').trim();
    const truncatedText = textToUse.length > 30 ? textToUse.substring(0, 30) + '...' : textToUse;
    const activeProj = localStorage.getItem('hekki_active_project');
    const newChat = {
      id: 'chat_' + Date.now(), title: truncatedText, messages: [],
      timestamp: new Date().toISOString(), project: activeProj || null,
      pinned: false, archived: false
    };
    chats.unshift(newChat);
    this.saveChats(chats);
    _activeChatId = newChat.id;
    localStorage.setItem('hekki_active_chat_id', newChat.id);
    this.renderChatsList();
    return newChat;
  },

  forkChat(msgIndex = null) {
    const activeId = this.getActiveChatId();
    const chats = this.getChats();
    const sourceChat = chats.find(c => c.id === activeId);
    if (!sourceChat || !sourceChat.messages || sourceChat.messages.length === 0) return;

    const targetIdx = (msgIndex !== null && msgIndex >= 0) ? msgIndex : sourceChat.messages.length - 1;
    const clonedMessages = JSON.parse(JSON.stringify(sourceChat.messages.slice(0, targetIdx + 1)));

    const activeProj = localStorage.getItem('hekki_active_project');
    const baseTitle = (sourceChat.title || 'Chat').replace(/^🔀\s*/i, '').replace(/^Branch:\s*/i, '');
    const newTitle = `Branch: ${baseTitle}`;

    const newChat = {
      id: 'chat_' + Date.now(), title: newTitle, messages: clonedMessages,
      timestamp: new Date().toISOString(), project: activeProj || null,
      pinned: false, archived: false, forkedFrom: sourceChat.id
    };

    chats.unshift(newChat);
    this.saveChats(chats);

    if (window.inConversationState) window.inConversationState.val = true;
    const homeScreen = document.getElementById('home-screen');
    if (homeScreen) homeScreen.classList.add('hidden');
    const inputBar = document.getElementById('bottom-input-bar');
    if (inputBar) inputBar.classList.remove('hidden');

    this.loadChat(newChat.id);

    if (window.showToast) {
      window.showToast('Thread Forked 🔀', `Created new branch with ${clonedMessages.length} message(s).`, 3000);
    }
  },

  appendMessage(role, text, metadata = null) {
    if (!_activeChatId) { this.createChat(text); }
    const chats = this.getChats();
    const chat = chats.find(c => c.id === _activeChatId);
    if (chat) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg && lastMsg.role === role && lastMsg.text === text) return;
      const nowIso = new Date().toISOString();
      chat.messages.push({ role, text, timestamp: nowIso, metadata });
      chat.timestamp = nowIso;
      this.saveChats(chats);
      this.renderChatsList();
    }
  },

  // Append suffix to the last saved message of a given role (no new entry).
  // Used to merge late-arriving error events into the already-finalized response
  // so reload doesn't render two separate bubbles.
  patchLastMessage(role, suffix) {
    if (!_activeChatId) return;
    const chats = this.getChats();
    const chat = chats.find(c => c.id === _activeChatId);
    if (!chat) return;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === role) {
        chat.messages[i].text = (chat.messages[i].text || '') + suffix;
        this.saveChats(chats);
        return;
      }
    }
  },

  deleteChat(id) {
    let chats = this.getChats();
    chats = chats.filter(c => c.id !== id);
    this.saveChats(chats);
    if (_activeChatId === id) {
      this.setActiveChatId(null);
      const activeProj = localStorage.getItem('hekki_active_project');
      const btnId = activeProj ? 'btn-new-code-chat' : 'btn-new-chat';
      document.getElementById(btnId)?.click();
    }
    this.renderChatsList();
  },

  renameChat(id, newTitle) {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === id);
    if (chat) {
      chat.title = newTitle;
      this.saveChats(chats);
      if (id === _activeChatId && window.updateTitleBreadcrumb) {
        window.updateTitleBreadcrumb(chat.project || localStorage.getItem('hekki_active_project'), chat.title);
      }
    }
    this.renderChatsList();
  },

  togglePinChat(id) {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === id);
    if (chat) { chat.pinned = !chat.pinned; this.saveChats(chats); }
    this.renderChatsList();
  },

  archiveChat(id) {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === id);
    if (chat) {
      chat.archived = true;
      this.saveChats(chats);
      if (_activeChatId === id) {
        _activeChatId = null;
        localStorage.removeItem('hekki_active_chat_id');
        const activeProj = localStorage.getItem('hekki_active_project');
        const btnId = activeProj ? 'btn-new-code-chat' : 'btn-new-chat';
        document.getElementById(btnId)?.click();
      }
    }
    this.renderChatsList();
  },

  ensureNormalChatActive() {
    // Never redirect away from a live streaming debate
    if (window._debateRunning) return;

    const chats = this.getChats();
    const activeId = localStorage.getItem('hekki_active_chat_id');
    const activeChat = chats.find(c => c.id === activeId);

    // Only redirect if active is an EMPTY playground chat (stale/abandoned).
    // A playground chat WITH messages is a completed debate — leave it alone.
    if (activeId && activeChat && activeChat.isPlayground &&
        (!activeChat.messages || activeChat.messages.length === 0)) {
      localStorage.removeItem('hekki_active_chat_id');
      localStorage.removeItem('mariano_active_chat_id');

      const normalChats = chats.filter(c => !c.isPlayground && !c.project && !c.archived);
      if (normalChats.length > 0) {
        normalChats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        this.loadChat(normalChats[0].id);
      } else {
        this.setActiveChatId(null);
        clearChatLogs();
        const homeScreen = document.getElementById('home-screen');
        if (homeScreen) homeScreen.classList.remove('hidden');
        const inputBar = document.getElementById('bottom-input-bar');
        if (inputBar) inputBar.classList.add('hidden');
        if (window.inConversationState) window.inConversationState.val = false;
        this.renderChatsList();
      }
    }
  },

  createPlaygroundChat(topic) {
    const chats = this.getChats();
    const truncatedText = topic.length > 30 ? topic.substring(0, 30) + '...' : topic;
    const newChat = {
      id: 'playground_' + Date.now(), title: truncatedText, messages: [],
      timestamp: new Date().toISOString(), project: null, isPlayground: true,
      pinned: false, archived: false
    };
    chats.unshift(newChat);
    this.saveChats(chats);
    _activeChatId = newChat.id;
    localStorage.setItem('hekki_active_chat_id', newChat.id);
    this.renderChatsList();
    return newChat;
  },

  appendPlaygroundMessage(role, text, extra = {}) {
    if (!_activeChatId) return;
    const chats = this.getChats();
    const chat = chats.find(c => c.id === _activeChatId);
    if (chat && chat.isPlayground) {
      const nowIso = new Date().toISOString();
      chat.messages.push({ role, text, timestamp: nowIso, ...extra });
      chat.timestamp = nowIso;
      this.saveChats(chats);
      this.renderChatsList();
    }
  },

  updateLastPlaygroundMessage(text) {
    if (!_activeChatId) return;
    const chats = this.getChats();
    const chat = chats.find(c => c.id === _activeChatId);
    if (chat && chat.isPlayground && chat.messages.length > 0) {
      const nowIso = new Date().toISOString();
      chat.messages[chat.messages.length - 1].text = text;
      chat.timestamp = nowIso;
      this.saveChats(chats);
      this.renderChatsList();
    }
  },

  loadChat(id) {
    // GUARD 1: Never interrupt a live streaming debate
    if (window._debateRunning) return;

    const chats = this.getChats();
    const chat = chats.find(c => c.id === id);
    if (!chat) return;

    // GUARD 2: Playground chat with 0 messages and already active — don't wipe DOM
    if (chat.isPlayground && chat.messages.length === 0 && id === _activeChatId) {
      if (window.router && window.router.currentPage !== 'chat') {
        window.router.navigateTo('chat');
      }
      this.renderChatsList();
      return;
    }

    // GUARD 3: If switching TO a chat that is actively streaming in the background,
    // thaw its stream back into DOM instead of loading from saved messages.
    const { thawActiveStream, isStreamActive } = window._streamBufferApi || {};
    if (thawActiveStream && isStreamActive && isStreamActive(id)) {
      this.setActiveChatId(id);
      // Clear hasNewResponse on opening
      if (chat.hasNewResponse) {
        chat.hasNewResponse = false;
        this.saveChats(chats);
      }
      clearChatLogs();
      // Reconstruct already-saved messages first
      const col = document.getElementById('chat-col');
      const fragment = document.createDocumentFragment();
      chat.messages.forEach((msg, idx) => {
        const el = createMessageElement(
          msg.role === 'user' ? 'user' : 'ai',
          msg.text, msg.timestamp, idx, this, () => _globalSendCallback, msg.metadata || msg
        );
        if (el) fragment.appendChild(el);
      });
      if (col) col.appendChild(fragment);
      // Then reattach live stream
      thawActiveStream(id, () => {
        if (window.inConversationState) window.inConversationState.val = true;
        document.getElementById('home-screen')?.classList.add('hidden');
        document.getElementById('bottom-input-bar')?.classList.remove('hidden');
      });
      // Sync button state for this chat
      const isGen = window._generatingChats?.has(id) || false;
      if (window._syncGeneratingState) window._syncGeneratingState(isGen);
      if (window.router && window.router.currentPage !== 'chat') {
        window.router.navigateTo('chat');
      }
      this.renderChatsList();
      return;
    }

    this.setActiveChatId(id);

    // Clear hasNewResponse when user opens the chat
    if (chat.hasNewResponse) {
      chat.hasNewResponse = false;
      this.saveChats(chats);
    }

    // Sync per-chat generating state to input buttons when switching chats
    const isGen = window._generatingChats?.has(id) || false;
    if (window._syncGeneratingState) window._syncGeneratingState(isGen);
    window.isGenerating = isGen;

    // Merge consecutive assistant messages in playground/debate chats
    if (chat.isPlayground && chat.messages && chat.messages.length > 1) {
      const merged = [];
      let assistantParts = [];
      chat.messages.forEach(m => {
        if (m.role === 'assistant') {
          if (m.text) assistantParts.push(m.text);
        } else {
          if (assistantParts.length > 0) {
            merged.push({ role: 'assistant', text: assistantParts.join('\n\n'), timestamp: new Date().toISOString() });
            assistantParts = [];
          }
          merged.push(m);
        }
      });
      if (assistantParts.length > 0) {
        merged.push({ role: 'assistant', text: assistantParts.join('\n\n'), timestamp: new Date().toISOString() });
      }
      chat.messages = merged;
      this.saveChats(chats);
    }

    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      try {
        const simplified = chat.messages.map(m => ({ role: m.role, content: m.text }));
        window.socket.send(JSON.stringify({ type: 'sync_session', chat_id: id, messages: simplified }));
      } catch (err) { console.error("Failed to sync session history:", err); }
    }

    clearChatLogs();
    const col = document.getElementById('chat-col');
    const fragment = document.createDocumentFragment();

    chat.messages.forEach((msg, idx) => {
      const toolRuns = (msg.metadata && Array.isArray(msg.metadata)) ? msg.metadata : (msg.metadata?.tool_runs || msg.metadata?.toolRuns || []);
      if (msg.role === 'assistant' && toolRuns && toolRuns.length > 0) {
        const normalizedMsg = {
          ...msg,
          metadata: (typeof msg.metadata === 'object' && !Array.isArray(msg.metadata))
            ? { ...msg.metadata, tool_runs: toolRuns }
            : { tool_runs: toolRuns }
        };
        const toolCard = createToolGroupCard(normalizedMsg, escapeHtml);
        if (toolCard) fragment.appendChild(toolCard);

        toolRuns.forEach(r => {
          if (r.image_path) {
            const renderUrl = `/api/workspace/render?path=${encodeURIComponent(r.image_path)}`;
            const restoredCard = document.createElement('div');
            restoredCard.className = 'chat-image-preview-card';
            restoredCard.innerHTML = `<div class="img-preview-box" style="position:relative; width:100%; border-radius:10px; overflow:hidden; cursor:pointer; background:var(--hover);"><img src="${renderUrl}" alt="Generated Image" loading="lazy" style="width:100%; height:130px; object-fit:cover; display:block; border-radius:10px;" /><a href="${renderUrl}" target="_blank" rel="noopener noreferrer" class="img-redirect-btn" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); color:#fff; width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; text-decoration:none; z-index:5;" title="Open image"><i data-lucide="external-link" style="width:11px; height:11px;"></i></a></div>`;
            const imgEl = restoredCard.querySelector('img');
            if (imgEl) { imgEl.onclick = (e) => { e.stopPropagation(); openImageLightbox(renderUrl); }; imgEl.onerror = () => restoredCard.remove(); }
            fragment.appendChild(restoredCard);
          }
        });
      }

      const el = createMessageElement(
        msg.role === 'user' ? 'user' : 'ai',
        msg.text, msg.timestamp, idx,
        this, () => _globalSendCallback,
        msg.metadata || msg
      );
      if (el) fragment.appendChild(el);
    });
    if (col) col.appendChild(fragment);
    if (window.lucide && col) lucide.createIcons({ parent: col });

    const isNewChat = chat.messages.length === 0;
    if (window.inConversationState) window.inConversationState.val = !isNewChat;
    if (isNewChat) {
      document.getElementById('home-screen')?.classList.remove('hidden');
      document.getElementById('bottom-input-bar')?.classList.add('hidden');
    } else {
      document.getElementById('home-screen')?.classList.add('hidden');
      document.getElementById('bottom-input-bar')?.classList.remove('hidden');
    }

    if (window.router && window.router.currentPage !== 'chat' && !window._debateRunning) {
      window.router.navigateTo('chat');
    }

    scrollChat();
    if (window.setGeneratingState) {
      window.setGeneratingState(false);
    }
    this.renderChatsList();
  },

  renderChatsList() {
    const chats = this.getChats().filter(c => !c.project && !c.archived && !isPlaygroundChat(c));
    chats.sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0, bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return getLatestActivityTime(b) - getLatestActivityTime(a);
    });

    renderRecentChatsList(
      chats,
      _activeChatId,
      (id) => this.loadChat(id),
      (e, id, btn, pinned) => this.toggleDropdown(e, id, btn, pinned),
      (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    );

    // Playground/Arena list — delegated to session_sidebar.js
    const pChats = this.getChats().filter(c => isPlaygroundChat(c) && !c.archived);
    pChats.sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0, bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return getLatestActivityTime(b) - getLatestActivityTime(a);
    });
    renderPlaygroundList(pChats, _activeChatId,
      (id) => this.loadChat(id),
      (e, id, btn, pinned) => this.toggleDropdown(e, id, btn, pinned),
      (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    );

    if (window.lucide) lucide.createIcons();
  },

  closeAllDropdowns() { closeAllDropdowns(); },

  toggleDropdown(e, chatId, optBtn, isPinned) {
    buildDropdown(chatId, optBtn, isPinned, this, showCustomPrompt);
  }
};

window.ChatSessionManager = ChatSessionManager;
window.chatSessionManager = ChatSessionManager;
