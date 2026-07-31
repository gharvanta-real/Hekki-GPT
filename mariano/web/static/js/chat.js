/* === CHAT MODULE === */
import { attachmentManager } from './components/attachment_manager.js';

// Configure marked parser options and custom link renderer
if (window.marked) {
  try {
    window.marked.use({
      gfm: true,
      breaks: true,
      renderer: {
        link({ href, title, text }) {
          if (!href) return text || '';
          const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
          const isExternal = /^https?:\/\//i.test(href) || /^www\./i.test(href);
          const isFile = /^file:\/\/\//i.test(href);
          const fullHref = /^www\./i.test(href) ? `https://${href}` : href;
          const target = (isExternal || isFile) ? ' target="_blank" rel="noopener noreferrer"' : '';
          
          let linkClass = 'chat-link';
          let iconMarkup = '';
          if (isExternal) {
            linkClass += ' external-link';
            iconMarkup = `<i data-lucide="external-link" class="chat-link-icon"></i>`;
          } else if (isFile) {
            linkClass += ' file-link';
            iconMarkup = `<i data-lucide="file-text" class="chat-link-icon"></i>`;
          }
          
          return `<a href="${escapeHtml(fullHref)}"${titleAttr}${target} class="${linkClass}">${text || href}${iconMarkup}</a>`;
        }
      }
    });
  } catch (e) {
    console.warn('Failed to set custom marked options:', e);
  }
}

let activeChatId = localStorage.getItem('hekki_active_chat_id') || null;
let globalSendCallback = null;

