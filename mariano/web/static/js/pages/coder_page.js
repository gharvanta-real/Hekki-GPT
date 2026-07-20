/**
 * coder_page.js — Hekki Coder Page
 *
 * Manages the coder welcome screen, workspace setup popup,
 * conversation history in sidebar. Real AI streaming is
 * handled by coder_stream_core.js + coder_stream_render.js.
 */
import { initCoderStream, sendCoderChat, setCoderStreamContext, sendCoderCommand, stopCoderChat } from './coder_stream_core.js';
import { CoderStreamRenderer } from './coder_stream_render.js';
import { showCustomConfirm, showCustomPrompt } from '../chat.js';

// ─── State ───────────────────────────────────────────────────────────────────
let _activeProject = null;   // { name, path, type: 'new'|'existing' }
let _conversations = [];     // [{ id, title, ts, projectName, pinned: bool, archived: bool, unread: bool, scheduled: bool }]
let _activeConvId = null;

// Renderer instance (shared with stream core)
let _renderer = null;

// Grouping and sorting state
let _groupBy = 'none';
let _sortBy = 'ts';
let _sortDir = 'desc';
let _subtitleType = 'none';
let _filterScheduled = false;

// Active open context menu tracking
let _activeContextMenu = null;

// ─── Stream Module Init ───────────────────────────────────────────────────────
function initStreamModules() {
  _renderer = new CoderStreamRenderer();

  // Register legacy FSM/refactor event handler so coder_stream_core
  // can dispatch those events back here.
  window._handleCoderLegacyEvent = handleCoderEvent;

  initCoderStream(_renderer);
}

// Shim so any existing calls to connectCoderWs() are no-ops;
// the stream core manages its own connection.
function connectCoderWs() {
  // Stream core auto-connects on initCoderStream(); no manual reconnect needed.
}

function setWsStatus(status) {
  const dot = document.getElementById('coder-ws-dot');
  const lbl = document.getElementById('coder-ws-label');
  if (!dot) return;
  const map = {
    connected:    { color: '#22c55e', text: 'Connected' },
    disconnected: { color: '#f59e0b', text: 'Reconnecting…' },
    error:        { color: '#ef4444', text: 'Error' },
  };
  const s = map[status] || map.disconnected;
  dot.style.background = s.color;
  if (lbl) lbl.textContent = s.text;
}

function handleCoderEvent(msg) {
  const { event } = msg;
  if (event === 'pong') return;

  if (event === 'fsm_state') {
    renderFsmBadge(msg);
  } else if (event === 'refactor_complete') {
    appendCoderMessage(
      msg.success
        ? `✅ **Refactor complete** — \`${msg.file_path ?? ''}\``
        : `❌ **Refactor failed** — ${msg.error}`,
      msg.success ? 'assistant' : 'error'
    );
    resetFsmBadge();
  } else if (event === 'file_content') {
    appendCoderMessage(
      `📄 **${msg.file_path.split(/[\\/]/).pop()}** loaded (${msg.symbols?.length ?? 0} symbols)`,
      'assistant'
    );
  }
}

