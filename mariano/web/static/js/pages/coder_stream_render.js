import { enhanceMarkdownContent } from '../chat.js';

/**
 * coder_stream_render.js — Hekki Coder AI Stream (Part 2 of 2)
 *
 * Isolated rendering module for the Hekki Coder page.
 * Creates and manages the streaming response bubble in #coder-chat-col.
 * Handles: user bubbles, streaming AI reply, thinking label, tool events,
 * markdown rendering, typing cursor, and done/error finalization.
 *
 * MAX: 500 lines  |  Companion: coder_stream_core.js handles WS + send logic
 */

// ─── Renderer State ───────────────────────────────────────────────────────────
let _streamBubble      = null;   // live AI response DOM node
let _streamText        = '';     // accumulated response text
let _cursor            = null;   // blinking typing cursor element
let _isStreaming        = false;
let _pendingUserBubble  = null;  // reference to the user bubble for scroll
let _lastToolBlock      = null;  // currently executing persistent tool card
let _thoughtBlock       = null;  // current open thought-process accordion card
let _thoughtText        = '';    // accumulated thought text for current block
let _editedFiles        = [];    // [{fileName, ext, additions, deletions}] per response

// ── Codex-style 3-layer feed state (mirrors agent_stream.js) ───────────────
let _coderActionEl      = null;  // ACTION label (pre-tool)
let _coderFindingEl     = null;  // FINDING label (post-tool)
let _coderFindingText   = '';    // accumulated finding text