export const ChatSessionManager = {
  getChats() {
    try {
      return JSON.parse(localStorage.getItem('hekki_chats') || '[]');
    } catch {
      return [];
    }
  },
  
  saveChats(chats) {
    localStorage.setItem('hekki_chats', JSON.stringify(chats));
    if (window.isServerOffline) return;
    // Asynchronously write-through the updated chats list to SQLite server database
    fetch('/api/chats/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chats })
    }).catch(err => {
      console.log("Server sync temporarily unavailable (offline mode).");
    });
  },

  
  getActiveChatId() {
    return activeChatId;
  },
  
  setActiveChatId(id) {
    activeChatId = id;
    if (id) {
      localStorage.setItem('hekki_active_chat_id', id);
      const chat = this.getChats().find(c => c.id === id);
      if (chat && window.updateTitleBreadcrumb) {
        window.updateTitleBreadcrumb(chat.project || localStorage.getItem('hekki_active_project'), chat.title);
      }
    } else {
      localStorage.removeItem('hekki_active_chat_id');
      if (window.updateTitleBreadcrumb) {
        window.updateTitleBreadcrumb(localStorage.getItem('hekki_active_project'), '');
      }
    }
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
    activeChatId = newChat.id;
    localStorage.setItem('hekki_active_chat_id', newChat.id);
    this.renderChatsList();
    return newChat;
  },
  
  appendMessage(role, text, metadata = null) {
    if (!activeChatId) {
      this.createChat(text);
    }
    const chats = this.getChats();
    const chat = chats.find(c => c.id === activeChatId);
    if (chat) {
      // Prevent double appending same message
      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg && lastMsg.role === role && lastMsg.text === text) return;
      chat.messages.push({ role, text, timestamp: new Date().toISOString(), metadata });
      this.saveChats(chats);
    }
  },

  
  deleteChat(id) {
    let chats = this.getChats();
    chats = chats.filter(c => c.id !== id);
    this.saveChats(chats);
    if (activeChatId === id) {
      activeChatId = null;
      localStorage.removeItem('hekki_active_chat_id');
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
      if (id === activeChatId && window.updateTitleBreadcrumb) {
        window.updateTitleBreadcrumb(chat.project || localStorage.getItem('hekki_active_project'), chat.title);
      }
    }
    this.renderChatsList();
  },

  togglePinChat(id) {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === id);
    if (chat) {
      chat.pinned = !chat.pinned;
      this.saveChats(chats);
    }
    this.renderChatsList();
  },

  archiveChat(id) {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === id);
    if (chat) {
      chat.archived = true;
      this.saveChats(chats);
      if (activeChatId === id) {
        activeChatId = null;
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
      // Find the most recent normal chat
      const normalChats = chats.filter(c => !c.isPlayground && !c.project && !c.archived);
      if (normalChats.length > 0) {
        normalChats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        this.loadChat(normalChats[0].id);
      } else {
        // No normal chats exist, reset active chat completely to greet screen
        this.setActiveChatId(null);
        clearChatLogs();
        const homeScreen = document.getElementById('home-screen');
        if (homeScreen) homeScreen.classList.remove('hidden');
        const inputBar = document.getElementById('bottom-input-bar');
        if (inputBar) inputBar.classList.add('hidden');
        if (window.inConversationState) {
          window.inConversationState.val = false;
        }
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
    activeChatId = newChat.id;
    localStorage.setItem('hekki_active_chat_id', newChat.id);
    this.renderChatsList();
    return newChat;
  },

  appendPlaygroundMessage(role, text, extra = {}) {
    if (!activeChatId) return;
    const chats = this.getChats();
    const chat = chats.find(c => c.id === activeChatId);
    if (chat && chat.isPlayground) {
      chat.messages.push({
        role,
        text,
        timestamp: new Date().toISOString(),
        ...extra
      });
      this.saveChats(chats);
    }
  },

  updateLastPlaygroundMessage(text) {
    if (!activeChatId) return;
    const chats = this.getChats();
    const chat = chats.find(c => c.id === activeChatId);
    if (chat && chat.isPlayground && chat.messages.length > 0) {
      chat.messages[chat.messages.length - 1].text = text;
      this.saveChats(chats);
    }
  },
  
  loadChat(id) {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    
    activeChatId = id;
    localStorage.setItem('hekki_active_chat_id', id);

    // Sync session history to backend WebSocket
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
      try {
        const simplified = chat.messages.map(m => ({
          role: m.role,
          content: m.text
        }));
        window.socket.send(JSON.stringify({
          type: 'sync_session',
          chat_id: id,
          messages: simplified
        }));
      } catch (err) {
        console.error("Failed to sync session history:", err);
      }
    }

    if (chat.isPlayground) {
      // 1. Navigate to debate view via router
      import('/static/js/router.js').then(module => {
        module.router.navigateTo('debate');
        // 2. Call the debate history rendering callback
        if (window.loadDebateHistory) {
          window.loadDebateHistory(chat);
        }
      });
      this.renderChatsList();
      return;
    }
    
    // Clear chat log (preserve home-screen by removing all other siblings)
    clearChatLogs();
    
    const col = document.getElementById('chat-col');
    // Append all messages
    chat.messages.forEach((msg, idx) => {
      // Restore collapsible tool container & nested reasoning cards if present in metadata
      if (msg.role === 'assistant' && msg.metadata && msg.metadata.tool_runs && msg.metadata.tool_runs.length > 0) {
        const toolCard = document.createElement('div');
        toolCard.className = 'tool-group-card';
        toolCard.style.cssText = 'margin: 6px 0; display: flex; flex-direction: column; font-family: var(--font); font-size: 12px; color: var(--text-3);';
        
        const count = msg.metadata.tool_runs.length;
        const runs = msg.metadata.tool_runs;
        const hasFailed = runs.some(r => r.status === 'failed');
        const statusHtml = hasFailed 
          ? '<span style="color: #ef4444;">✖ failed</span>' 
          : '<span style="color: var(--text-3);">✓ completed</span>';
          
        toolCard.innerHTML = `
          <div class="tool-group-header" style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; cursor: pointer; user-select: none;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="chevron-icon" style="transition: transform 0.15s; font-size: 10px; opacity: 0.5;">▸</span>
              <span class="tool-group-title" style="font-weight: 500; color: var(--text-secondary);">Actions</span>
            </div>
            <span class="tool-group-status" style="font-size: 11px; opacity: 0.6;">${statusHtml}</span>
          </div>
          <div class="tool-group-body" style="display: none; flex-direction: column; padding-left: 14px; border-left: 1px dashed var(--border); margin-left: 4px; margin-top: 2px; gap: 3px;">
            ${runs.map(r => {
              const statusSpan = r.status === 'done'
                ? '<span style="color: var(--text-3);">✓ done</span>'
                : '<span style="color: #ef4444;">✖ failed</span>';
              
              const reasoningHtml = r.reasoning
                ? `<div class="ai-reasoning-card" style="margin: 3px 0 6px 14px; padding: 3px 0 3px 10px; border-left: 1px dashed var(--border); background: transparent; font-size: 11.5px; font-family: var(--font); color: var(--text-3); line-height: 1.55; opacity: 0.9;"><div style="white-space:pre-wrap;word-break:break-word;"><span>${escapeHtml(r.reasoning)}</span></div></div>`
                : '';
              
              const iconToUse = r.icon || '▸';

              return `
                <div class="tool-log-card" style="display:flex; align-items:center; justify-content:space-between; margin:3px 0 4px 0; padding:4px 0; background:transparent; font-size:12px; font-family:var(--font); color:var(--text-3); gap:10px;">
                  <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
                    <span style="flex-shrink:0; opacity:0.5;">${escapeHtml(iconToUse)}</span>
                    <span style="font-weight:500; color:var(--text-secondary); white-space:nowrap;">${escapeHtml(r.label || '')}</span>
                    <span class="tool-detail" style="color:var(--text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:340px;">${r.detail || ''}</span>
                  </div>
                  <span class="tool-status" style="flex-shrink:0; font-size:11px; color:var(--text-3); white-space:nowrap; opacity:0.6;">${statusSpan}</span>
                </div>
                ${reasoningHtml}
              `;
            }).join('')}
          </div>
        `;
        
        if (col) col.appendChild(toolCard);
        
        const header = toolCard.querySelector('.tool-group-header');
        const body = toolCard.querySelector('.tool-group-body');
        const chevron = toolCard.querySelector('.chevron-icon');
        if (header && body) {
          header.addEventListener('click', () => {
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'flex' : 'none';
            if (chevron) {
              chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
              chevron.textContent = isHidden ? '▼' : '▸';
            }
          });
        }

        // ── Restore generated image cards that survived serialisation ─────────
        // Any tool run with an image_path was a successful generate_image call.
        // Re-render the preview card so images appear after page refresh,
        // matching how ChatGPT persists media in conversation history.
        runs.forEach(r => {
          if (r.image_path) {
            const renderUrl = `/api/workspace/render?path=${encodeURIComponent(r.image_path)}`;
            const restoredCard = document.createElement('div');
            restoredCard.className = 'chat-image-preview-card';
            restoredCard.innerHTML = `
              <div class="chat-image-preview-body">
                <img src="${renderUrl}" alt="Generated Image" loading="lazy" />
              </div>
              <div class="chat-image-preview-header">
                <i data-lucide="image" style="width:12px;height:12px;flex-shrink:0;"></i>
                <span>Generated Image</span>
                <a href="${renderUrl}" target="_blank" class="chat-image-preview-open" title="Open original image">
                  <i data-lucide="external-link" style="width:12px;height:12px;"></i>
                </a>
              </div>
            `;
            const imgEl = restoredCard.querySelector('img');
            if (imgEl) {
              imgEl.onload = () => {
                if (imgEl.clientWidth > 0) restoredCard.style.width = imgEl.clientWidth + 'px';
              };
              imgEl.onerror = () => restoredCard.remove();
            }
            if (col) col.appendChild(restoredCard);
            if (window.lucide) lucide.createIcons({ parent: restoredCard });
          }
        });
      }

      const el = createMessageElement(msg.role === 'user' ? 'user' : 'ai', msg.text, msg.timestamp, idx);
      if (col && el) col.appendChild(el);
    });
    
    // Set UI mode based on message count (empty chats show home greeting screen)
    const isNewChat = chat.messages.length === 0;
    if (window.inConversationState) {
      window.inConversationState.val = !isNewChat;
    }
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
    
    const formatTimeDiff = (timestamp) => {
      if (!timestamp) return '';
      const diffMs = Date.now() - new Date(timestamp).getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins || 1}m`;
      }
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d`;
    };

    // 1. Render Normal Chats
    if (chatList) {
      const chats = this.getChats().filter(c => !c.project && !c.archived && !c.isPlayground);
      chats.sort((a, b) => {
        const aPinned = a.pinned ? 1 : 0;
        const bPinned = b.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      chatList.innerHTML = '';
      if (chats.length === 0) {
        chatList.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:8px 6px">No recent chats.</div>';
      } else {
        chats.forEach(c => {
          const item = document.createElement('div');
          item.className = 'section-item';
          if (c.id === activeChatId) item.classList.add('active');
          item.title = c.title;
          
          const badgeText = c.pinned ? '📌' : c.title.substring(0, 1).toUpperCase();
          item.innerHTML = `
            <span class="badge" style="${c.pinned ? 'font-size:11px;' : ''}">${badgeText}</span>
            <span class="lbl">${c.title}</span>
            <span class="opt" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px">
              <i data-lucide="more-horizontal" style="width:14px; height:14px; pointer-events:none"></i>
            </span>
          `;
          
          item.addEventListener('click', (e) => {
            if (e.target.classList.contains('opt') || e.target.closest('.opt')) return;
            this.loadChat(c.id);
          });
          
          const optBtn = item.querySelector('.opt');
          optBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(e, c.id, optBtn, c.pinned);
          });
          chatList.appendChild(item);
        });
      }
    }

    // 2. Render Playground Chats
    if (playgroundList) {
      const pChats = this.getChats().filter(c => c.isPlayground && !c.archived);
      pChats.sort((a, b) => {
        const aPinned = a.pinned ? 1 : 0;
        const bPinned = b.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      playgroundList.innerHTML = '';
      if (pChats.length > 0) {
        if (playgroundSection) playgroundSection.style.display = 'block';
        pChats.forEach(c => {
          const item = document.createElement('div');
          item.className = 'section-item';
          if (c.id === activeChatId) item.classList.add('active');
          item.title = c.title;
          
          const badgeText = c.pinned ? '📌' : '⚔';
          item.innerHTML = `
            <span class="badge" style="font-size:10px; background:var(--border); display:flex; align-items:center; justify-content:center">${badgeText}</span>
            <span class="lbl">${c.title}</span>
            <span class="opt" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px">
              <i data-lucide="more-horizontal" style="width:14px; height:14px; pointer-events:none"></i>
            </span>
          `;
          
          item.addEventListener('click', (e) => {
            if (e.target.classList.contains('opt') || e.target.closest('.opt')) return;
            this.loadChat(c.id);
          });
          
          const optBtn = item.querySelector('.opt');
          optBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(e, c.id, optBtn, c.pinned);
          });
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
      if (savedTitle) {
        item.setAttribute('title', savedTitle);
        item.removeAttribute('data-title');
      }
    });
  },

  toggleDropdown(e, chatId, optBtn, isPinned) {
    this.closeAllDropdowns();
    
    const parentItem = optBtn.closest('.section-item');
    if (parentItem) {
      parentItem.classList.add('dropdown-open');
      const title = parentItem.getAttribute('title');
      if (title) {
        parentItem.setAttribute('data-title', title);
        parentItem.removeAttribute('title');
      }
    }
    
    const dropdown = document.createElement('div');
    dropdown.className = 'chat-dropdown';
    
    dropdown.innerHTML = `
      <button class="chat-dropdown-item open-opt">
        <i data-lucide="message-square"></i> Open
      </button>
      <button class="chat-dropdown-item pin-opt">
        <i data-lucide="${isPinned ? 'pin-off' : 'pin'}"></i> ${isPinned ? 'Unpin' : 'Pin'}
      </button>
      <button class="chat-dropdown-item rename-opt">
        <i data-lucide="pencil"></i> Rename
      </button>
      <button class="chat-dropdown-item archive-opt">
        <i data-lucide="archive"></i> Archive
      </button>
      <button class="chat-dropdown-item delete-opt delete">
        <i data-lucide="trash-2"></i> Delete
      </button>
    `;
    
    dropdown.querySelector('.open-opt').addEventListener('click', () => {
      this.loadChat(chatId);
      this.closeAllDropdowns();
    });

    dropdown.querySelector('.pin-opt').addEventListener('click', () => {
      this.togglePinChat(chatId);
      this.closeAllDropdowns();
    });
    
    dropdown.querySelector('.rename-opt').addEventListener('click', async () => {
      const currentTitle = parentItem ? parentItem.getAttribute('data-title') : (optBtn.parentNode.title || '');
      this.closeAllDropdowns();
      const newTitle = await showCustomPrompt('Rename Chat', 'Enter a new title for this conversation:', currentTitle);
      if (newTitle && newTitle.trim()) {
        this.renameChat(chatId, newTitle.trim());
      }
    });

    dropdown.querySelector('.archive-opt').addEventListener('click', () => {
      this.archiveChat(chatId);
      this.closeAllDropdowns();
    });
    
    dropdown.querySelector('.delete-opt').addEventListener('click', async () => {
      this.closeAllDropdowns();
      const yes = await showCustomConfirm('Delete Chat', 'Are you sure you want to delete this conversation?');
      if (yes) {
        this.deleteChat(chatId);
      }
    });
    
    optBtn.parentNode.appendChild(dropdown);
    
    if (window.lucide) lucide.createIcons({ parent: dropdown });
    
    const closeHandler = (ev) => {
      if (!dropdown.contains(ev.target) && ev.target !== optBtn) {
        this.closeAllDropdowns();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 50);
  }
};

/** Render a single message DOM node with full Claude-style actions */
function createMessageElement(type, text, timestamp, index) {
  const timeStr = formatTime(timestamp);

  if (type === 'ai') {
    if (text) {
      const lines = text.split('\n');
      const filteredLines = lines.filter(line => !line.trim().startsWith('[Tool:'));
      text = filteredLines.join('\n').trim();
    }
    if (!text) return null;
  }

  if (type === 'user') {
    // User message wrapped in container group with bottom action bar
    const group = document.createElement('div');
    group.className = 'msg-group user';
    group.dataset.index = index;

    // Parse image attachments if present
    const imgRegex = /\[Attached Image:\s*([^\(]+)\s*\(saved at ([^\]]+)\)\]/g;
    let match;
    const imageCards = [];

    while ((match = imgRegex.exec(text)) !== null) {
      const fileName = match[1].trim();
      const rawPath = match[2].trim();
      const renderUrl = (rawPath.startsWith('data:') || rawPath.startsWith('http'))
        ? rawPath
        : `/api/workspace/render?path=${encodeURIComponent(rawPath)}`;

      imageCards.push(`
        <div style="align-self: flex-end; margin-bottom: 4px; border-radius: 12px; overflow: hidden; width: 120px; height: 120px; border: 1px solid var(--border); flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.12);">
          <img src="${renderUrl}" alt="${escapeHtml(fileName)}" style="width: 120px; height: 120px; object-fit: cover; display: block;" />
        </div>
      `);
    }

    if (imageCards.length > 0) {
      const imgContainer = document.createElement('div');
      imgContainer.style.display = 'flex';
      imgContainer.style.flexDirection = 'column';
      imgContainer.style.alignItems = 'flex-end';
      imgContainer.style.gap = '4px';
      imgContainer.innerHTML = imageCards.join('');
      group.appendChild(imgContainer);
    }

    let cleanText = text.replace(/\[Attached Image:[^\]]+\]/g, '').replace(/\[Attached File:[^\]]+\]/g, '').replace(/\[Active Workspace Context:[^\]]+\]/g, '').trim();
    if (cleanText) {
      const bubble = document.createElement('div');
      bubble.className = 'msg user';
      bubble.innerHTML = escapeHtml(cleanText);
      group.appendChild(bubble);
    }

    // Actions bar below bubble
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actions.innerHTML = `
      <span class="action-time">${timeStr}</span>
      <button class="action-btn btn-copy" title="Copy text">
        <i data-lucide="copy"></i>
      </button>
      <button class="action-btn btn-edit" title="Edit prompt">
        <i data-lucide="pencil"></i>
      </button>
      <button class="action-btn btn-retry" title="Retry generation">
        <i data-lucide="refresh-cw"></i>
      </button>
    `;
    group.appendChild(actions);

    // Bind action callbacks
    actions.querySelector('.btn-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        const copyIcon = actions.querySelector('.btn-copy i');
        if (copyIcon) {
          copyIcon.setAttribute('data-lucide', 'check');
          if (window.lucide) lucide.createIcons();
          setTimeout(() => {
            copyIcon.setAttribute('data-lucide', 'copy');
            if (window.lucide) lucide.createIcons();
          }, 1500);
        }
      });
    });

    actions.querySelector('.btn-edit').addEventListener('click', () => {
      makeUserMessageEditable(group, text, index);
    });

    actions.querySelector('.btn-retry').addEventListener('click', () => {
      triggerRetry(index);
    });

    if (window.lucide) {
      setTimeout(() => lucide.createIcons({ parent: actions }), 0);
    }

    return group;
  } else {
    // AI or System message wrapped in container group
    const group = document.createElement('div');
    group.className = `msg-group ${type}`;
    group.dataset.index = index;

    const el = document.createElement('div');
    el.className = `msg ${type}`;
    
    if (type === 'ai') {
      let thoughtHtml = '';
      let finalText = text;
      
      const thinkMatch = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
      if (thinkMatch) {
        const thoughtContent = thinkMatch[1].trim();
        finalText = text.replace(/<think>([\s\S]*?)(?:<\/think>|$)/i, '').trim();
        
        if (thoughtContent) {
          thoughtHtml = `
            <div class="thought-container">
              <div class="thought-header">
                <span class="thought-title">Thinking Process</span>
                <i class="mi-chevron thought-chevron" data-lucide="chevron-down" style="width:12px;height:12px;display:inline-block;vertical-align:middle;transition:transform 0.2s"></i>
              </div>
              <div class="thought-body collapsed" style="display: none;">
                <p class="thought-step">${escapeHtml(thoughtContent)}</p>
              </div>
            </div>
          `;
        }
      }
      
      el.innerHTML = thoughtHtml + (window.marked ? marked.parse(finalText) : escapeHtml(finalText));
      enhanceMarkdownContent(el);
      
      const header = el.querySelector('.thought-header');
      const body = el.querySelector('.thought-body');
      if (header && body) {
        header.addEventListener('click', () => {
          const collapsed = body.classList.toggle('collapsed');
          header.classList.toggle('open', !collapsed);
          if (collapsed) {
            body.style.display = 'none';
          } else {
            body.style.display = 'flex';
          }
        });
      }
      if (window.lucide) {
        setTimeout(() => lucide.createIcons({ parent: el }), 0);
      }

      group.appendChild(el);

      // Actions bar for AI response (right-aligned copy, thumbs-up, thumbs-down)
      const actions = document.createElement('div');
      actions.className = 'msg-actions ai-actions';
      actions.innerHTML = `
        <button class="action-btn btn-copy" title="Copy response">
          <i data-lucide="copy"></i>
        </button>
        <button class="action-btn btn-like" title="Good response">
          <i data-lucide="thumbs-up"></i>
        </button>
        <button class="action-btn btn-dislike" title="Bad response">
          <i data-lucide="thumbs-down"></i>
        </button>
      `;
      group.appendChild(actions);

      // Bind action callbacks
      actions.querySelector('.btn-copy').addEventListener('click', () => {
        const cleanText = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
        navigator.clipboard.writeText(cleanText).then(() => {
          const copyIcon = actions.querySelector('.btn-copy i');
          if (copyIcon) {
            copyIcon.setAttribute('data-lucide', 'check');
            if (window.lucide) lucide.createIcons();
            setTimeout(() => {
              copyIcon.setAttribute('data-lucide', 'copy');
              if (window.lucide) lucide.createIcons();
            }, 1500);
          }
        });
      });

      actions.querySelector('.btn-like').addEventListener('click', () => {
        const likeBtn = actions.querySelector('.btn-like');
        likeBtn.classList.toggle('active');
        actions.querySelector('.btn-dislike').classList.remove('active');
      });

      actions.querySelector('.btn-dislike').addEventListener('click', () => {
        const dislikeBtn = actions.querySelector('.btn-dislike');
        dislikeBtn.classList.toggle('active');
        actions.querySelector('.btn-like').classList.remove('active');
      });

      if (window.lucide) {
        setTimeout(() => lucide.createIcons({ parent: actions }), 0);
      }
    } else {
      el.innerHTML = escapeHtml(text);
      group.appendChild(el);
    }
    
    return group;
  }
}

