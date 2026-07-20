import { handleChatAgentEvent } from '../agent_stream.js';
import { appendMsg, clearInputs, scrollChat } from '../chat.js';
import { showToast } from './toast.js';

const wsScheme = location.protocol === 'https:' ? 'wss:' : 'ws';
export let socket = new WebSocket(`${wsScheme}://${location.host}/ws`);
window.socket = socket;

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
window.isServerOffline = false;

export function rebindSocket(onMessageCallback, log) {
  const syncSession = () => {
    reconnectAttempts = 0;
    window.isServerOffline = false;
    log('WS connected. Syncing active session...', 'ok');
    const activeChatId = localStorage.getItem('mariano_active_chat_id');
    if (activeChatId) {
      try {
        const chats = JSON.parse(localStorage.getItem('mariano_chats') || '[]');
        const chat = chats.find(c => c.id === activeChatId);
        if (chat && chat.messages) {
          const simplified = chat.messages.map(m => ({
            role: m.role,
            content: m.text
          }));
          socket.send(JSON.stringify({
            type: 'sync_session',
            chat_id: activeChatId,
            messages: simplified
          }));
        }
      } catch (err) {
        console.error("Failed to sync session history:", err);
      }
    }
  };

  if (socket.readyState === WebSocket.OPEN) {
    syncSession();
  } else {
    socket.onopen = syncSession;
  }

  socket.onclose = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      window.isServerOffline = true;
      log('WS disconnected permanently. Server is offline.', 'err');
      return;
    }
    reconnectAttempts++;
    log(`WS closed. Reconnecting... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'err');
    setTimeout(() => { 
      socket = new WebSocket(`${wsScheme}://${location.host}/ws`); 
      window.socket = socket;
      rebindSocket(onMessageCallback, log); 
    }, 3000);
  };
  socket.onmessage = onMessageCallback;
}

export function send(text, enterConversation, log) {
  const activeProj = localStorage.getItem('mariano_active_project');
  const activePath = localStorage.getItem('mariano_active_project_path');
  const activeChatId = localStorage.getItem('mariano_active_chat_id');
  socket.send(JSON.stringify({ 
    type: 'query', 
    text,
    project: activeProj || null,
    project_path: activePath || null,
    chat_id: activeChatId || null,
    permission_policy: localStorage.getItem('mariano_permission_policy') || 'ask',
    aider_enabled: false,
  }));
  
  window.setGeneratingState(true);
  appendMsg('user', text, enterConversation, scrollChat);
  clearInputs();
  log(`Sent: "${text}" with project context: ${activeProj} (${activePath})`, 'ok');
}

export function setupSocketEvents(enterConversation, log, handleTranscriptCallback) {
  const onMessage = ({ data }) => {
    let p;
    try { p = JSON.parse(data); } catch { return; }

    switch (p.type) {
      case 'agent_event':
        handleChatAgentEvent(p, enterConversation);
        if (p.kind === 'response') {
          if (window.refreshPlanDrawer) window.refreshPlanDrawer();
          if (p.data && p.data.includes('Aider Coding Task Completed')) {
            if (window.lastPreviewIframe) {
              window.lastPreviewIframe.src = window.lastPreviewIframe.src;
              console.log("[WebPreview] Aider completed, reloading preview iframe.");
            }
          }
        }
        break;
      case 'debate_event':
        if (window.handleDebateEvent) window.handleDebateEvent(p);
        break;
      case 'voice_transcript': handleTranscriptCallback(p); break;
      case 'reload_frontend':  location.reload(); break;
      case 'ui_event':         handleUIEvent(p); break;
    }
  };

  const handleUIEvent = (p) => {
    if (p.event === 'create_app') {
      const appPane = document.getElementById('app-pane');
      appPane?.classList.remove('hidden-pane');
      window.tabs?.createTab(p.widget_id, p.title, p.html, p.css, p.js, p.icon);
    } else if (p.event === 'notification') {
      showToast(p.title, p.message, p.duration_ms);
    }
  };

  rebindSocket(onMessage, log);
}
