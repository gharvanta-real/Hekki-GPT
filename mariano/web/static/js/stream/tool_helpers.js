/**
 * tool_helpers.js — Shared helper utilities for tool rendering.
 * Kept separate to maintain stream_tools.js under 500 lines.
 */

export function getFriendlyToolActionText(toolName, args = {}) {
  const t = (toolName || '').toLowerCase();
  const rawPath = args.TargetFile || args.target_file || args.file_path || args.filePath || args.path || args.file || args.filename || args.query || args.pattern || '';
  const fileName = rawPath ? (rawPath.split(/[\/\\]/).pop() || rawPath) : '';
  const cmd = args.CommandLine || args.command || args.cmd || '';

  if (t === 'web_search' || t === 'search_web') return args.query ? `Searching for "${args.query.slice(0, 25)}..."` : 'Searching the web...';
  if (t === 'web_scraper' || t === 'web_scrape' || t === 'read_url_content') return 'Reading web page...';
  if (t === 'write_to_file') return fileName ? `Writing ${fileName}...` : 'Writing file...';
  if (t === 'replace_file_content' || t === 'multi_replace_file_content') return fileName ? `Editing ${fileName}...` : 'Editing file...';
  if (t === 'view_file') return fileName ? `Reading ${fileName}...` : 'Reading file...';
  if (t === 'list_dir') return 'Scanning directory...';
  if (t === 'grep_search' || t === 'find_by_name') return 'Searching workspace...';
  if (t === 'run_command' || t === 'shell') return cmd ? `Running ${cmd.slice(0, 25)}...` : 'Executing command...';
  if (t === 'generate_image') return 'Generating image...';
  if (t === 'image_analysis') return 'Analyzing image...';
  if (t === 'audio_summary' || t === 'voice_summary') return 'Synthesizing voice audio...';
  if (t === 'news_fetch') return 'Fetching latest news...';
  if (t === 'weather') return 'Checking live weather...';
  if (t === 'stock_data') return 'Fetching stock data...';
  if (t === 'translator') return 'Translating content...';
  if (t === 'wikipedia_search') return 'Searching Wikipedia...';
  if (t === 'deep_research') return 'Synthesizing research...';
  if (t === 'reminder' || t === 'schedule') return 'Scheduling task...';
  if (t === 'physics_solver' || t === 'real_simulation') return 'Running simulation...';
  if (t === 'coder_refactor') return 'Refactoring code...';
  if (t === 'data_analyzer') return 'Analyzing dataset...';
  if (t.includes('security') || t.includes('recon') || t.includes('red_team')) return 'Auditing security...';
  if (t === 'expert_debate') return 'Running expert debate...';
  if (t === 'safe_recycler') return 'Recycling files...';
  if (t === 'invoke_subagent') return 'Delegating to subagent...';
  if (t === 'manage_task') return 'Managing task...';
  if (t === 'skill_creator') return 'Creating skill...';
  if (t.includes('memory')) return 'Updating memory...';
  return `Executing ${toolName}...`;
}

/**
 * Classify a terminal log line into a CSS class for coloring.
 */
export function classifyLogLine(line) {
  const r = line.trimStart();
  if (/^(error[:\s]|✗|fail|exception|traceback|critical)/i.test(r)) return 'log-error';
  if (/^(warn[:\s]|warning[:\s]|⚠)/i.test(r)) return 'log-warn';
  if (/^(✓|ok[:\s]|success|done[:\s]|completed|installed|created|built)/i.test(r)) return 'log-ok';
  if (/^(info[:\s]|\[info\]|debug[:\s]|\[debug\])/i.test(r)) return 'log-info';
  if (/^([a-z]:[\\\/]|\/[a-z]|\.\/|\.\.\/|~\/)/i.test(r)) return 'log-path';
  return '';
}

/**
 * Resolves action label, icon, and detailHtml for tool cards.
 */
