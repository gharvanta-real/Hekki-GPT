/* === MARIANO MAIN ENTRY POINT === */

import { restoreFont } from '/static/js/components/font_manager.js';
import { bindGlobalShortcuts } from '/static/js/components/global_shortcuts.js';
import { setGreeting } from '/static/js/components/greeting_manager.js';
import { HudLogger } from '/static/js/components/hud_logger.js';

import { VoiceProcessor } from '/static/voice_processor.js';
import { TabManager }     from '/static/tab_manager.js';
import { bindInputs, clearInputs, setGeneratingState, appendMsg, scrollChat, ChatSessionManager } from '/static/js/chat.js';
import { initSettings }    from '/static/js/settings.js';
import { bindNavigation }  from '/static/js/nav.js';
import { router, initRouterState } from '/static/js/router.js';
import { SearchModal }     from '/static/js/components/search_modal.js';
import { SkillsPage }      from '/static/js/pages/skills_page.js?v=205';
import { sounds } from '/static/js/sound_effects.js';

// Modular UI component imports
import { showToast } from '/static/js/components/toast.js';
import { bindModelPills, updateModelPills, registerModelPillRefresh } from '/static/js/components/model_selector.js';
import { initAttachDropdowns } from '/static/js/components/attach_dropdown.js';
import { bindSidebarToggle, bindTitlebarActions, bindThemeToggle, bindImageLightbox } from '/static/js/components/layout_controls.js';
import { bindVoice, resetVoiceUIInstance } from '/static/js/components/voice_controller.js';
import { socket, setupSocketEvents, send } from '/static/js/components/socket_manager.js?v=201';

// Debate playground & Coder IDE page
import { initDebatePage, handleDebateEvent } from '/static/js/debate/debate_page.js?v=136';
import { initCoderPage, teardownCoderPage } from '/static/js/pages/coder_page.js';
import { LibraryPage } from '/static/js/pages/library_page.js';
import { LiveCanvasEngine } from '/static/js/components/live_canvas.js';
import { SlashMenuManager } from '/static/js/components/slash_menu.js';
import { ChatMinimapManager } from '/static/js/components/chat_minimap.js';
import { audioOverviewManager } from '/static/js/chat/audio_overview.js';
import { globalAudioPlayer } from '/static/js/audio_player.js';

window.updateModelPills = updateModelPills;
window.showToast = showToast;
window.handleDebateEvent = handleDebateEvent;
window.ChatMinimapManager = ChatMinimapManager;
window.audioOverviewManager = audioOverviewManager;
window.isGenerating = false;
window.setGeneratingState = setGeneratingState;

/* === PWA Service Worker Engine === */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.log('[PWA] HEKKI ServiceWorker active:', reg.scope))
      .catch(err => console.error('[PWA] ServiceWorker failed:', err));
  });
}

let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const pwaBtn = document.getElementById('btn-pwa-install');
  if (pwaBtn) pwaBtn.style.display = 'flex';
});

// State
let voice  = null;
let tabs   = null;
const inConversationState = { val: false };
window.inConversationState = inConversationState;

const $ = id => document.getElementById(id);

function log(text, type = '') {
  console.log(`[${type || 'log'}] ${text}`);
}

function enterConversation() {
  inConversationState.val = true;
  const home = document.getElementById('home-screen');
  if (home) {
    home.style.display = 'none';
    home.classList.add('hidden');
  }
  document.getElementById('bottom-input-bar')?.classList.remove('hidden');
  document.getElementById('chat-input-conv')?.focus();
}
window.enterConversation = enterConversation;
window.enterConversationState = enterConversation;