/** Wraps all pre blocks with copy & wrap-text icons */
export function enhanceCodeBlocks(container) {
  const preElements = container.querySelectorAll('pre');
  preElements.forEach((pre) => {
    if (pre.parentNode.classList.contains('code-block-wrapper') || pre.parentNode.classList.contains('mermaid-block-wrapper')) return;

    const code = pre.querySelector('code');
    if (!code) return;
    const rawCodeText = code.innerText;

    let lang = 'code';
    const classes = code.className.split(' ');
    for (const cls of classes) {
      if (cls.startsWith('language-')) {
        lang = cls.replace('language-', '');
        break;
      }
    }

    // ── Mermaid Flowchart Rendering ──
    if (lang === 'mermaid') {
      if (window.mermaid) {
        const mDiv = document.createElement('div');
        mDiv.className = 'mermaid';
        mDiv.textContent = rawCodeText;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-block-wrapper';
        wrapper.style.cssText = 'margin:12px 0; background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px; display:flex; justify-content:center; overflow-x:auto;';
        wrapper.appendChild(mDiv);
        
        pre.parentNode.insertBefore(wrapper, pre);
        pre.style.display = 'none'; // hide code block
        
        try {
          window.mermaid.run({
            nodes: [mDiv]
          }).catch(err => {
            console.error('[Mermaid] async render failed', err);
            // Fallback: restore code block display and remove mermaid wrapper
            pre.style.display = 'block';
            if (wrapper.parentNode) {
              wrapper.parentNode.removeChild(wrapper);
            }
          });
        } catch (e) {
          console.error('[Mermaid] render failed', e);
          pre.style.display = 'block';
          if (wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
          }
        }
        return;
      }
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';

    const langSpan = document.createElement('span');
    langSpan.className = 'code-block-lang';
    langSpan.innerText = (lang || 'code').toLowerCase();

    const actions = document.createElement('div');
    actions.className = 'code-block-actions';

    const wrapBtn = document.createElement('button');
    wrapBtn.className = 'code-action-btn btn-wrap';
    wrapBtn.title = 'Toggle Line Wrap';
    wrapBtn.innerHTML = '<i data-lucide="wrap-text" style="width:14px;height:14px"></i>';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-action-btn btn-copy';
    copyBtn.title = 'Copy Code';
    copyBtn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px"></i>';

    let iframeContainer = null;
    let iframe = null;
    if (lang === 'html' || lang === 'svg' || lang === 'xml') {
      iframeContainer = document.createElement('div');
      iframeContainer.className = 'inline-preview-container';
      iframeContainer.style.cssText = 'display:none; width:100%; height:350px; background:#ffffff; border-top:1px solid var(--border); overflow:hidden; border-bottom-left-radius:12px; border-bottom-right-radius:12px;';
      
      iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%; height:100%; border:none; background:#ffffff;';
      iframe.sandbox = 'allow-scripts allow-modals';
      iframeContainer.appendChild(iframe);

      const previewBtn = document.createElement('button');
      previewBtn.className = 'code-action-btn btn-preview';
      previewBtn.title = 'Toggle Inline Preview';
      previewBtn.innerHTML = '<i data-lucide="eye" style="width:14px;height:14px"></i>';
      actions.appendChild(previewBtn);

      let isPreviewing = false;
      previewBtn.addEventListener('click', () => {
        isPreviewing = !isPreviewing;
        if (isPreviewing) {
          pre.style.display = 'none';
          iframeContainer.style.display = 'block';
          iframe.srcdoc = rawCodeText;
          previewBtn.classList.add('active');
          previewBtn.style.color = '#3b82f6';
          wrapBtn.style.display = 'none';
          
          // Header text: Html Preview
          langSpan.innerText = `${capLang} Preview`;
          langSpan.style.fontWeight = '400';
          langSpan.style.fontSize = '11px';
          langSpan.style.textTransform = 'none';
        } else {
          pre.style.display = 'block';
          iframeContainer.style.display = 'none';
          previewBtn.classList.remove('active');
          previewBtn.style.color = '';
          wrapBtn.style.display = 'inline-block';
          
          // Restore: Html
          langSpan.innerText = capLang;
          langSpan.style.fontWeight = '';
          langSpan.style.fontSize = '';
          langSpan.style.textTransform = '';
        }
      });
    }

    actions.appendChild(wrapBtn);
    actions.appendChild(copyBtn);
    header.appendChild(langSpan);
    header.appendChild(actions);

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
    if (iframeContainer) {
      wrapper.appendChild(iframeContainer);
    }

    wrapBtn.addEventListener('click', () => {
      pre.classList.toggle('wrap-lines');
      wrapBtn.classList.toggle('active');
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(rawCodeText);
        copyBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;color:#16a34a"></i>';
        if (window.lucide) lucide.createIcons({ parent: copyBtn });
        setTimeout(() => {
          copyBtn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px"></i>';
          if (window.lucide) lucide.createIcons({ parent: copyBtn });
        }, 1500);
      } catch (err) {
        console.error('Failed to copy code', err);
      }
    });

    if (window.lucide) {
      lucide.createIcons({ parent: header });
    }
  });
}

