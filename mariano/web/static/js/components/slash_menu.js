/**
 * slash_menu.js — Family Droplist UI Slash Menu & Command Palette
 * Uses exact attach-dropdown styles & font rules matching the '+' menu.
 * Converts slash selectors (/web) into faded tag chips for 100% prompt focus.
 */

export class SlashMenuManager {
  constructor(sendCallback) {
    this.sendCallback = sendCallback;
    this.activeInput = null;
    this.activeTag = null;
    this.menuEl = null;
    this.paletteEl = null;
    this.selectedIndex = 0;
    this.isOpen = false;
    this.isPaletteOpen = false;

    this.commands = [
      // MCP Plugins (@ Mentions)
      { cmd: '@Github', label: 'GitHub MCP', icon: 'github', desc: 'PRs, issues & code search' },
      { cmd: '@GoogleDrive', label: 'Google Drive MCP', icon: 'hard-drive', desc: 'Files & document content search' },
      { cmd: '@BraveSearch', label: 'Brave Search MCP', icon: 'globe', desc: 'Real-time web search with filters' },
      { cmd: '@Slack', label: 'Slack MCP', icon: 'message-square', desc: 'Channels & team messaging' },
      { cmd: '@Gmail', label: 'Gmail / Email MCP', icon: 'mail', desc: 'Read inbox & send emails' },
      { cmd: '@Notion', label: 'Notion MCP', icon: 'file-text', desc: 'Pages, databases & task notes' },
      { cmd: '@Filesystem', label: 'Filesystem MCP', icon: 'folder', desc: 'Local drive directory & file ops' },
      { cmd: '@Postgres', label: 'Postgres MCP', icon: 'database', desc: 'SQL queries & database schemas' },
      { cmd: '@SQLite', label: 'SQLite MCP', icon: 'database', desc: 'Query local SQLite tables' },
      { cmd: '@GoogleCalendar', label: 'Calendar MCP', icon: 'calendar', desc: 'Events & meeting schedule' },
      { cmd: '@Linear', label: 'Linear MCP', icon: 'check-square', desc: 'Issues & sprint board' },
      { cmd: '@Figma', label: 'Figma MCP', icon: 'figma', desc: 'Design frames & CSS tokens' },

      // Slash Mode Commands
      { cmd: '/web', label: 'Force Web Search', icon: 'globe', desc: 'Search 10-15 live web sources' },
      { cmd: '/code', label: 'Code Generation', icon: 'code-2', desc: 'Clean code & auto-canvas' },
      { cmd: '/pdf', label: 'PDF Report Generator', icon: 'file-text', desc: 'Generate PDF documents' },
      { cmd: '/image', label: 'Image Generation', icon: 'image', desc: 'High-res visual assets' },
      { cmd: '/debate', label: 'Expert AI Debate', icon: 'swords', desc: 'Dual-model AI debate' },
      { cmd: '/detective', label: 'Detective Intelligence', icon: 'radar', desc: 'Company news & hiring signals' },
      { cmd: '/radar', label: 'Announcement Radar', icon: 'activity', desc: 'Real-time 4-tier impact' }
    ];

    this.init();
  }

  init() {
    this.createSlashMenuDOM();
    this.createCommandPaletteDOM();
    this.bindEvents();
  }

  createSlashMenuDOM() {
    let menu = document.getElementById('hekki-slash-menu');
    if (menu) {
      this.menuEl = menu;
      return;
    }
    menu = document.createElement('div');
    menu.id = 'hekki-slash-menu';
    menu.className = 'hekki-slash-popup hidden';
    menu.style.cssText = [
      'position: fixed',
      'z-index: 999999',
      'min-width: 250px',
      'max-width: 320px',
      'pointer-events: auto'
    ].join(';');

    document.body.appendChild(menu);
    this.menuEl = menu;
  }