// ─── FSM Badge ────────────────────────────────────────────────────────────────
function renderFsmBadge(msg) {
  const badge = document.getElementById('coder-fsm-badge');
  if (!badge) return;
  const colors = {
    IDLE:       '#6b7280',
    ANALYZING:  '#6366f1',
    VALIDATING: '#f59e0b',
    APPLYING:   '#22c55e',
    ROLLBACK:   '#f97316',
    ERROR:      '#ef4444',
  };
  const c = colors[msg.state] || '#6b7280';
  badge.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;
      background:${c}20;color:${c};font-size:11px;font-weight:600;border:1px solid ${c}40;">
      <span style="width:6px;height:6px;border-radius:50%;background:${c};flex-shrink:0;"></span>
      ${msg.state} · ${msg.tokens_consumed ?? 0} tkns
    </span>`;
}

function resetFsmBadge() {
  const badge = document.getElementById('coder-fsm-badge');
  if (badge) badge.innerHTML = '';
}

// ─── Chat Messages ────────────────────────────────────────────────────────────
function appendCoderMessage(mdText, role = 'assistant', shouldPersist = true) {
  appendCoderMessageToDOM(mdText, role);

  // Auto-persist if active session exists
  if (shouldPersist && _activeConvId) {
    const msgs = loadMessagesForSession(_activeConvId);
    msgs.push({ role, text: mdText, ts: Date.now() });
    saveMessagesForSession(_activeConvId, msgs);
  }
}

function loadMessagesForSession(convId) {
  try {
    const raw = localStorage.getItem(`hekki_coder_messages_${convId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessagesForSession(convId, messages) {
  try {
    localStorage.setItem(`hekki_coder_messages_${convId}`, JSON.stringify(messages.slice(0, 200)));
  } catch (e) {
    console.error('[Coder] failed to save messages', e);
  }
}

function renderSessionHistory() {
  if (_renderer) _renderer.clearChat();
  const col = document.getElementById('coder-chat-col');
  if (col) col.innerHTML = '';

  if (!_activeConvId) return;
  const msgs = loadMessagesForSession(_activeConvId);
  msgs.forEach(msg => {
    appendCoderMessageToDOM(msg.text, msg.role);
  });
}

function setActiveConvId(id) {
  _activeConvId = id;
  if (id) {
    localStorage.setItem('hekki_coder_active_conv_id', id);
  } else {
    localStorage.removeItem('hekki_coder_active_conv_id');
  }
}

function selectConversation(id) {
  setActiveConvId(id);
  
  const c = _conversations.find(conv => conv.id === id);
  if (c && c.unread) {
    c.unread = false;
    saveConversations();
  }

  renderConversationList();

  // Hide welcome dashboard screen and show chat column
  const welcome = document.getElementById('coder-chat-welcome');
  if (welcome) welcome.style.display = 'none';

  const col = document.getElementById('coder-chat-col');
  if (col) col.style.display = 'flex';

  const msgs = loadMessagesForSession(id);
  if (msgs.length === 0 && c) {
    // Brand new conversation: seed and save start message
    const welcomeText = `📂 Loaded session: **${c.title}**`;
    appendCoderMessage(welcomeText, 'assistant', true);
  } else {
    renderSessionHistory();
  }

  // Only update the breadcrumb if we are actually ON the coder page
  // (avoids overwriting chat page breadcrumb during boot-time init)
  if (window._router?.currentPage === 'coder') {
    updateCoderBreadcrumb();
  }
}

function appendCoderMessageToDOM(mdText, role = 'assistant') {
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
    enhanceCodeBlocksForElement(bubble);
  }
  log.scrollTop = log.scrollHeight;
}

function basicMdRender(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function enhanceCodeBlocksForElement(container) {
  container.querySelectorAll('pre code').forEach((block) => {
    if (block.dataset.enhanced) return;
    block.dataset.enhanced = '1';

    const pre = block.parentElement;
    pre.style.cssText = [
      'position:relative',
      'background:var(--code-bg,#0d1117)',
      'border:1px solid var(--border,rgba(255,255,255,.1))',
      'border-radius:8px',
      'padding:14px 16px',
      'overflow-x:auto',
      'font-size:12.5px',
      'line-height:1.6',
      'margin:10px 0',
    ].join(';');

    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.style.cssText = [
      'position:absolute',
      'top:8px',
      'right:10px',
      'font-size:11px',
      'padding:3px 8px',
      'border-radius:5px',
      'border:1px solid var(--border,rgba(255,255,255,.15))',
      'background:var(--card,rgba(255,255,255,.05))',
      'color:var(--text-3,#999)',
      'cursor:pointer',
      'transition:opacity .2s',
    ].join(';');
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(block.textContent).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
    pre.appendChild(btn);
  });
}

// Global hook for stream renderer to save assistant outputs
window._saveAssistantMessage = function(text, role = 'assistant') {
  if (_activeConvId) {
    const msgs = loadMessagesForSession(_activeConvId);
    msgs.push({ role, text, ts: Date.now() });
    saveMessagesForSession(_activeConvId, msgs);
  }
};

function clearCoderChat() {
  if (_renderer) {
    _renderer.clearChat();
  } else {
    const col = document.getElementById('coder-chat-col');
    if (col) col.innerHTML = '';
  }
}

// ─── Conversation Sidebar ─────────────────────────────────────────────────────
function loadConversations() {
  try {
    const raw = localStorage.getItem('hekki_coder_conversations');
    _conversations = raw ? JSON.parse(raw) : [];
  } catch {
    _conversations = [];
  }
  renderConversationList();
}

function saveConversations() {
  localStorage.setItem('hekki_coder_conversations', JSON.stringify(_conversations.slice(0, 50)));
}

function startNewConversationTemp() {
  setActiveConvId(null);
  
  if (_renderer) _renderer.clearChat();
  const col = document.getElementById('coder-chat-col');
  if (col) {
    col.innerHTML = '';
    col.style.display = 'none';
  }

  const welcome = document.getElementById('coder-chat-welcome');
  if (welcome) {
    welcome.style.display = 'flex';
  }

  // Clear sidebar active highlights
  renderConversationList();

  // Update titlebar breadcrumb only when on coder page
  if (window._router?.currentPage === 'coder' && window.updateTitleBreadcrumb) {
    const projName = _activeProject?.name || 'default';
    window.updateTitleBreadcrumb(projName, 'New Session');
  }
}

function createNewConversation(title) {
  startNewConversationTemp();
}

function renderConversationList() {
  const container = document.getElementById('coder-conv-list');
  if (!container) return;

  // Filter based on scheduled
  let list = _conversations;
  if (_filterScheduled) {
    list = list.filter(c => c.scheduled);
  }

  if (!list.length) {
    container.innerHTML = `<div style="font-size:11px;color:var(--text-3);padding:12px 6px;text-align:center;">No sessions found</div>`;
    return;
  }

  // Grouping
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

  // Sort groups (we want Pinned first under status, Active Session first, etc.)
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Active Session' || a === 'Pinned') return -1;
    if (b === 'Active Session' || b === 'Pinned') return 1;
    return a.localeCompare(b);
  });

  sortedGroupKeys.forEach(grpKey => {
    if (grpKey !== '') {
      const grpHeader = document.createElement('div');
      grpHeader.className = 'coder-conv-group-label';
      grpHeader.style.cssText = 'font-size:10px; color:var(--text-3); font-weight:700; text-transform:uppercase; margin:10px 4px 6px; letter-spacing:0.04em;';
      grpHeader.textContent = grpKey;
      container.appendChild(grpHeader);
    }

    // Sort items within group
    const items = groups[grpKey];
    items.sort((a, b) => {
      // Pinned items always float to the top of the group
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Secondary sorting
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
      if (c.archived && !_filterScheduled) {
        // Hide archived sessions from normal list unless they are explicitly filtered
        return;
      }
      const itemBtn = document.createElement('button');
      itemBtn.className = 'coder-conv-item' + (c.id === _activeConvId ? ' active' : '');
      itemBtn.dataset.id = c.id;

      // Render unread dot
      const unreadDot = c.unread ? '<span class="coder-conv-unread-dot"></span>' : '';
      
      // Render pin icon if pinned
      const pinIcon = c.pinned ? '<i data-lucide="pin" class="coder-conv-pin-badge" style="width:11px;height:11px;flex-shrink:0;"></i>' : '';

      // Subtitle HTML
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

      // Item selection handler (unless clicking actions)
      itemBtn.addEventListener('click', (e) => {
        if (e.target.closest('.coder-conv-action-btn')) return;
        selectConversation(c.id);
      });

      // Actions click handlers
      itemBtn.querySelector('.coder-btn-pin').addEventListener('click', (e) => {
        e.stopPropagation();
        c.pinned = !c.pinned;
        saveConversations();
        renderConversationList();
      });

      itemBtn.querySelector('.coder-btn-archive').addEventListener('click', (e) => {
        e.stopPropagation();
        c.archived = !c.archived;
        saveConversations();
        renderConversationList();
      });

      itemBtn.querySelector('.coder-btn-more').addEventListener('click', (e) => {
        e.stopPropagation();
        openItemActionsMenu(c.id, e.currentTarget, e);
      });

      container.appendChild(itemBtn);
    });
  });

  // Re-render lucide icons inside new elements
  if (window.lucide) lucide.createIcons();
}