/** Wraps all table elements in a clean container and adds a copy button */
export function enhanceTables(container) {
  const tables = container.querySelectorAll('table');
  tables.forEach((table) => {
    if (table.parentNode.classList.contains('table-scroll-container')) return;

    // 1. Create wrappers
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    const header = document.createElement('div');
    header.className = 'table-header-bar';

    const title = document.createElement('div');
    title.className = 'table-title';
    title.innerHTML = '<i data-lucide="table" style="width:14px;height:14px"></i><span>Data Table</span>';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'table-copy-btn';
    copyBtn.title = 'Copy Table as CSV';
    copyBtn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px"></i>';

    header.appendChild(title);
    header.appendChild(copyBtn);

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll-container';

    // Insert wrapper into DOM
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(header);
    wrapper.appendChild(scrollContainer);
    scrollContainer.appendChild(table);

    // 2. Add copy to CSV handler
    copyBtn.addEventListener('click', async () => {
      const rows = Array.from(table.querySelectorAll('tr'));
      const csvContent = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map(cell => {
          let text = cell.innerText.replace(/"/g, '""');
          if (text.includes(',') || text.includes('\n')) {
            text = `"${text}"`;
          }
          return text;
        }).join(',');
      }).join('\n');

      try {
        await navigator.clipboard.writeText(csvContent);
        copyBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;color:#16a34a"></i>';
        if (window.lucide) lucide.createIcons({ parent: copyBtn });
        setTimeout(() => {
          copyBtn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px"></i>';
          if (window.lucide) lucide.createIcons({ parent: copyBtn });
        }, 1500);
      } catch (err) {
        console.error('Failed to copy table', err);
      }
    });

    if (window.lucide) {
      lucide.createIcons({ parent: header });
    }
  });
}

