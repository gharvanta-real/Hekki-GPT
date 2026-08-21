import { enhanceCodeBlocks, createToolStartCard, handleToolEndCard, renderEditSummaryCard } from './coder_stream_cards.js';

/**
 * coder_stream_render.js — Hekki Coder AI Stream Renderer (Modularized < 500 lines)
 */

let _streamBubble      = null;
let _streamText        = '';
let _cursor            = null;
let _isStreaming        = false;
let _pendingUserBubble  = null;
let _lastToolBlock      = null;
let _thoughtBlock       = null;
let _thoughtText        = '';
let _editedFiles        = [];

let _coderActionEl      = null;
let _coderFindingEl     = null;
let _coderFindingText   = '';

function _col() {
  return document.getElementById('coder-chat-col');
}
function _log() {
  return document.getElementById('coder-chat-log');
}
function _scroll() {
  const log = _log();
  if (log) log.scrollTop = log.scrollHeight;
}

function _renderMd(text) {
  if (!text) return '';
  const cleaned = text
    .replace(/<(file_manager|coder_refactor|run_command|replace_file_content|multi_replace_file_content|write_to_file)[\s\S]*?(\/>|<\/\1>)/gi, '')
    .replace(/<(thinking|planning)>[\s\S]*?<\/\1>/gi, '');

  if (window.marked) {
    try { return marked.parse(cleaned); } catch {}
  }
  return cleaned
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,     '<em>$1</em>')
    .replace(/`([^`]+)`/g,     '<code>$1</code>')
    .replace(/\n/g,            '<br>');
}

function _addCursor(el) {
  _removeCursor();
  _cursor = document.createElement('span');
  _cursor.className = 'coder-stream-cursor';
  _cursor.innerHTML = '&#x2588;';
  _cursor.style.cssText = 'display:inline-block;width:2px;height:1em;background:var(--accent,#6366f1);border-radius:1px;margin-left:1px;animation:coder-blink .8s steps(1) infinite;vertical-align:text-bottom;font-size:.85em;opacity:.9;';
  el.appendChild(_cursor);
}
function _removeCursor() {
  _cursor?.remove();
  _cursor = null;
}

(function _injectCursorStyle() {
  if (document.getElementById('coder-stream-styles')) return;
  const s = document.createElement('style');
  s.id = 'coder-stream-styles';
  s.textContent = `
    @keyframes coder-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
    .coder-think-label {
      font-size: 11.5px;
      color: var(--text-3, #64748b);
      font-family: var(--font, system-ui);
      padding: 2px 0 6px;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-left: 4px;
    }
    .coder-think-label::before { content: "▸"; opacity: .6; }
    .coder-tool-bar {
      font-size: 11.5px;
      color: var(--text-3, #64748b);
      font-family: var(--font, sans-serif);
      padding: 3px 0 6px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-left: 2px solid var(--border, rgba(255,255,255,.1));
      padding-left: 8px;
      margin-left: 4px;
    }
    .coder-stream-error {
      color: #ef4444;
      font-size: 13px;
      font-family: var(--font, system-ui);
      padding: 8px 12px;
      background: rgba(239,68,68,.08);
      border: 1px solid rgba(239,68,68,.2);
      border-radius: 8px;
      margin: 6px 0;
    }
  `;
  document.head.appendChild(s);
})();

function _appendUserBubble(text) {
  const col = _col();
  if (!col) return null;
  const bubble = document.createElement('div');
  bubble.className = 'coder-msg coder-msg-user';
  bubble.textContent = text;
  col.appendChild(bubble);
  _scroll();
  return bubble;
}

function _ensureAiBubble() {
  if (_streamBubble) return;
  const col = _col();
  if (!col) return;
  _editedFiles = [];

  const header = document.createElement('div');
  header.className = 'cad-ai-stream-header';
  header.style.marginBottom = '12px';
  header.style.marginTop = '16px';
  header.id = 'coder-active-stream-header';
  header.innerHTML = `
    <div class="cad-ai-dot-grid" aria-hidden="true">
      <span style="--d:0"></span><span style="--d:1"></span><span style="--d:2"></span><span style="--d:3"></span>
      <span style="--d:1"></span><span style="--d:2"></span><span style="--d:3"></span><span style="--d:4"></span>
      <span style="--d:2"></span><span style="--d:3"></span><span style="--d:4"></span><span style="--d:5"></span>
      <span style="--d:3"></span><span style="--d:4"></span><span style="--d:5"></span><span style="--d:6"></span>
    </div>
    <span class="cad-ai-header-title">Thinking...</span>
  `;
  col.appendChild(header);

  _streamBubble = document.createElement('div');
  _streamBubble.className = 'coder-msg coder-msg-assistant';
  _streamBubble.setAttribute('data-stream-row', '1');
  col.appendChild(_streamBubble);
  _addCursor(_streamBubble);
}

function _ensureThoughtBlock() {
  if (_thoughtBlock) return;
  const col = _col();
  if (!col) return;

  const card = document.createElement('div');
  card.className = 'coder-thought-card';
  card.innerHTML = `
    <div class="coder-thought-header">
      <div class="coder-thought-title">
        <span>Thought Process</span>
        <span class="coder-thought-status" style="margin-left:6px; opacity:0.6;">(thinking…)</span>
      </div>
      <span class="coder-thought-chevron">▾</span>
    </div>
    <div class="coder-thought-preview"></div>
    <div class="coder-thought-body">
      <div class="coder-thought-text"></div>
    </div>
  `;

  const header  = card.querySelector('.coder-thought-header');
  const body    = card.querySelector('.coder-thought-body');
  const chevron = card.querySelector('.coder-thought-chevron');
  const preview = card.querySelector('.coder-thought-preview');

  header.addEventListener('click', () => {
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? 'block' : 'none';
    if (preview) preview.style.display = collapsed ? 'none' : 'block';
    chevron.textContent = collapsed ? '▾' : '▸';
  });

  col.appendChild(card);
  _thoughtBlock = card;
  _scroll();
}

function _sealThoughtBlock() {
  if (!_thoughtBlock) return;
  const statusEl = _thoughtBlock.querySelector('.coder-thought-status');
  if (statusEl) statusEl.textContent = '(done)';

  const previewEl = _thoughtBlock.querySelector('.coder-thought-preview');
  if (previewEl && _thoughtText.trim()) {
    const lines = _thoughtText.trim().split('\n').filter(l => l.trim());
    let preview = lines.slice(0, 2).join('\n');
    if (preview.length > 140) preview = preview.slice(0, 137) + '…';
    previewEl.textContent = preview;
    previewEl.style.display = 'block';
  }

  const body    = _thoughtBlock.querySelector('.coder-thought-body');
  const chevron = _thoughtBlock.querySelector('.coder-thought-chevron');
  if (body)    body.style.display = 'none';
  if (chevron) chevron.textContent = '▸';
  _thoughtBlock = null;
  _thoughtText  = '';
}

function _finalizeStream() {
  _removeCursor();
  _sealThoughtBlock();

  const activeHeader = document.getElementById('coder-active-stream-header');
  if (activeHeader) activeHeader.remove();

  if (_streamBubble && _streamText) {
    const finalHtml = _renderMd(_streamText);
    _streamBubble.innerHTML = finalHtml;
    enhanceCodeBlocks(_streamBubble);

    if (typeof window._saveAssistantMessage === 'function') {
      window._saveAssistantMessage(_streamText, 'assistant');
    }
  }
  _streamBubble = null;
  _streamText   = '';
  _isStreaming  = false;
  _lastToolBlock = null;
  _scroll();
}

export class CoderStreamRenderer {
  handleAgentEvent(msg) {
    const { kind, data, metadata } = msg;

    switch (kind) {
      case 'thinking':
      case 'reasoning': {
        const text = (data ?? '').trim();
        const col = _col();
        if (col) {
          if (_coderActionEl) { _coderActionEl.remove(); _coderActionEl = null; }
          _coderFindingEl = null;
          _coderFindingText = '';
          if (text) {
            _coderActionEl = document.createElement('div');
            _coderActionEl.className = 'action-label action-label-temp';
            _coderActionEl.textContent = text;
            col.appendChild(_coderActionEl);
            _scroll();
          }
        }
        break;
      }

      case 'think_chunk':
        break;

      case 'reasoning_chunk': {
        const col = _col();
        if (col) {
          if (_coderActionEl) {
            _coderActionEl.classList.remove('action-label-temp');
            _coderActionEl = null;
          }
          if (!_coderFindingEl) {
            _coderFindingEl = document.createElement('div');
            _coderFindingEl.className = 'finding-label';
            col.appendChild(_coderFindingEl);
          }
          _coderFindingText += data ?? '';
          const sentenceBreak = _coderFindingText.search(/(?<=[.!?])\s+[A-Z]/);
          const display = sentenceBreak > 0
            ? _coderFindingText.slice(0, sentenceBreak + 1).trim()
            : _coderFindingText.slice(0, 180).trim();
          _coderFindingEl.textContent = display;
          _scroll();
        }
        break;
      }

      case 'response_chunk':
        this.onResponseChunk(data ?? '');
        break;

      case 'response':
        _ensureAiBubble();
        _streamText = data ?? '';
        _removeCursor();
        _streamBubble.innerHTML = _renderMd(_streamText);
        enhanceCodeBlocks(_streamBubble);
        _scroll();
        break;

      case 'tool_call':
        this.onToolStart(data ?? metadata?.tool ?? 'tool', metadata);
        break;

      case 'tool_result':
        this.onToolEnd(data, metadata);
        break;

      case 'done':
        this.onDone(data ?? '');
        break;

      case 'error':
        this.onError(data ?? msg.reason ?? 'An error occurred');
        break;
    }
  }

  appendUserMessage(text) {
    _sealThoughtBlock();
    _isStreaming = false;
    _pendingUserBubble = _appendUserBubble(text);
  }

  onResponseChunk(chunk) {
    _sealThoughtBlock();
    _ensureAiBubble();
    _isStreaming = true;
    _streamText += chunk;

    if (_streamBubble) {
      _removeCursor();
      const partial = _renderMd(_streamText);
      _streamBubble.innerHTML = partial;
      enhanceCodeBlocks(_streamBubble);
      _addCursor(_streamBubble);
    }
    _scroll();
  }

  onToolStart(toolName, metadata) {
    _finalizeStream();
    const card = createToolStartCard(toolName, metadata);
    const col = _col();
    if (col) { col.appendChild(card); _scroll(); }
    _lastToolBlock = card;
  }

  onToolEnd(data, metadata) {
    if (!_lastToolBlock) return;
    handleToolEndCard(_lastToolBlock, data, metadata, _editedFiles);
    _lastToolBlock = null;
  }

  onDone(_summary) {
    _finalizeStream();
    renderEditSummaryCard(_editedFiles, _col(), _scroll);
    _editedFiles = [];
  }

  onError(reason) {
    _removeCursor();
    _sealThoughtBlock();
    _streamBubble  = null;
    _streamText    = '';
    _isStreaming   = false;
    _lastToolBlock = null;

    const col = _col();
    if (!col) return;
    const err = document.createElement('div');
    err.className = 'coder-stream-error';
    err.textContent = `⚠ ${reason}`;
    col.appendChild(err);
    _scroll();

    if (typeof window._saveAssistantMessage === 'function') {
      window._saveAssistantMessage(`⚠ ${reason}`, 'error');
    }
  }

  clearChat() {
    _finalizeStream();
    _sealThoughtBlock();
    _lastToolBlock = null;
    const col = _col();
    if (col) col.innerHTML = '';
  }

  get isStreaming() { return _isStreaming; }
}
