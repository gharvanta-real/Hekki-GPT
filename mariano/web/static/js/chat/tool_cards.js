/* === chat/tool_cards.js — Tool execution cards & runs rendering === */

import { renderToolResultTreeHtml, attachToolTreeInteractivity, getFileItemIcon } from '../stream/tool_result_tree.js';
import { parseDirectoryEntries } from '../stream/tool_result_parsers.js';
import { classifyLogLine, resolveToolDisplayMeta } from '../stream/tool_helpers.js';

/** Render tool run cards restored from metadata on chat history load */
export function createToolGroupCard(msg, escapeHtmlFn) {
  const esc = escapeHtmlFn || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  const runs = (msg.metadata && Array.isArray(msg.metadata)) ? msg.metadata : (msg.metadata?.tool_runs || msg.metadata?.toolRuns || []);
  const durationSec = msg.metadata?.duration_sec || msg.metadata?.tool_runs_duration_sec || Math.max(1, (runs.length * 2));
  
  let titleText = `Worked for ${durationSec}s`;
  if (runs.length > 0) {
    const isAllCmds = runs.every(r => (r.tool === 'run_command' || r.action === 'command' || r.tool === 'shell' || String(r.label || '').toLowerCase().includes('command')));
    const isAllFiles = runs.every(r => (r.tool === 'view_file' || r.action === 'read' || r.tool === 'list_dir' || r.action === 'list' || r.tool === 'find_by_name' || r.action === 'search'));
    if (isAllCmds) {
      titleText = runs.length === 1 ? 'Ran 1 command' : `Ran ${runs.length} commands`;
    } else if (isAllFiles) {
      titleText = runs.length === 1 ? 'Explored 1 file' : `Explored ${runs.length} files`;
    } else {
      titleText = runs.length === 1 ? 'Completed 1 action' : `Completed ${runs.length} actions`;
    }
  }

  const hasFailed = runs.some(r => r.status === 'failed');
  const svgCheck = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;"><polyline points="20 6 9 17 4 12"/></svg>';
  const svgCross = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const fallbackIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:middle;display:inline-block;flex-shrink:0;opacity:0.7;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const memorySvg = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;vertical-align:middle;display:inline-block;flex-shrink:0;"><path d="m12,28h-2c-3.8599,0-7-3.1401-7-7v-2h2v2c0,2.7568,2.2432,5,5,5h2v2Z"/><path d="m28,19h-9c-1.104.0014-1.9986.896-2,2v5c0,1.1046.8954,2,2,2h3v-2h-3v-5h9v5h-2.5352l-2.5937,3.8906,1.6641,1.1094,2-3h1.4648c1.1046,0,2-.8954,2-2v-5c-.0014-1.104-.896-1.9986-2-2Z"/><path d="m29,15v-4c0-3.8599-3.1401-7-7-7h-3v2h3c2.7568,0,5,2.2432,5,5v4h2Z"/><rect x="6" y="10" width="3" height="2"/><path d="m12.606,6.4355l-2.5251-3.6855c-.3821-.4766-.9512-.75-1.5615-.75h-4.5193c-1.1028,0-2,.8975-2,2v10c0,1.1025.8972,2,2,2h7c1.1028,0,2-.8975,2-2v-6.375c0-.4526-.1558-.8965-.394-1.1895Zm-8.606,7.5645V4h4v3c0,.5522.4478,1,1,1h2v6h-7Z"/></svg>';
  const statusHtml = hasFailed ? `<span style="color:#ef4444;display:inline-flex;align-items:center;gap:4px;">${svgCross} failed</span>` : `<span style="color:var(--text-3);display:inline-flex;align-items:center;gap:4px;">${svgCheck} completed</span>`;

  const toolCard = document.createElement('div');
  toolCard.className = 'tool-group-card';
  toolCard.innerHTML = `
    <div class="tool-group-header" style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border:none;cursor:pointer;user-select:none;">
      <div style="display:flex;align-items:center;gap:6px;">
        <svg data-chevron="right" class="chevron-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;opacity:0.85;transition:transform 0.15s;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><polyline points="9 18 15 12 9 6"/></svg>
        <span class="tool-group-title" style="font-weight:400;font-size:15px;color:var(--text-primary);letter-spacing:-0.1px;">${titleText}</span>
      </div>


      <span class="tool-group-status" style="font-size:15px;opacity:0.85;font-weight:400;">${statusHtml}</span>
    </div>
    <div class="tool-group-body" style="display:none;flex-direction:column;padding-left:20px;border-left:none;margin-left:0;margin-top:4px;gap:3px;">
      ${runs.map(r => {
        const statusSpan = r.status === 'done'
          ? `<span style="color:var(--text-3);display:inline-flex;align-items:center;gap:3.5px;">${svgCheck} done</span>`
          : `<span style="color:#ef4444;display:inline-flex;align-items:center;gap:3.5px;">${svgCross} failed</span>`;
        const reasoningHtml = r.reasoning
          ? `<div class="ai-reasoning-card" style="margin:2px 0 4px 0;padding:3px 0 3px 20px;background:transparent;font-size:13px;font-family:var(--font);color:var(--text-3);line-height:1.5;opacity:0.9;"><div style="white-space:pre-wrap;word-break:break-word;"><span>${esc(r.reasoning)}</span></div></div>`
          : '';

        const toolName = r.tool || r.name || r.label || 'action';
        const action = r.action || r.args?.action || '';
        const args = r.args || {};
        const rawPath = r.detail || args.TargetFile || args.target_file || args.file_path || args.filePath || args.path || args.file || args.filename || args.query || args.pattern || '';
        const fileName = rawPath ? (rawPath.split(/[\/\\]/).pop() || rawPath) : toolName;
        const metaKey = (toolName === 'file_manager' && action) ? `file_manager:${action}` : toolName;

        let { label: rLabel, icon: iconToUse, detailHtml } = resolveToolDisplayMeta(toolName, action, args, fileName, rawPath, metaKey, getFileItemIcon, esc);

        if (action === 'list' || toolName === 'list_dir' || action === 'search' || toolName === 'find_by_name' || action === 'grep' || toolName === 'grep_search') {
          let count = (r.metadata?.count ?? r.metadata?.matches ?? r.metadata?.total_entries ?? '');
          if (count === '' && (r.output || r.data)) {
            const items = parseDirectoryEntries(r.output || r.data, r.metadata);
            if (items.length > 0) count = items.length;
          }
          if (count !== '') {
            detailHtml += `<span class="tool-count-pill" style="margin-left:5px;font-size:15px;color:var(--text-3);font-family:var(--font);">(${count})</span>`;
          }
        }


        const isCmd = (toolName === 'run_command' || toolName === 'shell' || action === 'command');
        const hasLogs = (r.logs && Array.isArray(r.logs) && r.logs.length > 0);

        // Suppress duplicate output tree if logs already exist for a command
        const outputTreeHtml = (isCmd && hasLogs)
          ? ''
          : renderToolResultTreeHtml(r.tool || r.label, r.action || r.args?.action || '', r.output || r.data || '', r.metadata || {}, r.args || {}, esc);

        const logsHtml = hasLogs
          ? `<div class="tool-tree-output-wrapper" style="width:100%;"><div class="tool-live-log tool-terminal-block" style="width:100%;margin-top:4px;max-height:240px;overflow-y:auto;background:var(--bg) !important;padding:8px 12px;border-radius:var(--radius-sm, 8px);font-family:var(--font-mono);font-size:13px;line-height:1.5;border:1px solid var(--border-subtle, var(--border)) !important;box-shadow:none !important;">${r.logs.map(line => {
              const cls = classifyLogLine(line);
              return `<div class="tool-log-line ${cls}" style="color:inherit;opacity:0.85;">${esc(line)}</div>`;
            }).join('')}</div></div>`
          : '';



        const statusIcon = r.status === 'done'
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        const statusColor = r.status === 'done' ? 'var(--text-3)' : '#ef4444';
        const cardStateClass = r.status === 'done' ? 'state-done' : 'state-failed';
        const hasBody = !!(outputTreeHtml || logsHtml);
        const chevronHtml = hasBody
          ? `<svg class="tool-tree-toggle-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : '';
        const rowClass = hasBody ? 'tool-log-row has-tree' : 'tool-log-row';

        return `
          <div class="tool-log-card ${cardStateClass}" style="display:flex;flex-direction:column;width:100%;margin:2px 0;padding:3px 0;background:transparent;font-size:15px;font-family:var(--font);color:var(--text-3);gap:2px;">
            <div class="${rowClass}" style="display:flex;align-items:center;gap:6px;overflow:hidden;width:100%;white-space:nowrap;">
              <span class="tool-lead-status" style="display:inline-flex;align-items:center;color:${statusColor};flex-shrink:0;">${statusIcon}</span>
              <span style="font-weight:400;font-size:15px;color:var(--text-primary);white-space:nowrap;flex-shrink:0;">${rLabel}</span>
              <div style="display:inline-flex;align-items:center;gap:5px;overflow:hidden;flex:1;min-width:0;white-space:nowrap;">
                ${iconToUse ? `<span style="flex-shrink:0;display:inline-flex;align-items:center;">${iconToUse}</span>` : ''}
                ${detailHtml}
              </div>
              ${chevronHtml}
            </div>
            ${outputTreeHtml ? `<div class="tool-tree-output-wrapper" style="width:100%;">${outputTreeHtml}</div>` : ''}
            ${logsHtml}
            ${reasoningHtml}
          </div>
        `;
      }).join('')}
    </div>
  `;

  const header = toolCard.querySelector('.tool-group-header');
  const body = toolCard.querySelector('.tool-group-body');
  const chevron = toolCard.querySelector('.chevron-icon');
  if (header && body) {
    header.addEventListener('click', () => {
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'flex' : 'none';
      if (chevron) chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    });
  }

  toolCard.querySelectorAll('.tool-log-row.has-tree').forEach(row => {
    row.addEventListener('click', (ev) => {
      if (ev.target.closest('a, button')) return;
      const card = row.closest('.tool-log-card');
      if (!card) return;
      const wrapper = card.querySelector('.tool-tree-output-wrapper');
      if (!wrapper) return;
      const isHidden = wrapper.style.display === 'none';
      wrapper.style.display = isHidden ? '' : 'none';
      row.querySelector('.tool-tree-toggle-chevron')?.classList.toggle('collapsed', !isHidden);
    });
  });

  attachToolTreeInteractivity(toolCard);
  return toolCard;
}