/** Scan container for image URLs/links and render a visual preview card card for each */
export function enhanceImagePreviews(container) {
  if (!container) return;

  // Translate any inline img tags with file:/// src (e.g. from markdown parsed images)
  const imgs = container.querySelectorAll('img');
  imgs.forEach((img) => {
    const src = img.getAttribute('src');
    if (src && src.startsWith('file:///')) {
      const decoded = decodeURIComponent(src.replace('file:///', ''));
      img.src = `/api/workspace/render?path=${encodeURIComponent(decoded)}`;
    }
  });

  // Scan links to render image preview cards
  const links = container.querySelectorAll('a');
  links.forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;

    let isFileImage = false;
    let fileImagePath = '';
    if (href.startsWith('file:///')) {
      const decoded = decodeURIComponent(href.replace('file:///', ''));
      if (decoded.match(/\.(jpeg|jpg|gif|png|webp|svg)(?:\?.*)?$/i)) {
        isFileImage = true;
        fileImagePath = decoded;
      }
    }

    if (isFileImage || href.match(/\.(jpeg|jpg|gif|png|webp|svg)(?:\?.*)?$/i) ||
      href.includes('unsplash.com/photo-') ||
      href.includes('images.unsplash.com/') ||
      href.includes('imgur.com/') ||
      href.includes('media.giphy.com/')
    ) {
      if (a.dataset.hasPreview) return;
      a.dataset.hasPreview = "true";

      let srcUrl = href;
      if (isFileImage) {
        srcUrl = `/api/workspace/render?path=${encodeURIComponent(fileImagePath)}`;
      }
      
      const imgContainer = document.createElement('div');
      imgContainer.className = 'chat-image-preview-card';
      imgContainer.innerHTML = `
        <div class="chat-image-preview-body">
          <img src="${srcUrl}" alt="Preview" loading="lazy" />
        </div>
        <div class="chat-image-preview-header">
          <i data-lucide="image" style="width:12px;height:12px;flex-shrink:0;"></i>
          <span>Image Preview</span>
          <a href="${srcUrl}" target="_blank" class="chat-image-preview-open" title="Open original image">
            <i data-lucide="external-link" style="width:12px;height:12px;"></i>
          </a>
        </div>
      `;
      
      const img = imgContainer.querySelector('img');
      if (img) {
        img.onload = () => {
          if (img.clientWidth > 0) {
            imgContainer.style.width = img.clientWidth + 'px';
          }
        };
        if (img.complete && img.clientWidth > 0) {
          imgContainer.style.width = img.clientWidth + 'px';
        }
        img.onerror = () => {
          imgContainer.remove();
        };
      }

      const parent = a.closest('p') || a.parentNode;
      if (parent) {
        parent.parentNode.insertBefore(imgContainer, parent.nextSibling);
      } else {
        container.appendChild(imgContainer);
      }
      if (window.lucide) {
        lucide.createIcons({ parent: imgContainer });
      }
    }
  });
}

