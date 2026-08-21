/**
 * tool_result_tree.js — Transparent hierarchical file/folder tree, web search, command, and rich tool logs.
 * Strictly uses outline SVG icons and extension badges (ZERO emojis, flat clean aesthetic).
 */

import {
  parseDirectoryEntries,
  parseSearchResults,
  parseGrepResults,
  parseWebSearchResults,
  parseNewsResults,
  parseWeatherResults,
  parseStockResults,
  parseSecurityResults,
  parseSimulationResults
} from './tool_result_parsers.js';

const FOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;flex-shrink:0;color:var(--text-secondary);opacity:0.85;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
const FILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;flex-shrink:0;color:var(--text-secondary);opacity:0.85;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
const CHEVRON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;color:var(--text-secondary);opacity:0.75;"><polyline points="9 18 15 12 9 6"/></svg>`;
const GLOBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;flex-shrink:0;color:var(--text-secondary);opacity:0.85;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
const NEWS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;flex-shrink:0;color:var(--text-secondary);opacity:0.85;"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`;
const WEATHER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;flex-shrink:0;color:var(--text-secondary);opacity:0.85;"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const STOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;flex-shrink:0;color:var(--text-secondary);opacity:0.85;"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
const SHIELD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;flex-shrink:0;color:var(--text-secondary);opacity:0.85;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
const ATOM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;flex-shrink:0;color:var(--text-secondary);opacity:0.85;"><circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.4-2.4 2.4-6.3 0-8.7L12 3.3 3.8 11.5c-2.4 2.4-2.4 6.3 0 8.7 2.4 2.4 6.3 2.4 8.7 0l7.7-7.7"/><path d="m3.8 3.8 16.4 16.4"/></svg>`;

/**
 * Returns a clean monochromatic vector icon for a filename (zero colorful badges).
 */
export function getFileItemIcon(name, isDir = false) {
  if (isDir) return FOLDER_SVG;
  return FILE_SVG;
}


/**
 * Renders rich hierarchical tree / output view for any skill result.
 */
export function renderToolResultTreeHtml(toolName, action, resultData, metadata, args, escapeHtmlFn) {
  const esc = escapeHtmlFn || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  const act = (action || args?.action || '').toLowerCase();
  const tName = (toolName || '').toLowerCase();

  const isList = act === 'list' || tName === 'list_dir' || (tName === 'file_manager' && act === 'list');
  const isSearch = act === 'search' || tName === 'find_by_name' || (tName === 'file_manager' && act === 'search');
  const isGrep = act === 'grep' || tName === 'grep_search' || (tName === 'file_manager' && act === 'grep');
  const isRead = act === 'read' || tName === 'view_file' || (tName === 'file_manager' && act === 'read');
  const isWebSearch = tName === 'web_search' || tName === 'search_web';
  const isCmd = tName === 'run_command' || tName === 'shell';
  const isNews = tName === 'news_fetch';
  const isWeather = tName === 'weather';
  const isStock = tName === 'stock_data';
  const isSecurity = tName.includes('security') || tName.includes('recon') || tName.includes('red_team');
  const isSim = tName.includes('simulation') || tName.includes('physics');

  // 1. Directory Tree View
  if (isList) {
    const items = parseDirectoryEntries(resultData, metadata);
    if (items.length === 0) {
      if (typeof resultData === 'string' && resultData.includes('(empty)')) {
        return `<div class="tool-tree-container"><div style="font-size:12.5px;color:var(--text-3);padding:2px 0;">(empty directory)</div></div>`;
      }
      return '';
    }

    const initialLimit = 15;
    const initialItems = items.slice(0, initialLimit);
    const extraItems = items.slice(initialLimit);

    const renderItemRow = (it) => `
      <div class="tool-tree-item">
        <div class="tool-tree-item-left">
          <span class="tool-tree-icon ${it.isDir ? 'folder' : 'file'}">${getFileItemIcon(it.name, it.isDir)}</span>
          <span class="tool-tree-name tool-tree-faded">${esc(it.name)}</span>
        </div>
        ${it.size ? `<span class="tool-tree-meta">${esc(it.size)}</span>` : ''}
      </div>
    `;

    return `
      <div class="tool-tree-container">
        <div class="tool-tree-list">
          ${initialItems.map(renderItemRow).join('')}
          ${extraItems.length > 0
            ? `<div class="tool-tree-extra-items">${extraItems.map(renderItemRow).join('')}</div>
               <button type="button" class="tool-tree-more-btn" data-more-count="${extraItems.length}">
                 + Show ${extraItems.length} more
               </button>`
            : ''}
        </div>
      </div>
    `;
  }

  // 2. Search / Glob Matching View
  if (isSearch) {
    const items = parseSearchResults(resultData, metadata);
    if (items.length === 0) return '';

    const initialLimit = 15;
    const initialItems = items.slice(0, initialLimit);
    const extraItems = items.slice(initialLimit);

    const renderSearchRow = (it) => `
      <div class="tool-tree-item">
        <div class="tool-tree-item-left">
          <span class="tool-tree-icon ${it.isDir ? 'folder' : 'file'}">${getFileItemIcon(it.name || it.path, it.isDir)}</span>
          <span class="tool-tree-name tool-tree-faded">${esc(it.name || it.path)}</span>
        </div>
      </div>
    `;

    return `
      <div class="tool-tree-container">
        <div class="tool-tree-list">
          ${initialItems.map(renderSearchRow).join('')}
          ${extraItems.length > 0
            ? `<div class="tool-tree-extra-items">${extraItems.map(renderSearchRow).join('')}</div>
               <button type="button" class="tool-tree-more-btn" data-more-count="${extraItems.length}">
                 + Show ${extraItems.length} more
               </button>`
            : ''}
        </div>
      </div>
    `;
  }

  // 3. Grep / Regex Code Match View
  if (isGrep) {
    const items = parseGrepResults(resultData);
    if (items.length === 0) return '';

    const initialLimit = 15;
    const initialItems = items.slice(0, initialLimit);
    const extraItems = items.slice(initialLimit);

    const renderGrepRow = (it) => {
      const lineLabel = it.lines && it.lines.length > 0 
        ? (it.lines.length === 1 ? `#L${it.lines[0]}` : `#L${it.lines.slice(0, 4).join(', ')}${it.lines.length > 4 ? '...' : ''}`)
        : (it.line ? `#L${it.line}` : '');

      return `
        <div class="tool-tree-item">
          <div class="tool-tree-item-left">
            <span class="tool-tree-icon file">${getFileItemIcon(it.file, false)}</span>
            <span class="tool-tree-name tool-tree-faded">${esc(it.file)}</span>
            ${lineLabel ? `<span class="tool-line-tag">${esc(lineLabel)}</span>` : ''}
          </div>
        </div>
      `;
    };

    return `
      <div class="tool-tree-container">
        <div class="tool-tree-list">
          ${initialItems.map(renderGrepRow).join('')}
          ${extraItems.length > 0
            ? `<div class="tool-tree-extra-items">${extraItems.map(renderGrepRow).join('')}</div>
               <button type="button" class="tool-tree-more-btn" data-more-count="${extraItems.length}">
                 + Show ${extraItems.length} more
               </button>`
            : ''}
        </div>
      </div>
    `;
  }


  // 4. Live News Headlines View
  if (isNews) {
    const headlines = parseNewsResults(resultData, metadata);
    if (headlines.length > 0) {
      const rows = headlines.slice(0, 5).map(h => `
        <div class="tool-tree-item" style="padding:2.5px 5px;">
          <div class="tool-tree-item-left" style="flex:1;">
            <span class="tool-tree-icon" style="color:var(--text-3);">${NEWS_SVG}</span>
            <span class="tool-tree-name" style="font-size:15px;color:var(--text-primary);">${esc(h.title)}</span>
          </div>
          ${h.source ? `<span class="tool-tree-badge" style="font-size:12.5px;">${esc(h.source)}</span>` : ''}
        </div>
      `).join('');
      return `<div class="tool-tree-container"><div class="tool-tree-list">${rows}</div></div>`;
    }
  }

  // 5. Live Weather View
  if (isWeather) {
    const w = parseWeatherResults(resultData, metadata);
    if (w && w.temp) {
      return `
        <div class="tool-tree-container">
          <div style="display:inline-flex;align-items:center;gap:8px;padding:3px 0;font-size:15px;color:var(--text-primary);">
            <span style="color:var(--accent-primary,#3b82f6);display:inline-flex;align-items:center;">${WEATHER_SVG}</span>
            <span style="font-weight:500;font-size:15px;">${esc(w.temp)}</span>
            ${w.city ? `<span style="color:var(--text-secondary);">${esc(w.city)}</span>` : ''}
            ${w.condition ? `<span class="tool-tree-badge">${esc(w.condition)}</span>` : ''}
            ${w.humidity ? `<span class="tool-tree-meta">Humidity: ${esc(w.humidity)}</span>` : ''}
          </div>
        </div>
      `;
    }
  }

  // 6. Real-Time Stock View
  if (isStock) {
    const s = parseStockResults(resultData, metadata);
    if (s && s.price) {
      const isPositive = String(s.change).startsWith('+');
      const changeColor = isPositive ? '#16a34a' : (String(s.change).startsWith('-') ? '#dc2626' : 'var(--text-3)');
      return `
        <div class="tool-tree-container">
          <div style="display:inline-flex;align-items:center;gap:8px;padding:3px 0;font-size:15px;color:var(--text-primary);">
            <span style="color:var(--text-3);">${STOCK_SVG}</span>
            <span style="font-weight:500;font-family:var(--font-mono,monospace);">${esc(s.symbol)}</span>
            <span style="font-weight:500;">${esc(s.price)}</span>
            ${s.change ? `<span style="color:${changeColor};font-size:13.5px;font-weight:500;">${esc(s.change)}</span>` : ''}
          </div>
        </div>
      `;
    }
  }

  // 7. Security Scanner View
  if (isSecurity) {
    const sec = parseSecurityResults(resultData, metadata);
    if (sec) {
      return `
        <div class="tool-tree-container">
          <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 0;font-size:15px;">
            <span style="color:var(--text-3);">${SHIELD_SVG}</span>
            <span style="font-weight:500;">Grade ${esc(sec.grade)}</span>
            ${sec.target ? `<span class="tool-tree-meta">${esc(sec.target)}</span>` : ''}
            <span class="tool-tree-badge" style="color:#16a34a;">${sec.passed} passed</span>
            ${sec.failed > 0 ? `<span class="tool-tree-badge" style="color:#dc2626;">${sec.failed} alerts</span>` : ''}
          </div>
        </div>
      `;
    }
  }

  // 8. Physics / Scientific Simulation View
  if (isSim) {
    const sim = parseSimulationResults(resultData, metadata);
    if (sim) {
      return `
        <div class="tool-tree-container">
          <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 0;font-size:15px;">
            <span style="color:var(--accent-primary,#3b82f6);">${ATOM_SVG}</span>
            <span style="font-weight:500;color:var(--text-primary);">${esc(sim.solver)}</span>
            <span class="tool-tree-badge" style="font-size:12.5px;">${esc(sim.trl)}</span>
            ${sim.execution_time ? `<span class="tool-tree-meta">${esc(sim.execution_time)}</span>` : ''}
          </div>
        </div>
      `;
    }
  }

  // 9. Web Search Results View — SITENAME "FIND TEXT" Format
  if (isWebSearch || tName.includes('search') || tName.includes('web')) {
    const webResults = parseWebSearchResults(resultData, metadata);
    if (webResults.length > 0) {
      const rows = webResults.slice(0, 6).map(r => {
        let domain = r.domain;
        if ((!domain || domain === 'news.google.com') && r.url) {
          try { domain = new URL(r.url).hostname.replace('www.', ''); } catch (e) {}
        }
        domain = domain || 'web';

        // Clean title by stripping trailing domain suffix if present
        let cleanTitle = r.title || r.url;
        const re = new RegExp(`[-–|]\\s*${domain.replace('.', '\\.')}\\s*$`, 'i');
        cleanTitle = cleanTitle.replace(re, '').trim();

        return `
          <div class="tool-tree-item" style="padding:2.5px 6px;border-radius:var(--radius-xs, 4px);">
            <div class="tool-tree-item-left" style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;overflow:hidden;white-space:nowrap;">
              <span class="tool-tree-icon file" style="color:var(--accent-primary);flex-shrink:0;">${GLOBE_SVG}</span>
              <span class="tool-tree-sitename" style="color:var(--text-3);font-family:var(--font-mono, monospace);font-size:13.5px;flex-shrink:0;opacity:0.85;">${esc(domain)}</span>
              <a href="${esc(r.url)}" target="_blank" rel="noopener" style="font-size:15px;color:var(--text-primary);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400;" title="${esc(r.title)}">
                &ldquo;${esc(cleanTitle)}&rdquo;
              </a>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="tool-tree-container" style="width:100%;margin-top:3px;">
          <div class="tool-tree-list" style="display:flex;flex-direction:column;gap:1.5px;">${rows}</div>
        </div>
      `;
    }
  }




  // 10. Command Output View — Clean Borderless Terminal Block
  if (isCmd) {
    let cleanOut = String(resultData || '').trim();
    if (!cleanOut) return '';

    // Strip redundant "Exit code: 0\nSTDOUT:\n" wrapper if present
    cleanOut = cleanOut.replace(/^Exit code:\s*0\r?\n(?:STDOUT:\r?\n)?/i, '').trim();
    if (!cleanOut) return '';

    const cmdStr = args.CommandLine || args.command || args.cmd || '';
    const cwd = args.Cwd || args.cwd || '';
    let dirName = cwd ? cwd.split(/[\/\\]/).filter(Boolean).pop() : 'Hekki-Assistant';
    const promptHeader = cmdStr ? `
      <div class="tool-cmd-prompt-line" style="margin-bottom:6px;color:var(--text-3);opacity:0.85;font-size:13px;word-break:break-all;">
        <span>...\\${esc(dirName)} &gt; </span><span style="color:var(--text-primary);font-weight:500;">${esc(cmdStr)}</span>
      </div>
    ` : '';

    return `
      <div class="tool-tree-container" style="width:100%;margin-top:4px;">
        <div class="tool-output-block tool-terminal-block" style="max-height:260px;overflow-y:auto;padding:8px 12px;font-family:var(--font-mono, monospace);font-size:13px;line-height:1.5;color:var(--text-secondary);border-radius:var(--radius-sm, 8px);background:var(--bg) !important;border:1px solid var(--border-subtle, var(--border)) !important;box-shadow:none !important;">
          ${promptHeader}
          <div class="tool-cmd-output-lines" style="white-space:pre-wrap;word-break:break-word;">${esc(cleanOut)}</div>
        </div>
      </div>
    `;
  }



  // 11. File View Content
  if (isRead) {
    const rawText = String(resultData || '').trim();
    if (!rawText) return '';
    const lineCount = metadata?.total_lines || (rawText.split('\n').length);
    return `
      <div class="tool-tree-container">
        <details style="margin:0;width:100%;">
          <summary style="cursor:pointer;color:var(--text-3);font-size:15px;font-weight:400;outline:none;user-select:none;display:inline-flex;align-items:center;gap:4px;padding:2px 0;">
            ${CHEVRON_SVG}<span>View file content (${lineCount} lines)</span>
          </summary>
          <pre class="tool-output-block tool-terminal-block" style="max-height:260px;overflow-y:auto;margin-top:4px;font-size:12.5px;">${esc(rawText)}</pre>
        </details>
      </div>
    `;
  }

  // Suppress generic output details box for file mutation operations (write, replace, delete, mkdir)
  const isFileMutation = (
    toolName === 'write_to_file' || toolName.includes('replace') || toolName === 'delete_file' || toolName === 'create_dir' ||
    action === 'write' || action.includes('replace') || action === 'delete' || action === 'mkdir' || action === 'create_dir'
  );
  if (isFileMutation) {
    return '';
  }

  // Generic fallback: output details block
  if (resultData && typeof resultData === 'string' && resultData.trim()) {
    return `
      <div style="width:100%;margin-top:2px;padding-left:0;box-sizing:border-box;">
        <details style="margin:0;opacity:0.95;width:100%;">
          <summary style="cursor:pointer;color:var(--text-3);font-size:15px;font-weight:400;outline:none;user-select:none;display:inline-flex;align-items:center;gap:3px;padding:2px 0;">
            ${CHEVRON_SVG}<span>View output details</span>
          </summary>
          <pre class="tool-output-block tool-terminal-block" style="max-height:240px;overflow-y:auto;font-size:12.5px;">${esc(resultData)}</pre>
        </details>
      </div>
    `;
  }


  return '';
}

/**
 * Attaches interactive toggle handlers to all +Show more buttons in a container.
 */
export function attachToolTreeInteractivity(containerEl) {
  if (!containerEl) return;
  const btns = containerEl.querySelectorAll('.tool-tree-more-btn');
  btns.forEach(btn => {
    if (btn._hasTreeToggle) return;
    btn._hasTreeToggle = true;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = btn.closest('.tool-tree-list');
      if (!parent) return;
      const extra = parent.querySelector('.tool-tree-extra-items');
      if (!extra) return;
      const isOpen = extra.classList.toggle('open');
      const count = btn.dataset.moreCount || '';
      btn.textContent = isOpen ? '− Show less' : `+ Show ${count} more`;
    });
  });
}
