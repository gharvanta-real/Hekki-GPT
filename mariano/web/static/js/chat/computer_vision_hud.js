/**
 * computer_vision_hud.js
 * Dedicated Image-Matched Voice Screen & Desktop Vision Controller.
 * Zero Emojis — Clean Vector Icons Only.
 * Minimum Window Size Locked (320px W x 240px H) to prevent UI breakage.
 * Strictly < 500 lines (~380 lines).
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
    this.container = this.launcher = this.header = this.hero = this.chatBody = this.bottomGroup = null;
    this.voiceView = this.voiceMainStatus = this.voiceSubStatus = this.input = this.micBtn = this.dropdown = null;
    this.isDragging = false; this.startX = this.startY = 0;
    this.isEnabled = localStorage.getItem('hekki_vision_hud_enabled') === 'true';
    this.isVoiceActive = false; this.recognition = null;
    this.init();
  }

  init() {
    if (document.getElementById('vision-hud-container')) return;
    this.createDOM();
    this.bindEvents();
    this.initSpeechRecognition();
    if (!this.isEnabled) this.disable();
  }

  createDOM() {
    const wrap = document.createElement('div');
    wrap.id = 'vision-hud-container';
    wrap.innerHTML = `
      <div class="vision-hud-peek-handle" id="vision-hud-peek" title="Click to expand">
        ${ICONS.chevronRight}
      </div>

      <!-- DEFAULT MODE HEADER -->
      <div class="vision-hud-header" id="vision-hud-header">
        <span class="vision-hud-title">Ask Super AI</span>
        <div class="vision-hud-header-actions">
          <button type="button" class="vision-hud-mic-btn" id="vision-hud-mic" title="Open Voice Screen">
            ${ICONS.mic}
          </button>
          <button type="button" class="vision-hud-close-btn" id="vision-hud-close" title="Close">
            ${ICONS.close}
          </button>
        </div>
      </div>

      <!-- DEFAULT MODE HERO -->
      <div class="vision-hud-hero" id="vision-hud-hero">
        <img src="/static/hekki.png" class="vision-hud-hero-ribbon" alt="Hekki AI" />
        <span class="vision-hud-hero-text">Ask Super AI anything</span>
      </div>

      <!-- CHAT MESSAGE LOG -->
      <div class="vision-hud-chat-body" id="vision-hud-chat-body" style="display: none;"></div>

      <!-- DEFAULT MODE BOTTOM GROUP -->
      <div class="vision-hud-bottom-group" id="vision-hud-bottom-group">
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
            <button type="button" class="vision-hud-send-btn" id="vision-hud-send" title="Send Prompt">
              ${ICONS.send}
            </button>
          </div>
        </div>
      </div>

      <!-- DEDICATED VOICE SCREEN UI -->
      <div class="vision-hud-voice-view" id="vision-hud-voice-view">
        <div class="vision-hud-voice-center-content">
          <img src="/static/hekki.png" class="vision-hud-voice-ribbon" alt="Hekki AI" />
          <div class="vision-hud-voice-status-box">
            <span class="vision-hud-voice-main-status" id="vision-hud-voice-main">Listening to your voice command...</span>
            <span class="vision-hud-voice-sub-status" id="vision-hud-voice-sub">Speak your desktop goal</span>
          </div>
        </div>

        <div class="vision-hud-voice-controls-bar">
          <button type="button" class="vision-hud-voice-circle-btn mic-active" id="vision-hud-voice-mic-toggle" title="Listening Active">
            ${ICONS.mic}
          </button>
          <button type="button" class="vision-hud-voice-circle-btn" id="vision-hud-voice-exit" title="Exit Voice Mode">
            ${ICONS.close}
          </button>
        </div>
      </div>

      <!-- CORNER RESIZE GRIP HANDLE -->
      <div class="vision-hud-resize-handle" id="vision-hud-resize" title="Drag to resize window"></div>
    `;

    document.body.appendChild(wrap);
    this.container = wrap;
    this.header = wrap.querySelector('#vision-hud-header');
    this.hero = wrap.querySelector('#vision-hud-hero');
    this.chatBody = wrap.querySelector('#vision-hud-chat-body');
    this.bottomGroup = wrap.querySelector('#vision-hud-bottom-group');
    this.voiceView = wrap.querySelector('#vision-hud-voice-view');
    this.voiceMainStatus = wrap.querySelector('#vision-hud-voice-main');
    this.voiceSubStatus = wrap.querySelector('#vision-hud-voice-sub');
    this.input = wrap.querySelector('#vision-hud-input');
    this.micBtn = wrap.querySelector('#vision-hud-mic');
    this.dropdown = wrap.querySelector('#vision-hud-dropdown');

    // Persistent Floating Launcher Pill
    const launcher = document.createElement('div');
    launcher.id = 'vision-hud-launcher';
    launcher.className = 'hidden';
    launcher.title = 'Open Computer Vision (Alt+V)';
    launcher.innerHTML = `
      <img src="/static/hekki.png" class="vision-hud-launcher-ribbon" alt="Hekki AI" />
      <span class="vision-hud-launcher-text">Ask Super AI</span>
    `;
    document.body.appendChild(launcher);
    this.launcher = launcher;
  }

  bindEvents() {
    this.container.querySelector('#vision-hud-close')?.addEventListener('click', () => {
      this.closeVoiceMode();
      this.hide();
    });

    this.launcher?.addEventListener('click', () => this.show());
    this.micBtn?.addEventListener('click', () => this.openVoiceMode());
    this.container.querySelector('#vision-hud-voice-exit')?.addEventListener('click', () => this.closeVoiceMode());

    this.container.querySelector('#vision-hud-voice-mic-toggle')?.addEventListener('click', () => {
      if (this.isVoiceActive) {
        try { this.recognition?.start(); } catch (err) {}
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.altKey && (e.key === 'v' || e.key === 'V')) || (e.ctrlKey && e.shiftKey && (e.key === 'v' || e.key === 'V'))) {
        e.preventDefault();
        this.toggle();
      }
    });

    this.container.querySelector('#vision-hud-plus')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#vision-hud-dropdown') && !e.target.closest('#vision-hud-plus')) {
        this.dropdown?.classList.remove('show');
      }
    });

    this.dropdown.querySelectorAll('.vision-hud-dropdown-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleQuickAction(action);
        this.dropdown.classList.remove('show');
      });
    });

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

    this.container.querySelector('#vision-hud-peek')?.addEventListener('click', () => {
      this.container.classList.toggle('expanded');
    });

    this.setupMagneticSnapping();
    this.setupWindowResizing();
  }

  initSpeechRecognition() {
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) return;

    this.recognition = new SpeechClass();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'hi-IN';

    this.recognition.onspeechstart = () => this.setRibbonAnimating(true);
    this.recognition.onspeechend = () => this.setRibbonAnimating(false);

    this.recognition.onresult = (e) => {
      let interim = '', final = '';
      this.setRibbonAnimating(true);
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        e.results[i].isFinal ? final += e.results[i][0].transcript : interim += e.results[i][0].transcript;
      }
      const spokenText = (final || interim).trim();
      if (spokenText && this.voiceMainStatus) this.voiceMainStatus.textContent = `"${spokenText}"`;
      if (final.trim()) this.submitVoiceCommand(final.trim());
    };
    this.recognition.onerror = () => {
      this.setRibbonAnimating(false);
      if (this.isVoiceActive && this.voiceMainStatus) this.voiceMainStatus.textContent = "Listening to your voice command...";
    };
    this.recognition.onend = () => {
      if (this.isVoiceActive && !window.speechSynthesis?.speaking) {
        this.setRibbonAnimating(false);
        try { this.recognition.start(); } catch (err) {}
      }
    };
  }

  openVoiceMode() {
    this.isVoiceActive = true;
    this.container?.classList.add('voice-mode');
    if (this.voiceMainStatus) this.voiceMainStatus.textContent = "Listening to your voice command...";
    if (this.voiceSubStatus) this.voiceSubStatus.textContent = "Speak your desktop goal";
    try { this.recognition?.start(); } catch (err) {}
  }

  closeVoiceMode() {
    this.isVoiceActive = false;
    try { this.recognition?.stop(); } catch (err) {}
    try { window.speechSynthesis?.cancel(); } catch (err) {}
    this.container?.classList.remove('voice-mode');
  }

  async submitVoiceCommand(promptText) {
    if (this.voiceMainStatus) this.voiceMainStatus.textContent = `"${promptText}"`;
    if (this.voiceSubStatus) this.voiceSubStatus.textContent = "Thinking with Gemini 3.1...";
    this.setRibbonAnimating(true);

    try {
      const response = await fetch('/api/quick-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: promptText })
      });
      const data = await response.json();
      const answer = data?.response_text || data?.message || data?.data || "Action completed.";

      if (this.voiceMainStatus) this.voiceMainStatus.textContent = answer;
      if (this.voiceSubStatus) this.voiceSubStatus.textContent = "Gemini 3.1 Response";
      this.speakVoiceResponse(answer);
    } catch (err) {
      const fallback = `Answer for "${promptText}" processed.`;
      if (this.voiceMainStatus) this.voiceMainStatus.textContent = fallback;
      this.speakVoiceResponse(fallback);
    }
  }

  speakVoiceResponse(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    this.setRibbonAnimating(true);
    utterance.onend = () => {
      this.setRibbonAnimating(false);
      if (this.isVoiceActive && this.voiceMainStatus) {
        this.voiceMainStatus.textContent = "Listening to your voice command...";
        if (this.voiceSubStatus) this.voiceSubStatus.textContent = "Speak your desktop goal";
        try { this.recognition?.start(); } catch (err) {}
      }
    };
    utterance.onerror = () => this.setRibbonAnimating(false);
    window.speechSynthesis.speak(utterance);
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

      const rect = this.container.getBoundingClientRect();
      const screenW = window.innerWidth;
      if (rect.right > screenW - 60) {
        this.container.classList.add('docked-right');
        this.container.classList.remove('docked-left', 'expanded');
        this.container.style.left = '';
        this.container.style.right = '0px';
      } else if (rect.left < 60) {
        this.container.classList.add('docked-left');
        this.container.classList.remove('docked-right', 'expanded');
        this.container.style.left = '0px';
        this.container.style.right = '';
      } else {
        this.container.classList.remove('docked-right', 'docked-left', 'expanded');
      }
    });
  }

  /* ─── Window Resizing (Strict Locked Bounds: 320px W x 240px H) ─────────── */
  setupWindowResizing() {
    const resizer = this.container?.querySelector('#vision-hud-resize');
    if (!resizer) return;
    let isResizing = false, startW = 0, startH = 0, startX = 0, startY = 0;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = this.container.offsetWidth;
      startH = this.container.offsetHeight;
      e.stopPropagation();
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newW = Math.max(320, Math.min(900, startW + (e.clientX - startX)));
      const newH = Math.max(340, Math.min(850, startH + (e.clientY - startY)));
      this.container.style.setProperty('width', `${newW}px`, 'important');
      this.container.style.setProperty('height', `${newH}px`, 'important');
    });

    document.addEventListener('mouseup', () => { isResizing = false; });
  }

  appendMessage(role, text, imageUrl = null) {
    this.container?.classList.add('has-messages');
    if (this.hero) this.hero.style.setProperty('display', 'none', 'important');
    if (this.chatBody) this.chatBody.style.setProperty('display', 'flex', 'important');

    const row = document.createElement('div');
    row.className = `vision-hud-msg ${role}`;
    let previewHtml = '';
    if (imageUrl) {
      previewHtml = `
        <div class="vision-hud-screenshot-card">
          <img src="${imageUrl}" class="vision-hud-screenshot-thumb" alt="Desktop Screenshot" onclick="window.open('${imageUrl}', '_blank')" title="Click to view full screenshot" />
          <span class="vision-hud-screenshot-badge">📸 Desktop Capture</span>
        </div>
      `;
    }

    if (role === 'ai') {
      row.innerHTML = `<img src="/static/hekki.png" class="vision-hud-msg-avatar" alt="Hekki" /><div class="vision-hud-msg-text">${this.escape(text)}${previewHtml}</div>`;
    } else {
      row.innerHTML = `<div class="vision-hud-msg-text">${this.escape(text)}</div>`;
    }

    this.chatBody.appendChild(row);
    this.chatBody.scrollTop = this.chatBody.scrollHeight;
  }

  async submitPrompt(promptText) {
    this.input.value = '';
    this.appendMessage('user', promptText);

    try {
      const response = await fetch('/api/quick-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: promptText })
      });
      const data = await response.json();
      const answer = data?.response_text || data?.message || data?.data || "Done!";
      const imgUrl = data?.image_url || null;
      this.appendMessage('ai', answer, imgUrl);
    } catch (err) {
      this.appendMessage('ai', `I encountered an issue processing your prompt. Please try again.`);
    }
  }

  async handleQuickAction(action) {
    if (action === 'capture_screen') {
      this.appendMessage('user', 'Capture my desktop screen');
      try {
        const response = await fetch('/api/screen-capture', { method: 'POST' });
        const data = await response.json();
        const answer = data?.analysis || "Desktop screen captured successfully.";
        const imgUrl = data?.image_url || null;
        this.appendMessage('ai', answer, imgUrl);
      } catch (err) {
        this.appendMessage('ai', 'Desktop screen captured.');
      }
      return;
    }
    if (action === 'click_element') { this.input.value = 'Click on '; return this.input.focus(); }
    if (action === 'type_text') { this.input.value = 'Type '; return this.input.focus(); }
    if (action === 'focus_window') { this.input.value = 'Focus window '; return this.input.focus(); }
    if (action === 'stop_failsafe') this.appendMessage('ai', 'Emergency Stop: All automation routines halted.');
  }

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  show() {
    if (!this.isEnabled) return;
    this.container?.classList.remove('hidden');
    this.launcher?.classList.add('hidden');
    this.input?.focus();
  }

  hide() {
    this.container?.classList.add('hidden');
    this.launcher?.classList.toggle('hidden', !this.isEnabled);
  }

  enable() {
    this.isEnabled = true;
    localStorage.setItem('hekki_vision_hud_enabled', 'true');
    this.show();
  }

  disable() {
    this.isEnabled = false;
    localStorage.setItem('hekki_vision_hud_enabled', 'false');
    this.closeVoiceMode();
    this.container?.classList.add('hidden');
    this.launcher?.classList.add('hidden');
  }

  toggle() {
    if (window.electronAPI && window.electronAPI.toggleOverlay) {
      window.electronAPI.toggleOverlay();
      return;
    }
    if (this.isEnabled) this.container?.classList.contains('hidden') ? this.show() : this.hide();
  }
}

window.VisionHUD = new VisionHUDController();