function boot() {
  console.log("Booting MARIANO dashboard...");
  window._router = router;
  initDebatePage();
  initCoderPage();
  router.onLeave('coder', teardownCoderPage);
  initRouterState();

  if (window.lucide) {
    lucide.createIcons();
  }

  voice = new VoiceProcessor();
  tabs  = new TabManager('pane-tabs', 'pane-content', log);
  window.tabs = tabs;

  // Resizer drag handler
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
      if (width >= 280 && width <= window.innerWidth * 0.8) {
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

  bindInputs((text) => {
    if (window.sounds) window.sounds.playSend();
    send(text, enterConversation, log);
  });
  window.clearInputs = clearInputs;

  bindGlobalShortcuts();
  initSettings(setGreeting);
  registerModelPillRefresh();
  bindModelPills();

  router.onRefresh((page) => {
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

  window.chatMinimap = new ChatMinimapManager({ containerSelector: '#chat-log', paneSelector: '#chat-pane', isDebate: false });
  router.onRefresh((page) => {
    if (page === 'chat' && window.chatMinimap) window.chatMinimap.refresh();
  });

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

  const skillsPage = new SkillsPage(showToast);
  window.router = router;
  router.onNavigate('skills', () => {
    const pane = $('skills-pane');
    if (pane) skillsPage.mount(pane);
  });

  globalAudioPlayer.init();
  window.globalAudioPlayer = globalAudioPlayer;

  const libraryPage = new LibraryPage(showToast);
  window.libraryPageInstance = libraryPage;
  router.onNavigate('library', () => {
    const pane = $('images-pane');
    if (pane) libraryPage.mount(pane);
  });
  router.onNavigate('images', () => {
    const pane = $('images-pane');
    if (pane) libraryPage.mount(pane);
  });

  router.onNavigate('chat', () => {
    document.querySelectorAll('.agent-welcome-wrapper').forEach(el => el.remove());
    if (window._debateRunning || inConversationState.val) {
      $('home-screen')?.classList.add('hidden');
      $('bottom-input-bar')?.classList.remove('hidden');
    } else {
      $('home-screen')?.classList.remove('hidden');
      $('bottom-input-bar')?.classList.add('hidden');
    }
    ChatSessionManager.renderChatsList();
  });

  bindNavigation(tabs, showToast, inConversationState);
  ChatSessionManager.renderChatsList();

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

  const storedId = localStorage.getItem('hekki_active_chat_id') || localStorage.getItem('mariano_active_chat_id');
  if (storedId) {
    const chats = ChatSessionManager.getChats();
    const activeChat = chats.find(c => c.id === storedId);
    if (activeChat) {
      if (activeChat.isPlayground && activeChat.messages && activeChat.messages.length === 0) {
        ChatSessionManager.setActiveChatId(null);
        localStorage.removeItem('hekki_active_chat_id');
        localStorage.removeItem('mariano_active_chat_id');
        $('home-screen')?.classList.remove('hidden');
        $('bottom-input-bar')?.classList.add('hidden');
        inConversationState.val = false;
        ChatSessionManager.renderChatsList();
      } else {
        ChatSessionManager.loadChat(storedId);
        if (!activeChat.isPlayground) enterConversation();
      }
    }
  }

  // Global click interceptor for local files -> Open in Live Canvas
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    const hasDataPath = link.hasAttribute('data-filepath');
    const isFileLink = link.classList.contains('file-link') ||
                       hasDataPath ||
                       href.startsWith('file:///') ||
                       href.startsWith('file://') ||
                       href.includes('/api/workspace/render?path=') ||
                       href.includes('/api/workspace/file?path=');
    
    if (isFileLink) {
      e.preventDefault();
      e.stopPropagation();
      let targetPath = link.dataset.filepath || '';
      if (!targetPath) {
        if (href.includes('path=')) {
          targetPath = decodeURIComponent(href.split('path=')[1].split('&')[0]);
        } else {
          targetPath = decodeURIComponent(href.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, ''));
        }
      }
      targetPath = targetPath.replace(/\\/g, '/');
      const fileName = targetPath.split('/').pop() || 'File';
      const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'text';

      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
        if (window.openImageLightbox) {
          window.openImageLightbox(`/api/workspace/render?path=${encodeURIComponent(targetPath)}`);
          return;
        }
      }

      try {
        const res = await fetch(`/api/workspace/render?path=${encodeURIComponent(targetPath)}`);
        if (res.ok) {
          const content = await res.text();
          if (window.liveCanvas) {
            window.liveCanvas.openArtifact({
              title: fileName,
              code: content,
              language: ext === 'py' ? 'python' : (ext === 'js' ? 'javascript' : (ext === 'md' ? 'markdown' : ext)),
              filepath: targetPath
            });
            return;
          }
        }
      } catch (err) {
        console.warn('Live Canvas file open error:', err);
      }

      navigator.clipboard.writeText(targetPath).then(() => {
        if (window.showToast) window.showToast('File Path Copied', targetPath, 3000);
      });
    }
  });

  setTimeout(() => {
    const loader = $('loader');
    if (loader) loader.classList.add('out');
    const shell = $('shell');
    if (shell) shell.style.opacity = '1';
    const input = inConversationState.val ? $('chat-input-conv') : $('chat-input');
    input?.focus();
  }, 900);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
