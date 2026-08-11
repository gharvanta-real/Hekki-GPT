/* === MARIANO MAIN ENTRY POINT === */

import { initWaveCanvas } from '/static/wave_canvas.js';
import { VoiceProcessor } from '/static/voice_processor.js';
import { TabManager }     from '/static/tab_manager.js';

import { bindInputs, clearInputs, appendMsg, scrollChat, ChatSessionManager } from '/static/js/chat.js';
import { initSettings }    from '/static/js/settings.js';
import { bindNavigation }  from '/static/js/nav.js';
import { router, initRouterState } from '/static/js/router.js';
import { SearchModal }     from '/static/js/components/search_modal.js';
import { SkillsPage }      from '/static/js/pages/skills_page.js?v=205';
import { handleChatAgentEvent } from '/static/js/agent_stream.js';
import { sounds } from '/static/js/sound_effects.js';

// Modular UI component imports
import { showToast } from '/static/js/components/toast.js';
import { bindModelPills, updateModelPills, registerModelPillRefresh } from '/static/js/components/model_selector.js';
import { initAttachDropdowns } from '/static/js/components/attach_dropdown.js';
import { bindSidebarToggle, bindTitlebarActions, bindThemeToggle, bindImageLightbox } from '/static/js/components/layout_controls.js';
import { bindVoice, resetVoiceUIInstance } from '/static/js/components/voice_controller.js';
import { socket, setupSocketEvents, send } from '/static/js/components/socket_manager.js';
// Debate playground  isolated module
import { initDebatePage, handleDebateEvent } from '/static/js/debate/debate_page.js?v=136';
// Coder IDE page
import { initCoderPage, teardownCoderPage } from '/static/js/pages/coder_page.js';
// Images Gallery page
import { ImagesPage } from '/static/js/pages/images_page.js';
// Interactive Live Canvas Engine (Claude Canvas style)
import { LiveCanvasEngine } from '/static/js/components/live_canvas.js';
import { SlashMenuManager } from '/static/js/components/slash_menu.js';
import { ChatMinimapManager } from '/static/js/components/chat_minimap.js';

window.updateModelPills = updateModelPills;
window.showToast = showToast;
window.handleDebateEvent = handleDebateEvent;
window.ChatMinimapManager = ChatMinimapManager;

/* === PWA Service Worker & Installability Engine === */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.log('[PWA] HEKKI ServiceWorker active:', reg.scope))
      .catch(err => console.error('[PWA] ServiceWorker failed:', err));
  });
}

// ── Boot-time Font Restore (runs instantly, zero flash) ───────────────────
(function _restoreFont() {
  const FONT_MAP = {
    'system': {
      font:  '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"',
      serif: '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"',
      ai:    '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"'
    },
    'anthropic': {
      font:  '"anthropic-sans", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      serif: '"anthropic-serif", "Anthropic Serif Fallback Georgia", Georgia, "Times New Roman", serif',
      ai:    '"anthropic-serif", "Anthropic Serif Fallback Georgia", Georgia, "Times New Roman", serif'
    }
  };
  const key = localStorage.getItem('hekki_font') || 'system';
  const cfg = FONT_MAP[key] || FONT_MAP['system'];
  document.documentElement.style.setProperty('--font', cfg.font);
  document.documentElement.style.setProperty('--font-sans', cfg.font);
  document.documentElement.style.setProperty('--font-serif', cfg.serif);
  document.documentElement.style.setProperty('--font-ai', cfg.ai);
})();

let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const pwaBtn = document.getElementById('btn-pwa-install');
  if (pwaBtn) pwaBtn.style.display = 'flex';
});

