/* === DEBATE_MODE.JS — Inline Debate: Same Chat Bubble Style as Main Chat === */

window._debateModeActive = false;

// Rotating thinking messages (shown in the AI thinking header)
const THINKING_MSGS = [
  "Selecting expert personas for this topic...",
  "Fetching verified research papers from arXiv...",
  "Alpha agent is formulating opening thesis...",
  "Agents searching for empirical evidence...",
  "Beta agent is counter-analyzing core premises...",
  "Cross-examining arguments & evidence...",
  "Generating joint synthesis report..."
];

// ── Show conversation input bar + hide home screen ─────────────────────────
function _enterConversationView(topic) {
  // Hide home screen — class only, never inline style (inline style can't be cleared by nav.js)
  const homeScreen = document.getElementById('home-screen');
  if (homeScreen) {
    homeScreen.classList.add('hidden');
    // Do NOT set homeScreen.style.display — it overrides CSS class removal on New Chat
  }

  // Show bottom input bar
  const inputBar = document.getElementById('bottom-input-bar');
  if (inputBar) inputBar.classList.remove('hidden');

  // Create & flag chat session as Playground/Debate
  // Always use createPlaygroundChat so chat gets playground_ prefixed ID
  // and is guaranteed to never appear in Recent Chats
  if (window.ChatSessionManager) {
    const mgr = window.ChatSessionManager;
    // Always create a fresh Playground chat for every debate — never reuse normal chat IDs
    const pgChat = mgr.createPlaygroundChat(topic);
    if (pgChat) {
      pgChat.isDebate = true;
      mgr.saveChats(mgr.getChats());
      mgr.renderChatsList();
    }
  }
}

let _alphaName = 'Alpha Agent';
let _betaName  = 'Beta Agent';
let _rotateTimer = null;
let _thinkingHeaderEl = null;
let _chatColEl = null;
let _canvasWrapEl = null;
let _canvasBodyEl = null;
let _summaryText = '';
let _activeBriefEl = null;      // .debate-agent-brief streaming target
let _currentRoundCardEl = null; // the current round's combined card
let _alphaSnippet = '';
let _betaSnippet  = '';
let _finished = false;

// ── Public API ──────────────────────────────────────────────────────────────
export function isDebateModeActive() { return !!window._debateModeActive; }
export function setDebateMode(active) {
  window._debateModeActive = !!active;
  _updatePlaceholders();
}
export function toggleDebateMode() { setDebateMode(!window._debateModeActive); }
export function initInlineDebateMode() { _updatePlaceholders(); }

function _updatePlaceholders() {
  const ph = window._debateModeActive
    ? "Enter a debate topic… e.g. 'Is AI replacing human creativity?'"
    : null;
  const hi = document.getElementById('chat-input');
  const ci = document.getElementById('chat-input-conv');
  if (ph) { if (hi) hi.placeholder = ph; if (ci) ci.placeholder = ph; }
  else {
    if (hi) hi.placeholder = "How can I help you today?";
    if (ci) ci.placeholder = "Write a message...";
  }
  document.querySelectorAll('.debate-toggle-switch').forEach(sw =>
    sw.classList.toggle('on', !!window._debateModeActive));
}