// ─── Project Setup Popup ──────────────────────────────────────────────────────
function openCoderWorkspacePopup() {
  document.getElementById('coder-workspace-popup')?.classList.remove('hidden');
  document.getElementById('coder-popup-step-choose')?.classList.remove('hidden');
  document.getElementById('coder-popup-step-new')?.classList.add('hidden');
  document.getElementById('coder-popup-step-existing')?.classList.add('hidden');
}

function closeCoderWorkspacePopup() {
  document.getElementById('coder-workspace-popup')?.classList.add('hidden');
}

function showPopupStep(step) {
  ['choose', 'new', 'existing'].forEach(s => {
    document.getElementById(`coder-popup-step-${s}`)?.classList.toggle('hidden', s !== step);
  });
}

function activateProject(name, path, type) {
  _activeProject = { name, path, type };
  closeCoderWorkspacePopup();

  // Update active project name in sidebar header
  const sidebarProjName = document.getElementById('coder-active-project-name');
  if (sidebarProjName) sidebarProjName.textContent = name;

  // Persist project workspace selection initially
  localStorage.setItem('hekki_coder_active_project', JSON.stringify(_activeProject));
  localStorage.setItem('mariano_active_project', name);
  localStorage.setItem('mariano_active_project_path', path);

  // Show welcome screen → hide; show chat
  document.getElementById('coder-welcome-screen')?.classList.add('hidden');
  document.getElementById('coder-chat-area')?.classList.remove('hidden');

  // Auto create first session
  createNewConversation('Session 1');
  connectCoderWs();
  updateCoderBreadcrumb();

  // Notify backend via PathGuard API and synchronize absolute workspace path
  fetch('/api/workspace/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: name, project_path: path }),
  })
    .then(r => r.json())
    .then(data => {
      if (data && data.project_path) {
        _activeProject.path = data.project_path;
        localStorage.setItem('hekki_coder_active_project', JSON.stringify(_activeProject));
        localStorage.setItem('mariano_active_project_path', data.project_path);
        
        // Sync streaming context with resolved path
        setCoderStreamContext(name, data.project_path, _activeConvId);
      }
    })
    .catch((err) => {
      console.error("[CoderPage] Failed to sync workspace with backend:", err);
    });
}

