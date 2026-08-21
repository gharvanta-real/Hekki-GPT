/**
 * coder_sidebar.js — Coder session list, sorting, filtering, and history manager
 */
import { enhanceMarkdownContent } from '../chat.js';

export let _conversations = [];
export let _activeConvId = null;
export let _activeProject = null;

export let _groupBy = 'none';
export let _sortBy = 'ts';
export let _sortDir = 'desc';
export let _subtitleType = 'none';
export let _filterScheduled = false;

export function setGroupBy(val) { _groupBy = val; }
export function setSortBy(val) { _sortBy = val; }
export function setSortDir(val) { _sortDir = val; }
export function setSubtitleType(val) { _subtitleType = val; }
export function setFilterScheduled(val) { _filterScheduled = val; }
export function setActiveProject(p) { _activeProject = p; }

export function loadConversations() {
  try {
    const raw = localStorage.getItem('hekki_coder_conversations');
    _conversations = raw ? JSON.parse(raw) : [];
  } catch {
    _conversations = [];
  }
  renderConversationList();
}

export function saveConversations() {
  localStorage.setItem('hekki_coder_conversations', JSON.stringify(_conversations.slice(0, 50)));
}

export function setActiveConvId(id) {
  _activeConvId = id;
  if (id) {
    localStorage.setItem('hekki_coder_active_conv_id', id);
  } else {
    localStorage.removeItem('hekki_coder_active_conv_id');
  }
}