// ── Escape helper ─────────────────────────────────────────────────────────
function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _scroll() {
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

function _getChatCol() {
  return document.getElementById('chat-col');
}

// ── User bubble — exactly like main chat ─────────────────────────────────
function _appendUserBubble(topic) {
  const col = _getChatCol();
  if (!col) return;
  const group = document.createElement('div');
  group.className = 'msg-group user';
  const bubble = document.createElement('div');
  bubble.className = 'msg user';
  bubble.innerHTML = `<span class="user-cmd-highlight" style="display:inline-flex;align-items:center;background:transparent !important;color:#3b82f6;padding:0 !important;font-weight:400 !important;margin-right:6px;font-size:15px !important;letter-spacing:0.2px;">/debate</span>${_esc(topic)}`;
  group.appendChild(bubble);
  col.appendChild(group);
  // Save user message to session so history restores it
  if (window.ChatSessionManager) {
    window.ChatSessionManager.appendPlaygroundMessage('user', `/debate ${topic}`);
  }
  _scroll();
}

// ── Thinking header — unbolded 13px status line ────────────────────────────
function _appendThinkingHeader() {
  const col = _getChatCol();
  if (!col) return;

  // Remove any prior orphan thinking header
  col.querySelectorAll('.chat-ai-stream-header').forEach(el => el.remove());

  const el = document.createElement('div');
  el.className = 'cad-ai-stream-header chat-ai-stream-header';
  el.style.marginTop = '20px';
  el.style.marginBottom = '8px';
  el.innerHTML = `
    <canvas class="cad-ai-orb-avatar" id="debate-active-orb-canvas" width="24" height="24"></canvas>
    <span class="cad-ai-header-title debate-thinking-txt-unbold" id="debate-thinking-txt" style="font-weight:400 !important; font-size:15px !important; color:var(--text-2); background:none !important; -webkit-text-fill-color:var(--text-2) !important;">${THINKING_MSGS[0]}</span>
  `;
  col.appendChild(el);
  _thinkingHeaderEl = el;

  setTimeout(() => {
    const canvas = el.querySelector('#debate-active-orb-canvas');
    if (canvas && window.RibbonGradientOrb) new window.RibbonGradientOrb(canvas).start();
  }, 60);

  let idx = 0;
  _rotateTimer = setInterval(() => {
    if (_finished) { clearInterval(_rotateTimer); return; }
    idx = (idx + 1) % THINKING_MSGS.length;
    const txt = el.querySelector('#debate-thinking-txt');
    if (txt) txt.textContent = THINKING_MSGS[idx];
  }, 2400);

  _scroll();
}

function _updateThinkingText(msg) {
  const txt = _thinkingHeaderEl?.querySelector('#debate-thinking-txt');
  if (txt) {
    const cleanMsg = String(msg || '').replace(/\*\*/g, '').replace(/__/g, '').replace(/<b>/g, '').replace(/<\/b>/g, '');
    txt.textContent = cleanMsg;
  }
}

function _removeThinkingHeader() {
  _thinkingHeaderEl?.remove();
  _thinkingHeaderEl = null;
  clearInterval(_rotateTimer);
}

// ── Per-round agent brief card — shown as AI bubble ────────────────────────
function _getOrCreateRoundCard(roundNum) {
  const col = _getChatCol();
  if (!col) return null;

  if (_currentRoundCardEl && _currentRoundCardEl.dataset.round === String(roundNum)) {
    return _currentRoundCardEl;
  }

  const group = document.createElement('div');
  group.className = 'msg-group ai debate-round-card';
  group.dataset.round = String(roundNum);

  const bubble = document.createElement('div');
  bubble.className = 'msg ai';
  bubble.style.padding = '0';
  bubble.style.background = 'none';
  bubble.style.maxWidth = '100%';

  const inner = document.createElement('div');
  inner.className = 'debate-round-inner';
  inner.innerHTML = `<div class="debate-round-label">⚔️ Round ${roundNum}</div>`;
  bubble.appendChild(inner);
  group.appendChild(bubble);

  if (_thinkingHeaderEl && _thinkingHeaderEl.parentNode === col) {
    col.insertBefore(group, _thinkingHeaderEl);
  } else {
    col.appendChild(group);
  }

  _currentRoundCardEl = group;
  return group;
}

// Append or update an agent section inside the round card (inline debater name on left, spinner on right)
function _getOrCreateAgentSection(roundCard, sender) {
  const inner = roundCard.querySelector('.debate-round-inner');
  if (!inner) return null;

  const existingId = `debate-agent-${sender}-r${roundCard.dataset.round}`;
  let section = inner.querySelector(`#${existingId}`);
  if (section) return section.querySelector('.debate-agent-brief');

  section = document.createElement('div');
  section.id = existingId;
  section.className = 'debate-agent-section';
  section.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;width:100%;">
      <div>
        <span class="debate-agent-name" id="debate-name-${sender}-${roundCard.dataset.round}"></span>
        <span class="debate-agent-brief" id="debate-brief-${sender}-${roundCard.dataset.round}"></span>
      </div>
      <span class="debate-spinner" id="debate-spinner-${sender}-${roundCard.dataset.round}"></span>
    </div>
  `;
  inner.appendChild(section);
  return section.querySelector('.debate-agent-brief');
}

// ── Synthesis Canvas — shown as AI bubble at bottom ───────────────────────
function _getOrCreateCanvas() {
  if (_canvasWrapEl) return _canvasWrapEl;

  const col = _getChatCol();
  if (!col) return null;

  const group = document.createElement('div');
  group.className = 'msg-group ai';

  const bubble = document.createElement('div');
  bubble.className = 'msg ai debate-canvas-bubble';
  bubble.style.padding = '0';
  bubble.style.background = 'none';
  bubble.style.maxWidth = '100%';

  const wrap = document.createElement('div');
  wrap.className = 'debate-canvas-wrap';
  const hdr = document.createElement('div');
  hdr.className = 'debate-canvas-hdr';
  hdr.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <i data-lucide="file-text" style="width:16px;height:16px;color:var(--text-2);flex-shrink:0;"></i>
      <span style="font-size:15px;font-weight:400;color:var(--text-primary);">Joint Synthesis Report</span>
    </div>
    <button id="btn-debate-copy-canvas" title="Copy" style="background:none;border:none;cursor:pointer;color:var(--text-2);padding:4px 6px;border-radius:6px;">
      <i data-lucide="copy" style="width:14px;height:14px;"></i>
    </button>
  `;
  const body = document.createElement('div');
  body.className = 'debate-canvas-body markdown-body';
  wrap.appendChild(hdr);
  wrap.appendChild(body);
  bubble.appendChild(wrap);
  group.appendChild(bubble);

  if (_thinkingHeaderEl && _thinkingHeaderEl.parentNode === col) {
    col.insertBefore(group, _thinkingHeaderEl);
  } else {
    col.appendChild(group);
  }

  if (window.lucide) lucide.createIcons({ parent: hdr });
  hdr.querySelector('#btn-debate-copy-canvas')?.addEventListener('click', () => {
    navigator.clipboard.writeText(body.innerText || '');
  });

  _canvasWrapEl = wrap;
  _canvasBodyEl = body;
  return wrap;
}

// ── Main handler ─────────────────────────────────────────────────────────
export async function handleInlineDebateSubmit(topic) {
  if (!topic?.trim()) return;
  const cleanTopic = topic.trim();

  const ws = window.socket;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    if (window.showToast) window.showToast('Debate Error', 'WebSocket not connected. Please refresh.', 3000);
    return;
  }

  // Reset state
  _alphaName = 'Alpha Agent';
  _betaName  = 'Beta Agent';
  _rotateTimer = null;
  _thinkingHeaderEl = null;
  _canvasWrapEl = null;
  _canvasBodyEl = null;
  _summaryText = '';
  _activeBriefEl = null;
  _currentRoundCardEl = null;
  _alphaSnippet = '';
  _betaSnippet  = '';
  _finished = false;
  window._debateRunning = true;  // guard: prevent session redirect during live debate
  window._debateRoundsText = []; // accumulator for single AI session message

  // Enter conversation mode (shows input bar)
  _enterConversationView(cleanTopic);

  _appendUserBubble(cleanTopic);
  _appendThinkingHeader();

  // ── WebSocket event handler (routed via socket_manager → window.handleDebateEvent)
  window.handleDebateEvent = (p) => {
    const kind   = p.kind   || '';
    const sender = p.sender || 'system';
    const round  = p.round  || 1;
    const data   = p.data   || '';

    // Init — names received
    if (kind === 'init') {
      if (p.alpha_name) _alphaName = p.alpha_name;
      if (p.beta_name)  _betaName  = p.beta_name;
    }

    // Search status — update thinking text
    if (kind === 'search_start') _updateThinkingText(`🔍 ${data || 'Fetching research evidence...'}`);
    if (kind === 'search_done')  _updateThinkingText(`✅ ${data || 'Evidence gathered.'}`);

    // Turn start — open agent section inside round card
    if (kind === 'turn_start' && (sender === 'alpha' || sender === 'beta')) {
      const agentLabel = sender === 'alpha' ? _alphaName : _betaName;
      _updateThinkingText(`⚔️ Round ${round} — ${agentLabel} is responding...`);

      const card = _getOrCreateRoundCard(round);
      if (card) {
        _activeBriefEl = _getOrCreateAgentSection(card, sender);
        const nameEl = card.querySelector(`#debate-name-${sender}-${round}`);
        if (nameEl) nameEl.textContent = `${agentLabel}: `;
        if (_activeBriefEl) _activeBriefEl.textContent = '';
        const spinner = card.querySelector(`#debate-spinner-${sender}-${round}`);
        if (spinner) spinner.style.display = 'inline-block';
      }
      _scroll();
    }

    // Synthesis turn start
    if (kind === 'turn_start' && sender === 'synthesis') {
      _updateThinkingText('✨ Generating joint synthesis report...');
      _getOrCreateCanvas();
      _scroll();
    }

    // Chunk — stream into active brief (max 240 chars visible)
    if (kind === 'chunk') {
      if (sender === 'alpha') _alphaSnippet += data;
      if (sender === 'beta')  _betaSnippet  += data;

      if (_activeBriefEl && (sender === 'alpha' || sender === 'beta')) {
        const raw = sender === 'alpha' ? _alphaSnippet : _betaSnippet;
        // Show max 240 chars cleanly, strip markdown symbols for readability
        const clean = raw.replace(/[#*`_~>]/g, '').trim();
        _activeBriefEl.textContent = clean.length > 240 ? clean.slice(0, 240) + '…' : clean;
        _scroll();
      }

      if (sender === 'synthesis' && _canvasBodyEl) {
        _summaryText += data;
        _canvasBodyEl.innerHTML = window.marked
          ? window.marked.parse(_summaryText)
          : _esc(_summaryText).replace(/\n/g, '<br>');
        _scroll();
      }
    }

function _syncDebateToSession() {
  if (!window.ChatSessionManager) return;
  const mgr = window.ChatSessionManager;
  const activeId = mgr.getActiveChatId();
  if (!activeId) return;

  const roundMap = new Map();
  (window._debateRoundItems || []).forEach(item => {
    if (!roundMap.has(item.round)) roundMap.set(item.round, []);
    roundMap.get(item.round).push(item);
  });

  let htmlParts = [];
  roundMap.forEach((items, rNum) => {
    let roundHtml = `<div class="debate-round-inner" style="margin-bottom:16px;"><div class="debate-round-label">⚔️ Round ${rNum}</div>`;
    items.forEach(it => {
      roundHtml += `
        <div class="debate-agent-section">
          <span class="debate-agent-name">${_esc(it.name)}:</span>
          <span class="debate-agent-brief">${_esc(it.snippet)}</span>
        </div>
      `;
    });
    roundHtml += `</div>`;
    htmlParts.push(roundHtml);
  });

  if (_summaryText) {
    const parsedSummary = window.marked ? window.marked.parse(_summaryText) : _esc(_summaryText).replace(/\n/g, '<br>');
    const canvasHtml = `
      <div class="debate-canvas-wrap" style="margin-top:14px;">
        <div class="debate-canvas-hdr">
          <div style="display:flex;align-items:center;gap:8px;">
            <i data-lucide="file-text" style="width:16px;height:16px;color:var(--text-2);flex-shrink:0;"></i>
            <span style="font-size:15px;font-weight:400;color:var(--text-primary);">Joint Synthesis Report</span>
          </div>
        </div>
        <div class="debate-canvas-body markdown-body">
          ${parsedSummary}
        </div>
      </div>
    `;
    htmlParts.push(canvasHtml);
  }

  const fullContent = htmlParts.join('\n\n');
  if (!fullContent) return;

  const chats = mgr.getChats();
  const chat = chats.find(c => c.id === activeId);
  if (chat && chat.isPlayground) {
    const hasAssistant = chat.messages.some(m => m.role === 'assistant');
    if (!hasAssistant) {
      mgr.appendPlaygroundMessage('assistant', fullContent);
    } else {
      mgr.updateLastPlaygroundMessage(fullContent);
    }
  }
}

    // Turn end — lock in final brief snippet & hide spinner
    if (kind === 'turn_end' && (sender === 'alpha' || sender === 'beta')) {
      const fullText = (p.full_text || (sender === 'alpha' ? _alphaSnippet : _betaSnippet)).trim();
      const clean = fullText.replace(/[#*`_~>]/g, '').trim();
      if (_activeBriefEl) {
        _activeBriefEl.textContent = clean.length > 240 ? clean.slice(0, 240) + '…' : clean;
      }
      const card = _currentRoundCardEl;
      if (card) {
        const spinner = card.querySelector(`#debate-spinner-${sender}-${round}`);
        if (spinner) spinner.style.display = 'none';
      }
      _activeBriefEl = null;

      // Accumulate round item and update single AI session message
      const agentLabel = sender === 'alpha' ? _alphaName : _betaName;
      if (fullText) {
        const snippet = clean.length > 240 ? clean.slice(0, 240) + '…' : clean;
        window._debateRoundItems.push({ round, sender, name: agentLabel, snippet });
        _syncDebateToSession();
      }

      // Reset snippet for next round
      if (sender === 'alpha') _alphaSnippet = '';
      if (sender === 'beta')  _betaSnippet  = '';
      _scroll();
    }

    // Summary chunk — stream into canvas
    if (kind === 'summary_chunk' && _canvasBodyEl) {
      _summaryText += data;
      _canvasBodyEl.innerHTML = window.marked
        ? window.marked.parse(_summaryText)
        : _esc(_summaryText).replace(/\n/g, '<br>');
      _scroll();
      _syncDebateToSession();
    }

    // Summary end or doc_ready → finish
    if (kind === 'summary_end') {
      _syncDebateToSession();
      _markDone();
    }

    if (kind === 'doc_ready' && p.payload) {
      // Render documentary as markdown in canvas
      const sections = p.payload.sections || [];
      let md = `# ${p.payload.title || 'Debate Documentary'}\n\n`;
      sections.forEach(s => {
        if (s.heading) md += `## ${s.heading}\n`;
        if (s.body) md += `${s.body}\n\n`;
      });
      _getOrCreateCanvas();
      if (_canvasBodyEl) {
        _canvasBodyEl.innerHTML = window.marked ? window.marked.parse(md) : md.replace(/\n/g, '<br>');
      }
      _summaryText = md;
      _syncDebateToSession();
      _scroll();
      _markDone();
    }

    // Error
    if (kind === 'error') {
      _updateThinkingText(`❌ ${data || 'Debate error occurred.'}`);
      setTimeout(_markDone, 2000);
    }
  };

  // Send debate_start (2 rounds, same as Debate Page)
  ws.send(JSON.stringify({
    type: 'debate_start',
    topic: cleanTopic,
    rounds: 2,
    model_alpha: 'gemini-3.1-flash-lite',
    model_beta: 'gemini-3.1-flash-lite'
  }));

  // Safety timeout — 6 minutes
  setTimeout(_markDone, 360000);
}

function _markDone() {
  if (_finished) return;
  _finished = true;
  window._debateRunning = false;  // debate fully complete, allow navigation again
  clearInterval(_rotateTimer);
  _removeThinkingHeader();
  window.handleDebateEvent = null;
}
