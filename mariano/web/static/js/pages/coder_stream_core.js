/**
 * coder_stream_core.js — Hekki Coder AI Stream (Part 1 of 2)
 *
 * Isolated streaming module for the Hekki Coder page.
 * Manages the WebSocket connection to /api/coder/ws,
 * sends user prompts to the real MarianoAgent backend,
 * and dispatches streaming events to coder_stream_render.js.
 *
 * MAX: 500 lines  |  Split: coder_stream_render.js handles UI rendering
 */

// ─── Connection State ─────────────────────────────────────────────────────────
let _ws = null;
let _wsReady = false;
let _pendingQueue = [];          // messages queued before WS is ready
let _activeStreamId = null;      // tracks the current in-flight stream
let _reconnectTimer = null;
let _reconnectDelay = 2000;
const MAX_RECONNECT_DELAY = 30000;

// ─── External Renderer Reference ─────────────────────────────────────────────
// Set by initCoderStream(); allows core to delegate render work without circular deps
let _renderer = null;

// ─── Active Project Context ───────────────────────────────────────────────────
// Updated via setCoderStreamContext() called from coder_page.js
let _ctx = {
  project:      null,   // project name (string)
  project_path: null,   // project absolute path (string)
  conv_id:      null,   // active conversation / chat_id
};

// ─── Status Indicator ─────────────────────────────────────────────────────────
function _setStatus(status) {
  const dot = document.getElementById('coder-ws-dot');
  const lbl = document.getElementById('coder-ws-label');
  const MAP = {
    connected:    { color: '#22c55e', text: 'Connected' },
    connecting:   { color: '#6366f1', text: 'Connecting…' },
    disconnected: { color: '#f59e0b', text: 'Reconnecting…' },
    error:        { color: '#ef4444', text: 'Error' },
    streaming:    { color: '#22c55e', text: 'Streaming…' },
    idle:         { color: '#22c55e', text: 'Ready' },
  };
  const s = MAP[status] ?? MAP.disconnected;
  if (dot) dot.style.background = s.color;
  if (lbl) lbl.textContent = s.text;

  // Toggle coder-btn-send and coder-btn-stop button visibility
  const sendBtn = document.getElementById('coder-btn-send');
  const stopBtn = document.getElementById('coder-btn-stop');
  const chatInput = document.getElementById('coder-input');
  if (sendBtn && stopBtn) {
    if (status === 'streaming') {
      stopBtn.classList.remove('hidden');
      sendBtn.classList.add('hidden');
    } else {
      stopBtn.classList.add('hidden');
      if (chatInput && chatInput.value.trim()) {
        sendBtn.classList.remove('hidden');
      } else {
        sendBtn.classList.add('hidden');
      }
    }
  }
}

// ─── WebSocket Connection ─────────────────────────────────────────────────────
function _connect() {
  if (_ws && _ws.readyState < 2) return;   // already open or connecting
  _setStatus('connecting');

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  _ws = new WebSocket(`${proto}://${location.host}/api/coder/ws`);

  _ws.onopen = () => {
    console.log('[CoderStream] WS connected');
    _wsReady = true;
    _reconnectDelay = 2000;
    _setStatus('idle');
    // Flush any queued messages
    while (_pendingQueue.length > 0) {
      _ws.send(JSON.stringify(_pendingQueue.shift()));
    }
  };

  _ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      _handleIncoming(msg);
    } catch (err) {
      console.warn('[CoderStream] malformed message', err);
    }
  };

  _ws.onclose = () => {
    _wsReady = false;
    _setStatus('disconnected');
    // Exponential back-off reconnect
    if (_reconnectTimer) clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(() => {
      _reconnectDelay = Math.min(_reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
      _connect();
    }, _reconnectDelay);
  };

  _ws.onerror = () => {
    _setStatus('error');
  };
}