export function resolveToolDisplayMeta(toolName, action, args, fileName, rawPath, metaKey, getFileItemIcon, escapeHtml) {
  let label = 'Analyzed';
  let icon = getFileItemIcon(fileName, action === 'list' || toolName === 'list_dir');
  let detailHtml = '';

  if (action === 'create_dir' || action === 'mkdir' || toolName === 'create_dir' || toolName === 'mkdir' || metaKey === 'file_manager:create_dir' || metaKey === 'file_manager:mkdir') {
    label = 'Created directory';
    icon = getFileItemIcon(fileName, true);
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(rawPath || fileName)}</span>`;
  } else if (action === 'list' || toolName === 'list_dir') {
    label = 'Analyzed';
    icon = getFileItemIcon(fileName, true);
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(rawPath || fileName)}</span>`;
  } else if (action === 'read' || toolName === 'view_file') {
    label = 'Analyzed';
    icon = getFileItemIcon(fileName, false);
    const startLine = args.start_line || args.start || args.StartLine || null;
    const endLine = args.end_line || args.end || args.EndLine || null;
    const lineTag = (startLine || endLine) ? `<span class="tool-line-tag">#L${startLine || 1}${endLine ? `-${endLine}` : ''}</span>` : '';
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px;">${escapeHtml(fileName)}</span>${lineTag}`;
  } else if (action === 'search' || toolName === 'find_by_name') {
    label = 'Searched';
    icon = '';
    const pattern = args.pattern || args.query || args.Pattern || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(pattern)}</span>`;
  } else if (action === 'grep' || toolName === 'grep_search') {
    label = 'Searched';
    icon = '';
    const pattern = args.pattern || args.query || args.Query || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(pattern)}</span>`;
  } else if (toolName === 'write_to_file' || metaKey === 'file_manager:write' || action === 'write') {
    label = 'Wrote';
    icon = getFileItemIcon(fileName, false);
    const content = args.CodeContent || args.code_content || args.content || args.code || '';
    let diffBadge = '';
    if (content) {
      const lineCount = content.split('\n').length;
      diffBadge = `<span class="tool-diff-add" style="color:#22c55e;font-size:15px;font-weight:400;margin-left:6px;">+${lineCount}</span>`;
    }
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(fileName)}</span>${diffBadge}`;
  } else if (action === 'delete' || toolName === 'delete_file' || metaKey === 'file_manager:delete') {
    label = 'Deleted';
    icon = getFileItemIcon(fileName, false);
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(fileName)}</span>`;
  } else if (toolName.includes('replace') || action.includes('replace') || action.includes('edit')) {
    label = 'Edited';
    icon = getFileItemIcon(fileName, false);
    const rep = args.ReplacementContent || args.replacement_content || args.replacement || '';
    const tgt = args.TargetContent || args.target_content || args.target || '';
    let diffBadge = '';
    if (rep || tgt) {
      const addLines = rep ? rep.split('\n').length : 0;
      const delLines = tgt ? tgt.split('\n').length : 0;
      const addSpan = addLines > 0 ? `<span class="tool-diff-add" style="color:#22c55e;font-size:15px;font-weight:400;margin-left:6px;">+${addLines}</span>` : '';
      const delSpan = delLines > 0 ? `<span class="tool-diff-del" style="color:#ef4444;font-size:15px;font-weight:400;margin-left:4px;">-${delLines}</span>` : '';
      diffBadge = `${addSpan}${delSpan}`;
    }
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(fileName)}</span>${diffBadge}`;
  } else if (toolName === 'web_search' || toolName === 'search_web' || toolName === 'wikipedia_search') {
    label = 'Searched';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><path d="M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2ZM28,15H22A24.26,24.26,0,0,0,19.21,4.45,12,12,0,0,1,28,15ZM16,28a5,5,0,0,1-.67,0A21.85,21.85,0,0,1,12,17H20a21.85,21.85,0,0,1-3.3,11A5,5,0,0,1,16,28ZM12,15a21.85,21.85,0,0,1,3.3-11,6,6,0,0,1,1.34,0A21.85,21.85,0,0,1,20,15Zm.76-10.55A24.26,24.26,0,0,0,10,15h-6A12,12,0,0,1,12.79,4.45ZM4.05,17h6a24.26,24.26,0,0,0,2.75,10.55A12,12,0,0,1,4.05,17ZM19.21,27.55A24.26,24.26,0,0,0,22,17h6A12,12,0,0,1,19.21,27.55Z"/></svg>';
    const query = args.query || args.Query || args.q || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(query)}</span>`;
  } else if (toolName === 'read_url_content' || toolName === 'web_scraper' || toolName === 'browser') {
    label = 'Browsed';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><path d="M28,4H4A2,2,0,0,0,2,6V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V6A2,2,0,0,0,28,4Zm0,2v4H4V6ZM4,26V12H28V26Z"/><circle cx="7" cy="8" r="1"/><circle cx="11" cy="8" r="1"/><circle cx="15" cy="8" r="1"/></svg>';
    const url = args.Url || args.url || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(url)}</span>`;

  } else if (toolName === 'run_command' || toolName === 'shell') {
    label = 'Ran';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4Zm0,2v4H6V6ZM6,26V12H26V26Z"/><polygon points="10.76 16.18 13.58 19.01 10.76 21.84 12.17 23.25 16.41 19.01 12.17 14.77 10.76 16.18"/></svg>';
    const cmd = args.CommandLine || args.command || args.cmd || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(cmd)}</span>`;
  } else if (toolName === 'news_fetch') {
    label = 'Fetched news';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4Zm0,22H6V6H26Z"/><rect x="8" y="10" width="16" height="2"/><rect x="8" y="14" width="16" height="2"/><rect x="8" y="18" width="10" height="2"/></svg>';
    const topic = args.topic || args.category || 'Latest';
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(topic)}</span>`;
  } else if (toolName === 'weather') {
    label = 'Checked weather';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><circle cx="16" cy="16" r="6"/><path d="M16,4V2M16,30V28M4,16H2M30,16H28M7.5,7.5,6.1,6.1M25.9,25.9l-1.4-1.4M7.5,24.5,6.1,25.9M25.9,6.1,24.5,7.5"/></svg>';
    const city = args.city || args.location || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(city)}</span>`;
  } else if (toolName === 'stock_data') {
    label = 'Queried ticker';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><polyline points="4 24 12 16 18 22 28 8"/><polyline points="22 8 28 8 28 14"/></svg>';
    const sym = args.symbol || args.ticker || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(sym)}</span>`;
  } else if (toolName === 'physics_solver' || toolName === 'real_simulation') {
    label = 'Simulated';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><circle cx="16" cy="16" r="3"/><ellipse cx="16" cy="16" rx="14" ry="6" transform="rotate(-30 16 16)" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
    const solver = args.solver || args.simulation_type || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(solver)}</span>`;
  } else if (toolName.includes('security') || toolName.includes('recon') || toolName.includes('red_team')) {
    label = 'Audited security';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><path d="M16,2,4,7V16c0,7.7,5.1,14.4,12,16,6.9-1.6,12-8.3,12-16V7Zm10,14c0,6.6-4.3,12.3-10,13.9C10.3,28.3,6,22.6,6,16V8.4l10-4.2,10,4.2Z"/></svg>';
    const target = args.target || args.host || args.url || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(target)}</span>`;
  } else if (toolName === 'generate_image') {
    label = 'Generated image';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--accent-primary);"><path d="M28,4H4A2,2,0,0,0,2,6V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V6A2,2,0,0,0,28,4Zm0,2v14.59l-5.29-5.3a2,2,0,0,0-2.83,0l-5.17,5.17L10.41,16.17a2,2,0,0,0-2.83,0L4,19.76V6ZM4,26V22.59l4.59-4.59L13,22.41l5.71-5.71L28,26Z"/><circle cx="10.5" cy="11.5" r="2.5"/></svg>';
    const prompt = args.Prompt || args.prompt || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(prompt)}</span>`;
  } else if (toolName === 'image_analysis') {
    label = 'Analyzed image';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><circle cx="16" cy="16" r="4"/><path d="M30.94,15.66A16.69,16.69,0,0,0,16,5,16.69,16.69,0,0,0,1.06,15.66a1,1,0,0,0,0,.68A16.69,16.69,0,0,0,16,27a16.69,16.69,0,0,0,14.94-10.66A1,1,0,0,0,30.94,15.66ZM16,25c-5.39,0-10.28-3.46-12.85-9C5.72,10.46,10.61,7,16,7s10.28,3.46,12.85,9C26.28,21.54,21.39,25,16,25Z"/></svg>';
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(fileName)}</span>`;
  } else if (toolName === 'audio_summary' || toolName === 'voice_summary') {
    label = 'Synthesized audio';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><path d="M18,4a1,1,0,0,0-1,.12L9.72,10H4a2,2,0,0,0-2,2v8a2,2,0,0,0,2,2H9.72L17,27.88A1,1,0,0,0,18,28a.9.9,0,0,0,.46-.11A1,1,0,0,0,19,27V5A1,1,0,0,0,18,4ZM4,12H9v8H4Zm13,12.87L11,19.34V12.66l6-5.53ZM24,16a5,5,0,0,0-2-4.08V9.74a7,7,0,0,1,0,12.52v-2.18A5,5,0,0,0,24,16Z"/></svg>';
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(fileName)}</span>`;
  } else if (toolName === 'safe_recycler') {
    label = 'Recycled';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><path d="M12 4h8v2h-8zM6 8h20v2H6zm3 4h2v14H9zm6 0h2v14h-2zm6 0h2v14h-2z"/></svg>';
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(fileName)}</span>`;
  } else if (toolName === 'invoke_subagent') {
    label = 'Delegated';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--accent-primary);"><circle cx="16" cy="8" r="4"/><path d="M26,24a6,6,0,0,0-6-6H12a6,6,0,0,0-6,6v4H26Z"/></svg>';
    const subDesc = args.Role || args.TypeName || args.role || fileName;
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(subDesc)}</span>`;
  } else if (toolName === 'schedule' || toolName === 'reminder') {
    label = 'Timed';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="16 8 16 16 22 16" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const dur = args.DurationSeconds ? `${args.DurationSeconds}s` : (args.CronExpression || args.Prompt || fileName);
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(dur)}</span>`;
  } else if (toolName === 'manage_task') {
    label = 'Task';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><rect x="4" y="4" width="24" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="9 16 14 21 23 11" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const tAct = args.Action || args.action || 'status';
    const tId = (args.TaskId || args.taskId || '').split('/').pop();
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(tAct + (tId ? ' ' + tId : ''))}</span>`;
  } else if (metaKey.includes('memory')) {
    label = 'Memory';
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><path d="M12 28h-2c-3.86 0-7-3.14-7-7v-2h2v2c0 2.76 2.24 5 5 5h2v2zM28 19h-9c-1.1 0-2 .9-2 2v5c0 1.1.9 2 2 2h3v-2h-3v-5h9v5h-2.54l-2.59 3.89 1.66 1.11 2-3h1.47c1.1 0 2-.9 2-2v-5c0-1.1-.9-2-2-2z"/></svg>';
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(fileName)}</span>`;
  } else {
    label = metaKey.replace(/_/g, ' ');
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;vertical-align:middle;flex-shrink:0;color:var(--text-secondary);"><path d="M26,18A10,10,0,1,1,16,8,10,10,0,0,1,26,18Zm-2,0a8,8,0,1,0-8,8A8,8,0,0,0,24,18Z"/></svg>';
    detailHtml = `<span class="tool-detail" style="font-weight:400;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${escapeHtml(fileName)}</span>`;
  }

  return { label, icon, detailHtml };
}


