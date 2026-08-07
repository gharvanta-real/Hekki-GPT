import { handleChatAgentEvent } from '../agent_stream.js';
import { appendMsg, clearInputs, scrollChat } from '../chat.js';
import { showToast } from './toast.js';
import { attachmentManager } from './attachment_manager.js';

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
    const activeChatId = localStorage.getItem('hekki_active_chat_id') || localStorage.getItem('mariano_active_chat_id');
    if (activeChatId) {
      try {
        const chats = JSON.parse(localStorage.getItem('hekki_chats') || localStorage.getItem('mariano_chats') || '[]');
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
      // [H-2] Show user-facing error so UI doesn't silently freeze
      if (window.showToast) {
        showToast(
          'Connection Lost',
          'Unable to reach Hekki server after 5 attempts. Please restart the app.',
          8000
        );
      }
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
  const activeProj = localStorage.getItem('hekki_active_project') || localStorage.getItem('mariano_active_project');
  const activePath = localStorage.getItem('hekki_active_project_path') || localStorage.getItem('mariano_active_project_path');
  const activeChatId = localStorage.getItem('hekki_active_chat_id') || localStorage.getItem('mariano_active_chat_id');

  const files = attachmentManager.getFiles();
  const attachments = files.map(f => ({
    name: f.name,
    type: f.type,
    ext: f.ext,
    is_image: f.isImage,
    base64: f.base64 || null,
    text: f.text || null,
  }));

  // Build full message text containing attached image tags for user bubble rendering & persistence
  let fullMessageText = text;
  files.forEach(f => {
    if (f.isImage && (f.dataUrl || f.base64)) {
      const src = f.dataUrl || `data:${f.type};base64,${f.base64}`;
      fullMessageText += `\n[Attached Image: ${f.name} (saved at ${src})]`;
    } else if (f.name) {
      fullMessageText += `\n[Attached File: ${f.name}]`;
    }
  });

  // Guard: only send if socket is open — prevents DOMException and silent message loss
  if (socket.readyState !== WebSocket.OPEN) {
    log('Socket not open (readyState=' + socket.readyState + '). Message dropped.', 'err');
    return;
  }

  const alphaSel = document.getElementById('select-model-alpha');
  const betaSel = document.getElementById('select-model-beta');

  socket.send(JSON.stringify({ 
    type: 'query', 
    text,
    attachments,
    project: activeProj || null,
    project_path: activePath || null,
    chat_id: activeChatId || null,
    permission_policy: localStorage.getItem('mariano_permission_policy') || 'ask',
    aider_enabled: false,
    model_alpha: alphaSel ? alphaSel.value : null,
    model_beta: betaSel ? betaSel.value : null,
  }));
  
  window.setGeneratingState(true);
  appendMsg('user', fullMessageText, enterConversation, scrollChat);
  attachmentManager.clear();
  clearInputs();
  log(`Sent: "${text}" with ${files.length} attachment(s)`, 'ok');
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