export function loadMessagesForSession(convId) {
  try {
    const raw = localStorage.getItem(`hekki_coder_messages_${convId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMessagesForSession(convId, messages) {
  try {
    localStorage.setItem(`hekki_coder_messages_${convId}`, JSON.stringify(messages.slice(0, 200)));
  } catch (e) {
    console.error('[Coder] failed to save messages', e);
  }
}

export function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function basicMdRender(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

export function appendCoderMessageToDOM(mdText, role = 'assistant') {
  const col = document.getElementById('coder-chat-col');
  const log = document.getElementById('coder-chat-log');
  if (!col || !log) return;

  const bubble = document.createElement('div');
  bubble.className = `coder-msg coder-msg-${role}`;

  if (window.marked && role !== 'user') {
    try {
      bubble.innerHTML = marked.parse(mdText);
    } catch {
      bubble.innerHTML = basicMdRender(mdText);
    }
  } else {
    bubble.innerHTML = basicMdRender(mdText);
  }

  col.appendChild(bubble);
  if (window.marked && role !== 'user') {
    enhanceMarkdownContent(bubble);
  }
  log.scrollTop = log.scrollHeight;
}

export function appendCoderMessage(mdText, role = 'assistant', shouldPersist = true) {
  appendCoderMessageToDOM(mdText, role);
  if (shouldPersist && _activeConvId) {
    const msgs = loadMessagesForSession(_activeConvId);
    msgs.push({ role, text: mdText, ts: Date.now() });
    saveMessagesForSession(_activeConvId, msgs);
  }
}

export function renderSessionHistory(renderer) {
  if (renderer) renderer.clearChat();
  const col = document.getElementById('coder-chat-col');
  if (col) col.innerHTML = '';

  if (!_activeConvId) return;
  const msgs = loadMessagesForSession(_activeConvId);
  msgs.forEach(msg => {
    appendCoderMessageToDOM(msg.text, msg.role);
  });
}

export function selectConversation(id, renderer, onSelectCallback) {
  setActiveConvId(id);
  
  const c = _conversations.find(conv => conv.id === id);
  if (c && c.unread) {
    c.unread = false;
    saveConversations();
  }

  renderConversationList();

  const welcome = document.getElementById('coder-chat-welcome');
  if (welcome) welcome.style.display = 'none';

  const col = document.getElementById('coder-chat-col');
  if (col) col.style.display = 'flex';

  const msgs = loadMessagesForSession(id);
  if (msgs.length === 0 && c) {
    const welcomeText = `📂 Loaded session: **${c.title}**`;
    appendCoderMessage(welcomeText, 'assistant', true);
  } else {
    renderSessionHistory(renderer);
  }

  if (typeof onSelectCallback === 'function') {
    onSelectCallback(id);
  }
}

export function renderConversationList(onItemSelect, onItemActionMenu) {
  const container = document.getElementById('coder-conv-list');
  if (!container) return;

  let list = _conversations;
  if (_filterScheduled) {
    list = list.filter(c => c.scheduled);
  }

  if (!list.length) {
    container.innerHTML = `<div style="font-size:11px;color:var(--text-3);padding:12px 6px;text-align:center;">No sessions found</div>`;
    return;
  }

  const groups = {};
  list.forEach(c => {
    let grpKey = 'Default';
    if (_groupBy === 'project') {
      grpKey = c.projectName || 'default';
    } else if (_groupBy === 'environment') {
      grpKey = (c.projectName && c.projectName.toLowerCase().includes('remote')) ? 'Remote Dev Environment' : 'Local Dev Environment';
    } else if (_groupBy === 'status') {
      if (c.id === _activeConvId) grpKey = 'Active Session';
      else if (c.pinned) grpKey = 'Pinned';
      else grpKey = 'Idle Sessions';
    } else {
      grpKey = '';
    }

    if (!groups[grpKey]) groups[grpKey] = [];
    groups[grpKey].push(c);
  });

  container.innerHTML = '';

  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Active Session' || a === 'Pinned') return -1;
    if (b === 'Active Session' || b === 'Pinned') return 1;
    return a.localeCompare(b);
  });

  sortedGroupKeys.forEach(grpKey => {
    if (grpKey !== '') {
      const grpHeader = document.createElement('div');
      grpHeader.className = 'coder-conv-group-label';
      grpHeader.style.cssText = 'font-size:11.5px; color:var(--text-3); font-weight:400; margin:10px 4px 6px; letter-spacing:0.02em;';
      grpHeader.textContent = grpKey;
      container.appendChild(grpHeader);
    }

    const items = groups[grpKey];
    items.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      let comparison = 0;
      if (_sortBy === 'ts') {
        comparison = b.ts - a.ts;
      } else if (_sortBy === 'date_added') {
        comparison = a.ts - b.ts;
      } else if (_sortBy === 'alphabetical') {
        comparison = (a.title || '').localeCompare(b.title || '');
      }

      return _sortDir === 'desc' ? comparison : -comparison;
    });

    items.forEach(c => {
      if (c.archived && !_filterScheduled) return;

      const itemBtn = document.createElement('button');
      itemBtn.className = 'coder-conv-item' + (c.id === _activeConvId ? ' active' : '');
      itemBtn.dataset.id = c.id;

      const unreadDot = c.unread ? '<span class="coder-conv-unread-dot"></span>' : '';
      const pinIcon = c.pinned ? '<i data-lucide="pin" class="coder-conv-pin-badge" style="width:11px;height:11px;flex-shrink:0;"></i>' : '';
      const subtitleHtml = _subtitleType === 'worktree' 
        ? `<span class="coder-conv-subtitle">${escHtml(c.projectName || 'default')}</span>` 
        : '';

      itemBtn.innerHTML = `
        <div class="coder-conv-item-left">
          <div class="coder-conv-title-row">
            ${unreadDot}
            <span class="coder-conv-title-text">${escHtml(c.title)}</span>
            ${pinIcon}
          </div>
          ${subtitleHtml}
        </div>
        <div class="coder-conv-actions">
          <button class="coder-conv-action-btn coder-btn-pin" title="Pin Session">
            <i data-lucide="pin" style="width:12px;height:12px;"></i>
          </button>
          <button class="coder-conv-action-btn coder-btn-archive" title="Archive Session">
            <i data-lucide="archive" style="width:12px;height:12px;"></i>
          </button>
          <button class="coder-conv-action-btn coder-btn-more" title="More Actions">
            <i data-lucide="more-vertical" style="width:12px;height:12px;"></i>
          </button>
        </div>
      `;

      itemBtn.addEventListener('click', (e) => {
        if (e.target.closest('.coder-conv-action-btn')) return;
        if (typeof onItemSelect === 'function') onItemSelect(c.id);
      });

      itemBtn.querySelector('.coder-btn-pin').addEventListener('click', (e) => {
        e.stopPropagation();
        c.pinned = !c.pinned;
        saveConversations();
        renderConversationList(onItemSelect, onItemActionMenu);
      });

      itemBtn.querySelector('.coder-btn-archive').addEventListener('click', (e) => {
        e.stopPropagation();
        c.archived = !c.archived;
        saveConversations();
        renderConversationList(onItemSelect, onItemActionMenu);
      });

      itemBtn.querySelector('.coder-btn-more').addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof onItemActionMenu === 'function') {
          onItemActionMenu(c.id, e.currentTarget, e);
        }
      });

      container.appendChild(itemBtn);
    });
  });

  if (window.lucide) lucide.createIcons();
}