/** Automatically scan text nodes for raw URLs and convert them into interactive links */
export function autoLinkTextNodes(container) {
  if (!container) return;
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;
  
  function walk(node) {
    if (!node) return;
    const tag = node.nodeName ? node.nodeName.toLowerCase() : '';
    if (['pre', 'code', 'a', 'script', 'style', 'textarea', 'input', 'iframe', 'svg'].includes(tag)) {
      return;
    }
    if (node.classList && (node.classList.contains('thought-header') || node.classList.contains('code-block-wrapper') || node.classList.contains('mermaid'))) {
      return;
    }
    
    if (node.nodeType === 3) { // TEXT_NODE
      const text = node.nodeValue;
      if (!text || !urlRegex.test(text)) return;
      urlRegex.lastIndex = 0;
      
      const fragment = document.createDocumentFragment();
      let lastIdx = 0;
      let match;
      
      while ((match = urlRegex.exec(text)) !== null) {
        const urlText = match[0];
        const matchIdx = match.index;
        
        if (matchIdx > lastIdx) {
          fragment.appendChild(document.createTextNode(text.substring(lastIdx, matchIdx)));
        }
        
        const fullHref = urlText.toLowerCase().startsWith('www.') ? `https://${urlText}` : urlText;
        const a = document.createElement('a');
        a.href = fullHref;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'chat-link external-link';
        a.textContent = urlText;
        
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'external-link');
        icon.className = 'chat-link-icon';
        a.appendChild(icon);
        
        fragment.appendChild(a);
        lastIdx = matchIdx + urlText.length;
      }
      
      if (lastIdx < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
      }
      
      if (node.parentNode) {
        node.parentNode.replaceChild(fragment, node);
      }
    } else if (node.nodeType === 1) { // ELEMENT_NODE
      const children = Array.from(node.childNodes);
      for (const child of children) {
        walk(child);
      }
    }
  }
  
  walk(container);
}

