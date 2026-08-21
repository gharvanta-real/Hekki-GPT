/**
 * coder_page.js — Hekki Coder Page Coordinator (< 500 lines)
 */
import { initCoderStream, sendCoderChat, setCoderStreamContext, stopCoderChat } from './coder_stream_core.js';
import { CoderStreamRenderer } from './coder_stream_render.js';
import {
  _conversations,
  _activeConvId,
  _activeProject,
  _groupBy,
  _sortBy,
  _sortDir,
  _subtitleType,
  _filterScheduled,
  setGroupBy,
  setSortBy,
  setSortDir,
  setSubtitleType,
  setFilterScheduled,
  setActiveProject,
  loadConversations,
  saveConversations,
  setActiveConvId,
  loadMessagesForSession,
  saveMessagesForSession,
  appendCoderMessage,
  selectConversation,
  renderConversationList,
} from './coder_sidebar.js';
import {
  closeAllCoderMenus,
  openItemActionsMenu,
  bindContextMenuActions,
} from './coder_context_menu.js';
import {
  openCoderWorkspacePopup,
  closeCoderWorkspacePopup,
  showPopupStep,
  activateProject,
  bindModalListeners,
} from './coder_modals.js';

let _renderer = null;
let _isCoderPageInitialized = false;

function initStreamModules() {
  _renderer = new CoderStreamRenderer();
  window._handleCoderLegacyEvent = handleCoderEvent;
  initCoderStream(_renderer);
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
      background:${c}20;color:${c};font-size:11px;font-weight:400;border:1px solid ${c}40;">
      <span style="width:6px;height:6px;border-radius:50%;background:${c};flex-shrink:0;"></span>
      ${msg.state} · ${msg.tokens_consumed ?? 0} tkns
    </span>`;
}

function resetFsmBadge() {
  const badge = document.getElementById('coder-fsm-badge');
  if (badge) badge.innerHTML = '';
}

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

function startNewConversationTemp() {
  setActiveConvId(null);
  if (_renderer) _renderer.clearChat();
  const col = document.getElementById('coder-chat-col');
  if (col) {
    col.innerHTML = '';
    col.style.display = 'none';
  }
  const welcome = document.getElementById('coder-chat-welcome');
  if (welcome) welcome.style.display = 'flex';

  renderConversationList(
    (id) => selectConversation(id, _renderer, updateCoderBreadcrumb),
    openItemActionsMenu
  );

  if (window._router?.currentPage === 'coder' && window.updateTitleBreadcrumb) {
    const projName = _activeProject?.name || 'default';
    window.updateTitleBreadcrumb(projName, 'New Session');
  }
}

function createNewConversation(title) {
  startNewConversationTemp();
}

function updateCoderBreadcrumb() {
  if (window._router?.currentPage !== 'coder') return;
  if (window.updateTitleBreadcrumb) {
    const projName = _activeProject?.name || 'default';
    const activeConv = _conversations.find(c => c.id === _activeConvId);
    const chatTitle = activeConv ? activeConv.title : '';
    window.updateTitleBreadcrumb(projName, chatTitle);
  }
}
window.updateCoderBreadcrumb = updateCoderBreadcrumb;

export function teardownCoderPage() {
  closeAllCoderMenus();
  document.querySelectorAll('.coder-conv-item.menu-active, .coder-conv-item:hover').forEach(el => {
    el.classList.remove('menu-active');
  });
  const actionsMenu = document.getElementById('coder-item-actions-menu');
  if (actionsMenu) {
    actionsMenu.classList.add('hidden');
    actionsMenu.style.display = '';
    actionsMenu.style.visibility = '';
  }
  const innerCoder = document.getElementById('nav-inner-coder');
  if (innerCoder) {
    innerCoder.style.display = 'none';
    innerCoder.style.visibility = 'hidden';
    innerCoder.style.pointerEvents = 'none';
  }
}

function sendCoderMessage(text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return;

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

  const welcome = document.getElementById('coder-chat-welcome');
  if (welcome) welcome.style.display = 'none';
  const col = document.getElementById('coder-chat-col');
  if (col) col.style.display = 'flex';

  setCoderStreamContext(
    _activeProject?.name       ?? null,
    _activeProject?.path       ?? null,
    _activeConvId              ?? null,
  );

  if (_renderer) {
    _renderer.appendUserMessage(trimmed);
  }

  const msgs = loadMessagesForSession(_activeConvId);
  msgs.push({ role: 'user', text: trimmed, ts: Date.now() });
  saveMessagesForSession(_activeConvId, msgs);

  renderConversationList(
    (id) => selectConversation(id, _renderer, updateCoderBreadcrumb),
    openItemActionsMenu
  );
  updateCoderBreadcrumb();
  sendCoderChat(trimmed);
}

export function initCoderPage() {
  initStreamModules();
  loadConversations();

  const savedProj = localStorage.getItem('hekki_coder_active_project');
  if (savedProj) {
    try {
      const parsedProj = JSON.parse(savedProj);
      setActiveProject(parsedProj);
      document.getElementById('coder-welcome-screen')?.classList.add('hidden');
      document.getElementById('coder-chat-area')?.classList.remove('hidden');
      
      const sidebarProjName = document.getElementById('coder-active-project-name');
      if (sidebarProjName && parsedProj.name) sidebarProjName.textContent = parsedProj.name;

      const savedActiveConvId = localStorage.getItem('hekki_coder_active_conv_id');
      if (savedActiveConvId && _conversations.some(c => c.id === savedActiveConvId)) {
        selectConversation(savedActiveConvId, _renderer, updateCoderBreadcrumb);
      } else if (_conversations.length > 0) {
        selectConversation(_conversations[0].id, _renderer, updateCoderBreadcrumb);
      } else {
        createNewConversation('Session 1');
      }
    } catch (e) {
      localStorage.removeItem('hekki_coder_active_project');
    }
  }

  if (_isCoderPageInitialized) return;
  _isCoderPageInitialized = true;

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.coder-context-menu') && 
        !e.target.closest('#coder-sidebar-btn-plus') && 
        !e.target.closest('#coder-toolbar-btn-filter') &&
        !e.target.closest('.coder-btn-more')) {
      closeAllCoderMenus();
    }
  });

  document.getElementById('mode-coder')?.addEventListener('click', () => {
    window._router?.navigateTo('coder');
  });

  document.getElementById('coder-top-btn-new')?.addEventListener('click', () => {
    if (!_activeProject) { openCoderWorkspacePopup(); return; }
    createNewConversation();
  });

  document.getElementById('coder-top-btn-history')?.addEventListener('click', () => {
    setFilterScheduled(false);
    const checkIco = document.querySelector('#coder-filter-opt-scheduled i');
    if (checkIco) checkIco.style.opacity = '0';
    document.getElementById('coder-filter-opt-scheduled')?.classList.remove('active');
    renderConversationList((id) => selectConversation(id, _renderer, updateCoderBreadcrumb), openItemActionsMenu);
  });

  document.getElementById('coder-top-btn-scheduled')?.addEventListener('click', () => {
    setFilterScheduled(true);
    const checkIco = document.querySelector('#coder-filter-opt-scheduled i');
    if (checkIco) checkIco.style.opacity = '1';
    document.getElementById('coder-filter-opt-scheduled')?.classList.add('active');
    renderConversationList((id) => selectConversation(id, _renderer, updateCoderBreadcrumb), openItemActionsMenu);
  });

  document.getElementById('coder-sidebar-btn-settings')?.addEventListener('click', () => {
    openCoderWorkspacePopup();
  });

  document.getElementById('coder-sidebar-btn-plus')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('coder-project-plus-menu');
    const isHidden = menu?.classList.contains('hidden');
    closeAllCoderMenus();
    if (isHidden) menu?.classList.remove('hidden');
  });

  document.getElementById('coder-menu-opt-new-project')?.addEventListener('click', () => {
    closeAllCoderMenus();
    openCoderWorkspacePopup();
    showPopupStep('new');
  });

  document.getElementById('coder-menu-opt-quick-start')?.addEventListener('click', () => {
    closeAllCoderMenus();
    activateProject('default', '', 'new', createNewConversation);
  });

  document.getElementById('coder-toolbar-btn-filter')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('coder-filter-dropdown');
    const isHidden = menu?.classList.contains('hidden');
    closeAllCoderMenus();
    if (isHidden) menu?.classList.remove('hidden');
  });

  document.querySelectorAll('#coder-filter-dropdown [data-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      setGroupBy(btn.dataset.group);
      document.querySelectorAll('#coder-filter-dropdown [data-group] i').forEach(ico => {
        ico.style.opacity = ico.parentElement.dataset.group === _groupBy ? '1' : '0';
      });
      document.querySelectorAll('#coder-filter-dropdown [data-group]').forEach(item => {
        item.classList.toggle('active', item.dataset.group === _groupBy);
      });
      renderConversationList((id) => selectConversation(id, _renderer, updateCoderBreadcrumb), openItemActionsMenu);
    });
  });

  document.querySelectorAll('#coder-filter-dropdown [data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      setSortBy(btn.dataset.sort);
      document.querySelectorAll('#coder-filter-dropdown [data-sort] i').forEach(ico => {
        ico.style.opacity = ico.parentElement.dataset.sort === _sortBy ? '1' : '0';
      });
      document.querySelectorAll('#coder-filter-dropdown [data-sort]').forEach(item => {
        item.classList.toggle('active', item.dataset.sort === _sortBy);
      });
      renderConversationList((id) => selectConversation(id, _renderer, updateCoderBreadcrumb), openItemActionsMenu);
    });
  });

  document.querySelectorAll('#coder-filter-dropdown [data-subtitle]').forEach(btn => {
    btn.addEventListener('click', () => {
      setSubtitleType(btn.dataset.subtitle);
      document.querySelectorAll('#coder-filter-dropdown [data-subtitle] i').forEach(ico => {
        ico.style.opacity = ico.parentElement.dataset.subtitle === _subtitleType ? '1' : '0';
      });
      document.querySelectorAll('#coder-filter-dropdown [data-subtitle]').forEach(item => {
        item.classList.toggle('active', item.dataset.subtitle === _subtitleType);
      });
      renderConversationList((id) => selectConversation(id, _renderer, updateCoderBreadcrumb), openItemActionsMenu);
    });
  });

  document.getElementById('coder-filter-opt-scheduled')?.addEventListener('click', () => {
    setFilterScheduled(!_filterScheduled);
    const checkIco = document.querySelector('#coder-filter-opt-scheduled i');
    if (checkIco) checkIco.style.opacity = _filterScheduled ? '1' : '0';
    document.getElementById('coder-filter-opt-scheduled').classList.toggle('active', _filterScheduled);
    renderConversationList((id) => selectConversation(id, _renderer, updateCoderBreadcrumb), openItemActionsMenu);
  });

  document.getElementById('coder-toolbar-btn-new-session')?.addEventListener('click', () => {
    if (!_activeProject) { openCoderWorkspacePopup(); return; }
    createNewConversation();
  });

  document.getElementById('coder-toolbar-btn-sort-dir')?.addEventListener('click', () => {
    setSortDir(_sortDir === 'desc' ? 'asc' : 'desc');
    const sortIcon = document.getElementById('coder-sort-dir-icon');
    if (sortIcon) {
      sortIcon.style.transform = _sortDir === 'asc' ? 'rotate(180deg)' : '';
      sortIcon.style.transition = 'transform 0.15s ease';
    }
    renderConversationList((id) => selectConversation(id, _renderer, updateCoderBreadcrumb), openItemActionsMenu);
  });

  bindContextMenuActions(
    (id) => selectConversation(id, _renderer, updateCoderBreadcrumb),
    clearCoderChat,
    updateCoderBreadcrumb
  );

  bindModalListeners(createNewConversation);

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

  document.getElementById('coder-btn-attach')?.addEventListener('click', () => {
    if (window.showToast) {
      window.showToast('Attach Files', 'File attachment support is active inside workspace.', 2000);
    }
  });
}
