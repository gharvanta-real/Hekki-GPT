/* === DEBATE_MODE.JS — Inline Debate: Same Chat Bubble Style as Main Chat === */

window._debateModeActive = false;

const THINKING_MSGS = [
  "Selecting expert personas for this topic...",
  "Fetching verified research papers from arXiv...",
  "Alpha agent is formulating opening thesis...",
  "Agents searching for empirical evidence...",
  "Beta agent is counter-analyzing core premises...",
  "Cross-examining arguments & evidence...",
  "Generating joint synthesis report..."
];

function _enterConversationView(topic) {
  const homeScreen = document.getElementById('home-screen');
  if (homeScreen) homeScreen.classList.add('hidden');

  const inputBar = document.getElementById('bottom-input-bar');
  if (inputBar) inputBar.classList.remove('hidden');

  if (window.ChatSessionManager) {
    const mgr = window.ChatSessionManager;
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
let _activeBriefEl = null;
let _currentRoundCardEl = null;
let _alphaSnippet = '';
let _betaSnippet  = '';
let _finished = false;

export function isDebateModeActive() { return !!window._debateModeActive; }
export function setDebateMode(active) {
  window._debateModeActive = !!active;
  _updatePlaceholders();
}
export function toggleDebateMode() { setDebateMode(!window._debateModeActive); }
export function initInlineDebateMode() { _updatePlaceholders(); }

function _updatePlaceholders() {
  const ph = window._debateModeActive ? "Enter a debate topic… e.g. 'Is AI replacing human creativity?'" : null;
  const hi = document.getElementById('chat-input');
  const ci = document.getElementById('chat-input-conv');
  if (ph) { if (hi) hi.placeholder = ph; if (ci) ci.placeholder = ph; }
  else {
    if (hi) hi.placeholder = "How can I help you today?";
    if (ci) ci.placeholder = "Write a message...";
  }
  document.querySelectorAll('.debate-toggle-switch').forEach(sw => sw.classList.toggle('on', !!window._debateModeActive));
}

function _esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _scroll() {
  const log = document.getElementById('chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}
function _getChatCol() { return document.getElementById('chat-col'); }

function _appendUserBubble(topic) {
  const col = _getChatCol();
  if (!col) return;
  const group = document.createElement('div');
  group.className = 'msg-group user';
  const bubble = document.createElement('div');
  bubble.className = 'msg user';
  bubble.innerHTML = `<span class="user-cmd-highlight" style="display:inline-flex;align-items:center;background:transparent !important;color:#3b82f6;padding:0 !important;font-weight:400 !important;margin-right:6px;font-size:16px !important;letter-spacing:0.2px;">/debate</span>${_esc(topic)}`;
  group.appendChild(bubble);
  col.appendChild(group);
  if (window.ChatSessionManager) {
    window.ChatSessionManager.appendPlaygroundMessage('user', `/debate ${topic}`);
  }
  _scroll();
}

// ── Thinking header — unbolded 16px status line ────────────────────────────
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
    <span class="cad-ai-header-title debate-thinking-txt-unbold" id="debate-thinking-txt" style="font-weight:400 !important; font-size:16px !important; color:var(--text-2); background:none !important; -webkit-text-fill-color:var(--text-2) !important;">${THINKING_MSGS[0]}</span>
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

function _getOrCreateRoundCard(roundNum) {
  const col = _getChatCol();
  if (!col) return null;
  if (_currentRoundCardEl && _currentRoundCardEl.dataset.round === String(roundNum)) return _currentRoundCardEl;

  const group = document.createElement('div');
  group.className = 'msg-group ai debate-round-card';
  group.dataset.round = String(roundNum);
  const bubble = document.createElement('div');
  bubble.className = 'msg ai';
  bubble.style.cssText = 'padding:0;background:none;max-width:100%;';
  const inner = document.createElement('div');
  inner.className = 'debate-round-inner';
  inner.innerHTML = `<div class="debate-round-label">Round ${roundNum}</div>`;
  bubble.appendChild(inner);
  group.appendChild(bubble);

  if (_thinkingHeaderEl && _thinkingHeaderEl.parentNode === col) col.insertBefore(group, _thinkingHeaderEl);
  else col.appendChild(group);
  _currentRoundCardEl = group;
  return group;
}

const DONE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const CHEVRON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

window.toggleDebateBrief = function(btn) {
  const wrap = btn.closest('.debate-breakline-wrap');
  if (!wrap) return;
  const section = wrap.previousElementSibling;
  if (!section) return;
  const briefEl = section.querySelector('.debate-agent-brief');
  if (!briefEl) return;

  const isExpanded = btn.classList.toggle('expanded');
  const label = btn.querySelector('span');
  if (label) label.textContent = isExpanded ? 'Show less' : 'Show more';

  const full = section.dataset.fullText || section.getAttribute('data-full-text');
  const snippet = section.dataset.snippet || section.getAttribute('data-snippet');
  if (isExpanded) {
    briefEl.classList.add('expanded');
    briefEl.textContent = full || snippet;
  } else {
    briefEl.classList.remove('expanded');
    briefEl.textContent = snippet || full;
  }
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.debate-expand-pill');
  if (btn) window.toggleDebateBrief(btn);
});

function _getOrCreateAgentSection(roundCard, sender) {
  const inner = roundCard.querySelector('.debate-round-inner');
  if (!inner) return null;
  const existingId = `debate-agent-${sender}-r${roundCard.dataset.round}`;
  let section = inner.querySelector(`#${existingId}`);
  if (section) return section.querySelector('.debate-agent-brief');

  section = document.createElement('div');
  section.id = existingId;
  section.className = 'debate-agent-section';
  section.innerHTML = `<div class="debate-agent-row"><div class="debate-agent-content"><span class="debate-agent-name" id="debate-name-${sender}-${roundCard.dataset.round}"></span><span class="debate-agent-brief" id="debate-brief-${sender}-${roundCard.dataset.round}"></span></div><span class="debate-status-indicator" id="debate-status-${sender}-${roundCard.dataset.round}"><span class="debate-spinner" id="debate-spinner-${sender}-${roundCard.dataset.round}"></span></span></div>`;
  inner.appendChild(section);
  return section.querySelector('.debate-agent-brief');
}

function _getOrCreateCanvas() {
  if (_canvasWrapEl) return _canvasWrapEl;
  const col = _getChatCol();
  if (!col) return null;

  const group = document.createElement('div');
  group.className = 'msg-group ai';
  const bubble = document.createElement('div');
  bubble.className = 'msg ai debate-canvas-bubble';
  bubble.style.cssText = 'padding:0;background:none;max-width:100%;';
  const wrap = document.createElement('div');
  wrap.className = 'debate-canvas-wrap';
  const hdr = document.createElement('div');
  hdr.className = 'debate-canvas-hdr';
  hdr.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="file-text" style="width:16px;height:16px;color:var(--text-2);flex-shrink:0;"></i><span style="font-size:16px;font-weight:400;color:var(--text-primary);">Joint Synthesis Report</span></div><button id="btn-debate-copy-canvas" title="Copy" style="background:none;border:none;cursor:pointer;color:var(--text-2);padding:4px 6px;border-radius:6px;"><i data-lucide="copy" style="width:14px;height:14px;"></i></button>`;
  const body = document.createElement('div');
  body.className = 'debate-canvas-body markdown-body';
  body.innerHTML = `<div class="debate-shimmer-wrap"><div class="debate-shimmer-line" style="width:55%;"></div><div class="debate-shimmer-line" style="width:92%;"></div><div class="debate-shimmer-line" style="width:78%;"></div><div class="debate-shimmer-line" style="width:85%;"></div></div>`;
  wrap.appendChild(hdr);
  wrap.appendChild(body);
  bubble.appendChild(wrap);
  group.appendChild(bubble);

  if (_thinkingHeaderEl && _thinkingHeaderEl.parentNode === col) col.insertBefore(group, _thinkingHeaderEl);
  else col.appendChild(group);

  if (window.lucide) lucide.createIcons({ parent: hdr });
  hdr.querySelector('#btn-debate-copy-canvas')?.addEventListener('click', () => {
    navigator.clipboard.writeText(body.innerText || '');
  });
  _canvasWrapEl = wrap;
  _canvasBodyEl = body;
  return wrap;
}

// ── Sync inline debate transcript to current session ───────────────────────
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
    let roundHtml = `<div class="debate-round-inner"><div class="debate-round-label">Round ${rNum}</div>`;
    items.forEach(it => {
      const full = it.fullText || it.snippet || '';
      roundHtml += `<div class="debate-agent-section" id="debate-agent-${it.sender}-r${rNum}" data-full-text="${_esc(full)}" data-snippet="${_esc(it.snippet)}"><div class="debate-agent-row"><div class="debate-agent-content"><span class="debate-agent-name">${_esc(it.name)}:</span><span class="debate-agent-brief">${_esc(it.snippet)}</span></div><span class="debate-status-indicator"><span class="debate-done-icon">${DONE_SVG}</span></span></div></div><div class="debate-breakline-wrap"><div class="debate-breakline-line"></div><button type="button" class="debate-expand-pill"><span>Show more</span>${CHEVRON_SVG}</button></div>`;
    });
    roundHtml += `</div>`;
    htmlParts.push(roundHtml);
  });

  if (_summaryText) {
    const parsedSummary = window.marked ? window.marked.parse(_summaryText) : _esc(_summaryText).replace(/\n/g, '<br>');
    const canvasHtml = `<div class="debate-canvas-wrap"><div class="debate-canvas-hdr"><div style="display:flex;align-items:center;gap:8px;"><i data-lucide="file-text" style="width:16px;height:16px;color:var(--text-2);flex-shrink:0;"></i><span style="font-size:16px;font-weight:400;color:var(--text-primary);">Joint Synthesis Report</span></div></div><div class="debate-canvas-body markdown-body">${parsedSummary}</div></div>`;
    htmlParts.push(canvasHtml);
  }

  const fullContent = htmlParts.join('\n');
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

// ── Main handler ─────────────────────────────────────────────────────────
export async function handleInlineDebateSubmit(topic) {
  if (!topic?.trim()) return;
  const cleanTopic = topic.trim();

  const ws = window.socket;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    if (window.showToast) window.showToast('Debate Error', 'WebSocket not connected. Please refresh.', 3000);
    return;
  }

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
  window._debateRunning = true;
  window._debateRoundItems = [];

  _enterConversationView(cleanTopic);
  _appendUserBubble(cleanTopic);
  _appendThinkingHeader();

  window.handleDebateEvent = (p) => {
    const kind   = p.kind   || '';
    const sender = p.sender || 'system';
    const round  = p.round  || 1;
    const data   = p.data   || '';

    if (kind === 'init') {
      if (p.alpha_name) _alphaName = p.alpha_name;
      if (p.beta_name)  _betaName  = p.beta_name;
    }

    if (kind === 'search_start') _updateThinkingText(`🔍 ${data || 'Fetching research evidence...'}`);
    if (kind === 'search_done')  _updateThinkingText(`✅ ${data || 'Evidence gathered.'}`);

    if (kind === 'turn_start' && (sender === 'alpha' || sender === 'beta')) {
      const agentLabel = sender === 'alpha' ? _alphaName : _betaName;
      _updateThinkingText(`Round ${round} — ${agentLabel} is responding...`);

      const card = _getOrCreateRoundCard(round);
      if (card) {
        _activeBriefEl = _getOrCreateAgentSection(card, sender);
        const nameEl = document.getElementById(`debate-name-${sender}-${round}`);
        if (nameEl) nameEl.textContent = `${agentLabel}: `;
        if (_activeBriefEl) _activeBriefEl.textContent = '';
        const statusEl = document.getElementById(`debate-status-${sender}-${round}`);
        if (statusEl) statusEl.innerHTML = `<span class="debate-spinner" id="debate-spinner-${sender}-${round}"></span>`;
      }
      _scroll();
    }

    if (kind === 'summary_start' || (kind === 'turn_start' && sender === 'synthesis')) {
      _updateThinkingText('✨ Generating joint synthesis report...');
      _getOrCreateCanvas();
      _scroll();
    }

    if (kind === 'chunk') {
      if (sender === 'alpha') _alphaSnippet += data;
      if (sender === 'beta')  _betaSnippet  += data;

      if (_activeBriefEl && (sender === 'alpha' || sender === 'beta')) {
        const raw = sender === 'alpha' ? _alphaSnippet : _betaSnippet;
        const clean = raw.replace(/[#*`_~>]/g, '').replace(/\s+/g, ' ').trim();
        _activeBriefEl.textContent = clean.length > 200 ? clean.slice(0, 200) + '…' : clean;
        _scroll();
      }

      if (sender === 'synthesis') {
        if (!_canvasBodyEl) _getOrCreateCanvas();
        _summaryText += data;
        if (_canvasBodyEl) {
          _canvasBodyEl.innerHTML = window.marked ? window.marked.parse(_summaryText) : _esc(_summaryText).replace(/\n/g, '<br>');
        }
        _scroll();
      }
    }

    if (kind === 'turn_end' && (sender === 'alpha' || sender === 'beta')) {
      const fullText = (p.full_text || (sender === 'alpha' ? _alphaSnippet : _betaSnippet)).trim();
      const clean = fullText.replace(/[#*`_~>]/g, '').trim();
      const singleLine = clean.replace(/\s+/g, ' ').trim();
      const snippet = singleLine.length > 200 ? singleLine.slice(0, 200) + '…' : singleLine;
      
      if (_activeBriefEl) {
        _activeBriefEl.textContent = snippet;
      }
      const statusEl = document.getElementById(`debate-status-${sender}-${round}`);
      if (statusEl) {
        statusEl.innerHTML = `<span class="debate-done-icon">${DONE_SVG}</span>`;
      }

      const section = document.getElementById(`debate-agent-${sender}-r${round}`);
      if (section) {
        section.dataset.fullText = clean;
        section.dataset.snippet = snippet;
        
        const nextEl = section.nextElementSibling;
        if (nextEl && nextEl.classList.contains('debate-breakline-wrap')) nextEl.remove();

        const breakWrap = document.createElement('div');
        breakWrap.className = 'debate-breakline-wrap';
        breakWrap.innerHTML = `<div class="debate-breakline-line"></div><button type="button" class="debate-expand-pill"><span>Show more</span>${CHEVRON_SVG}</button>`;
        section.after(breakWrap);
      }

      _activeBriefEl = null;

      const agentLabel = sender === 'alpha' ? _alphaName : _betaName;
      if (fullText) {
        if (!window._debateRoundItems) window._debateRoundItems = [];
        window._debateRoundItems.push({ round, sender, name: agentLabel, snippet, fullText: clean });
        _syncDebateToSession();
      }

      if (sender === 'alpha') _alphaSnippet = '';
      if (sender === 'beta')  _betaSnippet  = '';
      _scroll();
    }

    if (kind === 'summary_chunk') {
      if (!_canvasBodyEl) _getOrCreateCanvas();
      _summaryText += data;
      if (_canvasBodyEl) {
        _canvasBodyEl.innerHTML = window.marked
          ? window.marked.parse(_summaryText)
          : _esc(_summaryText).replace(/\n/g, '<br>');
      }
      _scroll();
      _syncDebateToSession();
    }

    if (kind === 'summary_end' || (kind === 'turn_end' && sender === 'synthesis')) {
      const finalSummary = (p.full_text || _summaryText || '').trim();
      if (finalSummary) {
        if (!_canvasBodyEl) _getOrCreateCanvas();
        _summaryText = finalSummary;
        if (_canvasBodyEl) {
          _canvasBodyEl.innerHTML = window.marked ? window.marked.parse(_summaryText) : _esc(_summaryText).replace(/\n/g, '<br>');
        }
      }
      _syncDebateToSession();
      _scroll();
      _markDone();
    }

    if (kind === 'doc_ready' && p.payload) {
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

    if (kind === 'error') {
      _updateThinkingText(`❌ ${data || 'Debate error occurred.'}`);
      setTimeout(_markDone, 2000);
    }
  };

  const selectedRounds = parseInt(localStorage.getItem('mariano_debate_rounds') || window._debateRounds || 3, 10);
  ws.send(JSON.stringify({ type: 'debate_start', topic: cleanTopic, rounds: selectedRounds, model_alpha: 'gemini-3.1-flash-lite', model_beta: 'gemini-3.1-flash-lite' }));
  setTimeout(_markDone, 360000);
}

function _markDone() {
  if (_finished) return;
  _finished = true;
  window._debateRunning = false;
  clearInterval(_rotateTimer);
  _removeThinkingHeader();
  document.querySelectorAll('.debate-status-indicator').forEach(el => {
    el.innerHTML = `<span class="debate-done-icon">${DONE_SVG}</span>`;
  });
  window.handleDebateEvent = null;
}

