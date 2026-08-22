/**
 * stream_tools.js — Tool execution container, tool cards, right-aligned diff badges, and tool log streaming.
 */

import { escapeHtml, scrollChat } from '../chat.js';
import { renderToolResultTreeHtml, attachToolTreeInteractivity, getFileItemIcon } from './tool_result_tree.js';
import { parseDirectoryEntries } from './tool_result_parsers.js';
import { getFriendlyToolActionText, classifyLogLine, resolveToolDisplayMeta } from './tool_helpers.js';
export { getFriendlyToolActionText, classifyLogLine, resolveToolDisplayMeta };

let _streamToolContainer = null;
let _streamToolBody      = null;
let _streamToolCount     = 0;
let _streamToolStartTime = 0;
let _lastToolBlock       = null;

export function updateDynamicHeaderTitle(col, actionText) {
  const activeHeaderTitle = col.querySelector('.cad-ai-header-title');
  if (activeHeaderTitle) {
    activeHeaderTitle.textContent = actionText;
  }
}

export function ensureToolContainer(col, enterConversationCallback) {
  if (_streamToolContainer) return _streamToolContainer;
  enterConversationCallback();

  _streamToolContainer = document.createElement('div');
  _streamToolStartTime = Date.now();
  _streamToolContainer.className = 'tool-group-card';
  _streamToolContainer.style.cssText = [
    'margin: 6px 0',
    'display: flex',
    'flex-direction: column',
    'font-family: var(--font)',
    'font-size: 15px',
    'color: var(--text-3)',
  ].join(';');

  _streamToolContainer.innerHTML = `
    <div class="tool-group-header" style="display: flex; align-items: center; justify-content: space-between; padding: 3px 0; border: none; cursor: pointer; user-select: none;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <svg data-chevron="right" class="chevron-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;opacity:0.85;transition:transform 0.15s;display:inline-block;vertical-align:middle;transform:rotate(90deg);flex-shrink:0;color:var(--text-secondary);"><path d="M12 8l10 8-10 8z"/></svg>
        <span class="tool-group-title tool-group-title-live" style="font-weight: 400; font-size: 15px; color: var(--text-primary); letter-spacing: -0.1px;">Executing actions...</span>
      </div>
    </div>


    <div class="tool-group-body" style="display: flex; flex-direction: column; padding-left: 20px; border-left: none; margin-left: 0; margin-top: 4px; gap: 3px;">
    </div>
  `;

  const activeAiMsg = col.querySelector('.msg.ai:last-of-type, .ai-msg:last-of-type');
  if (activeAiMsg && activeAiMsg.parentNode === col) {
    col.insertBefore(_streamToolContainer, activeAiMsg);
  } else {
    col.appendChild(_streamToolContainer);
  }
  _streamToolBody = _streamToolContainer.querySelector('.tool-group-body');
  if (window.lucide) lucide.createIcons({ parent: _streamToolContainer });

  const header = _streamToolContainer.querySelector('.tool-group-header');
  const body = _streamToolContainer.querySelector('.tool-group-body');
  const chevron = _streamToolContainer.querySelector('.chevron-icon');
  
  if (header && body) {
    header.addEventListener('click', () => {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'flex' : 'none';
      if (chevron) {
        chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
      }
    });
  }

  _streamToolContainer._timerInterval = null;
  return _streamToolContainer;
}

