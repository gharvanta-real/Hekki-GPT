/**
 * coder_stream_cards.js — Tool execution cards, diff summaries, and code block enhancers
 */
import { enhanceMarkdownContent } from '../chat.js';

export function enhanceCodeBlocks(container) {
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
        setTimeout(() => { btn.textContent = 'Copy'; }, 3000);
      });
    });
    pre.appendChild(btn);
  });
}

export function createToolStartCard(toolName, metadata) {
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

  return card;
}

export function handleToolEndCard(card, data, metadata, editedFilesList) {
  const isSuccess = metadata?.success !== false;
  const isEditCard = card.classList.contains('coder-edit-card');

  if (isEditCard) {
    const lineEl = card.querySelector('.coder-edit-line');
    const statusEl = card.querySelector('.coder-edit-status');
    const body = card.querySelector('.coder-tool-body');
    const preEl = card.querySelector('.coder-tool-output');

    if (isSuccess) {
      if (statusEl) statusEl.remove();

      let args = metadata?.args;
      if (!args) {
        try { args = JSON.parse(card.dataset.args || '{}'); } catch (e) { args = {}; }
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

      const editFileName = card?.querySelector('.coder-edit-file')?.textContent || '';
      const editExt = card?.querySelector('.coder-edit-ext')?.textContent || '';
      if (editFileName && Array.isArray(editedFilesList)) {
        editedFilesList.push({ fileName: editFileName, ext: editExt, additions, deletions });
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
    const statusEl  = card.querySelector('.coder-tool-status');
    const preEl     = card.querySelector('.coder-tool-output');
    const body      = card.querySelector('.coder-tool-body');
    const chevron   = card.querySelector('.coder-tool-chevron');

    if (statusEl) {
      statusEl.textContent = isSuccess ? '(done)' : '(failed)';
    }

    if (preEl) {
      if (data) {
        const rawText = String(data).trim();
        const formatted = rawText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/__DIR__/g, '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-3px;color:var(--text-3);margin-right:4px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>')
          .replace(/__FILE__/g, '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-3px;color:var(--text-3);margin-right:4px;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>');
        preEl.innerHTML = formatted;
      } else {
        preEl.innerHTML = '(no output)';
      }
    }

    if (!isSuccess && body && chevron) {
      body.style.display = 'block';
      chevron.textContent = '▾';
    }
  }
}

export function renderEditSummaryCard(files, col, scrollFn) {
  if (!files || files.length === 0 || !col) return;

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
  if (typeof scrollFn === 'function') scrollFn();
}