  createCommandPaletteDOM() {
    let modal = document.getElementById('hekki-command-palette-modal');
    if (modal) {
      this.paletteEl = modal;
      return;
    }

    const modalHTML = `
      <div id="hekki-command-palette-modal" class="modal-overlay hidden" style="z-index: 1000000;">
        <div class="modal-box command-palette-box" style="width: 540px; max-width: 92vw; background: var(--card); border-radius: 12px; padding: 0; overflow: hidden; border: 1px solid var(--border); box-shadow: var(--shadow-md);">
          <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border);">
            <i data-lucide="terminal" style="width: 16px; height: 16px; color: var(--text-3);"></i>
            <input type="text" id="cmd-palette-input" placeholder="Type a command or search actions... (Ctrl + K)" autocomplete="off" style="flex: 1; background: transparent; border: none; outline: none; font-size: 13px; font-weight: 400; color: var(--text); font-family: var(--font);">
            <span style="font-size: 11px; color: var(--text-3); background: var(--hover); padding: 2px 6px; border-radius: 4px;">ESC</span>
          </div>
          <div id="cmd-palette-list" style="max-height: 360px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px;"></div>
        </div>
      </div>
    `;

    const wrap = document.createElement('div');
    wrap.innerHTML = modalHTML.trim();
    this.paletteEl = wrap.firstChild;
    document.body.appendChild(this.paletteEl);
  }