/** Enhances all <a> tags and auto-links raw URLs with icons and Desktop handlers */
export function enhanceLinks(container) {
  if (!container) return;
  
  const links = container.querySelectorAll('a');
  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href) return;
    
    const isExternal = /^https?:\/\//i.test(href) || /^www\./i.test(href);
    const isFile = /^file:\/\/\//i.test(href);
    
    if (isExternal || isFile) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      
      if (!a.classList.contains('chat-link')) {
        a.classList.add('chat-link');
      }
      
      if (isExternal && !a.classList.contains('external-link')) {
        a.classList.add('external-link');
      } else if (isFile && !a.classList.contains('file-link')) {
        a.classList.add('file-link');
      }
      
      if (!a.querySelector('.chat-link-icon') && !a.querySelector('i[data-lucide]')) {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', isFile ? 'file-text' : 'external-link');
        icon.className = 'chat-link-icon';
        a.appendChild(icon);
      }
      
      a.onclick = (e) => {
        if (window.electronAPI && window.electronAPI.openExternal) {
          e.preventDefault();
          window.electronAPI.openExternal(a.href);
        } else if (window.overlayAPI && window.overlayAPI.openExternal) {
          e.preventDefault();
          window.overlayAPI.openExternal(a.href);
        }
      };
    }
  });
  
  autoLinkTextNodes(container);
}

/** Transforms GitHub GFM callout blockquotes ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]) into styled cards */
export function enhanceCallouts(container) {
  if (!container) return;
  const blockquotes = container.querySelectorAll('blockquote');
  blockquotes.forEach((bq) => {
    if (bq.classList.contains('chat-callout')) return;
    
    const text = bq.innerText.trim();
    const match = text.match(/^\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
    if (!match) return;
    
    const type = match[1].toUpperCase();
    let iconName = 'info';
    let titleText = 'Note';
    let typeClass = 'callout-note';
    
    switch (type) {
      case 'TIP':
        iconName = 'sparkles';
        titleText = 'Tip';
        typeClass = 'callout-tip';
        break;
      case 'IMPORTANT':
        iconName = 'alert-circle';
        titleText = 'Important';
        typeClass = 'callout-important';
        break;
      case 'WARNING':
        iconName = 'triangle-alert';
        titleText = 'Warning';
        typeClass = 'callout-warning';
        break;
      case 'CAUTION':
        iconName = 'shield-alert';
        titleText = 'Caution';
        typeClass = 'callout-caution';
        break;
      default:
        iconName = 'info';
        titleText = 'Note';
        typeClass = 'callout-note';
        break;
    }
    
    const callout = document.createElement('div');
    callout.className = `chat-callout ${typeClass}`;
    
    const header = document.createElement('div');
    header.className = 'callout-header';
    header.innerHTML = `<i data-lucide="${iconName}" class="callout-icon"></i><span>${titleText}</span>`;
    
    const body = document.createElement('div');
    body.className = 'callout-body';
    
    let innerHTML = bq.innerHTML;
    innerHTML = innerHTML.replace(/\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, '').trim();
    innerHTML = innerHTML.replace(/^<p>\s*<\/p>/i, '').trim();
    body.innerHTML = innerHTML;
    
    callout.appendChild(header);
    callout.appendChild(body);
    
    if (bq.parentNode) {
      bq.parentNode.replaceChild(callout, bq);
    }
  });
}

/** Enhances GFM task checkboxes with custom styling */
export function enhanceTaskLists(container) {
  if (!container) return;
  const checkboxes = container.querySelectorAll('li > input[type="checkbox"]');
  checkboxes.forEach((cb) => {
    const li = cb.parentElement;
    if (li) {
      li.classList.add('chat-task-item');
      if (cb.checked) {
        li.classList.add('task-completed');
      }
    }
  });
}

/** Complete markdown response enhancement pipeline for links, callouts, code blocks, tables, images & math */
export function enhanceMarkdownContent(container) {
  if (!container) return;
  try { enhanceLinks(container); } catch (e) { console.error(e); }
  try { enhanceCallouts(container); } catch (e) { console.error(e); }
  try { enhanceCodeBlocks(container); } catch (e) { console.error(e); }
  try { enhanceTables(container); } catch (e) { console.error(e); }
  try { enhanceImagePreviews(container); } catch (e) { console.error(e); }
  try { enhanceTaskLists(container); } catch (e) { console.error(e); }
  if (window.renderMathInElement) {
    try {
      renderMathInElement(container, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false
      });
    } catch (e) {}
  }
  if (window.lucide) {
    try { lucide.createIcons({ parent: container }); } catch (e) {}
  }
}

/** Converts user bubble to edit textarea form in place */
function makeUserMessageEditable(groupEl, originalText, index) {
  const bubble = groupEl.querySelector('.msg.user');
  const actions = groupEl.querySelector('.msg-actions');
  if (!bubble) return;

  // Hide actions and bubble text
  bubble.style.display = 'none';
  if (actions) actions.style.display = 'none';

  // Create edit form container
  const editContainer = document.createElement('div');
  editContainer.className = 'msg-edit-container';
  editContainer.innerHTML = `
    <textarea class="msg-edit-textarea">${originalText}</textarea>
    <div class="msg-edit-buttons">
      <button class="msg-edit-btn btn-cancel">Cancel</button>
      <button class="msg-edit-btn save btn-save">Save & Submit</button>
    </div>
  `;
  groupEl.appendChild(editContainer);

  const textarea = editContainer.querySelector('.msg-edit-textarea');
  textarea.focus();
  // Set cursor to end of text
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

  editContainer.querySelector('.btn-cancel').addEventListener('click', () => {
    editContainer.remove();
    bubble.style.display = 'block';
    if (actions) actions.style.display = 'flex';
  });

  editContainer.querySelector('.btn-save').addEventListener('click', () => {
    const newText = textarea.value.trim();
    if (!newText) return;
    submitEditedText(index, newText);
  });
}

