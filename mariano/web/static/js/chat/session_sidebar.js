/* === chat/session_sidebar.js — Sidebar playground list, dropdowns, rename/archive/delete === */

export const getLatestActivityTime = (c) => {
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

export const isPlaygroundChat = (c) => Boolean(c && (
  c.isPlayground ||
  c.isDebate ||
  (c.id && (String(c.id).startsWith('playground_') || String(c.id).startsWith('debate_')))
));

/**
 * renderPlaygroundList — renders the Playground/Arena section in the sidebar.
 * Called from ChatSessionManager.renderChatsList().
 * @param {Array} pChats — array of playground chat objects
 * @param {string} activeChatId — the currently active chat id
 * @param {Function} loadChatFn — function to load a chat
 * @param {Function} toggleDropdownFn — function to show context menu
 * @param {string} escapeHtmlFn — html escape function
 */
export function renderPlaygroundList(pChats, activeChatId, loadChatFn, toggleDropdownFn, escapeHtmlFn) {
  const playgroundList = document.getElementById('playground-list');
  const playgroundSection = document.getElementById('nav-section-playground');
  if (!playgroundList) return;

  const countBadge = document.getElementById('playground-count');
  if (countBadge) countBadge.textContent = pChats.length;
  playgroundList.innerHTML = '';

  if (pChats.length > 0) {
    if (playgroundSection) playgroundSection.style.display = 'block';

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
      if (c.id === activeChatId) item.classList.add('active');
      item.title = cleanPgTitle;
      item.innerHTML = `
        <span class="lbl">${escapeHtmlFn(cleanPgTitle)}</span>
        <span class="opt" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; margin-left:auto; flex-shrink:0;">
          <i data-lucide="more-vertical" style="width:14px; height:14px; pointer-events:none;"></i>
        </span>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('opt') || e.target.closest('.opt')) return;
        loadChatFn(c.id);
      });
      const optBtn = item.querySelector('.opt');
      optBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdownFn(e, c.id, optBtn, c.pinned); });
      playgroundList.appendChild(item);
    });
  } else {
    if (playgroundSection) playgroundSection.style.display = 'none';
  }
  if (window.lucide) lucide.createIcons({ parent: playgroundList });
}

/**
 * closeAllDropdowns — remove any open context menu dropdowns.
 */
export function closeAllDropdowns() {
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
}

/**
 * buildDropdown — create and attach a context menu dropdown for a chat item.
 * @param {string} chatId
 * @param {HTMLElement} optBtn
 * @param {boolean} isPinned
 * @param {object} manager — the ChatSessionManager reference
 * @param {Function} showCustomPromptFn
 */
export function buildDropdown(chatId, optBtn, isPinned, manager, showCustomPromptFn) {
  closeAllDropdowns();
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
    <button class="chat-dropdown-item delete-opt delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg> <span>Delete</span></button>
  `;
  if (window.lucide) lucide.createIcons({ parent: dropdown });
  dropdown.querySelector('.open-opt')?.addEventListener('click', () => { manager.loadChat(chatId); closeAllDropdowns(); });
  dropdown.querySelector('.pin-opt')?.addEventListener('click', () => { manager.togglePinChat(chatId); closeAllDropdowns(); });
  dropdown.querySelector('.rename-opt')?.addEventListener('click', async () => {
    const currentTitle = parentItem ? parentItem.getAttribute('data-title') : (optBtn.parentNode.title || '');
    closeAllDropdowns();
    const newTitle = await showCustomPromptFn('Rename Chat', 'Enter a new title for this conversation:', currentTitle);
    if (newTitle && newTitle.trim()) manager.renameChat(chatId, newTitle.trim());
  });
  dropdown.querySelector('.archive-opt')?.addEventListener('click', () => { manager.archiveChat(chatId); closeAllDropdowns(); });
  dropdown.querySelector('.delete-opt')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllDropdowns();
    manager.deleteChat(chatId);
  });
  optBtn.parentNode.appendChild(dropdown);
  if (window.lucide) lucide.createIcons({ parent: dropdown });
  const closeHandler = (ev) => {
    if (!dropdown.contains(ev.target) && ev.target !== optBtn) { closeAllDropdowns(); }
  };
  window._dropdownCloseHandler = closeHandler;
  setTimeout(() => document.addEventListener('click', closeHandler), 50);
}

/**
 * renderRecentChatsList — renders recent chats in sidebar
 */
export function renderRecentChatsList(chats, activeChatId, loadChatFn, toggleDropdownFn, escapeHtmlFn) {
  const chatList = document.getElementById('recent-list');
  if (!chatList) return;
  chatList.innerHTML = '';
  if (chats.length === 0) {
    chatList.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:8px 6px">No recent chats.</div>';
    return;
  }
  chats.forEach(c => {
    const item = document.createElement('div');
    item.className = 'section-item';
    if (c.id === activeChatId) item.classList.add('active');

    const cleanTitle = (c.title || '').replace(/^🔀\s*/, '').replace(/^\/(?:debate|detective|web|code|pdf|image)\s*/i, '').trim() || c.title;
    item.title = cleanTitle;

    const isStreaming = window._streamBufferApi?.isStreamActive?.(c.id) || false;
    const hasNew = c.hasNewResponse && c.id !== activeChatId;

    let dotHtml = '';
    if (isStreaming && c.id !== activeChatId) {
      dotHtml = `<span style="width:6px;height:6px;border-radius:50%;background:#f97316;display:inline-block;flex-shrink:0;animation:sidebar-pulse 1.2s ease-in-out infinite;" title="Generating..."></span>`;
    } else if (hasNew) {
      dotHtml = `<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;flex-shrink:0;" title="New response"></span>`;
    }

    item.innerHTML = `
      <span class="lbl" style="display:flex;align-items:center;gap:5px;min-width:0;flex:1;overflow:hidden;">${c.pinned ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 32 32" fill="currentColor" style="width:12px;height:12px;margin-right:6px;color:var(--text-3);display:inline-block;vertical-align:-1px;flex-shrink:0;"><path d="M22.41,16.59,20,14.17V5h1V3H11V5h1V14.17L9.59,16.59A2,2,0,0,0,9,18v2h6v7h2V20h6V18A2,2,0,0,0,22.41,16.59Z"/></svg>' : ''}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtmlFn(cleanTitle)}</span>${dotHtml}</span>
      <span class="opt" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; flex-shrink:0;">
        <i data-lucide="more-vertical" style="width:14px; height:14px; pointer-events:none;"></i>
      </span>
    `;
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('opt') || e.target.closest('.opt')) return;
      loadChatFn(c.id);
    });
    const optBtn = item.querySelector('.opt');
    optBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleDropdownFn(e, c.id, optBtn, c.pinned); });
    chatList.appendChild(item);
  });
  if (window.lucide) lucide.createIcons({ parent: chatList });
}