document.addEventListener('DOMContentLoaded', () => {
  const pwaBtn = document.getElementById('btn-pwa-install');
  if (pwaBtn) {
    pwaBtn.addEventListener('click', async () => {
      if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        const { outcome } = await deferredPwaPrompt.userChoice;
        console.log('[PWA] User response:', outcome);
        deferredPwaPrompt = null;
      } else {
        showToast('Install App', 'To install HEKKI on your device, use your browser menu (...) and select "Install App" or "Add to Home Screen".', 3500);
      }
    });
  }

  // Double-enforce font persistence — CSS custom props from stylesheet
  // load synchronously before this, so inline style always wins here.
  const FONT_MAP_BOOT = {
    'system': {
      font:  '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"',
      serif: '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"',
      ai:    '-apple-system-body, ui-sans-serif, -apple-system, "system-ui", "Segoe UI", Helvetica, "Apple Color Emoji", Arial, "sans-serif", "Segoe UI Emoji", "Segoe UI Symbol"'
    },
    'anthropic': {
      font:  '"anthropic-sans", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      serif: '"anthropic-serif", "Anthropic Serif Fallback Georgia", Georgia, "Times New Roman", serif',
      ai:    '"anthropic-serif", "Anthropic Serif Fallback Georgia", Georgia, "Times New Roman", serif'
    }
  };
  const _fk   = localStorage.getItem('hekki_font') || 'system';
  const _cfg  = FONT_MAP_BOOT[_fk] || FONT_MAP_BOOT['system'];
  document.documentElement.style.setProperty('--font', _cfg.font);
  document.documentElement.style.setProperty('--font-sans', _cfg.font);
  document.documentElement.style.setProperty('--font-serif', _cfg.serif);
  document.documentElement.style.setProperty('--font-ai', _cfg.ai);
});














































//  GLOBALS 
let voice  = null;
let tabs   = null;
let stopWave = null;

// Page instances
let agentPage       = null;
let skillsPage      = null;
let changelogPage   = null;
let projectsSidebar = null;

// Wrap primitive boolean in an object to share mutable state across ES6 modules
const inConversationState = { val: false };
window.inConversationState = inConversationState;

// Helper
const $ = id => document.getElementById(id);

const hasAnyPastProject = () => {
  const activeProj = localStorage.getItem('mariano_active_project');
  if (activeProj) return true;

  try {
    const chats = JSON.parse(localStorage.getItem('mariano_chats') || '[]');
    if (chats.some(c => c.project)) return true;
  } catch (e) {}

  try {
    const sessions = JSON.parse(localStorage.getItem('hekki_agent_sessions') || '[]');
    if (sessions.some(s => s.project)) return true;
  } catch (e) {}

  return false;
};

window.HudLogger = {
  logs: [
    { type: 'info', text: 'System initialized.', timestamp: new Date().toLocaleTimeString() }
  ],
  append(type, text) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { type, text, timestamp };
    this.logs.push(logEntry);
    
    // If the shadow DOM for the tab is active, append it in real time
    const tab = window.tabs?.map.get('tab-process-hud');
    if (tab) {
      const shadow = tab.view.firstChild?.shadowRoot;
      const container = shadow?.getElementById('hud-log-container');
      if (container) {
        const line = document.createElement('div');
        line.className = 'log-line';
        line.innerHTML = `
          <span class="log-time">[${timestamp}]</span>
          <span class="log-text ${type}">${text}</span>
        `;
        container.appendChild(line);
        
        // Auto-scroll to bottom
        const view = tab.view.firstChild;
        if (view) view.scrollTop = view.scrollHeight;
      }
    }
  },
  show() {
    if (!window.tabs) return;
    
    const key = 'tab-process-hud';
    const appPane = document.getElementById('app-pane');
    const resizer = document.getElementById('app-pane-resizer');
    
    if (!window.tabs.map.has(key)) {
      const html = `
        <div style="padding: 16px; min-height: 100%; box-sizing: border-box; background: var(--bg); color: var(--text);">
          <div id="hud-log-container" style="display: flex; flex-direction: column; gap: 6px; font-family: monospace; font-size: 12.5px;"></div>
        </div>
      `;
      const css = `
        :host {
          background: var(--bg) !important;
        }
        .log-line {
          display: flex;
          gap: 8px;
          line-height: 1.5;
          font-family: monospace;
        }
        .log-time {
          color: var(--text-3);
          flex-shrink: 0;
        }
        .log-text {
          word-break: break-all;
          color: var(--text);
        }
        .log-text.exec { color: var(--blue, #2563eb); }
        .log-text.success { color: var(--green, #16a34a); }
        .log-text.failed { color: #dc2626; }
        .log-text.info { color: var(--text-3); }

        :host-context(body.dark) .log-text.exec { color: #60a5fa; }
        :host-context(body.dark) .log-text.success { color: #34d399; }
        :host-context(body.dark) .log-text.failed { color: #f87171; }
      `;
      window.tabs.createTab('process-hud', 'Process HUD', html, css, '', 'terminal');
      
      // Populate with existing logs
      const tab = window.tabs.map.get(key);
      const shadow = tab?.view.firstChild?.shadowRoot;
      const container = shadow?.getElementById('hud-log-container');
      if (container) {
        this.logs.forEach(log => {
          const line = document.createElement('div');
          line.className = 'log-line';
          line.innerHTML = `
            <span class="log-time">[${log.timestamp}]</span>
            <span class="log-text ${log.type}">${log.text}</span>
          `;
          container.appendChild(line);
        });
        const view = tab.view.firstChild;
        if (view) view.scrollTop = view.scrollHeight;
      }
    } else {
      if (appPane && appPane.classList.contains('hidden-pane')) {
        window.tabs.switchTo(key);
      } else if (window.tabs.active === key) {
        appPane?.classList.add('hidden-pane');
        resizer?.classList.add('hidden-pane');
      } else {
        window.tabs.switchTo(key);
      }
    }
  }
};