/** Handles submitting edited prompt: truncates session history & triggers resend */
function submitEditedText(index, newText) {
  if (!activeChatId) return;
  const chats = ChatSessionManager.getChats();
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;

  // Update this message text, slice session history up to this point
  chat.messages[index].text = newText;
  chat.messages[index].timestamp = new Date().toISOString();
  chat.messages = chat.messages.slice(0, index + 1);
  ChatSessionManager.saveChats(chats);

  // Reload the chat UI up to this message
  ChatSessionManager.loadChat(activeChatId);

  // Trigger WS query
  if (globalSendCallback) {
    globalSendCallback(newText);
  }
}

/** Truncates conversation and retries the exact same prompt */
function triggerRetry(index) {
  if (!activeChatId) return;
  const chats = ChatSessionManager.getChats();
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;

  const retryText = chat.messages[index].text;
  chat.messages[index].timestamp = new Date().toISOString();
  chat.messages = chat.messages.slice(0, index + 1);
  ChatSessionManager.saveChats(chats);

  ChatSessionManager.loadChat(activeChatId);

  if (globalSendCallback) {
    globalSendCallback(retryText);
  }
}

/** Formats ISO timestamp to human readable shorthand */
function formatTime(timestamp) {
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

export function bindInputs(sendCallback) {
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
        // Sync retrieved chats from server database with localStorage cache
        localStorage.setItem('hekki_chats', JSON.stringify(data.chats));
        
        // Re-render and load active chat
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

export function resetActiveChat() {
  ChatSessionManager.setActiveChatId(null);
  ChatSessionManager.renderChatsList();
  if (window.inConversationState) {
    window.inConversationState.val = false;
  }

}

window.ChatSessionManager = ChatSessionManager;

export function appendMsg(type, text, enterConvoCallback, scrollCallback) {
  if (type === 'ai' || type === 'assistant') {
    if (text) {
      const lines = text.split('\n');
      const filteredLines = lines.filter(line => !line.trim().startsWith('[Tool:'));
      text = filteredLines.join('\n').trim();
    }
    if (!text) return;
  }
  
  enterConvoCallback();
  
  // Save message to localStorage
  ChatSessionManager.appendMessage(type === 'user' ? 'user' : 'assistant', text);

  // Find dynamic index inside message array
  const chats = ChatSessionManager.getChats();
  const chat = chats.find(c => c.id === activeChatId);
  const index = chat ? chat.messages.length - 1 : 0;

  const el = createMessageElement(type === 'user' ? 'user' : 'ai', text, new Date().toISOString(), index);
  
  const col = document.getElementById('chat-col') || document.getElementById('chat-log');
  if (col && el) col.appendChild(el);
  scrollCallback();
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

/**
 * Reusable Custom Modal Confirmation Dialog
 * Returns a Promise resolving to true (confirm) or false (cancel)
 */
export function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-dialog-modal');
    const titleEl = document.getElementById('custom-dialog-title');
    const msgEl = document.getElementById('custom-dialog-message');
    const inputContainer = document.getElementById('custom-dialog-input-container');
    const btnCancel = document.getElementById('custom-dialog-cancel');
    const btnConfirm = document.getElementById('custom-dialog-confirm');
    const btnClose = document.getElementById('custom-dialog-close');

    if (!modal) {
      resolve(confirm(message));
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    inputContainer.classList.add('hidden');

    const cleanUp = (result) => {
      modal.classList.add('hidden');
      btnConfirm.replaceWith(btnConfirm.cloneNode(true));
      btnCancel.replaceWith(btnCancel.cloneNode(true));
      if (btnClose) btnClose.replaceWith(btnClose.cloneNode(true));
      resolve(result);
    };

    // Re-select cloned buttons to add event listeners safely
    const newConfirmBtn = document.getElementById('custom-dialog-confirm');
    const newCancelBtn = document.getElementById('custom-dialog-cancel');
    const newCloseBtn = document.getElementById('custom-dialog-close');

    newConfirmBtn.addEventListener('click', () => cleanUp(true));
    newCancelBtn.addEventListener('click', () => cleanUp(false));
    if (newCloseBtn) newCloseBtn.addEventListener('click', () => cleanUp(false));

    modal.classList.remove('hidden');
  });
}

/**
 * Reusable Custom Modal Prompt Dialog
 * Returns a Promise resolving to string (input value) or null (cancelled)
 */
export function showCustomPrompt(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-dialog-modal');
    const titleEl = document.getElementById('custom-dialog-title');
    const msgEl = document.getElementById('custom-dialog-message');
    const inputContainer = document.getElementById('custom-dialog-input-container');
    const inputEl = document.getElementById('custom-dialog-input');
    const btnCancel = document.getElementById('custom-dialog-cancel');
    const btnConfirm = document.getElementById('custom-dialog-confirm');
    const btnClose = document.getElementById('custom-dialog-close');

    if (!modal) {
      resolve(prompt(message, defaultValue));
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    inputContainer.classList.remove('hidden');
    inputEl.value = defaultValue;

    setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);

    const cleanUp = (confirmed) => {
      const val = confirmed ? inputEl.value : null;
      modal.classList.add('hidden');
      btnConfirm.replaceWith(btnConfirm.cloneNode(true));
      btnCancel.replaceWith(btnCancel.cloneNode(true));
      if (btnClose) btnClose.replaceWith(btnClose.cloneNode(true));
      resolve(val);
    };

    // Re-select cloned buttons to add event listeners safely
    const newConfirmBtn = document.getElementById('custom-dialog-confirm');
    const newCancelBtn = document.getElementById('custom-dialog-cancel');
    const newCloseBtn = document.getElementById('custom-dialog-close');

    newConfirmBtn.addEventListener('click', () => cleanUp(true));
    newCancelBtn.addEventListener('click', () => cleanUp(false));
    if (newCloseBtn) newCloseBtn.addEventListener('click', () => cleanUp(false));

    inputEl.onkeydown = (event) => {
      if (event.key === 'Enter') {
        cleanUp(true);
      } else if (event.key === 'Escape') {
        cleanUp(false);
      }
    };

    modal.classList.remove('hidden');
  });
}