// ─── DOM Helpers ─────────────────────────────────────────────────────────────
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
  // Strip raw tool tags and thinking/planning tag constructs to keep chat bubble clean
  const cleaned = text
    .replace(/<(file_manager|coder_refactor|run_command|replace_file_content|multi_replace_file_content|write_to_file)[\s\S]*?(\/>|<\/\1>)/gi, '')
    .replace(/<(thinking|planning)>[\s\S]*?<\/\1>/gi, '');

  if (window.marked) {
    try { return marked.parse(cleaned); } catch {}
  }
  // Fallback: basic inline markdown
  return cleaned
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,     '<em>$1</em>')
    .replace(/`([^`]+)`/g,     '<code>$1</code>')
    .replace(/\n/g,            '<br>');
}

// ─── Code Block Enhancement ───────────────────────────────────────────────────
function _enhanceCodeBlocks(container) {
  try { enhanceMarkdownContent(container); } catch(e) {}
  container.querySelectorAll('pre code').forEach((block) => {
    if (block.dataset.enhanced) return;
    block.dataset.enhanced = '1';

    const pre = block.parentElement;
    pre.style.cssText = [
      'position:relative',
      'background:var(--code-bg,#0d1117)',
      'border:1px solid var(--border,rgba(255,255,255,.1))',
      'border-radius:8px',
      'padding:14px 16px',
      'overflow-x:auto',
      'font-size:12.5px',
      'line-height:1.5',
      'margin:10px 0',
    ].join(';');

    // Copy button
    const btn = document.createElement('button');
    btn.textContent = 'Copy';
    btn.style.cssText = [
      'position:absolute',
      'top:8px',
      'right:10px',
      'font-size:11px',
      'padding:3px 8px',
      'border-radius:5px',
      'border:1px solid var(--border,rgba(255,255,255,.15))',
      'background:var(--card,rgba(255,255,255,.05))',
      'color:var(--text-3,#999)',
      'cursor:pointer',
      'transition:opacity .2s',
    ].join(';');
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(block.textContent).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
    pre.appendChild(btn);
  });
}

// ─── Cursor Management ────────────────────────────────────────────────────────
function _addCursor(el) {
  _removeCursor();
  _cursor = document.createElement('span');
  _cursor.className = 'coder-stream-cursor';
  _cursor.innerHTML = '&#x2588;';   // █
  _cursor.style.cssText = 'display:inline-block;width:2px;height:1em;background:var(--accent,#6366f1);border-radius:1px;margin-left:1px;animation:coder-blink .8s steps(1) infinite;vertical-align:text-bottom;font-size:.85em;opacity:.9;';
  el.appendChild(_cursor);
}
function _removeCursor() {
  _cursor?.remove();
  _cursor = null;
}

// Inject keyframe once
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

// ─── Bubble Creation ──────────────────────────────────────────────────────────
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
  _editedFiles = [];   // reset per-response tracking

  // Inject the Gemini 3.1 Reasoning Engine header
  const header = document.createElement('div');
  header.className = 'cad-ai-stream-header';
  header.style.marginBottom = '12px';
  header.style.marginTop = '16px';
  header.id = 'coder-active-stream-header';
  header.innerHTML = `
    <canvas class="cad-ai-orb-avatar" id="coder-active-orb-canvas" width="28" height="28"></canvas>
    <span class="cad-ai-header-title">Thinking...</span>
  `;
  col.appendChild(header);

  // Initialize the ribbon gradient orb animation
  setTimeout(() => {
    const canvas = header.querySelector('#coder-active-orb-canvas');
    if (canvas && window.RibbonGradientOrb) {
      new window.RibbonGradientOrb(canvas).start();
    }
  }, 50);

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
    if (preview) {
      preview.style.display = collapsed ? 'none' : 'block';
    }
    chevron.textContent = collapsed ? '▾' : '▸';
  });

  col.appendChild(card);
  _thoughtBlock = card;
  _scroll();
}

function _sealThoughtBlock() {
  if (!_thoughtBlock) return;
  const statusEl = _thoughtBlock.querySelector('.coder-thought-status');
  if (statusEl) {
    statusEl.textContent = '(done)';
  }

  // Extract brief preview (first ~120 chars or first 2 lines)
  const previewEl = _thoughtBlock.querySelector('.coder-thought-preview');
  if (previewEl && _thoughtText.trim()) {
    const lines = _thoughtText.trim().split('\n').filter(l => l.trim());
    let preview = lines.slice(0, 2).join('\n');
    if (preview.length > 140) preview = preview.slice(0, 137) + '…';
    previewEl.textContent = preview;
    previewEl.style.display = 'block';
  }

  // Collapse full text body
  const body    = _thoughtBlock.querySelector('.coder-thought-body');
  const chevron = _thoughtBlock.querySelector('.coder-thought-chevron');
  if (body)    body.style.display = 'none';
  if (chevron) chevron.textContent = '▸';
  _thoughtBlock = null;
  _thoughtText  = '';
}

function _appendThought(chunk) {
  _ensureThoughtBlock();
  _thoughtText += chunk;
  const textEl = _thoughtBlock?.querySelector('.coder-thought-text');
  if (textEl) {
    textEl.textContent = _thoughtText;   // raw, no truncation
  }
  _scroll();
}

function _finalizeStream() {
  _removeCursor();
  _sealThoughtBlock();

  // Remove reasoning header completely on stream completion for clean output
  const activeHeader = document.getElementById('coder-active-stream-header');
  if (activeHeader) {
    activeHeader.remove();
  }
  if (_streamBubble && _streamText) {
    // Full markdown render on completion
    const finalHtml = _renderMd(_streamText);
    _streamBubble.innerHTML = finalHtml;
    _enhanceCodeBlocks(_streamBubble);

    // Save assistant message to session history
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

function _renderEditSummary() {
  const files = _editedFiles;
  if (!files || files.length === 0) {
    _editedFiles = [];
    return;
  }
  const col = _col();
  if (!col) { _editedFiles = []; return; }

  const totalAdd = files.reduce((s, f) => s + (f.additions || 0), 0);
  const totalDel = files.reduce((s, f) => s + (f.deletions || 0), 0);
  const fileWord = files.length === 1 ? 'file' : 'files';

  const card = document.createElement('div');
  card.className = 'coder-changes-summary';
  card.innerHTML = `
    <div class="coder-changes-header changes-toggle">
      <div style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <span style="color:var(--text-primary); font-weight:400;">${files.length} ${fileWord} changed</span>
        ${totalAdd > 0 ? `<span class="coder-edit-add">+${totalAdd}</span>` : ''}
        ${totalDel > 0 ? `<span class="coder-edit-del">-${totalDel}</span>` : ''}
        <span class="coder-changes-chevron" style="font-size:11px; color:var(--text-3); opacity:0.7;">▾</span>
      </div>
    </div>
    <div class="coder-changes-files">
      ${files.map(f => `
        <div class="coder-changes-file-row">
          <div style="display:flex; align-items:center; gap:7px; overflow:hidden;">
            <span class="coder-edit-ext" style="flex-shrink:0;">${f.ext}</span>
            <span class="coder-changes-filename">${f.fileName}</span>
          </div>
          <div style="display:flex; gap:6px; font-family:var(--font-mono); font-size:11.5px;">
            ${f.additions > 0 ? `<span class="coder-edit-add">+${f.additions}</span>` : ''}
            ${f.deletions > 0 ? `<span class="coder-edit-del">-${f.deletions}</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Toggle collapse
  const header = card.querySelector('.changes-toggle');
  const filesList = card.querySelector('.coder-changes-files');
  const chevron = card.querySelector('.coder-changes-chevron');
  if (header && filesList) {
    header.addEventListener('click', () => {
      const hidden = filesList.style.display === 'none';
      filesList.style.display = hidden ? 'flex' : 'none';
      if (chevron) chevron.textContent = hidden ? '▾' : '▸';
    });
  }

  col.appendChild(card);
  _scroll();
  _editedFiles = [];
}

// ─── Public Renderer API (consumed by coder_stream_core.js) ───────────────────

export class CoderStreamRenderer {
  /**
   * Main entry point to process raw agent events.
   */
  handleAgentEvent(msg) {
    const { kind, data, metadata } = msg;

    switch (kind) {
      case 'thinking':
      case 'reasoning': {
        // LAYER 1: ACTION label — compact pre-tool narration
        const text = (data ?? '').trim();
        const col = _col();
        if (col) {
          // Clear previous action label, reset finding
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
        // Internal model inference — not for user display (Codex pattern)
        break;

      case 'reasoning_chunk': {
        // LAYER 3: FINDING label — post-tool micro-summary (max 2 sentences)
        const col = _col();
        if (col) {
          // Lock action label (remove temp class so it stays)
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
        _clearThinkLabel();
        _clearToolBar();
        _ensureAiBubble();
        _streamText = data ?? '';
        _removeCursor();
        _streamBubble.innerHTML = _renderMd(_streamText);
        _enhanceCodeBlocks(_streamBubble);
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

  /**
   * Called before anything is rendered — appends the user bubble to chat.
   */
  appendUserMessage(text) {
    _sealThoughtBlock();
    _isStreaming = false;
    _pendingUserBubble = _appendUserBubble(text);
  }

  /**
   * Agent emits a "thinking" label (handled inline in handleAgentEvent)
   */
  onThinking(text) { /* handled in handleAgentEvent routing */ }

  /**
   * Agent streams a reasoning/think chunk (handled inline in handleAgentEvent)
   */
  onThinkChunk(chunk) { /* handled in handleAgentEvent routing */ }

  /**
   * Agent streams a response token/chunk.
   */
  onResponseChunk(chunk) {
    // Seal any open thought block when real response starts
    _sealThoughtBlock();
    _ensureAiBubble();
    _isStreaming = true;
    _streamText += chunk;

    if (_streamBubble) {
      // Incremental markdown (fast path — keep cursor at end)
      _removeCursor();
      const partial = _renderMd(_streamText);
      _streamBubble.innerHTML = partial;
      _enhanceCodeBlocks(_streamBubble);
      _addCursor(_streamBubble);
    }
    _scroll();
  }

  /**
   * A tool invocation began.
   */
  onToolStart(toolName, metadata) {
    _finalizeStream();

    const args = metadata?.args || {};
    const action = args.action || '';
    const rawPath = args.TargetFile || args.target_file || args.file_path || args.filePath || args.path || args.file || args.filename || args.query || args.CommandLine || args.command || '';
    const fileName = rawPath ? rawPath.split(/[\/\\]/).pop() : '';

    let titleText = '';
    if (toolName === 'run_command' || toolName === 'shell') {
      const cmd = args.CommandLine || args.command || '';
      titleText = `Ran ${cmd}`;
    } else if (toolName === 'file_manager') {
      const act = String(action).toLowerCase();
      const targetName = fileName || rawPath || '';
      if (act === 'read') {
        titleText = `Read ${targetName}`;
      } else if (act === 'write') {
        titleText = `Wrote ${targetName}`;
      } else if (act === 'list') {
        titleText = `Listed ${targetName}`;
      } else if (act === 'grep' || act === 'search') {
        titleText = `Searched ${targetName}`;
      } else {
        titleText = `Explored ${targetName}`;
      }
    } else if (toolName === 'coder_refactor') {
      const targetName = fileName || rawPath || '';
      titleText = `Refactored ${targetName}`;
    } else {
      const detail = fileName || rawPath || String(Object.values(args)[0] || '');
      titleText = `Ran ${toolName}${detail ? ` · ${detail}` : ''}`;
    }

    if (titleText.length > 70) {
      titleText = titleText.slice(0, 67) + '…';
    }

    const isRefactor = (toolName === 'coder_refactor');
    const isWrite = (toolName === 'file_manager' && (action === 'write' || args.action === 'write' || args.Action === 'write'));
    const isReplace = (toolName === 'replace_file_content' || toolName === 'multi_replace_file_content' || toolName === 'write_to_file');
    const isEdit = isRefactor || isWrite || isReplace;

    const card = document.createElement('div');
    card.dataset.args = JSON.stringify(metadata?.args || {});

    if (isEdit) {
      card.className = 'coder-edit-card';
      const ext = fileName.split('.').pop() || 'txt';
      card.innerHTML = `
        <div class="coder-edit-line">
          <span style="opacity:0.6;">Edited</span>
          <span class="coder-edit-ext">${ext}</span>
          <span class="coder-edit-file">${fileName}</span>
          <span class="coder-edit-status" style="opacity:0.5; font-size:12px; margin-left:4px;">(editing…)</span>
        </div>
        <div class="coder-tool-body" style="display:none; margin-top:6px;">
          <pre class="coder-tool-output">(waiting for output…)</pre>
        </div>
      `;
    } else {
      card.className = 'coder-tool-card';
      card.innerHTML = `
        <div class="coder-tool-header">
          <div class="coder-tool-title">
            <span>${titleText}</span>
            <span class="coder-tool-status" style="margin-left:6px; opacity:0.6;">(running…)</span>
          </div>
          <span class="coder-tool-chevron">▸</span>
        </div>
        <div class="coder-tool-body">
          <pre class="coder-tool-output">(waiting for output…)</pre>
        </div>
      `;

      const header  = card.querySelector('.coder-tool-header');
      const body    = card.querySelector('.coder-tool-body');
      const chevron = card.querySelector('.coder-tool-chevron');

      header.addEventListener('click', () => {
        const collapsed = body.style.display === 'none';
        body.style.display = collapsed ? 'block' : 'none';
        chevron.textContent = collapsed ? '▾' : '▸';
      });
    }

    const col = _col();
    if (col) { col.appendChild(card); _scroll(); }
    _lastToolBlock = card;
  }

  /**
   * A tool invocation completed — show full output, mark status, auto-expand on failure.
   */
  onToolEnd(data, metadata) {
    if (!_lastToolBlock) return;

    const isSuccess = metadata?.success !== false;
    const isEditCard = _lastToolBlock.classList.contains('coder-edit-card');

    if (isEditCard) {
      const lineEl = _lastToolBlock.querySelector('.coder-edit-line');
      const statusEl = _lastToolBlock.querySelector('.coder-edit-status');
      const body = _lastToolBlock.querySelector('.coder-tool-body');
      const preEl = _lastToolBlock.querySelector('.coder-tool-output');

      if (isSuccess) {
        if (statusEl) statusEl.remove();

        // Calculate additions/deletions diff count
        let args = metadata?.args;
        if (!args) {
          try {
            args = JSON.parse(_lastToolBlock.dataset.args || '{}');
          } catch (e) {
            args = {};
          }
        }
        let additions = 0;
        let deletions = 0;

        if (args.new_content && args.old_content) {
          additions = args.new_content.split('\n').length;
          deletions = args.old_content.split('\n').length;
        } else if (args.ReplacementContent && args.TargetContent) {
          additions = args.ReplacementContent.split('\n').length;
          deletions = args.TargetContent.split('\n').length;
        } else if (Array.isArray(args.ReplacementChunks)) {
          args.ReplacementChunks.forEach(chunk => {
            if (chunk.ReplacementContent) additions += chunk.ReplacementContent.split('\n').length;
            if (chunk.TargetContent) deletions += chunk.TargetContent.split('\n').length;
          });
        } else if (args.CodeContent) {
          additions = args.CodeContent.split('\n').length;
          deletions = 0;
        } else if (args.content || args.code || args.text) {
          const content = args.content || args.code || args.text || '';
          additions = content.split('\n').length;
          deletions = 0;
        }

        // Track this edited file for the end-of-response summary card
        const editFileName = _lastToolBlock?.querySelector('.coder-edit-file')?.textContent || '';
        const editExt = _lastToolBlock?.querySelector('.coder-edit-ext')?.textContent || '';
        if (editFileName) {
          _editedFiles.push({ fileName: editFileName, ext: editExt, additions, deletions });
        }

        if (lineEl) {
          if (additions > 0 || deletions > 0) {
            if (additions > 0) {
              const addSpan = document.createElement('span');
              addSpan.className = 'coder-edit-add';
              addSpan.textContent = `+${additions}`;
              addSpan.style.marginLeft = '4px';
              lineEl.appendChild(addSpan);
            }
            if (deletions > 0) {
              const delSpan = document.createElement('span');
              delSpan.className = 'coder-edit-del';
              delSpan.textContent = `-${deletions}`;
              delSpan.style.marginLeft = '4px';
              lineEl.appendChild(delSpan);
            }
          } else {
            const doneSpan = document.createElement('span');
            doneSpan.style.opacity = '0.6';
            doneSpan.style.fontSize = '12.5px';
            doneSpan.style.marginLeft = '4px';
            doneSpan.textContent = '(done)';
            lineEl.appendChild(doneSpan);
          }
        }
      } else {
        // Failed edit
        if (statusEl) {
          statusEl.textContent = '(failed)';
          statusEl.style.color = '#ef4444';
          statusEl.style.opacity = '1';
        }
        if (preEl) {
          preEl.textContent = data ? String(data).trim() : '(no output)';
        }
        if (body) {
          body.style.display = 'block';
        }
      }
    } else {
      // Normal card
      const statusEl  = _lastToolBlock.querySelector('.coder-tool-status');
      const preEl     = _lastToolBlock.querySelector('.coder-tool-output');
      const body      = _lastToolBlock.querySelector('.coder-tool-body');
      const chevron   = _lastToolBlock.querySelector('.coder-tool-chevron');

      if (statusEl) {
        statusEl.textContent = isSuccess ? '(done)' : '(failed)';
      }

      if (preEl) {
        if (data) {
          const rawText = String(data).trim();
          // Escape HTML to prevent injection, then replace icons
          const formatted = rawText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/__DIR__/g, '<span class="material-icons-outlined" style="font-size:15px; vertical-align:-3px; color:var(--text-3); margin-right:4px;">folder</span>')
            .replace(/__FILE__/g, '<span class="material-icons-outlined" style="font-size:15px; vertical-align:-3px; color:var(--text-3); margin-right:4px;">description</span>');
          preEl.innerHTML = formatted;
        } else {
          preEl.innerHTML = '(no output)';
        }
      }

      // Auto-expand on failure so user immediately sees the error
      if (!isSuccess && body && chevron) {
        body.style.display = 'block';
        chevron.textContent = '▾';
      }
    }

    _lastToolBlock = null;
  }

  /**
   * Stream finished — finalize the bubble, then render file-changes summary.
   */
  onDone(_summary) {
    _finalizeStream();
    _renderEditSummary();
  }

  /**
   * Stream errored — show error inline.
   */
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

    // Save error message to session history
    if (typeof window._saveAssistantMessage === 'function') {
      window._saveAssistantMessage(`⚠ ${reason}`, 'error');
    }
  }

  /**
   * Clear the entire chat column (called on session switch).
   */
  clearChat() {
    _finalizeStream();
    _sealThoughtBlock();
    _lastToolBlock = null;
    const col = _col();
    if (col) col.innerHTML = '';
  }

  get isStreaming() { return _isStreaming; }
}
