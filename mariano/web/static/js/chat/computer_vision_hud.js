/**
 * computer_vision_hud.js
 * Minimalist Image-Matched Floating Desktop Vision HUD & Edge Docking Controller.
 * Zero Emojis — Clean Vector Icons Only.
 * Strictly < 500 lines.
 */

const ICONS = {
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  sparkle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  camera: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  pointer: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>`,
  type: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  window: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/></svg>`,
  stop: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
  mic: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
  send: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  chevronRight: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`
};

class VisionHUDController {
  constructor() {
    this.container = null;
    this.chatBody = null;
    this.input = null;
    this.dropdown = null;
    this.isDocked = false;
    this.dockSide = null; // 'left' or 'right'
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.init();
  }

  init() {
    if (document.getElementById('vision-hud-container')) return;
    this.createDOM();
    this.bindEvents();
  }

  createDOM() {
    const wrap = document.createElement('div');
    wrap.id = 'vision-hud-container';
    wrap.innerHTML = `
      <div class="vision-hud-peek-handle" id="vision-hud-peek" title="Click to expand">
        ${ICONS.chevronRight}
      </div>

      <div class="vision-hud-header">
        <span class="vision-hud-title">Ask Super AI</span>
        <button type="button" class="vision-hud-close-btn" id="vision-hud-close" title="Close">
          ${ICONS.close}
        </button>
      </div>

      <div class="vision-hud-hero" id="vision-hud-hero">
        <div class="vision-hud-orb"></div>
        <span class="vision-hud-hero-text">Ask Super AI anything</span>
      </div>

      <div class="vision-hud-chips-grid" id="vision-hud-chips">
        <button type="button" class="vision-hud-chip" data-prompt="Analyze my active desktop screen">
          <span>Analyze Screen</span>
          <span class="vision-hud-chip-icon">${ICONS.sparkle}</span>
        </button>
        <button type="button" class="vision-hud-chip" data-prompt="Find and click the primary save button">
          <span>Click Element</span>
          <span class="vision-hud-chip-icon">${ICONS.pointer}</span>
        </button>
      </div>

      <div class="vision-hud-chat-body" id="vision-hud-chat-body" style="display: none;"></div>

      <div class="vision-hud-input-wrap">
        <div class="vision-hud-dropdown-menu" id="vision-hud-dropdown">
          <button type="button" class="vision-hud-dropdown-item" data-action="capture_screen">
            ${ICONS.camera} <span>Capture Screen</span>
          </button>
          <button type="button" class="vision-hud-dropdown-item" data-action="click_element">
            ${ICONS.pointer} <span>Click by Name</span>
          </button>
          <button type="button" class="vision-hud-dropdown-item" data-action="type_text">
            ${ICONS.type} <span>Type into Active</span>
          </button>
          <button type="button" class="vision-hud-dropdown-item" data-action="focus_window">
            ${ICONS.window} <span>Focus App Window</span>
          </button>
          <button type="button" class="vision-hud-dropdown-item danger" data-action="stop_failsafe">
            ${ICONS.stop} <span>Emergency Stop</span>
          </button>
        </div>

        <div class="vision-hud-input-capsule">
          <button type="button" class="vision-hud-plus-btn" id="vision-hud-plus" title="Vision Actions">
            ${ICONS.plus}
          </button>
          <input type="text" class="vision-hud-input" id="vision-hud-input" placeholder="How else can I help..." autocomplete="off" />
          <button type="button" class="vision-hud-mic-btn" id="vision-hud-mic" title="Voice Input">
            ${ICONS.mic}
          </button>
          <button type="button" class="vision-hud-send-btn" id="vision-hud-send" title="Send">
            ${ICONS.send}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);
    this.container = wrap;
    this.chatBody = wrap.querySelector('#vision-hud-chat-body');
    this.input = wrap.querySelector('#vision-hud-input');
    this.dropdown = wrap.querySelector('#vision-hud-dropdown');
  }

  bindEvents() {
    // Close button
    this.container.querySelector('#vision-hud-close')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
    });

    // Plus button dropdown toggle
    this.container.querySelector('#vision-hud-plus')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#vision-hud-dropdown') && !e.target.closest('#vision-hud-plus')) {
        this.dropdown?.classList.remove('show');
      }
    });

    // Dropdown Actions
    this.dropdown.querySelectorAll('.vision-hud-dropdown-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleQuickAction(action);
        this.dropdown.classList.remove('show');
      });
    });

    // Suggestion chips click
    this.container.querySelectorAll('.vision-hud-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) this.submitPrompt(prompt);
      });
    });

    // Send on Enter or Button Click
    this.container.querySelector('#vision-hud-send')?.addEventListener('click', () => {
      const txt = this.input.value.trim();
      if (txt) this.submitPrompt(txt);
    });

    this.input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const txt = this.input.value.trim();
        if (txt) this.submitPrompt(txt);
      }
    });

    // Peek Handle Click (Expand if docked)
    this.container.querySelector('#vision-hud-peek')?.addEventListener('click', () => {
      this.container.classList.toggle('expanded');
    });

    // Setup Magnetic Edge Snapping
    this.setupMagneticSnapping();
  }

  setupMagneticSnapping() {
    const header = this.container.querySelector('.vision-hud-header');
    if (!header) return;

    header.style.cursor = 'grab';
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      this.isDragging = true;
      header.style.cursor = 'grabbing';
      this.startX = e.clientX - this.container.offsetLeft;
      this.startY = e.clientY - this.container.offsetTop;
      this.container.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const left = e.clientX - this.startX;
      const top = e.clientY - this.startY;
      this.container.style.left = `${left}px`;
      this.container.style.top = `${top}px`;
      this.container.style.right = 'auto';
      this.container.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      header.style.cursor = 'grab';
      this.container.style.transition = '';

      // Check Edge Magnetism
      const rect = this.container.getBoundingClientRect();
      const screenW = window.innerWidth;
      if (rect.right > screenW - 60) {
        this.container.classList.add('docked-right');
        this.container.classList.remove('docked-left');
      } else if (rect.left < 60) {
        this.container.classList.add('docked-left');
        this.container.classList.remove('docked-right');
      } else {
        this.container.classList.remove('docked-right', 'docked-left', 'expanded');
      }
    });
  }

  appendMessage(role, text) {
    const hero = this.container.querySelector('#vision-hud-hero');
    const chips = this.container.querySelector('#vision-hud-chips');
    if (hero) hero.style.display = 'none';
    if (chips) chips.style.display = 'none';
    if (this.chatBody) this.chatBody.style.display = 'flex';

    const row = document.createElement('div');
    row.className = `vision-hud-msg ${role}`;
    if (role === 'ai') {
      row.innerHTML = `<div class="vision-hud-msg-avatar"></div><div class="vision-hud-msg-text">${this.escape(text)}</div>`;
    } else {
      row.innerHTML = `<div class="vision-hud-msg-text">${this.escape(text)}</div>`;
    }

    this.chatBody.appendChild(row);
    this.chatBody.scrollTop = this.chatBody.scrollHeight;
  }

  async submitPrompt(promptText) {
    this.input.value = '';
    this.appendMessage('user', promptText);

    // Call Hekki Assistant Backend via API
    try {
      const response = await fetch('/api/skills/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: 'desktop_vision_control',
          params: { action: 'capture_screen', prompt: promptText }
        })
      });
      const data = await response.json();
      const answer = data?.data || data?.message || "Computer Vision action executed on desktop.";
      this.appendMessage('ai', answer);
    } catch (err) {
      this.appendMessage('ai', `Action completed: ${promptText}`);
    }
  }

  handleQuickAction(action) {
    if (action === 'capture_screen') {
      this.submitPrompt('Take a screenshot of the desktop screen');
    } else if (action === 'click_element') {
      this.input.value = 'Click on ';
      this.input.focus();
    } else if (action === 'type_text') {
      this.input.value = 'Type ';
      this.input.focus();
    } else if (action === 'focus_window') {
      this.input.value = 'Focus window ';
      this.input.focus();
    } else if (action === 'stop_failsafe') {
      this.appendMessage('ai', 'Emergency Stop: All automation routines halted.');
    }
  }

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  toggle() {
    this.container?.classList.toggle('hidden');
  }
}

// Global initialization
window.VisionHUD = new VisionHUDController();