export function renderToolCallCard(e, col, enterConversationCallback, toolRunsRef) {
  const toolName = e.data || e.metadata?.tool || 'action';
  const args = e.metadata?.args || {};
  const action = args.action || '';
  const rawPath = args.TargetFile || args.target_file || args.file_path || args.filePath || args.path || args.file || args.filename || args.query || args.pattern || args.city || args.symbol || args.topic || '';
  const fileName = rawPath ? (rawPath.split(/[\/\\]/).pop() || rawPath) : toolName;

  const metaKey = (toolName === 'file_manager' && action) ? `file_manager:${action}` : toolName;
  const { label, icon, detailHtml } = resolveToolDisplayMeta(toolName, action, args, fileName, rawPath, metaKey, getFileItemIcon, escapeHtml);


  const detail = escapeHtml(String(fileName || args.command || args.query || Object.values(args)[0] || '').slice(0, 60));
  const isCmd = (toolName === 'run_command' || toolName === 'shell');

  const card = document.createElement('div');
  card.className = 'tool-block-temp tool-log-card state-running';
  card.dataset.tool = metaKey;
  card.dataset.toolName = toolName;
  card.dataset.toolAction = action;
  card._toolName = toolName;
  card._action = action;
  card._args = args;
  card.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'margin:2px 0',
    'padding:3px 0',
    'background:transparent',
    'font-size:15px',
    'font-family:var(--font)',
    'color:var(--text-secondary)',
    'gap:10px',
  ].join(';');

  // Plain text command timing (no card/pill background)
  const cmdTimerBadgeHtml = isCmd
    ? `<span class="cmd-watch-badge" style="display:inline-flex;align-items:center;font-size:13px;font-weight:400;color:var(--text-3);white-space:nowrap;flex-shrink:0;">
        <span class="cmd-watch-elapsed">0s</span>
      </span>`
    : '';

  const svgRunning = '<svg class="tool-spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;animation:spin 1s linear infinite;flex-shrink:0;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';

  card.innerHTML = `
    <div class="tool-log-row" style="display:flex;align-items:center;gap:6px;overflow:hidden;width:100%;white-space:nowrap;">
      <span class="tool-lead-status" style="display:inline-flex;align-items:center;color:var(--text-3);flex-shrink:0;">${svgRunning}</span>
      <span style="font-weight:400;font-size:15px;color:var(--text-primary);white-space:nowrap;flex-shrink:0;">${label}</span>
      <div style="display:inline-flex;align-items:center;gap:5px;overflow:hidden;flex:1;min-width:0;white-space:nowrap;">
        ${icon ? `<span style="flex-shrink:0;display:inline-flex;align-items:center;">${icon}</span>` : ''}
        ${detailHtml}
      </div>
      ${cmdTimerBadgeHtml ? `<div style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0;">${cmdTimerBadgeHtml}</div>` : ''}
    </div>
  `;

  ensureToolContainer(col, enterConversationCallback);
  const activeAiMsg = col.querySelector('.msg.ai:last-of-type, .ai-msg:last-of-type');
  if (activeAiMsg && activeAiMsg.parentNode === col && (_streamToolContainer.compareDocumentPosition(activeAiMsg) & Node.DOCUMENT_POSITION_PRECEDING)) {
    col.insertBefore(_streamToolContainer, activeAiMsg);
  }
  _streamToolCount++;
  _streamToolBody.appendChild(card);
  _lastToolBlock = card;

  // Animated dots
  const dotsEl = card.querySelector('.dots');
  if (dotsEl) {
    card._dotsInterval = setInterval(() => {
      const d = dotsEl.textContent;
      dotsEl.textContent = d.length >= 3 ? '.' : d + '.';
    }, 400);
  }

  // Per-command elapsed stopwatch (only for run_command)
  if (isCmd) {
    card._cmdStr = args.CommandLine || args.command || args.cmd || '';
    card._cmdCwd = args.Cwd || args.cwd || '';
    const cmdStart = Date.now();
    card._cmdTimerInterval = setInterval(() => {
      const elapsed = Math.max(0, Math.round((Date.now() - cmdStart) / 1000));
      const elEl = card.querySelector('.cmd-watch-elapsed');
      if (elEl) elEl.textContent = `${elapsed}s`;
    }, 1000);

    // Store start time for final display on completion
    card._cmdStartTime = Date.now();
  }

  if (toolRunsRef && Array.isArray(toolRunsRef)) {
    toolRunsRef.push({
      icon,
      label,
      detail,
      status: 'running',
      tool: toolName,
      action,
      args,
      logs: [],
      reasoning: ''
    });
  }

  scrollChat();
  return card;
}


export function handleToolLog(logLine, toolRunsRef) {
  if (toolRunsRef && Array.isArray(toolRunsRef) && toolRunsRef.length > 0) {
    const lastRun = toolRunsRef[toolRunsRef.length - 1];
    if (!lastRun.logs) lastRun.logs = [];
    lastRun.logs.push(logLine);
  }
  if (!_lastToolBlock || !logLine) return;
  let liveLog = _lastToolBlock.querySelector('.tool-live-log');
  if (!liveLog) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tool-tree-output-wrapper';
    wrapper.style.width = '100%';

    liveLog = document.createElement('div');
    liveLog.className = 'tool-live-log tool-terminal-block';
    liveLog.style.cssText = 'width:100%;margin-top:4px;max-height:240px;overflow-y:auto;background:var(--bg) !important;padding:8px 12px;border-radius:var(--radius-sm, 8px);font-family:var(--font-mono);font-size:13px;line-height:1.5;border:1px solid var(--border-subtle, var(--border)) !important;box-shadow:none !important;';
    
    // Add command prompt line if command tool
    const cmdStr = _lastToolBlock._cmdStr;
    const cwd = _lastToolBlock._cmdCwd;
    if (cmdStr) {
      const dirName = cwd ? cwd.split(/[\/\\]/).filter(Boolean).pop() : 'Hekki-Assistant';
      const promptEl = document.createElement('div');
      promptEl.className = 'tool-cmd-prompt-line';
      promptEl.style.cssText = 'margin-bottom:6px;color:var(--text-3);opacity:0.85;font-size:13px;word-break:break-all;';
      promptEl.innerHTML = `<span>...\\${escapeHtml(dirName)} &gt; </span><span style="color:var(--text-primary);font-weight:500;">${escapeHtml(cmdStr)}</span>`;
      liveLog.appendChild(promptEl);
    }

    wrapper.appendChild(liveLog);
    _lastToolBlock.appendChild(wrapper);
  }
  const lineEl = document.createElement('div');
  lineEl.className = 'tool-log-line';

  // Classify line type for color coding via helper
  const lineClass = classifyLogLine(logLine);
  if (lineClass) {
    lineEl.classList.add(lineClass);
  } else {
    lineEl.style.color = 'inherit';
    lineEl.style.opacity = '0.85';
  }

  lineEl.textContent = logLine;
  liveLog.appendChild(lineEl);
  liveLog.scrollTop = liveLog.scrollHeight;


  // Auto-detect terminal timeout/error lines → state-timeout + freeze stopwatch
  const low = logLine.toLowerCase();
  const isTermErr = ['timed out', 'error:', 'killed', 'signal: term', 'exit code'].some(kw => low.includes(kw));
  if (isTermErr && _lastToolBlock._cmdTimerInterval) {
    clearInterval(_lastToolBlock._cmdTimerInterval);
    _lastToolBlock._cmdTimerInterval = null;
    _lastToolBlock.classList.remove('state-running');
    _lastToolBlock.classList.add('state-timeout');
    const watchBadge = _lastToolBlock.querySelector('.cmd-watch-badge');
    if (watchBadge && _lastToolBlock._cmdStartTime) {
      const finalElapsed = Math.max(1, Math.round((Date.now() - _lastToolBlock._cmdStartTime) / 1000));
      const elEl = watchBadge.querySelector('.cmd-watch-elapsed');
      if (elEl) elEl.textContent = `${finalElapsed}s`;
    }
    // Inject timeout pill badge if not already present
    const toolLogRow = _lastToolBlock.querySelector('.tool-log-row');
    if (toolLogRow && !toolLogRow.querySelector('.tool-timeout-badge')) {
      const badge = document.createElement('span');
      badge.className = 'tool-timeout-badge';
      badge.textContent = 'Timeout';
      toolLogRow.appendChild(badge);
    }
    if (_lastToolBlock._dotsInterval) {
      clearInterval(_lastToolBlock._dotsInterval);
      _lastToolBlock._dotsInterval = null;
    }
    const leadStatusEl = _lastToolBlock.querySelector('.tool-lead-status');
    if (leadStatusEl) {
      leadStatusEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      leadStatusEl.style.color = '#ef4444';
    }
  }
  scrollChat();
}



export function handleToolResult(e, toolRunsRef) {
  if (!_lastToolBlock) return;
  const isSuccess = e.metadata?.success !== false;

  // Swap CSS state class: running → done/failed
  _lastToolBlock.classList.remove('state-running');
  _lastToolBlock.classList.add(isSuccess ? 'state-done' : 'state-failed');

  if (_lastToolBlock._dotsInterval) {
    clearInterval(_lastToolBlock._dotsInterval);
    _lastToolBlock._dotsInterval = null;
  }

  // Stop per-command watch timer and freeze elapsed on badge
  if (_lastToolBlock._cmdTimerInterval) {
    clearInterval(_lastToolBlock._cmdTimerInterval);
    _lastToolBlock._cmdTimerInterval = null;
  }
  const watchBadge = _lastToolBlock.querySelector('.cmd-watch-badge');
  if (watchBadge && _lastToolBlock._cmdStartTime) {
    const finalElapsed = Math.max(1, Math.round((Date.now() - _lastToolBlock._cmdStartTime) / 1000));
    const elEl = watchBadge.querySelector('.cmd-watch-elapsed');
    if (elEl) elEl.textContent = `${finalElapsed}s`;
    watchBadge.style.opacity = '0.7';
  }

  const leadStatusEl = _lastToolBlock.querySelector('.tool-lead-status');
  if (leadStatusEl) {
    leadStatusEl.innerHTML = isSuccess
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    leadStatusEl.style.color = isSuccess ? 'var(--text-3)' : '#ef4444';
  }

  // Render transparent hierarchical tree/output view
  const toolName = _lastToolBlock._toolName || _lastToolBlock.dataset.toolName || _lastToolBlock.dataset.tool || e.metadata?.tool || '';
  const action = _lastToolBlock._action || _lastToolBlock.dataset.toolAction || e.metadata?.action || '';
  const args = _lastToolBlock._args || e.metadata?.args || {};

  // Update real line chunk tag on read completion
  if (action === 'read' || toolName === 'view_file' || e.metadata?.action === 'read') {
    const s = e.metadata?.start_line || args.start_line || args.start || args.StartLine || 1;
    const eLine = e.metadata?.end_line || args.end_line || args.end || args.EndLine || e.metadata?.total_lines || '';
    if (s && eLine) {
      const lineTagEl = _lastToolBlock.querySelector('.tool-line-tag');
      if (lineTagEl) {
        lineTagEl.textContent = `#L${s}-${eLine}`;
      } else {
        const detailEl = _lastToolBlock.querySelector('.tool-detail');
        if (detailEl) {
          detailEl.insertAdjacentHTML('afterend', `<span class="tool-line-tag">#L${s}-${eLine}</span>`);
        }
      }
    }
  }

  // Update count badge on list, search, grep completion (e.g. (8))
  const isListOrSearch = (action === 'list' || toolName === 'list_dir' || action === 'search' || toolName === 'find_by_name' || action === 'grep' || toolName === 'grep_search');
  if (isListOrSearch) {
    let count = (e.metadata?.count ?? e.metadata?.matches ?? e.metadata?.total_entries ?? '');
    if (count === '' && e.data && (action === 'list' || toolName === 'list_dir')) {
      const items = parseDirectoryEntries(e.data, e.metadata);
      if (items.length > 0) count = items.length;
    }
    if (count !== '') {
      const countPillEl = _lastToolBlock.querySelector('.tool-count-pill');
      if (countPillEl) {
        countPillEl.textContent = `(${count})`;
      } else {
        const detailEl = _lastToolBlock.querySelector('.tool-detail');
        if (detailEl) detailEl.insertAdjacentHTML('afterend', `<span class="tool-count-pill" style="margin-left:5px;font-size:15px;color:var(--text-3);font-family:var(--font);">(${count})</span>`);
      }
    }
  }

  // If this is a command tool and we ALREADY have a live log element, do NOT append a duplicate output tree
  const hasLiveLog = !!_lastToolBlock.querySelector('.tool-live-log');
  const isCmdTool = (toolName === 'run_command' || toolName === 'shell' || action === 'command');

  if (isCmdTool && hasLiveLog) {
    const liveLog = _lastToolBlock.querySelector('.tool-live-log');
    const rowEl = _lastToolBlock.querySelector('.tool-log-row');
    if (rowEl && !rowEl.querySelector('.tool-tree-toggle-chevron')) {
      rowEl.classList.add('has-tree');
      rowEl.insertAdjacentHTML('beforeend', `<svg class="tool-tree-toggle-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
      rowEl.addEventListener('click', (ev) => {
        if (ev.target.closest('a, button')) return;
        const isHidden = liveLog.style.display === 'none';
        liveLog.style.display = isHidden ? '' : 'none';
        rowEl.querySelector('.tool-tree-toggle-chevron')?.classList.toggle('collapsed', !isHidden);
      });
    }
  } else {
    const treeHtml = renderToolResultTreeHtml(toolName, action, e.data, e.metadata, args, escapeHtml);
    if (treeHtml) {
      const treeContainer = document.createElement('div');
      treeContainer.style.width = '100%';
      treeContainer.innerHTML = treeHtml;
      _lastToolBlock.appendChild(treeContainer);
      attachToolTreeInteractivity(treeContainer);
      _lastToolBlock._hasRichTree = true;
      const rowEl = _lastToolBlock.querySelector('.tool-log-row');
      if (rowEl && !rowEl.querySelector('.tool-tree-toggle-chevron')) {
        rowEl.classList.add('has-tree');
        rowEl.insertAdjacentHTML('beforeend', `<svg class="tool-tree-toggle-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
        rowEl.addEventListener('click', (ev) => {
          if (ev.target.closest('a, button')) return;
          const isHidden = treeContainer.style.display === 'none';
          treeContainer.style.display = isHidden ? '' : 'none';
          rowEl.querySelector('.tool-tree-toggle-chevron')?.classList.toggle('collapsed', !isHidden);
        });
      }
    }
  }


  if (toolRunsRef && toolRunsRef.length > 0) {
    const lastRun = toolRunsRef[toolRunsRef.length - 1];
    lastRun.status = isSuccess ? 'done' : 'failed';
    lastRun.tool = toolName;
    lastRun.action = action;
    lastRun.args = args;
    lastRun.metadata = e.metadata || {};
    if (e.data && typeof e.data === 'string') {
      lastRun.output = e.data;
    }
  }

  scrollChat();
}