  setSlashTag(cmdObj) {
    if (!cmdObj) {
      this.activeTag = null;
      document.querySelectorAll('.slash-tag-chip').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
      });
      return;
    }

    this.activeTag = cmdObj;
    document.querySelectorAll('.slash-tag-chip').forEach(el => {
      const textEl = el.querySelector('.slash-tag-text');
      if (textEl) textEl.textContent = cmdObj.cmd;
      el.classList.remove('hidden');
      el.style.display = 'inline-flex';
    });
  }

  clearSlashTag() {
    this.setSlashTag(null);
  }

  getActiveTag() {
    return this.activeTag;
  }

  bindEvents() {
    // Document level input delegation
    document.addEventListener('input', (e) => {
      const target = e.target;
      if (target && (target.id === 'chat-input' || target.id === 'chat-input-conv' || target.id === 'debate-input' || target.classList.contains('chat-textarea'))) {
        this.handleInput(e, target);
      }
    });

    document.addEventListener('keydown', (e) => {
      const target = e.target;
      if (target && (target.id === 'chat-input' || target.id === 'chat-input-conv' || target.id === 'debate-input' || target.classList.contains('chat-textarea'))) {
        this.handleKeyDown(e, target);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggleCommandPalette();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.slash-tag-close')) {
        this.clearSlashTag();
        return;
      }

      if (this.isOpen && this.menuEl && !this.menuEl.contains(e.target) && !e.target.closest('#chat-input, #chat-input-conv, #debate-input')) {
        this.hideSlashMenu();
      }
    });

    // Command palette input listener
    const paletteInput = document.getElementById('cmd-palette-input');
    if (paletteInput) {
      paletteInput.addEventListener('input', () => {
        this.renderPaletteResults(paletteInput.value);
      });

      paletteInput.addEventListener('keydown', (e) => {
        const items = Array.from(document.querySelectorAll('.cmd-palette-item'));
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedIndex = (this.selectedIndex + 1) % items.length;
          this.updatePaletteSelection(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
          this.updatePaletteSelection(items);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          items[this.selectedIndex]?.click();
        } else if (e.key === 'Escape') {
          this.hideCommandPalette();
        }
      });
    }

    // Modal background click
    this.paletteEl?.addEventListener('click', (e) => {
      if (e.target === this.paletteEl) this.hideCommandPalette();
    });
  }

  handleInput(e, input) {
    const val = input.value;

    // Check if user typed "/web " or "@Github " (command followed by a space) -> convert to chip tag
    const matchedCmdWithSpace = this.commands.find(c => {
      const lower = val.toLowerCase();
      return lower.startsWith(c.cmd.toLowerCase() + ' ') || lower.startsWith(c.cmd.toLowerCase() + ':');
    });
    if (matchedCmdWithSpace) {
      const restText = val.slice(matchedCmdWithSpace.cmd.length + 1);
      input.value = restText;
      this.setSlashTag(matchedCmdWithSpace);
      this.hideSlashMenu();
      input.focus();
      return;
    }

    const cursorPos = input.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    
    // Check if user typed '/' or '@' at start of prompt or after space
    const match = textBeforeCursor.match(/(?:^|\s)([/@][a-zA-Z0-9_-]*)$/);
    if (match) {
      this.activeInput = input;
      const query = match[1].toLowerCase();
      this.showSlashMenu(query, input);
    } else {
      this.hideSlashMenu();
    }
  }

  handleKeyDown(e, input) {
    // If Backspace pressed on empty input field and tag chip is active, remove tag chip!
    if (e.key === 'Backspace' && input.value === '' && this.activeTag) {
      this.clearSlashTag();
      return;
    }

    if (!this.isOpen) return;

    const filteredCmds = this.getFilteredCommands(this.currentQuery || '');
    if (filteredCmds.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % filteredCmds.length;
      this.updateSlashMenuSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + filteredCmds.length) % filteredCmds.length;
      this.updateSlashMenuSelection();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const cmd = filteredCmds[this.selectedIndex];
      if (cmd) this.executeCommand(cmd, input);
    } else if (e.key === 'Escape') {
      this.hideSlashMenu();
    }
  }

  getFilteredCommands(query) {
    if (!query) return this.commands.slice(0, 5);
    const q = query.toLowerCase();

    if (q.startsWith('@')) {
      const cleanQ = q.slice(1);
      const mcpOnly = this.commands.filter(c => c.cmd.startsWith('@'));
      if (!cleanQ) return mcpOnly.slice(0, 5);
      return mcpOnly.filter(c => 
        c.cmd.toLowerCase().includes(cleanQ) || 
        c.label.toLowerCase().includes(cleanQ) ||
        c.desc.toLowerCase().includes(cleanQ)
      );
    }

    if (q.startsWith('/')) {
      const cleanQ = q.slice(1);
      const slashOnly = this.commands.filter(c => c.cmd.startsWith('/'));
      if (!cleanQ) return slashOnly;
      return slashOnly.filter(c => 
        c.cmd.toLowerCase().includes(cleanQ) || 
        c.label.toLowerCase().includes(cleanQ) ||
        c.desc.toLowerCase().includes(cleanQ)
      );
    }

    return this.commands.filter(c => c.cmd.toLowerCase().includes(q) || c.label.toLowerCase().includes(q));
  }

  showSlashMenu(query, input) {
    // Guard: recreate if menuEl was removed from DOM (e.g., by attach_dropdown cleanup)
    if (!this.menuEl || !document.body.contains(this.menuEl)) {
      this.menuEl = null;
      this.createSlashMenuDOM();
    }
    this.currentQuery = query;
    const filtered = this.getFilteredCommands(query);
    if (filtered.length === 0) {
      this.hideSlashMenu();
      return;
    }

    // Find input container to position relative to
    const inputContainer = input.closest('#input-capsule, #input-capsule-conv, .home-capsule, .chat-input-container, .input-capsule, .chat-input-wrapper') || input;
    const rect = inputContainer.getBoundingClientRect();
    const isHomeScreen = !!input.closest('#input-capsule');

    this.menuEl.classList.remove('hidden');
    this.menuEl.style.position = 'fixed';
    this.menuEl.style.left = `${Math.max(12, rect.left)}px`;

    if (isHomeScreen) {
      // Welcome/Home screen: open BELOW the input capsule
      this.menuEl.style.top = `${rect.bottom + 8}px`;
      this.menuEl.style.bottom = 'auto';
    } else {
      // Conversation bottom bar: open ABOVE the input
      const bottomOffset = window.innerHeight - rect.top + 6;
      this.menuEl.style.bottom = `${bottomOffset}px`;
      this.menuEl.style.top = 'auto';
    }

    this.menuEl.style.display = 'flex';
    this.isOpen = true;

    this.selectedIndex = 0;
    this.renderSlashMenuHTML(filtered, input);
  }

  getLogoSvg(cmd, icon, size = 15) {
    const norm = String(cmd || icon || '').toLowerCase();
    if (norm.includes('gmail') || norm.includes('email') || norm === 'mail') return `<img src="/static/icons/google-mailsvg.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;" />`;
    if (norm.includes('brave')) return `<img src="/static/icons/brave.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;" />`;
    if (norm.includes('calendar') || norm.includes('gcalendar')) return `<img src="/static/icons/google-calendar.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;" />`;
    if (norm.includes('gdrive') || norm.includes('drive')) return `<img src="/static/icons/google-drive.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;" />`;
    if (norm.includes('linear')) return `<img src="/static/icons/linear.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;" />`;
    if (norm.includes('figma')) return `<img src="/static/icons/figma.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;" />`;
    if (norm.includes('postgres')) return `<img src="/static/icons/postgresql.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;" />`;
    if (norm.includes('filesystem') || norm.includes('file')) return `<img src="/static/icons/Filesystem.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;" />`;
    if (norm.includes('github')) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="flex-shrink:0;"><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`;
    if (norm.includes('slack')) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="flex-shrink:0;"><path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165c0-1.394 1.127-2.52 2.522-2.52h2.52v2.52z"/><path fill="#E01E5A" d="M6.313 15.165c0-1.394 1.127-2.52 2.52-2.52 1.396 0 2.524 1.126 2.524 2.52v6.313A2.528 2.528 0 0 1 8.833 24a2.528 2.528 0 0 1-2.52-2.522v-6.313z"/><path fill="#36C5F0" d="M8.833 5.042a2.528 2.528 0 0 1-2.52-2.52A2.528 2.528 0 0 1 8.833 0c1.394 0 2.52 1.127 2.52 2.522v2.52h-2.52z"/><path fill="#36C5F0" d="M8.833 6.313c1.394 0 2.52 1.127 2.52 2.52v1.396a2.528 2.528 0 0 1-2.52 2.524 2.528 2.528 0 0 1-2.522-2.524V8.833c0-1.393 1.128-2.52 2.522-2.52z"/><path fill="#2EB67D" d="M18.956 8.833a2.528 2.528 0 0 1 2.522-2.52A2.528 2.528 0 0 1 24 8.833c0 1.394-1.127 2.52-2.522 2.52h-2.522V8.833z"/><path fill="#2EB67D" d="M17.688 8.833c0 1.394-1.128 2.52-2.52 2.52a2.528 2.528 0 0 1-2.524-2.52V2.522A2.528 2.528 0 0 1 15.167 0a2.528 2.528 0 0 1 2.52 2.522v6.311z"/><path fill="#ECB22E" d="M15.167 18.956a2.528 2.528 0 0 1 2.52 2.52A2.528 2.528 0 0 1 15.167 24c-1.394 0-2.52-1.127-2.52-2.522v-2.522h2.52z"/><path fill="#ECB22E" d="M15.167 17.685c-1.394 0-2.52-1.127-2.52-2.52v-1.396c0-1.394 1.126-2.52 2.52-2.52a2.528 2.528 0 0 1 2.524 2.52v1.396c0 1.393-1.13 2.52-2.524 2.52z"/></svg>`;
    if (norm.includes('notion')) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="flex-shrink:0;"><path fill="currentColor" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.876c-.467-.373-.98-.606-1.82-.513L2.827 2.576c-.373.047-.467.233-.28.466l1.912 1.166zm.793 4.292v13.623c0 .84.373 1.12.98 1.166l14.475-.84c.793-.047.933-.513.933-1.12V7.707c0-.606-.233-.933-.746-.886L5.998 7.614c-.513.047-.746.28-.746.886zm11.758.84c.326.047.467.233.467.56v11.011c0 .28-.14.42-.467.42h-.793c-.233 0-.42-.093-.56-.373l-5.692-8.586v8.446c0 .326-.14.467-.467.467h-1.073c-.326 0-.467-.14-.467-.467V9.9c0-.28.14-.42.467-.42h.886c.28 0 .467.093.56.373l5.599 8.446V9.34c0-.326.14-.467.467-.467h1.073z"/></svg>`;
    if (norm.includes('sqlite')) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="flex-shrink:0;"><path fill="#003B5C" d="M12 2C6.48 2 2 3.34 2 5v14c0 1.66 4.48 3 10 3s10-1.34 10-3V5c0-1.66-4.48-3-10-3zm0 2c4.42 0 8 .89 8 2s-3.58 2-8 2-8-.89-8-2 3.58-2 8-2zm0 16c-4.42 0-8-.89-8-2v-2.12c1.92 1.05 4.8 1.62 8 1.62s6.08-.57 8-1.62V18c0 1.11-3.58 2-8 2zm0-5c-4.42 0-8-.89-8-2v-2.12c1.92 1.05 4.8 1.62 8 1.62s6.08-.57 8-1.62V13c0 1.11-3.58 2-8 2z"/><path fill="#00758F" d="M12 4c4.42 0 8 .89 8 2s-3.58 2-8 2-8-.89-8-2 3.58-2 8-2z"/></svg>`;
    return `<i data-lucide="${icon || 'plug'}" style="width:${size}px;height:${size}px;"></i>`;
  }

  renderSlashMenuHTML(cmds, input) {
    this.menuEl.innerHTML = cmds.map((c, i) => `
      <button class="attach-dropdown-item ${i === this.selectedIndex ? 'active-item' : ''}" data-index="${i}" style="font-weight: 400 !important; ${i === this.selectedIndex ? 'background: var(--hover); color: var(--text);' : ''}">
        ${this.getLogoSvg(c.cmd, c.icon, 15)}
        <span style="font-weight: 400 !important; font-size: 13px;">${c.cmd}</span>
        <span class="shortcut-hint" style="font-weight: 400 !important;">${c.label}</span>
      </button>
    `).join('');

    if (window.lucide) lucide.createIcons({ parent: this.menuEl });

    Array.from(this.menuEl.children).forEach((el, i) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.executeCommand(cmds[i], input);
      });
    });
  }

  updateSlashMenuSelection() {
    const items = Array.from(this.menuEl.children);
    items.forEach((el, i) => {
      if (i === this.selectedIndex) {
        el.style.background = 'var(--hover)';
        el.style.color = 'var(--text)';
      } else {
        el.style.background = 'transparent';
        el.style.color = 'var(--text-2)';
      }
    });
  }

  executeCommand(cmdObj, input) {
    this.hideSlashMenu();
    this.setSlashTag(cmdObj);
    input.value = input.value.replace(/(?:^|\s)[/@][a-zA-Z0-9_-]*$/, '').trim();
    input.focus();
  }

  hideSlashMenu() {
    if (this.menuEl) {
      this.menuEl.classList.add('hidden');
      this.menuEl.style.display = 'none';
      this.isOpen = false;
    }
  }

  toggleCommandPalette() {
    if (this.isPaletteOpen) {
      this.hideCommandPalette();
    } else {
      this.showCommandPalette();
    }
  }

  showCommandPalette() {
    this.paletteEl?.classList.remove('hidden');
    this.isPaletteOpen = true;
    const input = document.getElementById('cmd-palette-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
    this.renderPaletteResults('');
  }

  hideCommandPalette() {
    this.paletteEl?.classList.add('hidden');
    this.isPaletteOpen = false;
  }

  renderPaletteResults(query) {
    const listEl = document.getElementById('cmd-palette-list');
    if (!listEl) return;

    const q = query.toLowerCase().trim();
    const items = [
      ...this.commands.map(c => ({
        type: 'slash',
        title: `${c.cmd} ${c.label}`,
        desc: c.desc,
        icon: c.icon,
        action: () => {
          const targetInput = (document.getElementById('chat-input-conv') && document.getElementById('chat-input-conv').offsetParent !== null)
            ? document.getElementById('chat-input-conv')
            : document.getElementById('chat-input');
          this.executeCommand(c, targetInput);
        }
      })),
      {
        type: 'action',
        title: 'Search Chat History',
        desc: 'Search past conversation threads & messages',
        icon: 'search',
        action: () => {
          document.getElementById('btn-search-nav')?.click();
        }
      },
      {
        type: 'action',
        title: 'Start New Conversation Thread',
        desc: 'Clear active window & open fresh chat',
        icon: 'plus',
        action: () => {
          document.getElementById('btn-new-chat')?.click();
        }
      },
      {
        type: 'action',
        title: 'Open Coder IDE Workspace',
        desc: 'Switch to code editor & project view',
        icon: 'code',
        action: () => {
          if (window.router) window.router.navigate('coder');
        }
      }
    ];

    const filtered = items.filter(it => !q || it.title.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q));
    this.selectedIndex = 0;

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="padding: 16px; font-size: 12px; color: var(--text-3); text-align: center;">No matching commands found.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((it, i) => `
      <button class="attach-dropdown-item ${i === 0 ? 'active-item' : ''}" style="font-weight: 400 !important; ${i === 0 ? 'background: var(--hover); color: var(--text);' : ''}">
        <i data-lucide="${it.icon}"></i>
        <span style="font-weight: 400 !important; font-size: 13px;">${it.title}</span>
        <span class="shortcut-hint" style="font-weight: 400 !important;">${it.desc}</span>
      </button>
    `).join('');

    if (window.lucide) lucide.createIcons({ parent: listEl });

    Array.from(listEl.children).forEach((el, i) => {
      el.addEventListener('click', () => {
        this.hideCommandPalette();
        filtered[i].action();
      });
    });
  }

  updatePaletteSelection(items) {
    items.forEach((el, i) => {
      if (i === this.selectedIndex) {
        el.style.background = 'var(--hover)';
        el.style.color = 'var(--text)';
      } else {
        el.style.background = 'transparent';
        el.style.color = 'var(--text-2)';
      }
    });
  }
}
