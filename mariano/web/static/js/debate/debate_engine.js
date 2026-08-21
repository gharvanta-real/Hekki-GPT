/**
 * debate_engine.js — WebSocket turn execution, streaming parser & audio synchronization
 */
import { socket } from '../components/socket_manager.js';
import { showToast } from '../components/toast.js';
import { enhanceMarkdownContent } from '../chat.js';
import { saveDocumentToDisk } from './debate_research_modal.js';
import { openReaderMode } from './debate_reader_mode.js';

export let ALPHA_NAME = 'Tony Stark';
export let BETA_NAME  = 'Bruce Banner';
export const USER_NAME  = 'You';

export let _debateRunning = false;
export let _currentTurn = null;
export let _summaryCard = null;
export let _roundNum = 0;
export let _paused = false;
export let _voiceEnabled = false;
export let _chunkCount = 0;

export function setAlphaName(n) { ALPHA_NAME = n; }
export function setBetaName(n) { BETA_NAME = n; }

export function syncDebateInputButtons() {
  const textarea = document.getElementById('debate-input');
  const startBtn = document.getElementById('btn-debate-start');
  const stopBtn = document.getElementById('btn-debate-stop');
  const interveneBtn = document.getElementById('btn-debate-intervene');

  if (!textarea) return;
  const hasText = textarea.value.trim().length > 0;

  if (_debateRunning) {
    if (hasText) {
      stopBtn?.style.setProperty('display', 'none');
      startBtn?.style.setProperty('display', 'none');
      interveneBtn?.style.setProperty('display', 'flex');
    } else {
      interveneBtn?.style.setProperty('display', 'none');
      startBtn?.style.setProperty('display', 'none');
      stopBtn?.style.setProperty('display', 'flex');
    }
  } else {
    stopBtn?.style.setProperty('display', 'none');
    interveneBtn?.style.setProperty('display', 'none');
    startBtn?.style.setProperty('display', 'flex');
  }
}

export function startDebate() {
  const textarea = document.getElementById('debate-input');
  const roundsSelect = document.getElementById('select-debate-rounds');
  const topic = textarea ? textarea.value.trim() : '';

  if (!topic) {
    showToast('Topic Required', 'Please enter a topic to start the debate.', 2500);
    return;
  }

  const rounds = parseInt(roundsSelect?.value || '3', 10);
  _debateRunning = true;
  window._debateRunning = true;
  _roundNum = 1;

  // Clear empty state
  const emptyState = document.getElementById('debate-empty-state');
  if (emptyState) emptyState.style.display = 'none';

  textarea.value = '';
  textarea.style.height = 'auto';
  syncDebateInputButtons();

  // Send start command to backend
  socket.send(JSON.stringify({
    type: 'debate_start',
    topic: topic,
    rounds: rounds,
    alpha_name: ALPHA_NAME,
    beta_name: BETA_NAME,
  }));
}

export function interveneDebate() {
  const textarea = document.getElementById('debate-input');
  const text = textarea ? textarea.value.trim() : '';
  if (!text) return;

  renderUserInterventionBubble(text);

  textarea.value = '';
  textarea.style.height = 'auto';
  syncDebateInputButtons();

  socket.send(JSON.stringify({
    type: 'debate_intervene',
    message: text,
  }));
}

export function stopDebate() {
  _debateRunning = false;
  window._debateRunning = false;
  syncDebateInputButtons();
  socket.send(JSON.stringify({ type: 'debate_stop' }));
}

export function resetDebateRoom() {
  stopDebate();
  const thread = document.getElementById('debate-thread');
  if (thread) {
    thread.innerHTML = `
      <div class="debate-empty-state" id="debate-empty-state">
        <div class="des-icon">
          <img src="/static/hekki.png" alt="Logo" style="width: 44px; height: 44px; border-radius: 50%; object-fit: contain; pointer-events: none;" />
        </div>
        <div class="des-title">Start a Debate</div>
        <div class="des-subtitle">Type a topic below — Alpha and Beta will argue it out across rounds. You can intervene anytime.</div>
      </div>
    `;
  }
}

export function handleDebateEvent(msg) {
  const { event, turn, text, round, total_rounds, alpha_score, beta_score, synthesis, raw_markdown } = msg;

  if (event === 'turn_start') {
    _currentTurn = turn;
    _chunkCount = 0;
    createTurnBubble(turn, round);
  } else if (event === 'turn_chunk') {
    appendTurnChunk(text);
  } else if (event === 'turn_end') {
    finalizeTurnBubble(turn, text);
    _currentTurn = null;
  } else if (event === 'synthesis') {
    renderSynthesisCard(synthesis, raw_markdown);
    _debateRunning = false;
    window._debateRunning = false;
    syncDebateInputButtons();
  }
}