export function finalizeToolContainer(isSuccess = true) {
  if (_streamToolBody) {
    _streamToolBody.querySelectorAll('.tool-log-card').forEach(card => {
      if (card._dotsInterval) {
        clearInterval(card._dotsInterval);
        card._dotsInterval = null;
      }
      if (card._cmdTimerInterval) {
        clearInterval(card._cmdTimerInterval);
        card._cmdTimerInterval = null;
      }
    });
  }
  _lastToolBlock = null;
  if (!_streamToolContainer) return;

  if (_streamToolContainer._timerInterval) {
    clearInterval(_streamToolContainer._timerInterval);
    _streamToolContainer._timerInterval = null;
  }

  const titleEl = _streamToolContainer.querySelector('.tool-group-title');
  if (titleEl) {
    // Remove live pulsing dot
    titleEl.classList.remove('tool-group-title-live');

    // Count done vs failed cards for partial-fail label
    const allCards = _streamToolBody ? Array.from(_streamToolBody.querySelectorAll('.tool-log-card')) : [];
    const doneCount = allCards.filter(c => c.classList.contains('state-done')).length;
    const failedCount = allCards.filter(c => c.classList.contains('state-failed') || c.classList.contains('state-timeout')).length;

    if (!isSuccess || failedCount > 0) {
      if (failedCount > 0 && doneCount > 0) {
        titleEl.textContent = `${doneCount} done, ${failedCount} failed`;
        titleEl.style.color = '#f97316';
      } else {
        titleEl.textContent = 'Actions failed';
        titleEl.style.color = '#ef4444';
      }
    } else {
      const isAllCmds = allCards.every(c => c.dataset.toolName === 'run_command' || c.dataset.toolName === 'shell');
      const isAllFiles = allCards.every(c => ['view_file', 'list_dir', 'find_by_name', 'grep_search'].includes(c.dataset.toolName));
      if (isAllCmds && allCards.length > 0) {
        titleEl.textContent = allCards.length === 1 ? 'Ran 1 command' : `Ran ${allCards.length} commands`;
      } else if (isAllFiles && allCards.length > 0) {
        titleEl.textContent = allCards.length === 1 ? 'Explored 1 file' : `Explored ${allCards.length} files`;
      } else {
        titleEl.textContent = allCards.length === 1 ? 'Completed 1 action' : `Completed ${allCards.length} actions`;
      }
      titleEl.style.color = 'var(--text-2)';
    }
  }

  const body = _streamToolBody;
  const chevron = _streamToolContainer.querySelector('.chevron-icon');
  const hasOpenDetails = body && (body.querySelector('details[open]') || body.querySelector('.tool-tree-container') || body.querySelector('.tool-terminal-block'));
  if (body && body.style.display !== 'none' && !hasOpenDetails) {
    setTimeout(() => {
      if (body && !body.querySelector('.tool-tree-container') && !body.querySelector('.tool-terminal-block')) {
        body.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
      }
    }, 2000);
  }


  _streamToolContainer = null;
  _streamToolBody      = null;
  _streamToolCount     = 0;
}