//  BOOT 
function boot() {
  console.log("Booting MARIANO dashboard...");
  window._router = router;   // expose for coder_page.js and other modules
  initDebatePage();
  initCoderPage();
  // Register coder page teardown so navigating away always cleans up DOM
  router.onLeave('coder', teardownCoderPage);
  // Enforce initial page state = chat (clears any coder DOM/breadcrumb written at boot)
  initRouterState();
  if (window.lucide) {
    console.log("Lucide detected, compiling icons.");
    lucide.createIcons();
  } else {
    console.warn("Lucide library not found on load!");
  }

  voice = new VoiceProcessor();
  tabs  = new TabManager('pane-tabs', 'pane-content', log);
  window.tabs = tabs;

  // Initialize drag resizer for right panel
  const resizer = $('app-pane-resizer');
  const appPane = $('app-pane');
  if (resizer && appPane) {
    let isDragging = false;
    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      document.body.style.cursor = 'col-resize';
      resizer.classList.add('dragging');
      appPane.classList.add('no-transition');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const width = window.innerWidth - e.clientX;
      const minWidth = 280;
      const maxWidth = window.innerWidth * 0.8;
      if (width >= minWidth && width <= maxWidth) {
        appPane.style.width = `${width}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        resizer.classList.remove('dragging');
        appPane.classList.remove('no-transition');
      }
    });
  }

  setGreeting();
  bindSidebarToggle();
  bindThemeToggle();
  bindImageLightbox();
  bindVoice(voice, socket, inConversationState, log);

  // Bind inputs and send queries through WS
  bindInputs((text) => {
    if (window.sounds) window.sounds.playSend();
    send(text, enterConversation, log);
  });
  window.clearInputs = clearInputs;

  bindShortcuts();
  initSettings(setGreeting);
  // Register model pill reactive refresh (auto-updates on every navigation, no hard refresh needed)
  registerModelPillRefresh();
  bindModelPills();
  window.updateModelPills = updateModelPills;

  // Global router refresh hook — re-syncs all input bar UI state on every page switch
  router.onRefresh((page) => {
    // Re-sync bottom input bar vs home screen visibility
    const homeScreen = document.getElementById('home-screen');
    const bottomBar = document.getElementById('bottom-input-bar');
    if (page === 'chat') {
      // Let inConversationState decide which input to show — just re-trigger Lucide icons
      if (window.lucide) lucide.createIcons();
    }
    // Re-init Lucide icons in case any were injected dynamically
    if (window.lucide) lucide.createIcons();
  });

  const handleStopGen = () => {
    socket.send(JSON.stringify({ type: 'stop' }));
    window.setGeneratingState(false);
  };
  $('btn-stop-gen')?.addEventListener('click', handleStopGen);
  $('btn-stop-gen-conv')?.addEventListener('click', handleStopGen);
  initAttachDropdowns(inConversationState);
  bindTitlebarActions();
  new SearchModal(ChatSessionManager);
  window.slashMenu = new SlashMenuManager((text) => send(text, enterConversation, log));

  // Initialize Chat and Debate Minimaps
  window.chatMinimap = new ChatMinimapManager({ containerSelector: '#chat-log', paneSelector: '#chat-pane', isDebate: false });
  window.debateMinimap = new ChatMinimapManager({ containerSelector: '#debate-stream-container', paneSelector: '#debate-pane', isDebate: true });

  router.onRefresh((page) => {
    if (page === 'chat' && window.chatMinimap) {
      window.chatMinimap.refresh();
    } else if ((page === 'debate' || page === 'playground') && window.debateMinimap) {
      window.debateMinimap.refresh();
    }
  });


  // Setup WS events routing and logs reconnect loops
  setupSocketEvents(
    enterConversation,
    log,
    (p) => {
      if (!p.text) return;
      
      if (resetVoiceUIInstance) resetVoiceUIInstance();
      
      const debateInput = document.getElementById('debate-input');
      const agentInput = document.getElementById('agent-task-input');
      if (router.currentRoute === 'debate' && debateInput) {
        debateInput.value = p.text;
        debateInput.style.height = 'auto';
        debateInput.style.height = `${debateInput.scrollHeight}px`;
        debateInput.dispatchEvent(new Event('input'));
        debateInput.focus();
      } else if (router.currentRoute === 'agent' && agentInput) {
        agentInput.value = p.text;
        agentInput.style.height = 'auto';
        agentInput.style.height = `${agentInput.scrollHeight}px`;
        agentInput.dispatchEvent(new Event('input'));
        agentInput.focus();
      } else {
        send(p.text, enterConversation, log);
      }
    }
  );





  //  Register router page callbacks 
  skillsPage      = new SkillsPage(showToast);
  window.router = router;





  router.onNavigate('skills', () => {
    const pane = $('skills-pane');
    if (pane) skillsPage.mount(pane);
  });

  // Images Gallery
  const imagesPage = new ImagesPage(showToast);
  router.onNavigate('images', () => {
    const pane = $('images-pane');
    if (pane) imagesPage.mount(pane);
  });

  router.onNavigate('chat', () => {
    ChatSessionManager.ensureNormalChatActive();

    document.querySelectorAll('.agent-welcome-wrapper').forEach(el => el.remove());

    if (inConversationState.val) {
      $('home-screen')?.classList.add('hidden');
      $('bottom-input-bar')?.classList.remove('hidden');
    } else {
      $('home-screen')?.classList.remove('hidden');
      $('bottom-input-bar')?.classList.add('hidden');
    }
    // Only refresh the dynamic chat session list  never rebuild sidebar HTML,
    // which would destroy all event listeners (theme, toggle, settings, etc.)
    ChatSessionManager.renderChatsList();
  });

  //  Bind dock navigation buttons 
  bindNavigation(tabs, showToast, inConversationState);
  ChatSessionManager.renderChatsList();

  // Auto-resize textareas
  ['chat-input', 'chat-input-conv'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.style.overflowY = 'hidden';
    el.addEventListener('input', () => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
      el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
    });
  });

  // Restore active chat if stored in localStorage
  // CRITICAL: Must check isPlayground flag before deciding how to restore.
  // Debate/Playground chats must NEVER be loaded as normal chats — they belong
  // in the Debates & Playgrounds section and must restore through debate page.
  const storedId = localStorage.getItem('hekki_active_chat_id') || localStorage.getItem('mariano_active_chat_id');
  if (storedId) {
    const chats = ChatSessionManager.getChats();
    const activeChat = chats.find(c => c.id === storedId);
    if (activeChat) {
      if (activeChat.isPlayground) {
        // Playground chat: clear the stored active id so sidebar renders cleanly,
        // reset to home screen. The debate session will be accessible from sidebar.
        ChatSessionManager.setActiveChatId(null);
        localStorage.removeItem('hekki_active_chat_id');
        localStorage.removeItem('mariano_active_chat_id');
        $('home-screen')?.classList.remove('hidden');
        $('bottom-input-bar')?.classList.add('hidden');
        inConversationState.val = false;
        ChatSessionManager.renderChatsList();
      } else {
        // Normal chat: restore it
        ChatSessionManager.loadChat(storedId);
        enterConversation();
      }
    }
  }

  // Global click interceptor for file:/// links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;
    
    if (href.startsWith('file:///')) {
      e.preventDefault();
      
      // Parse file path
      let decodedPath = decodeURIComponent(href.replace('file:///', ''));
      decodedPath = decodedPath.replace(/\\/g, '/');

      // Copy path to clipboard
      navigator.clipboard.writeText(href).then(() => {
        showToast('Link Copied', 'Browser blocked loading local file. Path copied to clipboard.', 3000);
      });
    }
  });

  // Fade out loader and fade in shell
  setTimeout(() => {
    const loader = $('loader');
    if (loader) { loader.classList.add('out'); }
    const shell = $('shell');
    if (shell) { shell.style.opacity = '1'; }
    const input = inConversationState.val ? $('chat-input-conv') : $('chat-input');
    input?.focus();
  }, 900);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

//  GREETING & USER PROFILE & 3D AVATAR CYCLER 
function setup3DAvatar() {
  let curIdx = parseInt(localStorage.getItem('hekki_3d_avatar_idx') || '0', 10);
  if (curIdx === 0) {
    curIdx = 1;
    localStorage.setItem('hekki_3d_avatar_idx', '1');
  }

  const avatarUrl = `/static/avatars/3d-avatar-${curIdx}.webp`;
  ['sidebar-user-avatar', 'debate-sidebar-user-avatar'].forEach(id => {
    const sbAvatar = document.getElementById(id);
    if (!sbAvatar) return;
    if (sbAvatar.tagName && sbAvatar.tagName.toLowerCase() === 'img') {
      sbAvatar.src = avatarUrl;
    } else {
      sbAvatar.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
    }
  });
}

function rotate3DAvatarOnBoot() {
  let lastIdx = parseInt(localStorage.getItem('hekki_3d_avatar_idx') || '0', 10);
  let nextIdx = (lastIdx % 5) + 1;
  localStorage.setItem('hekki_3d_avatar_idx', nextIdx.toString());
  setup3DAvatar();
}
window.setup3DAvatar = setup3DAvatar;

function getRandomDynamicGreeting(name) {
  const hour = new Date().getHours();
  let greetings = [];

  if (hour >= 5 && hour < 12) {
    greetings = [
      "Good morning",
      "Rise and shine",
      "Morning! Ready to build?",
      "Good morning! What's on the agenda?",
      "Fresh start today",
      "Morning! Let's get things done"
    ];
  } else if (hour >= 12 && hour < 17) {
    greetings = [
      "Good afternoon",
      "Hey there! How's your day going?",
      "Afternoon! Ready to work?",
      "Good afternoon! What's next?",
      "Hey! Hope your day is going great"
    ];
  } else if (hour >= 17 && hour < 22) {
    greetings = [
      "Good evening",
      "Evening! Let me know what you need",
      "Good evening! Ready to build something cool?",
      "Hey! How was your day?",
      "Good evening! What can I help with?"
    ];
  } else {
    greetings = [
      "Night owl mode active",
      "Working late tonight?",
      "Late night coding?",
      "Quiet hours! What are we building?",
      "Good evening! Still grinding?"
    ];
  }

  const baseGreet = greetings[Math.floor(Math.random() * greetings.length)];
  if (!name) return baseGreet;

  if (baseGreet.includes("?")) {
    return baseGreet.replace("?", `, ${name}?`);
  } else {
    return `${baseGreet}, ${name}`;
  }
}

function setGreeting(nameOverride) {
  const el = $('greeting-text');
  const updateSidebar = (name) => {
    const sbName = $('sidebar-user-name');
    const dbName = $('debate-sidebar-user-name');
    if (sbName) sbName.textContent = name || 'User';
    if (dbName) dbName.textContent = name || 'User';
  };
  rotate3DAvatarOnBoot();

  if (nameOverride !== undefined) {
    if (el) el.textContent = getRandomDynamicGreeting(nameOverride);
    updateSidebar(nameOverride);
    return;
  }
  
  // Load from backend
  fetch('/api/settings')
    .then(r => r.json())
    .then(cfg => {
      const name = cfg.user_name || localStorage.getItem('hekki_user_name') || '';
      if (el) el.textContent = getRandomDynamicGreeting(name);
      updateSidebar(name);
    })
    .catch(() => {
      if (el) el.textContent = getRandomDynamicGreeting('');
      updateSidebar('');
    });
}

window.isGenerating = false;
window.setGeneratingState = function(isGenerating) {
  window.isGenerating = isGenerating;
  const btnHomeSubmit = $('btn-submit-home');
  const btnConvSubmit = $('btn-submit-conv');
  const btnHomeStop = $('btn-stop-gen');
  const btnConvStop = $('btn-stop-gen-conv');

  const inputHome = $('chat-input');
  const inputConv = $('chat-input-conv');

  const hasAtt = window.attachmentManager ? window.attachmentManager.hasFiles() : false;
  const hasTextHome = (inputHome && inputHome.value.trim() !== '') || hasAtt;
  const hasTextConv = (inputConv && inputConv.value.trim() !== '') || hasAtt;

  if (isGenerating) {
    if (hasTextHome) {
      btnHomeSubmit?.classList.remove('hidden');
      btnHomeStop?.classList.add('hidden');
    } else {
      btnHomeSubmit?.classList.add('hidden');
      btnHomeStop?.classList.remove('hidden');
    }

    if (hasTextConv) {
      btnConvSubmit?.classList.remove('hidden');
      btnConvStop?.classList.add('hidden');
    } else {
      btnConvSubmit?.classList.add('hidden');
      btnConvStop?.classList.remove('hidden');
    }
  } else {
    btnHomeStop?.classList.add('hidden');
    btnConvStop?.classList.add('hidden');

    if (hasTextHome) {
      btnHomeSubmit?.classList.remove('hidden');
    } else {
      btnHomeSubmit?.classList.add('hidden');
    }
    if (hasTextConv) {
      btnConvSubmit?.classList.remove('hidden');
    } else {
      btnConvSubmit?.classList.add('hidden');
    }
  }
};

//  SHORTCUTS 
function bindShortcuts() {
  document.querySelectorAll('.shortcut').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.textContent.trim();
      $('chat-input')?.focus();
      $('chat-input').value = label + ': ';
      $('chat-input').dispatchEvent(new Event('input'));
    });
  });
}

//  CONVERSATION MODE 
function enterConversation() {
  inConversationState.val = true;
  
  // Show convo pane, hide welcome pane
  document.getElementById('home-screen')?.classList.add('hidden');
  document.getElementById('bottom-input-bar')?.classList.remove('hidden');
  document.getElementById('chat-input-conv')?.focus();
}

//  LOG 
function log(text, type = '') {
  console.log(`[${type || 'log'}] ${text}`);
}

//  CUSTOM DIALOG MODALS 
window.showCustomConfirm = function(title, message, callback) {
  const modal = document.getElementById('custom-dialog-modal');
  const titleEl = document.getElementById('custom-dialog-title');
  const msgEl = document.getElementById('custom-dialog-message');
  const inputContainer = document.getElementById('custom-dialog-input-container');
  const confirmBtn = document.getElementById('custom-dialog-confirm');
  const cancelBtn = document.getElementById('custom-dialog-cancel');
  const closeBtn = document.getElementById('custom-dialog-close');

  if (!modal) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  inputContainer.classList.add('hidden');
  modal.classList.remove('hidden');

  const cleanup = () => {
    modal.classList.add('hidden');
    confirmBtn.removeEventListener('click', onConfirm);
    cancelBtn.removeEventListener('click', onCancel);
    closeBtn.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    cleanup();
    callback(true);
  };

  const onCancel = () => {
    cleanup();
    callback(false);
  };

  confirmBtn.addEventListener('click', onConfirm);
  cancelBtn.addEventListener('click', onCancel);
  closeBtn.addEventListener('click', onCancel);
};

window.showCustomPrompt = function(title, message, defaultValue, callback) {
  const modal = document.getElementById('custom-dialog-modal');
  const titleEl = document.getElementById('custom-dialog-title');
  const msgEl = document.getElementById('custom-dialog-message');
  const inputContainer = document.getElementById('custom-dialog-input-container');
  const inputEl = document.getElementById('custom-dialog-input');
  const confirmBtn = document.getElementById('custom-dialog-confirm');
  const cancelBtn = document.getElementById('custom-dialog-cancel');
  const closeBtn = document.getElementById('custom-dialog-close');

  if (!modal) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  inputContainer.classList.remove('hidden');
  inputEl.value = defaultValue || '';
  modal.classList.remove('hidden');
  setTimeout(() => inputEl.focus(), 50);

  const cleanup = () => {
    modal.classList.add('hidden');
    confirmBtn.removeEventListener('click', onConfirm);
    cancelBtn.removeEventListener('click', onCancel);
    closeBtn.removeEventListener('click', onCancel);
  };

  const onConfirm = () => {
    const val = inputEl.value;
    cleanup();
    callback(val);
  };

  const onCancel = () => {
    cleanup();
    callback(null);
  };

  confirmBtn.addEventListener('click', onConfirm);
  cancelBtn.addEventListener('click', onCancel);
  closeBtn.addEventListener('click', onCancel);
};

//  PROJECT WORKSPACE MANAGEMENT 
// (initProjectWorkspace removed)




