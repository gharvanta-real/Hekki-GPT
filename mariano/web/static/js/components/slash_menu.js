/**
 * slash_menu.js — Family Droplist UI Slash Menu & Command Palette
 * Uses exact attach-dropdown styles & font rules matching the '+' menu.
 * Converts slash selectors (/web) into faded tag chips for 100% prompt focus.
 */

export class SlashMenuManager {
  constructor(sendCallback) {
    if (window._slashMenuBound) return window.slashMenu;
    window._slashMenuBound = true;
    window.slashMenu = this;

    this.sendCallback = sendCallback;
    this.activeInput = null;
    this.activeTag = null;
    this.menuEl = null;
    this.paletteEl = null;
    this.selectedIndex = 0;
    this.isOpen = false;
    this.isPaletteOpen = false;

    this.commands = [
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
      { cmd: '/web', label: 'Force Web Search', icon: 'globe', desc: 'Search 10-15 live web sources' },
      { cmd: '/code', label: 'Code Generation', icon: 'code-2', desc: 'Clean code & auto-canvas' },
      { cmd: '/pdf', label: 'PDF Report Generator', icon: 'file-text', desc: 'Generate PDF documents' },
      { cmd: '/image', label: 'Image Generation', icon: 'image', desc: 'High-res visual assets' },
      { cmd: '/debate', label: 'Expert AI Debate', icon: 'swords', desc: 'Dual-model AI debate' },
      { cmd: '/detective', label: 'Detective Intelligence', icon: 'radar', desc: 'Company news & hiring signals' },
      { cmd: '/radar', label: 'Announcement Radar', icon: 'activity', desc: 'Real-time 4-tier impact' },
      { cmd: '/Images-U', label: 'Direct Image Gen', icon: 'image-u', desc: 'Direct prompt to image model (Zero AI trace)' }
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
    if (norm.includes('filesystem')) return `<img src="/static/icons/Filesystem.svg" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;" />`;
    if (norm.includes('github')) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="flex-shrink:0;"><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`;

    if (norm === '/web') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;flex-shrink:0;"><path d="M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2ZM28,15H22A24.26,24.26,0,0,0,19.21,4.45,12,12,0,0,1,28,15ZM16,28a5,5,0,0,1-.67,0A21.85,21.85,0,0,1,12,17H20a21.85,21.85,0,0,1-3.3,11A5,5,0,0,1,16,28ZM12,15a21.85,21.85,0,0,1,3.3-11,6,6,0,0,1,1.34,0A21.85,21.85,0,0,1,20,15Zm.76-10.55A24.26,24.26,0,0,0,10,15h-6A12,12,0,0,1,12.79,4.45ZM4.05,17h6a24.26,24.26,0,0,0,2.75,10.55A12,12,0,0,1,4.05,17ZM19.21,27.55A24.26,24.26,0,0,0,22,17h6A12,12,0,0,1,19.21,27.55Z"/></svg>`;
    if (norm === '/code') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;flex-shrink:0;"><path d="M11.17,6.41,3.59,14a2,2,0,0,0,0,2.83l7.58,7.58,1.42-1.41L5,15.41a.58.58,0,0,1,0-.82l7.58-7.59ZM20.83,6.41l-1.42,1.41L27,15.41a.58.58,0,0,1,0,.82l-7.58,7.59,1.42,1.41L28.41,17.65a2,2,0,0,0,0-2.83Z"/></svg>`;
    if (norm === '/pdf') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;flex-shrink:0;"><polygon points="30 18 30 16 24 16 24 26 26 26 26 22 29 22 29 20 26 20 26 18 30 18"/><path d="M19,26H15V16h4a3.0033,3.0033,0,0,1,3,3v4A3.0033,3.0033,0,0,1,19,26Zm-2-2h2a1.0011,1.0011,0,0,0,1-1V19a1.0011,1.0011,0,0,0-1-1H17Z"/><path d="M11,16H6V26H8V23h3a2.0027,2.0027,0,0,0,2-2V18A2.0023,2.0023,0,0,0,11,16ZM8,21V18h3l.001,3Z"/><path d="M22,14V10a.9092.9092,0,0,0-.3-.7l-7-7A.9087.9087,0,0,0,14,2H4A2.0059,2.0059,0,0,0,2,4V28a2,2,0,0,0,2,2H20V28H4V4h8v6a2.0059,2.0059,0,0,0,2,2h6v2Zm-8-4V4.4L19.6,10Z"/></svg>`;
    if (norm === '/image') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;flex-shrink:0;"><path d="M19,14a3,3,0,1,0-3-3A3,3,0,0,0,19,14Zm0-4a1,1,0,1,1-1,1A1,1,0,0,1,19,10Z"/><path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4Zm0,22H6V20l5-5,5.59,5.59a2,2,0,0,0,2.82,0L21,19l5,5Zm0-4.83-3.59-3.59a2,2,0,0,0-2.82,0L18,19.17l-5.59-5.59a2,2,0,0,0-2.82,0L6,17.17V6H26Z"/></svg>`;
    if (norm === '/debate') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;flex-shrink:0;"><path d="M16,2A14,14,0,1,0,30,16,14.0158,14.0158,0,0,0,16,2Zm0,26A12,12,0,1,1,28,16,12.0137,12.0137,0,0,1,16,28Z"/><circle cx="11" cy="15" r="2"/><circle cx="21" cy="15" r="2"/><path d="M11,21a6,6,0,0,0,10,0Z"/></svg>`;
    if (norm === '/detective') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;flex-shrink:0;"><path d="M26,24.5859l-5.1147-5.1147c.9407-1.3201,1.3683-3.0299.9602-4.8428-.4971-2.2083-2.2783-3.9913-4.4888-4.4786-4.3566-.9604-8.1675,2.8505-7.207,7.2071.4873,2.2105,2.2703,3.9918,4.4787,4.4888,1.8129.408,3.5228-.0197,4.8429-.9605l5.1147,5.1147,1.4141-1.4141h0ZM17.0848,19.8568c-3.0406.805-5.7481-1.9051-4.9404-4.9449.3548-1.3352,1.4352-2.4146,2.7707-2.7682,3.0406-.805,5.7481,1.9051,4.9404,4.9449-.3548,1.3352-1.4352,2.4146-2.7707,2.7682ZM29.0663,16.3569l-.0654-.1709c-1.9897-5.2383-7.5781-9.1865-13.0005-9.1865s-11.0107,3.9482-12.9995,9.1841l-.0664.1733c-.1978.5166-.7764.7739-1.2915.5767-.5161-.1978-.7739-.7759-.5767-1.2915l.0654-.1709c2.2671-5.9688,8.6597-10.4717,14.8687-10.4717s12.6016,4.5029,14.8696,10.4741l.0645.1685M16.0004,27c-6.2088-.0002-12.6006-4.5031-14.8691-10.4741l-.064-.166c-.1987-.5151.0581-1.0942.5732-1.293.5146-.1982,1.0938.0576,1.293.5732l.0659.1709c1.9907,5.2405,7.5788,9.1887,13.001,9.189v2Z"/></svg>`;
    if (norm === '/radar') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;flex-shrink:0;"><path d="M16,2,2,13,8,30H24l6-17Zm2.5818,19.2651-5.9861,1.3306-1.4226-7.8252,4.91-4.209,5.4416,4.0816Zm.1977,2.0054L21.3264,28H10.6736l1.7912-3.3267ZM9.59,13.4937,5.74,12.605,15,5.3291V8.8569ZM17,8.75V5.3291l9.26,7.2759-3.15.727ZM4.6143,14.3979l4.6535,1.0738,1.4844,8.164-1.738,3.2281ZM22.9858,26.8638l-2.5766-4.7852,3.0063-6.7646,3.97-.9161Z"/></svg>`;
    if (norm === '/images-u' || norm === 'image-u') return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor" style="width:${size}px;height:${size}px;flex-shrink:0;"><polygon points="4 20 4 22 8.586 22 2 28.586 3.414 30 10 23.414 10 28 12 28 12 20 4 20"/><path d="M19,14a3,3,0,1,0-3-3A3,3,0,0,0,19,14Zm0-4a1,1,0,1,1-1,1A1,1,0,0,1,19,10Z"/><path d="M26,4H6A2,2,0,0,0,4,6V16H6V6H26V21.17l-3.59-3.59a2,2,0,0,0-2.82,0L18,19.17,11.8308,13l-1.4151,1.4155L14,18l2.59,2.59a2,2,0,0,0,2.82,0L21,19l5,5v2H16v2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4Z"/></svg>`;

    return `<i data-lucide="${icon || 'plug'}" style="width:${size}px;height:${size}px;"></i>`;
  }

  renderSlashMenuHTML(cmds, input) {
    this.menuEl.innerHTML = cmds.map((c, i) => `
      <button class="attach-dropdown-item ${i === this.selectedIndex ? 'active-item' : ''}" data-index="${i}" style="font-weight: 400 !important; ${i === this.selectedIndex ? 'background: var(--hover); color: var(--text);' : ''}">
        ${this.getLogoSvg(c.cmd, c.icon, 15)}
        <span style="font-weight: 400 !important; font-size: 14.5px;">${c.cmd}</span>
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
    const getInput = () => {
      const c = document.getElementById('chat-input-conv');
      return (c && c.offsetParent) ? c : document.getElementById('chat-input');
    };
    const staticActions = [
      { title: 'Search Chat History', desc: 'Search past conversation threads & messages', icon: 'search', action: () => document.getElementById('btn-search-nav')?.click() },
      { title: 'Start New Conversation Thread', desc: 'Clear active window & open fresh chat', icon: 'plus', action: () => document.getElementById('btn-new-chat')?.click() },
      { title: 'Open Coder IDE Workspace', desc: 'Switch to code editor & project view', icon: 'code', action: () => window.router?.navigate('coder') }
    ];
    const items = [
      ...this.commands.map(c => ({ title: `${c.cmd} ${c.label}`, desc: c.desc, icon: c.icon, action: () => this.executeCommand(c, getInput()) })),
      ...staticActions
    ];
    const filtered = items.filter(it => !q || it.title.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q));
    this.selectedIndex = 0;
    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="padding:16px;font-size:12px;color:var(--text-3);text-align:center;">No matching commands found.</div>`;
      return;
    }
    listEl.innerHTML = filtered.map((it, i) => `
      <button class="attach-dropdown-item ${i === 0 ? 'active-item' : ''}" style="font-weight:400!important;${i === 0 ? 'background:var(--hover);color:var(--text);' : ''}">
        <i data-lucide="${it.icon}"></i>
        <span style="font-weight:400!important;font-size:14.5px;">${it.title}</span>
        <span class="shortcut-hint" style="font-weight:400!important;">${it.desc}</span>
      </button>`).join('');
    if (window.lucide) lucide.createIcons({ parent: listEl });
    Array.from(listEl.children).forEach((el, i) => el.addEventListener('click', () => { this.hideCommandPalette(); filtered[i].action(); }));
  }

  updatePaletteSelection(items) {
    items.forEach((el, i) => {
      el.style.background = i === this.selectedIndex ? 'var(--hover)' : 'transparent';
      el.style.color = i === this.selectedIndex ? 'var(--text)' : 'var(--text-2)';
    });
  }
}