// ─── Input Handling ───────────────────────────────────────────────────────────
function sendCoderMessage(text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return;

  // 1. If we are in an unsaved session, register the conversation now
  if (!_activeConvId) {
    const id = 'conv_' + Date.now();
    const title = trimmed.length > 25 ? trimmed.slice(0, 22) + '...' : trimmed;
    const entry = {
      id,
      title,
      ts: Date.now(),
      projectName: _activeProject?.name ?? 'No project',
    };
    _conversations.unshift(entry);
    saveConversations();
    setActiveConvId(id);
  }

  // 2. Hide welcome screen dashboard and show chat column
  const welcome = document.getElementById('coder-chat-welcome');
  if (welcome) welcome.style.display = 'none';
  const col = document.getElementById('coder-chat-col');
  if (col) col.style.display = 'flex';

  // 3. Sync project/session context
  setCoderStreamContext(
    _activeProject?.name       ?? null,
    _activeProject?.path       ?? null,
    _activeConvId              ?? null,
  );

  // 4. Render the user bubble
  if (_renderer) {
    _renderer.appendUserMessage(trimmed);
  }

  // 5. Save the user message to history
  const msgs = loadMessagesForSession(_activeConvId);
  msgs.push({ role: 'user', text: trimmed, ts: Date.now() });
  saveMessagesForSession(_activeConvId, msgs);

  // 6. Refresh sidebar list to show the newly registered chat session
  renderConversationList();
  updateCoderBreadcrumb();

  // 7. Send chat command to real agent
  sendCoderChat(trimmed);
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function isToday(d) {
  const n = new Date();
  return d.getDate()===n.getDate() && d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
}
function isYesterday(d) {
  const y = new Date(); y.setDate(y.getDate()-1);
  return d.getDate()===y.getDate() && d.getMonth()===y.getMonth() && d.getFullYear()===y.getFullYear();
}

// ─── Dropdown Context Menu Operations ─────────────────────────────────────────
let _activeMenuConvId = null;

function updateCoderBreadcrumb() {
  // Guard: only update breadcrumb when actually on the coder page
  if (window._router?.currentPage !== 'coder') return;
  if (window.updateTitleBreadcrumb) {
    const projName = _activeProject?.name || 'default';
    const activeConv = _conversations.find(c => c.id === _activeConvId);
    const chatTitle = activeConv ? activeConv.title : '';
    window.updateTitleBreadcrumb(projName, chatTitle);
  }
}
window.updateCoderBreadcrumb = updateCoderBreadcrumb;

function closeAllCoderMenus() {
  document.getElementById('coder-project-plus-menu')?.classList.add('hidden');
  document.getElementById('coder-filter-dropdown')?.classList.add('hidden');
  document.getElementById('coder-item-actions-menu')?.classList.add('hidden');
  document.querySelectorAll('.coder-conv-item.menu-active').forEach(item => {
    item.classList.remove('menu-active');
  });
  _activeContextMenu = null;
}

function openItemActionsMenu(id, triggerElement, event) {
  event.stopPropagation();
  closeAllCoderMenus();

  _activeMenuConvId = id;
  const menu = document.getElementById('coder-item-actions-menu');
  if (!menu) return;

  // Add active state styling class to the conversation button
  const itemBtn = triggerElement.closest('.coder-conv-item');
  if (itemBtn) itemBtn.classList.add('menu-active');

  // Position the menu absolute relative to the trigger button
  menu.classList.remove('hidden');
  
  // Calculate relative coordinate within container parent
  const parent = document.getElementById('nav-inner-coder');
  if (parent) {
    const parentRect = parent.getBoundingClientRect();
    const triggerRect = triggerElement.getBoundingClientRect();
    
    const relativeTop = triggerRect.bottom - parentRect.top;
    const relativeLeft = triggerRect.left - parentRect.left - 130; // offset width
    
    menu.style.top = `${relativeTop}px`;
    menu.style.left = `${Math.max(8, relativeLeft)}px`;
  }
  _activeContextMenu = menu;
}

// ─── Teardown (called by router when leaving coder page) ──────────────────────
export function teardownCoderPage() {
  // 1. Close all open context menus immediately
  closeAllCoderMenus();

  // 2. Remove any hover/active states from conv items
  document.querySelectorAll('.coder-conv-item.menu-active, .coder-conv-item:hover').forEach(el => {
    el.classList.remove('menu-active');
  });

  // 3. Reset active menu tracking
  _activeContextMenu = null;

  // 4. Hide the coder-item-actions-menu if it somehow floated open
  const actionsMenu = document.getElementById('coder-item-actions-menu');
  if (actionsMenu) {
    actionsMenu.classList.add('hidden');
    actionsMenu.style.display = '';
    actionsMenu.style.visibility = '';
  }

  // 5. Force-hide the entire coder sidebar subpanel for guaranteed clean state
  const innerCoder = document.getElementById('nav-inner-coder');
  if (innerCoder) {
    innerCoder.style.display = 'none';
    innerCoder.style.visibility = 'hidden';
    innerCoder.style.pointerEvents = 'none';
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export function initCoderPage() {
  // Boot streaming modules first so WS connects before any project is loaded
  initStreamModules();
  loadConversations();

  // Restore active project workspace on startup and show active project name
  const savedProj = localStorage.getItem('hekki_coder_active_project');
  if (savedProj) {
    try {
      _activeProject = JSON.parse(savedProj);
      document.getElementById('coder-welcome-screen')?.classList.add('hidden');
      document.getElementById('coder-chat-area')?.classList.remove('hidden');
      
      const sidebarProjName = document.getElementById('coder-active-project-name');
      if (sidebarProjName && _activeProject.name) sidebarProjName.textContent = _activeProject.name;
      
      connectCoderWs();

      // Restore active conversation session ID
      const savedActiveConvId = localStorage.getItem('hekki_coder_active_conv_id');
      if (savedActiveConvId && _conversations.some(c => c.id === savedActiveConvId)) {
        selectConversation(savedActiveConvId);
      } else if (_conversations.length > 0) {
        selectConversation(_conversations[0].id);
      } else {
        createNewConversation('Session 1');
      }
    } catch (e) {
      localStorage.removeItem('hekki_coder_active_project');
    }
  }

  // 1. Click outside handler to close any opened dropdown menus
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.coder-context-menu') && 
        !e.target.closest('#coder-sidebar-btn-plus') && 
        !e.target.closest('#coder-toolbar-btn-filter') &&
        !e.target.closest('.coder-btn-more')) {
      closeAllCoderMenus();
    }
  });

  // Dock button → navigate
  document.getElementById('mode-coder')?.addEventListener('click', () => {
    window._router?.navigateTo('coder');
  });

  // Top action 1: + New Conversation
  document.getElementById('coder-top-btn-new')?.addEventListener('click', () => {
    if (!_activeProject) { openCoderWorkspacePopup(); return; }
    createNewConversation();
  });

  // Top action 2: Conversation History tab
  document.getElementById('coder-top-btn-history')?.addEventListener('click', () => {
    _filterScheduled = false;
    // Turn off checkmark in dropdown filter too
    const checkIco = document.querySelector('#coder-filter-opt-scheduled i');
    if (checkIco) checkIco.style.opacity = '0';
    document.getElementById('coder-filter-opt-scheduled')?.classList.remove('active');
    renderConversationList();
  });

  // Top action 3: Scheduled Tasks tab
  document.getElementById('coder-top-btn-scheduled')?.addEventListener('click', () => {
    _filterScheduled = true;
    // Turn on checkmark in dropdown filter too
    const checkIco = document.querySelector('#coder-filter-opt-scheduled i');
    if (checkIco) checkIco.style.opacity = '1';
    document.getElementById('coder-filter-opt-scheduled')?.classList.add('active');
    renderConversationList();
  });

  // 2. Active Project Settings Cog button click
  document.getElementById('coder-sidebar-btn-settings')?.addEventListener('click', () => {
    openCoderWorkspacePopup();
  });

  // 3. Active Project Actions Plus button click
  document.getElementById('coder-sidebar-btn-plus')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('coder-project-plus-menu');
    const isHidden = menu?.classList.contains('hidden');
    closeAllCoderMenus();
    if (isHidden) {
      menu?.classList.remove('hidden');
      _activeContextMenu = menu;
    }
  });

  // Plus menu options binding
  document.getElementById('coder-menu-opt-new-project')?.addEventListener('click', () => {
    closeAllCoderMenus();
    openCoderWorkspacePopup();
    showPopupStep('new');
  });

  document.getElementById('coder-menu-opt-quick-start')?.addEventListener('click', () => {
    closeAllCoderMenus();
    // Quick start with default workspace
    activateProject('default', '', 'new');
  });

  // 4. Toolbar: Filter/Group By button click
  document.getElementById('coder-toolbar-btn-filter')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('coder-filter-dropdown');
    const isHidden = menu?.classList.contains('hidden');
    closeAllCoderMenus();
    if (isHidden) {
      menu?.classList.remove('hidden');
      _activeContextMenu = menu;
    }
  });

  // Filter & Group options list binding
  document.querySelectorAll('#coder-filter-dropdown [data-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      _groupBy = btn.dataset.group;
      document.querySelectorAll('#coder-filter-dropdown [data-group] i').forEach(ico => {
        ico.style.opacity = ico.parentElement.dataset.group === _groupBy ? '1' : '0';
      });
      document.querySelectorAll('#coder-filter-dropdown [data-group]').forEach(item => {
        item.classList.toggle('active', item.dataset.group === _groupBy);
      });
      renderConversationList();
    });
  });

  document.querySelectorAll('#coder-filter-dropdown [data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      _sortBy = btn.dataset.sort;
      document.querySelectorAll('#coder-filter-dropdown [data-sort] i').forEach(ico => {
        ico.style.opacity = ico.parentElement.dataset.sort === _sortBy ? '1' : '0';
      });
      document.querySelectorAll('#coder-filter-dropdown [data-sort]').forEach(item => {
        item.classList.toggle('active', item.dataset.sort === _sortBy);
      });
      renderConversationList();
    });
  });

  document.querySelectorAll('#coder-filter-dropdown [data-subtitle]').forEach(btn => {
    btn.addEventListener('click', () => {
      _subtitleType = btn.dataset.subtitle;
      document.querySelectorAll('#coder-filter-dropdown [data-subtitle] i').forEach(ico => {
        ico.style.opacity = ico.parentElement.dataset.subtitle === _subtitleType ? '1' : '0';
      });
      document.querySelectorAll('#coder-filter-dropdown [data-subtitle]').forEach(item => {
        item.classList.toggle('active', item.dataset.subtitle === _subtitleType);
      });
      renderConversationList();
    });
  });

  // Filter Scheduled checkbox toggle
  document.getElementById('coder-filter-opt-scheduled')?.addEventListener('click', () => {
    _filterScheduled = !_filterScheduled;
    const checkIco = document.querySelector('#coder-filter-opt-scheduled i');
    if (checkIco) checkIco.style.opacity = _filterScheduled ? '1' : '0';
    document.getElementById('coder-filter-opt-scheduled').classList.toggle('active', _filterScheduled);
    renderConversationList();
  });

  // 5. Toolbar: Folder-plus (New Session) button click
  document.getElementById('coder-toolbar-btn-new-session')?.addEventListener('click', () => {
    if (!_activeProject) { openCoderWorkspacePopup(); return; }
    createNewConversation();
  });

  // 6. Toolbar: Sort direction chevron click
  document.getElementById('coder-toolbar-btn-sort-dir')?.addEventListener('click', () => {
    _sortDir = _sortDir === 'desc' ? 'asc' : 'desc';
    const sortIcon = document.getElementById('coder-sort-dir-icon');
    if (sortIcon) {
      sortIcon.style.transform = _sortDir === 'asc' ? 'rotate(180deg)' : '';
      sortIcon.style.transition = 'transform 0.15s ease';
    }
    renderConversationList();
  });

  // 7. Item Action context menu choices
  document.getElementById('coder-item-opt-unread')?.addEventListener('click', () => {
    if (!_activeMenuConvId) return;
    const conv = _conversations.find(c => c.id === _activeMenuConvId);
    if (conv) {
      conv.unread = !conv.unread;
      saveConversations();
      renderConversationList();
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
        renderConversationList();
        updateCoderBreadcrumb();
      }
    }
    closeAllCoderMenus();
  });

  document.getElementById('coder-item-opt-delete')?.addEventListener('click', async () => {
    if (!_activeMenuConvId) return;
    const confirmed = await showCustomConfirm('Delete Session', 'Are you sure you want to delete this coding session? This action cannot be undone.');
    if (confirmed) {
      _conversations = _conversations.filter(c => c.id !== _activeMenuConvId);
      saveConversations();
      
      // Clean up localStorage for the deleted session
      localStorage.removeItem(`hekki_coder_messages_${_activeMenuConvId}`);

      if (_activeConvId === _activeMenuConvId) {
        const nextActiveId = _conversations[0]?.id || null;
        if (nextActiveId) {
          selectConversation(nextActiveId);
        } else {
          setActiveConvId(null);
          clearCoderChat();
        }
      } else {
        renderConversationList();
        updateCoderBreadcrumb();
      }
    }
    closeAllCoderMenus();
  });

  // Popup step navigations
  document.querySelectorAll('.coder-popup-back').forEach(btn =>
    btn.addEventListener('click', () => showPopupStep('choose'))
  );
  document.getElementById('coder-popup-close')?.addEventListener('click', closeCoderWorkspacePopup);
  document.getElementById('coder-workspace-popup')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCoderWorkspacePopup();
  });

  // New project confirm
  document.getElementById('coder-btn-create-project')?.addEventListener('click', () => {
    const name = document.getElementById('coder-new-project-name')?.value.trim();
    if (!name) return;
    activateProject(name, '', 'new');
  });

  // Trigger native OS folder picker via API
  document.getElementById('coder-btn-browse-existing')?.addEventListener('click', async () => {
    try {
      const resp = await fetch('/api/workspace/browse', { method: 'POST' });
      if (!resp.ok) throw new Error('Browse failed');
      const data = await resp.json();
      if (data.path) {
        document.getElementById('coder-exist-path').value = data.path;
        const preview = document.getElementById('coder-exist-path-preview');
        if (preview) preview.textContent = data.path;
      }
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Browse Error', 'Could not open folder picker.', 3000);
    }
  });

  // Existing project confirm
  document.getElementById('coder-btn-load-existing')?.addEventListener('click', () => {
    const path = document.getElementById('coder-exist-path')?.value.trim();
    if (!path) {
      if (window.showToast) window.showToast('Select Folder', 'Please click Select Folder first.', 3000);
      return;
    }
    const name = path.split(/[\\/]/).filter(Boolean).pop() || 'project';
    activateProject(name, path, 'existing');
  });

  // Existing: path input → update preview
  document.getElementById('coder-exist-path')?.addEventListener('input', e => {
    const path = e.target.value;
    const preview = document.getElementById('coder-exist-path-preview');
    if (preview) preview.textContent = path || '—';
  });

  // Chat input
  const chatInput = document.getElementById('coder-input');
  const sendBtn = document.getElementById('coder-btn-send');

  chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    if (sendBtn) sendBtn.classList.toggle('hidden', !chatInput.value.trim());
  });

  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const txt = chatInput.value;
      chatInput.value = '';
      chatInput.style.height = '';
      sendBtn?.classList.add('hidden');
      sendCoderMessage(txt);
    }
  });

  sendBtn?.addEventListener('click', () => {
    const txt = chatInput.value;
    chatInput.value = '';
    chatInput.style.height = '';
    sendBtn.classList.add('hidden');
    sendCoderMessage(txt);
  });

  document.getElementById('coder-btn-stop')?.addEventListener('click', () => {
    stopCoderChat();
  });

  // Attach button event listener
  document.getElementById('coder-btn-attach')?.addEventListener('click', () => {
    if (window.showToast) {
      window.showToast('Attach Files', 'File attachment support is active inside workspace.', 2000);
    }
  });

  // Welcome screen shortcut: directly open corresponding step
  document.getElementById('coder-welcome-card-new')?.addEventListener('click', () => {
    openCoderWorkspacePopup();
    showPopupStep('new');
  });

  document.getElementById('coder-welcome-card-existing')?.addEventListener('click', async () => {
    try {
      const resp = await fetch('/api/workspace/browse', { method: 'POST' });
      if (!resp.ok) throw new Error('Browse failed');
      const data = await resp.json();
      if (data.path) {
        document.getElementById('coder-exist-path').value = data.path;
        const preview = document.getElementById('coder-exist-path-preview');
        if (preview) preview.textContent = data.path;
        
        openCoderWorkspacePopup();
        showPopupStep('existing');
      }
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Browse Error', 'Could not open folder picker.', 3000);
    }
  });
}