function createTurnBubble(turn, round) {
  const thread = document.getElementById('debate-thread');
  if (!thread) return;

  const isAlpha = turn === 'alpha';
  const name = isAlpha ? ALPHA_NAME : BETA_NAME;
  const avatarChar = name.charAt(0).toUpperCase();

  const bubble = document.createElement('div');
  bubble.className = `debate-turn-wrapper ${turn}-turn`;
  bubble.innerHTML = `
    <div class="debate-turn-header" style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
      <div class="dp-avatar ${turn === 'alpha' ? 'dp-alpha' : 'dp-beta'}" style="width:22px; height:22px; border-radius:50%; background:var(--hover); font-size:11px; display:flex; align-items:center; justify-content:center; font-weight:600;">${avatarChar}</div>
      <span style="font-weight:600; font-size:12.5px; color:var(--text);">${name}</span>
      <span style="font-size:11px; color:var(--text-3);">Round ${round || 1}</span>
    </div>
    <div class="debate-turn-bubble markdown-body" id="current-active-turn-bubble" style="padding:12px 14px; border-radius:12px; background:var(--card); font-size:13.5px; line-height:1.5;"></div>
  `;

  thread.appendChild(bubble);
  thread.scrollTop = thread.scrollHeight;
}

function appendTurnChunk(chunk) {
  const bubble = document.getElementById('current-active-turn-bubble');
  if (!bubble) return;
  bubble.textContent += chunk;
  const thread = document.getElementById('debate-thread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

function finalizeTurnBubble(turn, fullText) {
  const bubble = document.getElementById('current-active-turn-bubble');
  if (!bubble) return;
  bubble.removeAttribute('id');

  if (window.marked && fullText) {
    try {
      bubble.innerHTML = marked.parse(fullText);
      enhanceMarkdownContent(bubble);
    } catch {}
  }
}

function renderUserInterventionBubble(text) {
  const thread = document.getElementById('debate-thread');
  if (!thread) return;

  const bubble = document.createElement('div');
  bubble.className = 'debate-turn-wrapper user-turn';
  bubble.innerHTML = `
    <div class="debate-turn-header" style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
      <div class="dp-avatar dp-user" style="width:22px; height:22px; border-radius:50%; background:var(--hover); font-size:11px; display:flex; align-items:center; justify-content:center; font-weight:600;">U</div>
      <span style="font-weight:600; font-size:12.5px; color:var(--text);">You (Intervention)</span>
    </div>
    <div class="debate-turn-bubble" style="padding:10px 14px; border-radius:12px; background:var(--hover); font-size:13.5px; line-height:1.5;">${text}</div>
  `;

  thread.appendChild(bubble);
  thread.scrollTop = thread.scrollHeight;
}

function renderSynthesisCard(synthesisHtml, rawMarkdown) {
  const thread = document.getElementById('debate-thread');
  if (!thread) return;

  const card = document.createElement('div');
  card.className = 'debate-synthesis-card';
  card.style.cssText = 'margin: 16px 0; padding: 16px; border-radius: 12px; background: var(--card); border: 1px solid var(--border);';
  card.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
      <div style="font-weight:600; font-size:14px; display:flex; align-items:center; gap:6px;">
        <i data-lucide="sparkles" style="width:16px; height:16px; color:#f59e0b;"></i>
        <span>Debate Synthesis & Consensus</span>
      </div>
      <button class="btn-open-reader" style="background:var(--hover); border:none; padding:4px 10px; border-radius:6px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; color:var(--text);">
        <i data-lucide="maximize-2" style="width:12px; height:12px;"></i>
        <span>Reader Mode</span>
      </button>
    </div>
    <div class="markdown-body" style="font-size:13.5px; line-height:1.6;">${synthesisHtml || ''}</div>
  `;

  thread.appendChild(card);
  thread.scrollTop = thread.scrollHeight;

  card.querySelector('.btn-open-reader')?.addEventListener('click', () => {
    openReaderMode(synthesisHtml, 'Arena Debate Synthesis', rawMarkdown);
  });

  saveDocumentToDisk({
    id: 'doc_' + Date.now(),
    title: 'Debate Synthesis',
    date: new Date().toLocaleDateString(),
    contentHtml: synthesisHtml,
    content: rawMarkdown,
  });

  if (window.lucide) lucide.createIcons();
}
