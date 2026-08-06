/* === chat/messages.js — Message DOM rendering, user edit, retry === */
import { escapeHtml, formatTime, scrollChat, clearChatLogs } from './input.js';
import { enhanceMarkdownContent } from './markdown.js';
import { enhanceImagePreviews } from './media.js';

/** Render a single message DOM node with full Claude-style actions */
export function createMessageElement(type, text, timestamp, index, ChatSessionManager, globalSendCallbackRef) {
  const timeStr = formatTime(timestamp);

  if (type === 'ai') {
    if (text) {
      const lines = text.split('\n');
      const filteredLines = lines.filter(line => !line.trim().startsWith('[Tool:'));
      text = filteredLines.join('\n').trim();
    }
    if (!text) return null;
  }

  if (type === 'user') {
    const group = document.createElement('div');
    group.className = 'msg-group user';
    group.dataset.index = index;

    const imgRegex = /\[Attached Image:\s*([^\(]+)\s*\(saved at ([^\]]+)\)\]/g;
    let match;
    const imageCards = [];

    while ((match = imgRegex.exec(text)) !== null) {
      const fileName = match[1].trim();
      const rawPath = match[2].trim();
      const renderUrl = (rawPath.startsWith('data:') || rawPath.startsWith('http'))
        ? rawPath
        : `/api/workspace/render?path=${encodeURIComponent(rawPath)}`;

      imageCards.push(`
        <div style="align-self: flex-end; margin-bottom: 4px; border-radius: 12px; overflow: hidden; width: 120px; height: 120px; border: 1px solid var(--border); flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.12);">
          <img src="${renderUrl}" alt="${escapeHtml(fileName)}" style="width: 120px; height: 120px; object-fit: cover; display: block;" />
        </div>
      `);
    }

    if (imageCards.length > 0) {
      const imgContainer = document.createElement('div');
      imgContainer.style.display = 'flex';
      imgContainer.style.flexDirection = 'column';
      imgContainer.style.alignItems = 'flex-end';
      imgContainer.style.gap = '4px';
      imgContainer.innerHTML = imageCards.join('');
      group.appendChild(imgContainer);
    }

    let cleanText = text.replace(/\[Attached Image:[^\]]+\]/g, '').replace(/\[Attached File:[^\]]+\]/g, '').replace(/\[Active Workspace Context:[^\]]+\]/g, '').trim();
    if (cleanText) {
      const bubble = document.createElement('div');
      bubble.className = 'msg user';
      
      const slashMatch = cleanText.match(/^(\/(?:web|code|pdf|image|debate))\b([\s\S]*)/i);
      if (slashMatch) {
        const cmdTag = escapeHtml(slashMatch[1]);
        const restText = escapeHtml(slashMatch[2]);
        bubble.innerHTML = `<span class="user-cmd-highlight" style="display:inline-flex; align-items:center; background:rgba(37,99,235,0.16); color:#60a5fa; padding:2px 7px; border-radius:5px; font-weight:500; margin-right:6px; font-size:12.5px; font-family:var(--font); letter-spacing:0.2px;">${cmdTag}</span>${restText}`;
      } else {
        bubble.innerHTML = escapeHtml(cleanText);
      }

      const lineCount = (cleanText.match(/\n/g) || []).length + 1;
      if (cleanText.length > 200 || lineCount > 4) {
        bubble.classList.add('collapsible');
        const expandWrapper = document.createElement('div');
        expandWrapper.className = 'msg-expand-pill-wrapper';
        const expandBtn = document.createElement('button');
        expandBtn.className = 'msg-expand-btn';
        expandBtn.type = 'button';
        expandBtn.title = 'Show more';
        expandBtn.innerHTML = '<i data-lucide="chevron-down" style="width:14px;height:14px;"></i>';
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExpanded = bubble.classList.contains('expanded');
          if (isExpanded) {
            bubble.classList.remove('expanded');
            expandBtn.title = 'Show more';
            expandBtn.innerHTML = '<i data-lucide="chevron-down" style="width:14px;height:14px;"></i>';
          } else {
            bubble.classList.add('expanded');
            expandBtn.title = 'Show less';
            expandBtn.innerHTML = '<i data-lucide="chevron-up" style="width:14px;height:14px;"></i>';
          }
          if (window.lucide) lucide.createIcons();
        });
        expandWrapper.appendChild(expandBtn);
        bubble.appendChild(expandWrapper);
      }
      group.appendChild(bubble);
    }

    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actions.innerHTML = `
      <span class="action-time">${timeStr}</span>
      <button class="action-btn btn-copy" title="Copy text"><i data-lucide="copy"></i></button>
      <button class="action-btn btn-edit" title="Edit prompt"><i data-lucide="pencil"></i></button>
      <button class="action-btn btn-retry" title="Retry generation"><i data-lucide="refresh-cw"></i></button>
    `;
    group.appendChild(actions);

    actions.querySelector('.btn-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        const copyIcon = actions.querySelector('.btn-copy i');
        if (copyIcon) {
          copyIcon.setAttribute('data-lucide', 'check');
          if (window.lucide) lucide.createIcons();
          setTimeout(() => { copyIcon.setAttribute('data-lucide', 'copy'); if (window.lucide) lucide.createIcons(); }, 1500);
        }
      });
    });

    actions.querySelector('.btn-edit').addEventListener('click', () => {
      makeUserMessageEditable(group, text, index, ChatSessionManager, globalSendCallbackRef);
    });

    actions.querySelector('.btn-retry').addEventListener('click', () => {
      triggerRetry(index, ChatSessionManager, globalSendCallbackRef);
    });

    if (window.lucide) setTimeout(() => lucide.createIcons({ parent: actions }), 0);
    return group;
  } else {
    const group = document.createElement('div');
    group.className = `msg-group ${type}`;
    group.dataset.index = index;

    const el = document.createElement('div');
    el.className = `msg ${type}`;

    if (type === 'ai') {
      let thoughtHtml = '';
      let finalText = text;

      // Extract thinking process (<think> tags or numbered CoT reasoning steps)
      const parseThinking = (raw) => {
        if (!raw) return { thought: '', content: '' };
        // Pattern 1: Explicit <think>...</think> or <thinking>...</thinking>
        const tagMatch = raw.match(/<(think|thinking)>([\s\S]*?)(?:<\/\1>|$)/i);
        if (tagMatch) {
          return {
            thought: tagMatch[2].trim(),
            content: raw.replace(/<(think|thinking)>[\s\S]*?(?:<\/\1>|$)/gi, '').trim()
          };
        }

        // Pattern 2: Leaked Step-by-Step CoT Blocks (e.g. 1. **Analyze User Request:** ... 2. **Safety & Policy Check:** ...)
        if (/^(?:\d+\.\s*\*\*(?:Analyze|Safety|Policy|Persona|Constraint|Formulate).*?\*\*)/i.test(raw.trim())) {
          const paragraphs = raw.split(/\n\s*\n/);
          const thoughtPs = [];
          const contentPs = [];
          let inThought = true;

          for (let p of paragraphs) {
            const trimmedP = p.trim();
            if (inThought && (/^(?:\d+\.\s*\*|\*\*(?:Analyze|Safety|Policy|Persona|Constraint|Formulate).*?\*\*)/i.test(trimmedP) || trimmedP.startsWith('* **') || trimmedP.startsWith('- **'))) {
              thoughtPs.push(p);
            } else {
              inThought = false;
              contentPs.push(p);
            }
          }

          if (thoughtPs.length > 0 && contentPs.length > 0) {
            return {
              thought: thoughtPs.join('\n\n').trim(),
              content: contentPs.join('\n\n').trim()
            };
          }
        }

        return { thought: '', content: raw };
      };

      const { thought: thoughtContent, content: parsedFinalText } = parseThinking(text);
      finalText = parsedFinalText;

      if (thoughtContent) {
        thoughtHtml = `
          <div class="thought-container">
            <div class="thought-header">
              <span class="thought-title">Thinking Process</span>
              <i class="mi-chevron thought-chevron" data-lucide="chevron-down" style="width:12px;height:12px;display:inline-block;vertical-align:middle;transition:transform 0.2s"></i>
            </div>
            <div class="thought-body collapsed" style="display: none;">
              <div class="thought-step">${window.marked ? marked.parse(thoughtContent) : escapeHtml(thoughtContent)}</div>
            </div>
          </div>
        `;
      }

      el.innerHTML = thoughtHtml + (window.marked ? marked.parse(finalText) : escapeHtml(finalText));
      enhanceMarkdownContent(el);

      const header = el.querySelector('.thought-header');
      const body = el.querySelector('.thought-body');
      if (header && body) {
        header.addEventListener('click', () => {
          const collapsed = body.classList.toggle('collapsed');
          header.classList.toggle('open', !collapsed);
          body.style.display = collapsed ? 'none' : 'flex';
        });
      }
      if (window.lucide) setTimeout(() => lucide.createIcons({ parent: el }), 0);

      group.appendChild(el);

      if (finalText && finalText.trim().length > 0) {
        // Extract web domains mentioned in response links/markdown
        const urlRegex = /(https?:\/\/[^\s"'<>\)]+)/gi;
        const matches = text.match(urlRegex) || [];
        const domains = new Set();
        matches.forEach(u => {
          try {
            const parsed = new URL(u);
            let host = parsed.hostname.replace(/^www\./, '');
            if (host && host.includes('.') && !host.includes('localhost') && !host.includes('127.0.0.1')) {
              domains.add(host);
            }
          } catch (err) {}
        });

        let faviconsHtml = '';
        if (domains.size > 0) {
          const domainList = Array.from(domains).slice(0, 5);
          const getCat = (d) => {
            const dom = (d || '').toLowerCase();
            if (dom.includes('.gov') || dom.includes('.edu') || dom.includes('official') || dom.includes('nseindia.com') || dom.includes('bseindia.com') || dom.includes('sebi.gov.in') || dom.includes('rbi.org.in')) return '🏛️ Official';
            if (dom.includes('news') || dom.includes('reuters.com') || dom.includes('bloomberg.com') || dom.includes('economictimes') || dom.includes('moneycontrol') || dom.includes('ndtv') || dom.includes('bbc') || dom.includes('cnn') || dom.includes('thehindu') || dom.includes('livemint')) return '📰 News';
            if (dom.includes('wikipedia') || dom.includes('arxiv') || dom.includes('github') || dom.includes('quora') || dom.includes('stackoverflow') || dom.includes('medium')) return '📚 Ref';
            return '';
          };

          faviconsHtml = `
            <div class="ai-bottom-right-sources" style="display:inline-flex; align-items:center; gap:5px; margin-right:auto; flex-wrap:wrap; opacity:0.9;">
              ${domainList.map(dom => {
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${dom}&sz=32`;
                const cat = getCat(dom);
                const catSpan = cat ? `<span style="font-size:10px; opacity:0.75; margin-left:2px; font-weight:400;">${cat}</span>` : '';
                return `
                  <a href="https://${dom}" target="_blank" rel="noopener noreferrer" title="Verified Source: ${dom}" style="display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:4px; background:rgba(255,255,255,0.05); font-size:11px; color:var(--text-secondary); font-family:var(--font); text-decoration:none; transition:background 0.15s;">
                    <img src="${faviconUrl}" style="width:12px; height:12px; border-radius:2px;" onerror="this.style.display='none'">
                    <span style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">${dom}</span>
                    ${catSpan}
                  </a>
                `;
              }).join('')}
            </div>
          `;
        }

        const actions = document.createElement('div');
        actions.className = 'msg-actions ai-actions';
        actions.style.cssText = 'display:flex; align-items:center; justify-content:flex-end; gap:6px; margin-top:6px; flex-wrap:wrap; width:100%;';
        actions.innerHTML = `
          ${faviconsHtml}
          <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
            <button class="action-btn btn-copy" title="Copy response"><i data-lucide="copy"></i></button>
            <button class="action-btn btn-like" title="Good response"><i data-lucide="thumbs-up"></i></button>
            <button class="action-btn btn-dislike" title="Bad response"><i data-lucide="thumbs-down"></i></button>
            <button class="action-btn btn-fork" title="Fork conversation branch from here"><i data-lucide="git-fork"></i></button>
          </div>
        `;
        group.appendChild(actions);

        actions.querySelector('.btn-fork')?.addEventListener('click', () => {
          if (ChatSessionManager && ChatSessionManager.forkChat) {
            ChatSessionManager.forkChat(index);
          }
        });

        // Check if message references web apps or files
        const fileMatch = text.match(/([\w\-_\/\\\.]+\.(html|js|css|py|json|md))/i);
        if (fileMatch || text.includes('```html') || text.includes('```mermaid') || text.includes('```javascript') || text.includes('```py')) {
          const canvasActionBtn = document.createElement('button');
          canvasActionBtn.className = 'action-btn btn-canvas-launch';
          canvasActionBtn.title = 'Open in Live Canvas';
          canvasActionBtn.innerHTML = '<i data-lucide="layout" style="width:13px;height:13px"></i> Open Canvas';
          canvasActionBtn.style.cssText = 'display:flex; align-items:center; gap:4px; font-size:11.5px; font-weight:600; color:var(--blue); background:rgba(37,99,235,0.08); padding:3px 8px; border-radius:6px; border:none; cursor:pointer;';
          canvasActionBtn.addEventListener('click', () => {
            if (window.liveCanvas) {
              const codeBlockMatch = text.match(/```(\w+)?\n([\s\S]*?)```/);
              const extractedCode = codeBlockMatch ? codeBlockMatch[2] : text;
              const extractedLang = codeBlockMatch ? (codeBlockMatch[1] || 'html') : 'html';
              window.liveCanvas.openArtifact({
                type: extractedLang === 'mermaid' ? 'diagram' : (extractedLang === 'html' || extractedCode.includes('<html') ? 'web_app' : 'code'),
                title: fileMatch ? fileMatch[1] : 'Interactive Artifact',
                code: extractedCode,
                language: extractedLang
              });
            }
          });
          actions.insertBefore(canvasActionBtn, actions.firstChild);
        }

        actions.querySelector('.btn-copy').addEventListener('click', () => {
          const cleanText = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
          navigator.clipboard.writeText(cleanText).then(() => {
            const copyIcon = actions.querySelector('.btn-copy i');
            if (copyIcon) {
              copyIcon.setAttribute('data-lucide', 'check');
              if (window.lucide) lucide.createIcons();
              setTimeout(() => { copyIcon.setAttribute('data-lucide', 'copy'); if (window.lucide) lucide.createIcons(); }, 1500);
            }
          });
        });

        actions.querySelector('.btn-like').addEventListener('click', () => {
          actions.querySelector('.btn-like').classList.toggle('active');
          actions.querySelector('.btn-dislike').classList.remove('active');
        });

        actions.querySelector('.btn-dislike').addEventListener('click', () => {
          actions.querySelector('.btn-dislike').classList.toggle('active');
          actions.querySelector('.btn-like').classList.remove('active');
        });

        if (window.lucide) setTimeout(() => lucide.createIcons({ parent: actions }), 0);
      }
    } else {
      el.innerHTML = escapeHtml(text);
      group.appendChild(el);
    }

    return group;
  }
}

/** Render tool run cards restored from metadata on chat history load */
export function createToolGroupCard(msg, escapeHtmlFn) {
  const runs = msg.metadata.tool_runs;
  const durationSec = msg.metadata?.duration_sec || msg.metadata?.tool_runs_duration_sec || Math.max(1, (runs.length * 2));
  const titleText = `Worked for ${durationSec}s`;
  const hasFailed = runs.some(r => r.status === 'failed');
  const statusHtml = hasFailed
    ? '<span style="color: #ef4444;">&#10006; failed</span>'
    : '<span style="color: var(--text-3);">&#10003; completed</span>';

  const toolCard = document.createElement('div');
  toolCard.className = 'tool-group-card';
  toolCard.style.cssText = 'margin: 6px 0; display: flex; flex-direction: column; font-family: var(--font); font-size: 12px; color: var(--text-3);';

  toolCard.innerHTML = `
    <div class="tool-group-header" style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; cursor: pointer; user-select: none;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <i data-lucide="chevron-right" class="chevron-icon" style="width:13px;height:13px;opacity:0.6;transition:transform 0.15s;display:inline-block;vertical-align:middle;"></i>
        <span class="tool-group-title" style="font-weight: 400; color: var(--text-secondary);">${titleText}</span>
      </div>
      <span class="tool-group-status" style="font-size: 11px; opacity: 0.6; font-weight: 400;">${statusHtml}</span>
    </div>
    <div class="tool-group-body" style="display: none; flex-direction: column; padding-left: 14px; border-left: 1px dashed var(--border); margin-left: 4px; margin-top: 2px; gap: 3px;">
      ${runs.map(r => {
        const statusSpan = r.status === 'done'
          ? '<span style="color: var(--text-3);">&#10003; done</span>'
          : '<span style="color: #ef4444;">&#10006; failed</span>';
        const reasoningHtml = r.reasoning
          ? `<div class="ai-reasoning-card" style="margin: 3px 0 6px 14px; padding: 3px 0 3px 10px; border-left: 1px dashed var(--border); background: transparent; font-size: 11.5px; font-family: var(--font); color: var(--text-3); line-height: 1.55; opacity: 0.9;"><div style="white-space:pre-wrap;word-break:break-word;"><span>${escapeHtmlFn(r.reasoning)}</span></div></div>`
          : '';
        const isTerminal = r.label && (r.label.includes('Shell') || r.label.includes('Command') || r.label.includes('System') || r.label.includes('run_command'));
        const outputHtml = r.output
          ? `<div style="width: 100%; margin-top: 4px; padding-left: 21px; box-sizing: border-box;">
              <details style="margin: 0; opacity: 0.95; width: 100%;">
                <summary style="cursor:pointer; color:var(--text-3); font-size:11px; font-weight:500; outline:none; user-select:none; display:inline-flex; align-items:center; gap:4px; padding: 2px 0;">
                  <span>${isTerminal ? '&#9654; Terminal Output' : '&#9654; View output details'}</span>
                </summary>
                <pre style="margin:6px 0 2px 0; padding:10px 12px; background:var(--card); color:var(--text-primary); border-radius:8px; font-size:11px; font-family:var(--font-mono); line-height:1.55; overflow-x:auto; border:none !important; box-shadow:none !important; max-height:220px; width:100%; box-sizing:border-box; white-space:pre-wrap; word-break:break-all;">${escapeHtmlFn(r.output)}</pre>
              </details>
            </div>`
          : '';
        const iconToUse = r.icon || '&#9654;';
        const rLabel = escapeHtmlFn(r.label || '');
        const rSlashDetail = r.detail
          ? `<span style="font-weight:500;color:var(--text-secondary);white-space:nowrap;">${rLabel}</span><span style="color:var(--text-3);opacity:0.55;margin:0 1px;">/</span><span class="tool-detail" style="color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${r.detail}</span>`
          : `<span style="font-weight:500;color:var(--text-secondary);white-space:nowrap;">${rLabel}</span>`;

        return `
          <div class="tool-log-card" style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; margin:3px 0 4px 0; padding:4px 0; background:transparent; font-size:12px; font-family:var(--font); color:var(--text-3); gap:10px;">
            <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
              <span style="flex-shrink:0; opacity:0.75;">${iconToUse}</span>
              ${rSlashDetail}
            </div>
            <span class="tool-status" style="flex-shrink:0; font-size:11px; color:var(--text-3); white-space:nowrap; opacity:0.6;">${statusSpan}</span>
            ${outputHtml}
          </div>
          ${reasoningHtml}
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

  return toolCard;
}

/** Converts user bubble to edit textarea form in place */
function makeUserMessageEditable(groupEl, originalText, index, ChatSessionManager, globalSendCallbackRef) {
  const bubble = groupEl.querySelector('.msg.user');
  const actions = groupEl.querySelector('.msg-actions');
  if (!bubble) return;

  bubble.style.display = 'none';
  if (actions) actions.style.display = 'none';

  const editContainer = document.createElement('div');
  editContainer.className = 'msg-edit-container';
  const _editTa = document.createElement('textarea');
  _editTa.className = 'msg-edit-textarea';
  _editTa.value = originalText;
  const _editBtnRow = document.createElement('div');
  _editBtnRow.className = 'msg-edit-buttons';
  const _cancelBtn = document.createElement('button');
  _cancelBtn.className = 'msg-edit-btn btn-cancel';
  _cancelBtn.textContent = 'Cancel';
  const _saveBtn = document.createElement('button');
  _saveBtn.className = 'msg-edit-btn save btn-save';
  _saveBtn.textContent = 'Save & Submit';
  _editBtnRow.appendChild(_cancelBtn);
  _editBtnRow.appendChild(_saveBtn);
  editContainer.appendChild(_editTa);
  editContainer.appendChild(_editBtnRow);
  groupEl.appendChild(editContainer);

  const textarea = _editTa;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

  editContainer.querySelector('.btn-cancel').addEventListener('click', () => {
    editContainer.remove();
    bubble.style.display = 'block';
    if (actions) actions.style.display = 'flex';
  });

  editContainer.querySelector('.btn-save').addEventListener('click', () => {
    const newText = textarea.value.trim();
    if (!newText) return;
    submitEditedText(index, newText, ChatSessionManager, globalSendCallbackRef);
  });
}

/** Handles submitting edited prompt: truncates session history & triggers resend */
function submitEditedText(index, newText, ChatSessionManager, globalSendCallbackRef) {
  const activeChatId = ChatSessionManager.getActiveChatId();
  if (!activeChatId) return;
  const chats = ChatSessionManager.getChats();
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;

  chat.messages[index].text = newText;
  chat.messages[index].timestamp = new Date().toISOString();
  chat.messages = chat.messages.slice(0, index + 1);
  ChatSessionManager.saveChats(chats);
  ChatSessionManager.loadChat(activeChatId);

  const cb = globalSendCallbackRef();
  if (cb) cb(newText);
}

/** Truncates conversation and retries the exact same prompt */
function triggerRetry(index, ChatSessionManager, globalSendCallbackRef) {
  const activeChatId = ChatSessionManager.getActiveChatId();
  if (!activeChatId) return;
  const chats = ChatSessionManager.getChats();
  const chat = chats.find(c => c.id === activeChatId);
  if (!chat) return;

  const retryText = chat.messages[index].text;
  chat.messages[index].timestamp = new Date().toISOString();
  chat.messages = chat.messages.slice(0, index + 1);
  ChatSessionManager.saveChats(chats);
  ChatSessionManager.loadChat(activeChatId);

  const cb = globalSendCallbackRef();
  if (cb) cb(retryText);
}
