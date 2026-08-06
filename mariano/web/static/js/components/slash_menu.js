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
      {
        cmd: '/web',
        label: 'Force Web Search',
        icon: 'globe',
        desc: 'Search 10-15 live web sources & summarize',
        action: (input) => {
          input.value = ' ';
          input.focus();
        }
      },
      {
        cmd: '/code',
        label: 'Code Generation Mode',
        icon: 'code-2',
        desc: 'Write clean, modular code with auto-canvas preview',
        action: (input) => {
          input.value = ' ';
          input.focus();
        }
      },
      {
        cmd: '/pdf',
        label: 'PDF Report / Resume Generator',
        icon: 'file-text',
        desc: 'Generate structured professional PDF document',
        action: (input) => {
          input.value = ' ';
          input.focus();
        }
      },
      {
        cmd: '/image',
        label: 'Image Generation Mode',
        icon: 'image',
        desc: 'Create high-resolution visual assets',
        action: (input) => {
          input.value = ' ';
          input.focus();
        }
      },
      {
        cmd: '/debate',
        label: 'Multi-Model Expert Debate',
        icon: 'swords',
        desc: 'Run dual-model AI debate on complex topics',
        action: (input) => {
          input.value = ' ';
          input.focus();
        }
      }
    ];

    this.init();
  }

  init() {
    this.createSlashMenuDOM();
    this.createCommandPaletteDOM();
    this.bindEvents();
  }

  createSlashMenuDOM() {
    if (document.getElementById('hekki-slash-menu')) return;
    const menu = document.createElement('div');
    menu.id = 'hekki-slash-menu';
    menu.className = 'attach-dropdown hekki-slash-popup hidden';
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
    if (document.getElementById('hekki-command-palette-modal')) return;

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

    // Check if user typed "/web" or "/web " or any registered slash command
    const matchedCmd = this.commands.find(c => val === c.cmd || val.startsWith(c.cmd + ' '));
    if (matchedCmd) {
      const restText = val.startsWith(matchedCmd.cmd + ' ') ? val.slice(matchedCmd.cmd.length + 1) : '';
      input.value = restText;
      this.setSlashTag(matchedCmd);
      this.hideSlashMenu();
      input.focus();
      return;
    }

    const cursorPos = input.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    
    // Check if user typed '/' at start of prompt or after space
    const match = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z]*)$/);
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
    if (!query) return this.commands;
    return this.commands.filter(c => c.cmd.toLowerCase().includes(query) || c.label.toLowerCase().includes(query));
  }

  showSlashMenu(query, input) {
    this.currentQuery = query;
    const filtered = this.getFilteredCommands(query);
    if (filtered.length === 0) {
      this.hideSlashMenu();
      return;
    }

    // Find input container to position touched directly above it
    const inputContainer = input.closest('.chat-input-container, .input-capsule, .chat-input-wrapper') || input;
    const rect = inputContainer.getBoundingClientRect();
    
    // Calculate bottom offset so dropdown touches top edge of input container
    const bottomOffset = window.innerHeight - rect.top + 6;

    this.menuEl.classList.remove('hidden');
    this.menuEl.style.position = 'fixed';
    this.menuEl.style.left = `${Math.max(12, rect.left)}px`;
    this.menuEl.style.bottom = `${bottomOffset}px`;
    this.menuEl.style.top = 'auto';
    this.menuEl.style.display = 'flex';
    this.isOpen = true;

    this.selectedIndex = 0;
    this.renderSlashMenuHTML(filtered, input);
  }

  renderSlashMenuHTML(cmds, input) {
    this.menuEl.innerHTML = cmds.map((c, i) => `
      <button class="attach-dropdown-item ${i === this.selectedIndex ? 'active-item' : ''}" data-index="${i}" style="font-weight: 400 !important; ${i === this.selectedIndex ? 'background: var(--hover); color: var(--text);' : ''}">
        <i data-lucide="${c.icon}"></i>
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
    input.value = input.value.replace(/\/[a-zA-Z]*$/, '').trim();
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
