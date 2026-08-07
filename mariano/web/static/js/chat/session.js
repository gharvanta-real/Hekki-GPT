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
    try { return JSON.parse(localStorage.getItem('hekki_chats') || '[]'); } catch { return []; }
  },

  saveChats(chats) {
    localStorage.setItem('hekki_chats', JSON.stringify(chats));
    localStorage.setItem('mariano_chats', JSON.stringify(chats));
    if (window.isServerOffline) return;
    fetch('/api/chats/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chats })
    }).catch(() => { console.log("Server sync temporarily unavailable (offline mode)."); });
  },

  createChat(initialText) {
    const chats = this.getChats();
    const truncatedText = initialText.length > 30 ? initialText.substring(0, 30) + '...' : initialText;
    const activeProj = localStorage.getItem('hekki_active_project');
    const newChat = {
      id: 'chat_' + Date.now(),
      title: truncatedText,
      messages: [],
      timestamp: new Date().toISOString(),
      project: activeProj || null,
      pinned: false,
      archived: false
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
      id: 'chat_' + Date.now(),
      title: newTitle,
      messages: clonedMessages,
      timestamp: new Date().toISOString(),
      project: activeProj || null,
      pinned: false,
      archived: false,
      forkedFrom: activeId
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
    const chats = this.getChats();
    const activeId = localStorage.getItem('hekki_active_chat_id');
    const activeChat = chats.find(c => c.id === activeId);
    if (activeId && activeChat && activeChat.isPlayground) {
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
      id: 'playground_' + Date.now(),
      title: truncatedText,
      messages: [],
      timestamp: new Date().toISOString(),
      project: null,
      isPlayground: true,
      pinned: false,
      archived: false
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
    const chats = this.getChats();
    const chat = chats.find(c => c.id === id);
    if (!chat) return;

    this.setActiveChatId(id);

    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      try {
        const simplified = chat.messages.map(m => ({ role: m.role, content: m.text }));
        window.socket.send(JSON.stringify({ type: 'sync_session', chat_id: id, messages: simplified }));
      } catch (err) { console.error("Failed to sync session history:", err); }
    }

    if (chat.isPlayground) {
      import('/static/js/router.js').then(module => {
        module.router.navigateTo('debate');
        if (window.loadDebateHistory) window.loadDebateHistory(chat);
      });
      this.renderChatsList();
      return;
    }

    clearChatLogs();
    const col = document.getElementById('chat-col');

    chat.messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.metadata && msg.metadata.tool_runs && msg.metadata.tool_runs.length > 0) {
        const toolCard = createToolGroupCard(msg, escapeHtml);
        if (col) col.appendChild(toolCard);
        if (window.lucide) lucide.createIcons({ parent: toolCard });

        // Restore generated image cards from tool metadata
        msg.metadata.tool_runs.forEach(r => {
          if (r.image_path) {
            const renderUrl = `/api/workspace/render?path=${encodeURIComponent(r.image_path)}`;
            const restoredCard = document.createElement('div');
            restoredCard.className = 'chat-image-preview-card';
            restoredCard.innerHTML = `
              <div class="img-preview-box" style="position:relative; width:100%; border-radius:10px; overflow:hidden; cursor:pointer; background:var(--hover);">
                <img src="${renderUrl}" alt="Generated Image" loading="lazy" style="width:100%; height:130px; object-fit:cover; display:block; border-radius:10px;" />
                <a href="${renderUrl}" target="_blank" rel="noopener noreferrer" class="img-redirect-btn" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); color:#fff; width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; text-decoration:none; z-index:5;" title="Open image">
                  <i data-lucide="external-link" style="width:11px; height:11px;"></i>
                </a>
              </div>
            `;
            const imgEl = restoredCard.querySelector('img');
            if (imgEl) {
              imgEl.onclick = (e) => { e.stopPropagation(); openImageLightbox(renderUrl); };
              imgEl.onerror = () => restoredCard.remove();
            }
            if (col) col.appendChild(restoredCard);
            if (window.lucide) lucide.createIcons({ parent: restoredCard });
          }
        });
      }

      const el = createMessageElement(
        msg.role === 'user' ? 'user' : 'ai',
        msg.text, msg.timestamp, idx,
        this, () => _globalSendCallback,
        msg.metadata || msg
      );
      if (col && el) col.appendChild(el);
    });

    const isNewChat = chat.messages.length === 0;
    if (window.inConversationState) window.inConversationState.val = !isNewChat;
    if (isNewChat) {
      document.getElementById('home-screen')?.classList.remove('hidden');
      document.getElementById('bottom-input-bar')?.classList.add('hidden');
    } else {
      document.getElementById('home-screen')?.classList.add('hidden');
      document.getElementById('bottom-input-bar')?.classList.remove('hidden');
    }

    scrollChat();
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

    if (chatList) {
      const chats = this.getChats().filter(c => !c.project && !c.archived && !c.isPlayground);
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

          const cleanTitle = (c.title || '').replace(/^🔀\s*/, '');
          item.title = cleanTitle;

          let badgeContent = '';
          if (c.pinned) {
            badgeContent = '<i data-lucide="pin" style="width:14px; height:14px; stroke-width:2.2px; display:inline-block;"></i>';
          } else if (c.forkedFrom || cleanTitle.toLowerCase().startsWith('branch:')) {
            badgeContent = '<i data-lucide="git-fork" style="width:14px; height:14px; stroke-width:2.2px; display:inline-block;"></i>';
          } else {
            const firstChar = Array.from(cleanTitle)[0] || 'C';
            badgeContent = firstChar.toUpperCase();
          }

          item.innerHTML = `
            <span class="lbl">${c.pinned ? '<i data-lucide="pin" style="width:12px; height:12px; margin-right:6px; color:var(--text-3); vertical-align:-1px;"></i>' : ''}${escapeHtml(cleanTitle)}</span>
            <span class="opt" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px">
              <i data-lucide="more-horizontal" style="width:14px; height:14px; pointer-events:none"></i>
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
      const pChats = this.getChats().filter(c => c.isPlayground && !c.archived);
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
          const item = document.createElement('div');
          item.className = 'section-item';
          if (c.id === _activeChatId) item.classList.add('active');
          item.title = c.title;
          item.innerHTML = `
            <span class="lbl" style="display:flex; align-items:center; gap:6px;">
              <i data-lucide="swords" style="width:13px; height:13px; color:var(--accent, #2563eb); flex-shrink:0;"></i>
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.title)}</span>
            </span>
            <span class="opt" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px">
              <i data-lucide="more-horizontal" style="width:14px; height:14px; pointer-events:none"></i>
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
      <button class="chat-dropdown-item open-opt"><i data-lucide="message-square"></i> Open</button>
      <button class="chat-dropdown-item pin-opt"><i data-lucide="${isPinned ? 'pin-off' : 'pin'}"></i> ${isPinned ? 'Unpin' : 'Pin'}</button>
      <button class="chat-dropdown-item rename-opt"><i data-lucide="pencil"></i> Rename</button>
      <button class="chat-dropdown-item archive-opt"><i data-lucide="archive"></i> Archive</button>
      <button class="chat-dropdown-item delete-opt delete"><i data-lucide="trash-2"></i> Delete</button>
    `;
    dropdown.querySelector('.open-opt').addEventListener('click', () => { this.loadChat(chatId); this.closeAllDropdowns(); });
    dropdown.querySelector('.pin-opt').addEventListener('click', () => { this.togglePinChat(chatId); this.closeAllDropdowns(); });
    dropdown.querySelector('.rename-opt').addEventListener('click', async () => {
      const currentTitle = parentItem ? parentItem.getAttribute('data-title') : (optBtn.parentNode.title || '');
      this.closeAllDropdowns();
      const newTitle = await showCustomPrompt('Rename Chat', 'Enter a new title for this conversation:', currentTitle);
      if (newTitle && newTitle.trim()) this.renameChat(chatId, newTitle.trim());
    });
    dropdown.querySelector('.archive-opt').addEventListener('click', () => { this.archiveChat(chatId); this.closeAllDropdowns(); });
    dropdown.querySelector('.delete-opt').addEventListener('click', async () => {
      this.closeAllDropdowns();
      const yes = await showCustomConfirm('Delete Chat', 'Are you sure you want to delete this conversation?');
      if (yes) this.deleteChat(chatId);
    });
    optBtn.parentNode.appendChild(dropdown);
    if (window.lucide) lucide.createIcons({ parent: dropdown });
    const closeHandler = (ev) => {
      if (!dropdown.contains(ev.target) && ev.target !== optBtn) { this.closeAllDropdowns(); document.removeEventListener('click', closeHandler); }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 50);
  }
};
