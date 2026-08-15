/* === chat/session.js — ChatSessionManager: CRUD, load, render list, dropdown === */
import { showCustomConfirm, showCustomPrompt, openImageLightbox } from './dialogs.js';
import { scrollChat, clearChatLogs, setActiveChatId as _setActive } from './input.js';
import { createMessageElement, createToolGroupCard } from './messages.js';
import { enhanceImagePreviews } from './media.js';
import { escapeHtml } from './input.js';

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
    // GUARD 1: Never interrupt a live streaming debate — it renders directly into DOM
    // and hasn't been saved to chat.messages yet during streaming.
    if (window._debateRunning) return;

    const chats = this.getChats();
    const chat = chats.find(c => c.id === id);
    if (!chat) return;

    // GUARD 2: If clicking the already-active playground chat and it has 0 messages,
    // the DOM still holds whatever debate_mode.js rendered — don't wipe it.
    // This happens if the user clicks the sidebar item before session data is saved.
    if (chat.isPlayground && chat.messages.length === 0 && id === _activeChatId) {
      if (window.router && window.router.currentPage !== 'chat') {
        window.router.navigateTo('chat');
      }
      this.renderChatsList();
      return;
    }

    this.setActiveChatId(id);

    // Merge consecutive assistant messages in playground/debate chats to eliminate multiple action bars
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

    // All chats (including playground/debate ones) load into the main chat pane.
    // Legacy redirect to debate-pane removed — playground chats now live in main chat.
    clearChatLogs();
    const col = document.getElementById('chat-col');
    // [H-1] Use DocumentFragment for batch DOM insertion (prevents N reflows)
    const fragment = document.createDocumentFragment();

    chat.messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.metadata && msg.metadata.tool_runs && msg.metadata.tool_runs.length > 0) {
        const toolCard = createToolGroupCard(msg, escapeHtml);
        if (toolCard) fragment.appendChild(toolCard);

        // Restore generated image cards from tool metadata
        msg.metadata.tool_runs.forEach(r => {
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
    // Append entire fragment in one operation
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

    // Always switch to the main chat view after loading any chat —
    // but skip if a live debate is running (would wipe the debate UI).
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
    const chatList = document.getElementById('recent-list');
    const playgroundList = document.getElementById('playground-list');
    const playgroundSection = document.getElementById('nav-section-playground');

    const getLatestActivityTime = (c) => {
      if (!c) return 0;
      if (c.messages && c.messages.length > 0) {
        for (let i = c.messages.length - 1; i >= 0; i--) {
          const m = c.messages[i];
          if (m && m.timestamp) {
            const t = new Date(m.timestamp).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
        }
      }
      if (c.timestamp) {
        const t = new Date(c.timestamp).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (c.id && c.id.includes('_')) {
        const parts = c.id.split('_');
        const tsFromId = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(tsFromId) && tsFromId > 1000000000) return tsFromId;
      }
      return 0;
    };

    const isPlaygroundChat = (c) => Boolean(c && (
      c.isPlayground ||
      c.isDebate ||
      (c.id && (String(c.id).startsWith('playground_') || String(c.id).startsWith('debate_')))
    ));

    if (chatList) {
      const chats = this.getChats().filter(c => !c.project && !c.archived && !isPlaygroundChat(c));
      chats.sort((a, b) => {
        const aPinned = a.pinned ? 1 : 0, bPinned = b.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return getLatestActivityTime(b) - getLatestActivityTime(a);
      });
      chatList.innerHTML = '';
      if (chats.length === 0) {
        chatList.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:8px 6px">No recent chats.</div>';
      } else {
        chats.forEach(c => {
          const item = document.createElement('div');
          item.className = 'section-item';
          if (c.id === _activeChatId) item.classList.add('active');

          const cleanTitle = (c.title || '').replace(/^🔀\s*/, '').replace(/^\/(?:debate|detective|web|code|pdf|image)\s*/i, '').trim() || c.title;
          item.title = cleanTitle;

          let badgeContent = '';
          if (c.pinned) {
            badgeContent = '<i data-lucide="pin" style="width:14px;height:14px;"></i>';
          } else if (c.forkedFrom || cleanTitle.toLowerCase().startsWith('branch:')) {
            badgeContent = '<i data-lucide="git-fork" style="width:14px;height:14px;"></i>';
          } else {
            const firstChar = Array.from(cleanTitle)[0] || 'C';
            badgeContent = firstChar.toUpperCase();
          }

          item.innerHTML = `
            <span class="lbl">${c.pinned ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 32 32" fill="currentColor" style="width:12px;height:12px;margin-right:6px;color:var(--text-3);display:inline-block;vertical-align:-1px;"><path d="M22.41,16.59,20,14.17V5h1V3H11V5h1V14.17L9.59,16.59A2,2,0,0,0,9,18v2h6v7h2V20h6V18A2,2,0,0,0,22.41,16.59Z"/></svg>' : ''}${escapeHtml(cleanTitle)}</span>
            <span class="opt" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; margin-left:auto; flex-shrink:0;">
              <i data-lucide="more-vertical" style="width:14px; height:14px; pointer-events:none;"></i>
            </span>
          `;
          item.addEventListener('click', (e) => {
            if (e.target.classList.contains('opt') || e.target.closest('.opt')) return;
            this.loadChat(c.id);
          });
          const optBtn = item.querySelector('.opt');
          optBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleDropdown(e, c.id, optBtn, c.pinned); });
          chatList.appendChild(item);
        });
        if (window.lucide) lucide.createIcons({ parent: chatList });
      }
    }

    if (playgroundList) {
      const pChats = this.getChats().filter(c => isPlaygroundChat(c) && !c.archived);
      pChats.sort((a, b) => {
        const aPinned = a.pinned ? 1 : 0, bPinned = b.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return getLatestActivityTime(b) - getLatestActivityTime(a);
      });
      playgroundList.innerHTML = '';
      const countBadge = document.getElementById('playground-count');
      if (countBadge) countBadge.textContent = pChats.length;

      if (pChats.length > 0) {
        if (playgroundSection) playgroundSection.style.display = 'block';

        // Collapsible header toggle setup
        const pgHdr = document.getElementById('hdr-section-playground');
        const pgChevron = document.getElementById('chevron-playground');
        if (pgHdr && !pgHdr._boundCollapse) {
          pgHdr._boundCollapse = true;
          pgHdr.addEventListener('click', () => {
            const currentlyHidden = playgroundList.style.display === 'none';
            playgroundList.style.display = currentlyHidden ? 'block' : 'none';
            if (pgChevron) pgChevron.style.transform = currentlyHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
            localStorage.setItem('hekki_pg_collapsed', currentlyHidden ? 'false' : 'true');
          });
        }

        const isCollapsed = localStorage.getItem('hekki_pg_collapsed') === 'true';
        playgroundList.style.display = isCollapsed ? 'none' : 'block';
        if (pgChevron) pgChevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';

        pChats.forEach(c => {
          const cleanPgTitle = (c.title || '').replace(/^🔀\s*/, '').replace(/^\/(?:debate|detective|web|code|pdf|image)\s*/i, '').trim() || c.title;
          const item = document.createElement('div');
          item.className = 'section-item';
          if (c.id === _activeChatId) item.classList.add('active');
          item.title = cleanPgTitle;
          item.innerHTML = `
            <span class="lbl">${escapeHtml(cleanPgTitle)}</span>
            <span class="opt" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; margin-left:auto; flex-shrink:0;">
              <i data-lucide="more-vertical" style="width:14px; height:14px; pointer-events:none;"></i>
            </span>
          `;

          item.addEventListener('click', (e) => {
            if (e.target.classList.contains('opt') || e.target.closest('.opt')) return;
            this.loadChat(c.id);
          });
          const optBtn = item.querySelector('.opt');
          optBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleDropdown(e, c.id, optBtn, c.pinned); });
          playgroundList.appendChild(item);
        });
      } else {
        if (playgroundSection) playgroundSection.style.display = 'none';
      }
    }

    if (window.lucide) lucide.createIcons();
  },

  closeAllDropdowns() {
    document.querySelectorAll('.chat-dropdown').forEach(d => d.remove());
    document.querySelectorAll('.section-item.dropdown-open').forEach(item => {
      item.classList.remove('dropdown-open');
      const savedTitle = item.getAttribute('data-title');
      if (savedTitle) { item.setAttribute('title', savedTitle); item.removeAttribute('data-title'); }
    });
    if (window._dropdownCloseHandler) {
      document.removeEventListener('click', window._dropdownCloseHandler);
      window._dropdownCloseHandler = null;
    }
  },

  toggleDropdown(e, chatId, optBtn, isPinned) {
    this.closeAllDropdowns();
    const parentItem = optBtn.closest('.section-item');
    if (parentItem) {
      parentItem.classList.add('dropdown-open');
      const title = parentItem.getAttribute('title');
      if (title) { parentItem.setAttribute('data-title', title); parentItem.removeAttribute('title'); }
    }
    const dropdown = document.createElement('div');
    dropdown.className = 'chat-dropdown';
    dropdown.innerHTML = `
      <button class="chat-dropdown-item open-opt"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M16,19a6.9908,6.9908,0,0,1-5.833-3.1287l1.666-1.1074a5.0007,5.0007,0,0,0,8.334,0l1.666,1.1074A6.9908,6.9908,0,0,1,16,19Z"/><path d="M20,8a2,2,0,1,0,2,2A1.9806,1.9806,0,0,0,20,8Z"/><path d="M12,8a2,2,0,1,0,2,2A1.9806,1.9806,0,0,0,12,8Z"/><path d="M17.7358,30,16,29l4-7h6a1.9966,1.9966,0,0,0,2-2V6a1.9966,1.9966,0,0,0-2-2H6A1.9966,1.9966,0,0,0,4,6V20a1.9966,1.9966,0,0,0,2,2h9v2H6a3.9993,3.9993,0,0,1-4-4V6A3.9988,3.9988,0,0,1,6,2H26a3.9988,3.9988,0,0,1,4,4V20a3.9993,3.9993,0,0,1-4,4H21.1646Z"/></svg> Open</button>
      <button class="chat-dropdown-item pin-opt"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M28.59,13.31,30,11.9,20,2,18.69,3.42,19.87,4.6,8.38,14.32,6.66,12.61,5.25,14l5.66,5.68L2,28.58,3.41,30l8.91-8.91L18,26.75l1.39-1.42-1.71-1.71L27.4,12.13ZM16.26,22.2,9.8,15.74,21.29,6,26,10.71Z"/></svg> ${isPinned ? 'Unpin' : 'Pin'}</button>
      <button class="chat-dropdown-item rename-opt"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M18,30H4A2,2,0,0,1,2,28V6A2,2,0,0,1,4,4H20a2,2,0,0,1,2,2v8H20V6H4V28H18Z"/><path d="M26.41,18.59,28,17,21,10H14v7l7,7,1.59-1.59L17.41,17H16V15.59l6.59-6.59L25.17,11Z"/></svg> Rename</button>
      <button class="chat-dropdown-item archive-opt"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M20,21H12a2,2,0,0,1-2-2V17a2,2,0,0,1,2-2h8a2,2,0,0,1,2,2v2A2,2,0,0,1,20,21Zm-8-4v2h8V17Z"/><path d="M28,4H4A2,2,0,0,0,2,6v4a2,2,0,0,0,2,2V28a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V12a2,2,0,0,0,2-2V6A2,2,0,0,0,28,4ZM26,28H6V12H26Zm2-18H4V6H28v4Z"/></svg> Archive</button>
      <button class="chat-dropdown-item delete-opt delete" style="color:#ef4444 !important;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;color:#ef4444;"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg> <span style="color:#ef4444 !important;">Delete</span></button>
    `;
    if (window.lucide) lucide.createIcons({ parent: dropdown });
    dropdown.querySelector('.open-opt').addEventListener('click', () => { this.loadChat(chatId); this.closeAllDropdowns(); });
    dropdown.querySelector('.pin-opt').addEventListener('click', () => { this.togglePinChat(chatId); this.closeAllDropdowns(); });
    dropdown.querySelector('.rename-opt').addEventListener('click', async () => {
      const currentTitle = parentItem ? parentItem.getAttribute('data-title') : (optBtn.parentNode.title || '');
      this.closeAllDropdowns();
      const newTitle = await showCustomPrompt('Rename Chat', 'Enter a new title for this conversation:', currentTitle);
      if (newTitle && newTitle.trim()) this.renameChat(chatId, newTitle.trim());
    });
    dropdown.querySelector('.archive-opt').addEventListener('click', () => { this.archiveChat(chatId); this.closeAllDropdowns(); });
    dropdown.querySelector('.delete-opt').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      this.deleteChat(chatId);
    });
    optBtn.parentNode.appendChild(dropdown);
    if (window.lucide) lucide.createIcons({ parent: dropdown });
    const closeHandler = (ev) => {
      if (!dropdown.contains(ev.target) && ev.target !== optBtn) { this.closeAllDropdowns(); }
    };
    window._dropdownCloseHandler = closeHandler;
    setTimeout(() => document.addEventListener('click', closeHandler), 50);
  }
};

window.ChatSessionManager = ChatSessionManager;
window.chatSessionManager = ChatSessionManager;