// ─── Incoming Event Router ────────────────────────────────────────────────────
function _handleIncoming(msg) {
  const { event } = msg;

  // Legacy FSM / refactor events — still handled by existing coder_page logic
  if (event === 'pong')            return;
  if (event === 'fsm_state')       { _dispatchLegacy(msg); return; }
  if (event === 'refactor_complete') { _dispatchLegacy(msg); return; }
  if (event === 'file_content')    { _dispatchLegacy(msg); return; }
  if (event === 'dir_listing')     { _dispatchLegacy(msg); return; }
  if (event === 'patch_preview')   { _dispatchLegacy(msg); return; }
  if (event === 'symbols')         { _dispatchLegacy(msg); return; }

  // Raw Agent Event pipeline routing
  if (event === 'agent_event' && _renderer) {
    const { kind } = msg;
    if (kind === 'response_chunk') {
      _setStatus('streaming');
    } else if (kind === 'done' || kind === 'error') {
      _setStatus('idle');
      _activeStreamId = null;
    }
    _renderer.handleAgentEvent(msg);
  }
}

// Dispatch to existing window-level legacy FSM handler if present
function _dispatchLegacy(msg) {
  if (typeof window._handleCoderLegacyEvent === 'function') {
    window._handleCoderLegacyEvent(msg);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize the coder streaming module.
 * @param {object} renderer  - Instance of CoderStreamRenderer from coder_stream_render.js
 */
export function initCoderStream(renderer) {
  _renderer = renderer;
  _connect();
}

/**
 * Update project/conversation context so the backend knows which workspace to use.
 * Called from coder_page.js whenever project or active session changes.
 */
export function setCoderStreamContext(project, project_path, conv_id) {
  _ctx.project      = project      ?? _ctx.project;
  _ctx.project_path = project_path ?? _ctx.project_path;
  _ctx.conv_id      = conv_id      ?? _ctx.conv_id;
}

/**
 * Send a user prompt to the real agent backend over the coder WS.
 * Returns true if queued/sent, false if skipped (empty text).
 */
export function sendCoderChat(text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return false;

  // Abort any active stream before starting a new one
  if (_activeStreamId) {
    _send({ command: 'chat_cancel', payload: { stream_id: _activeStreamId } });
  }

  _activeStreamId = `stream_${Date.now()}`;
  _setStatus('streaming');

  _send({
    command: 'chat',
    payload: {
      text:         trimmed,
      project:      _ctx.project      ?? '',
      project_path: _ctx.project_path ?? '',
      chat_id:      _ctx.conv_id      ?? 'coder_default',
      stream_id:    _activeStreamId,
    },
  });

  return true;
}

/**
 * Stop/Cancel the current Coder AI chat stream execution.
 */
export function stopCoderChat() {
  if (_activeStreamId) {
    _send({ command: 'chat_cancel', payload: { stream_id: _activeStreamId } });
    _activeStreamId = null;
    _setStatus('idle');
  }
}

/**
 * Reconnect the WS manually (e.g. if user clicks a reconnect button).
 */
export function reconnectCoderStream() {
  if (_ws) {
    try { _ws.close(); } catch {}
  }
  _connect();
}

/**
 * Check if the coder WS is currently live and ready to send.
 */
export function isCoderStreamReady() {
  return _wsReady && _ws?.readyState === 1;
}

// ─── Internal WS Send ─────────────────────────────────────────────────────────
function _send(msg) {
  if (_wsReady && _ws?.readyState === 1) {
    _ws.send(JSON.stringify(msg));
  } else {
    // Queue for when connection is established
    _pendingQueue.push(msg);
    if (!_ws || _ws.readyState > 1) {
      _connect();
    }
  }
}

// Expose low-level send for legacy FSM commands (used by coder_page.js)
export function sendCoderCommand(command, payload) {
  _send({ command, payload: payload ?? {} });
}

// ─── Legacy WS shim ──────────────────────────────────────────────────────────
// Makes the legacy connectCoderWs() / _coderWs pattern in coder_page.js
// point to this module instead of maintaining a separate WS connection.
export function getCoderWsShim() {
  return {
    get readyState() { return _ws?.readyState ?? 3; },
    send(data) { _send(JSON.parse(data)); },
    close() { if (_ws) _ws.close(); },
  };
}
