/* === chat/messages.js — Message DOM rendering, user edit, retry === */
import { escapeHtml, formatTime, scrollChat, clearChatLogs } from './input.js';
import { enhanceMarkdownContent } from './markdown.js';
import { enhanceImagePreviews } from './media.js';

function sanitizeHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?\/>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/href\s*=\s*["']?javascript:[^"'>\s]*/gi, 'href="#"');
}

/** Render a single message DOM node with full Claude-style actions */
export function createMessageElement(type, text, timestamp, index, ChatSessionManager, globalSendCallbackRef, metadata = null) {
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
    const fileRegex = /\[Attached File:\s*([^\]]+)\]/g;
    let match;
    const attachmentCards = [];

    // Extract images
    while ((match = imgRegex.exec(text)) !== null) {
      const fileName = match[1].trim(), rawPath = match[2].trim();
      const renderUrl = (rawPath.startsWith('data:') || rawPath.startsWith('http')) ? rawPath : `/api/workspace/render?path=${encodeURIComponent(rawPath)}`;
      attachmentCards.push(`<div class="user-img-attachment-card" style="align-self:flex-end;margin-bottom:0;border-radius:12px;overflow:hidden;width:120px;height:120px;border:1px solid var(--border);flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.12);"><img src="${renderUrl}" alt="${escapeHtml(fileName)}" style="width:120px;height:120px;object-fit:cover;display:block;" /></div>`);
    }

    while ((match = fileRegex.exec(text)) !== null) {
      const fileName = match[1].trim();
      const extMatch = fileName.match(/\.([a-z0-9]+)$/i);
      const ext = extMatch ? extMatch[1].toUpperCase() : 'FILE';
      let iconName = 'file-text';
      if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) iconName = 'archive';
      else if (['PY', 'JS', 'HTML', 'CSS', 'JSON', 'CPP', 'C', 'TS'].includes(ext)) iconName = 'file-code';
      attachmentCards.push(`<div class="user-file-attachment-card" style="align-self:flex-end;margin-bottom:0;padding:8px 14px;border-radius:12px;background:var(--card,#fff);border:1px solid var(--border)!important;display:inline-flex;align-items:center;gap:8px;font-size:14.5px;color:var(--text-primary);font-weight:500;max-width:320px;box-shadow:0 2px 6px rgba(0,0,0,0.06);"><i data-lucide="${iconName}" style="width:17px;height:17px;color:var(--accent,#2563eb);flex-shrink:0;"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${escapeHtml(fileName)}</span><span style="font-size:11px;background:rgba(37,99,235,0.12);color:var(--accent,#2563eb);padding:2px 7px;border-radius:6px;text-transform:uppercase;font-weight:500;flex-shrink:0;">${ext}</span></div>`);
    }

    if (attachmentCards.length > 0) {
      const attachContainer = document.createElement('div');
      attachContainer.className = 'user-attachment-container';
      attachContainer.style.display = 'flex';
      attachContainer.style.flexDirection = 'column';
      attachContainer.style.alignItems = 'flex-end';
      attachContainer.style.gap = '6px';
      attachContainer.style.marginBottom = '8px';
      attachContainer.style.width = '100%';
      attachContainer.innerHTML = attachmentCards.join('');
      group.appendChild(attachContainer);
    }

    let cleanText = text.replace(/\[Attached Image:[^\]]+\]/g, '').replace(/\[Attached File:[^\]]+\]/g, '').replace(/\[Active Workspace Context:[^\]]+\]/g, '').trim();
    if (cleanText) {
      const bubble = document.createElement('div');
      bubble.className = 'msg user';
      
      const slashMatch = cleanText.match(/^(\/(?:web|code|pdf|image|images-u|debate))\b([\s\S]*)/i);
      if (slashMatch) {
        const cmdTag = escapeHtml(slashMatch[1]);
        const restText = escapeHtml(slashMatch[2]);
        bubble.innerHTML = `<span class="user-cmd-highlight" style="display:inline-flex; align-items:center; background:transparent !important; color:#3b82f6; padding:0 !important; font-weight:400 !important; margin-right:6px; font-size:15px !important; font-family:var(--font); letter-spacing:0.2px;">${cmdTag}</span>${restText}`;
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
        expandBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;"><path d="M16 22L6 12l1.4-1.4 8.6 8.6 8.6-8.6L26 12z"/></svg>';
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExpanded = bubble.classList.contains('expanded');
          if (isExpanded) {
            bubble.classList.remove('expanded');
            expandBtn.title = 'Show more';
            expandBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;"><path d="M16 22L6 12l1.4-1.4 8.6 8.6 8.6-8.6L26 12z"/></svg>';
          } else {
            bubble.classList.add('expanded');
            expandBtn.title = 'Show less';
            expandBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;"><path d="M16 10l10 10-1.4 1.4-8.6-8.6-8.6 8.6L6 20z"/></svg>';
          }
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
      <button class="action-btn btn-copy" title="Copy text"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;display:block;"><path d="M27.4,14.7l-6.1-6.1C21,8.2,20.5,8,20,8h-8c-1.1,0-2,0.9-2,2v18c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16.1C28,15.6,27.8,15.1,27.4,14.7z M20,10l5.9,6H20V10z M12,28V10h6v6c0,1.1,0.9,2,2,2h6l0,10H12z"/><path d="M6,18H4V4c0-1.1,0.9-2,2-2h14v2H6V18z"/></svg></button>
      <button class="action-btn btn-edit" title="Edit prompt"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><rect x="2" y="26" width="28" height="2"/><path d="M25.4,9c0.8-0.8,0.8-2,0-2.8c0,0,0,0,0,0l-3.6-3.6c-0.8-0.8-2-0.8-2.8,0c0,0,0,0,0,0l-15,15V24h6.4L25.4,9z M20.4,4L24,7.6l-3,3L17.4,7L20.4,4z M6,22v-3.6l10-10l3.6,3.6l-10,10H6z"/></svg></button>
      <button class="action-btn btn-retry" title="Retry generation"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="M25.95,7.65l.0047-.0039c-.0918-.1094-.197-.2061-.2925-.3125-.1841-.2051-.3672-.41-.5635-.603-.1382-.1358-.2856-.2613-.43-.3907-.1831-.1645-.3657-.3286-.5581-.4824-.1592-.1279-.3244-.2466-.4895-.3667-.1921-.14-.3855-.2768-.5854-.4062-.1743-.1128-.3523-.2188-.5322-.3238q-.3081-.1786-.6253-.3408c-.1846-.0942-.37-.1846-.56-.27-.2224-.1-.449-.1914-.678-.2793-.1894-.0723-.3777-.1455-.5713-.209-.2463-.0815-.498-.1494-.7507-.2163-.1848-.0493-.3674-.1025-.5554-.1431-.29-.0634-.5865-.1074-.8833-.1508-.159-.023-.3145-.0552-.4754-.0728A12.9331,12.9331,0,0,0,6,7.7031V4H4v8h8V10H6.8115A10.961,10.961,0,0,1,16,5a11.1114,11.1114,0,0,1,1.189.0669c.1362.0146.268.042.4026.0615.2509.0366.5014.0742.7468.1275.1592.0346.3144.08.4712.1215.2131.0562.4258.1138.6335.1822.1643.0547.325.1167.4859.1782.1926.0742.3835.1509.5705.2349.1611.0727.3193.15.4763.23q.2677.1363.5262.2867c.153.0893.3046.18.4531.2758.1679.1089.3308.2242.4922.3413.1406.1026.2817.2037.417.3125.1616.1294.3156.2676.47.4063.1225.11.2478.2168.3652.332.1668.1636.3223.3379.4785.5117A10.9928,10.9928,0,1,1,5,16H3A13,13,0,1,0,25.95,7.65Z"/></svg></button>
    `;
    group.appendChild(actions);
    if (window.lucide) lucide.createIcons({ parent: actions });

    const userCopyBtn = actions.querySelector('.btn-copy');
    if (userCopyBtn) {
      userCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          userCopyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#16a34a" style="width:14px;height:14px;display:block;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>';
          setTimeout(() => {
            userCopyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;display:block;"><path d="M27.4,14.7l-6.1-6.1C21,8.2,20.5,8,20,8h-8c-1.1,0-2,0.9-2,2v18c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16.1C28,15.6,27.8,15.1,27.4,14.7z M20,10l5.9,6H20V10z M12,28V10h6v6c0,1.1,0.9,2,2,2h6l0,10H12z"/><path d="M6,18H4V4c0-1.1,0.9-2,2-2h14v2H6V18z"/></svg>';
          }, 3000);
        }).catch(err => console.warn('Clipboard write failed', err));
      });
    }

    actions.querySelector('.btn-edit')?.addEventListener('click', () => {
      makeUserMessageEditable(group, text, index, ChatSessionManager, globalSendCallbackRef);
    });

    actions.querySelector('.btn-retry')?.addEventListener('click', () => {
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
              <svg class="mi-chevron thought-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" style="width:12px;height:12px;display:inline-block;vertical-align:middle;transition:transform 0.2s;flex-shrink:0;"><path d="M16 22L6 12l1.4-1.4 8.6 8.6 8.6-8.6L26 12z"/></svg>
            </div>
            <div class="thought-body collapsed" style="display: none;">
              <div class="thought-step">${window.marked ? sanitizeHtml(marked.parse(thoughtContent)) : escapeHtml(thoughtContent)}</div>
            </div>
          </div>
        `;
      }

      const isDebateHtml = finalText.includes('debate-round-inner') || finalText.includes('debate-agent-section') || finalText.includes('debate-canvas-wrap');
      el.innerHTML = thoughtHtml + (isDebateHtml ? sanitizeHtml(finalText) : (window.marked ? sanitizeHtml(marked.parse(finalText)) : escapeHtml(finalText)));
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
        // Extract web domains mentioned in response links/markdown AND tool runs
        const urlRegex = /(https?:\/\/[^\s"'<>\)]+)/gi;
        let allContent = text || '';
        const toolRuns = (metadata && (metadata.tool_runs || metadata.toolRuns)) || [];
        if (Array.isArray(toolRuns)) {
          toolRuns.forEach(tr => {
            if (tr.result) allContent += ' ' + (typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result));
            if (tr.output) allContent += ' ' + (typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output));
            if (tr.data)   allContent += ' ' + (typeof tr.data === 'string' ? tr.data : JSON.stringify(tr.data));
          });
        }
        const matches = allContent.match(urlRegex) || [];
        const domains = new Set();
        const ignoreList = ['localhost', '127.0.0.1', 'cloudflare.com', 'cloudflare.net', 'nel.cloudflare.com', 'w3.org', 'schema.org', 'gstatic.com', 'googleapis.com'];
        matches.forEach(u => {
          try {
            const cleanUrl = u.replace(/[`'"><\)]+$/, '').replace(/\.$/, '');
            const parsed = new URL(cleanUrl);
            let host = parsed.hostname.toLowerCase().replace(/^www\./, '').trim();
            // Strict domain check: must contain a valid alpha TLD (at least 2 letters, e.g. .com, .org, .in) and not be an IP/number
            const isValidDomain = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(host);
            if (isValidDomain && !ignoreList.some(ig => host === ig || host.endsWith('.' + ig))) {
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
                const rootDom = (dom || '').split('.').slice(-2).join('.');
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(rootDom)}&sz=32`;
                const cat = getCat(dom);
                const catSpan = cat ? `<span style="font-size:11.5px; opacity:0.8; margin-left:2px; font-weight:400;">${cat}</span>` : '';
                return `
                  <a href="https://${dom}" target="_blank" rel="noopener noreferrer" title="Verified Source: ${dom}" style="display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:5px; background:rgba(255,255,255,0.06); font-size:13px; color:var(--text-secondary); font-family:var(--font); text-decoration:none; transition:background 0.15s; font-weight:400;">
                    <img src="${faviconUrl}" style="width:14px; height:14px; border-radius:3px;" onerror="this.onerror=null; this.removeAttribute('src'); this.style.display='none';">
                    <span style="max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:400;">${dom}</span>
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
            <button class="action-btn btn-copy" title="Copy response"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;display:block;"><path d="M27.4,14.7l-6.1-6.1C21,8.2,20.5,8,20,8h-8c-1.1,0-2,0.9-2,2v18c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16.1C28,15.6,27.8,15.1,27.4,14.7z M20,10l5.9,6H20V10z M12,28V10h6v6c0,1.1,0.9,2,2,2h6l0,10H12z"/><path d="M6,18H4V4c0-1.1,0.9-2,2-2h14v2H6V18z"/></svg></button>
            <button class="action-btn btn-like" title="Good response"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="M26,12H20V6a3.0033,3.0033,0,0,0-3-3H14.8672a2.0094,2.0094,0,0,0-1.98,1.7173l-.8453,5.9165L8.4648,16H2V30H23a7.0078,7.0078,0,0,0,7-7V16A4.0045,4.0045,0,0,0,26,12ZM8,28H4V18H8Zm20-5a5.0057,5.0057,0,0,1-5,5H10V17.3027l3.9578-5.9365L14.8672,5H17a1.0008,1.0008,0,0,1,1,1v8h8a2.0025,2.0025,0,0,1,2,2Z"/></svg></button>
            <button class="action-btn btn-dislike" title="Bad response"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="M30,16V9a7.0078,7.0078,0,0,0-7-7H2V16H8.4648l3.5774,5.3662.8453,5.9165A2.0094,2.0094,0,0,0,14.8672,29H17a3.0033,3.0033,0,0,0,3-3V20h6A4.0045,4.0045,0,0,0,30,16ZM8,14H4V4H8Zm20,2a2.0025,2.0025,0,0,1-2,2H18v8a1.0008,1.0008,0,0,1-1,1H14.8672l-.9094-6.3662L10,14.6973V4H23a5.0057,5.0057,0,0,1,5,5Z"/></svg></button>
            <button class="action-btn btn-fork" title="Fork conversation branch from here"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="m20,6c0,1.8584,1.2798,3.4106,3,3.8579v5.1421h-14v-5.1421c1.7202-.4473,3-1.9995,3-3.8579,0-2.2056-1.7944-4-4-4s-4,1.7944-4,4c0,1.8584,1.2798,3.4106,3,3.8579v5.1421c0,1.103.897,2,2,2h6v5.1421c-1.7202.4473-3,1.9995-3,3.8579,0,2.2056,1.7944,4,4,4s4-1.7944,4-4c0-1.8584-1.2798-3.4106-3-3.8579v-5.1421h6c1.103,0,2-.897,2-2v-5.1421c1.7202-.4473,3-1.9995,3-3.8579,0-2.2056-1.7944-4-4-4s-4,1.7944-4,4Zm-14,0c0-1.103.897-2,2-2s2,.897,2,2c0,1.103-.897,2-2,2s-2-.897-2-2Zm12,20c0,1.103-.897,2-2,2s-2-.897-2-2c0-1.103.897-2,2-2s2,.897,2,2ZM26,6c0,1.103-.897,2-2,2s-2-.897-2-2c0-1.103.897-2,2-2s2,.897,2,2Z"/></svg></button>
          </div>
        `;
        group.appendChild(actions);
        if (window.lucide) lucide.createIcons({ parent: actions });

        actions.querySelector('.btn-fork')?.addEventListener('click', () => {
          if (ChatSessionManager && ChatSessionManager.forkChat) {
            ChatSessionManager.forkChat(index);
          }
        });
        const SVG_LIKE_OUTLINE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="M26,12H20V6a3.0033,3.0033,0,0,0-3-3H14.8672a2.0094,2.0094,0,0,0-1.98,1.7173l-.8453,5.9165L8.4648,16H2V30H23a7.0078,7.0078,0,0,0,7-7V16A4.0045,4.0045,0,0,0,26,12ZM8,28H4V18H8Zm20-5a5.0057,5.0057,0,0,1-5,5H10V17.3027l3.9578-5.9365L14.8672,5H17a1.0008,1.0008,0,0,1,1,1v8h8a2.0025,2.0025,0,0,1,2,2Z"/></svg>`;
        const SVG_LIKE_FILLED  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><rect x="2" y="16" width="5" height="14"/><path d="M23,30H9V15.1973l3.0422-4.5635.8453-5.9165A2.0094,2.0094,0,0,1,14.8672,3H15a3.0033,3.0033,0,0,1,3,3v6h8a4.0045,4.0045,0,0,1,4,4v7A7.0078,7.0078,0,0,1,23,30Z"/></svg>`;
        const SVG_DISLIKE_OUTLINE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="M30,16V9a7.0078,7.0078,0,0,0-7-7H2V16H8.4648l3.5774,5.3662.8453,5.9165A2.0094,2.0094,0,0,0,14.8672,29H17a3.0033,3.0033,0,0,0,3-3V20h6A4.0045,4.0045,0,0,0,30,16ZM8,14H4V4H8Zm20,2a2.0025,2.0025,0,0,1-2,2H18v8a1.0008,1.0008,0,0,1-1,1H14.8672l-.9094-6.3662L10,14.6973V4H23a5.0057,5.0057,0,0,1,5,5Z"/></svg>`;
        const SVG_DISLIKE_FILLED  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><rect x="2" y="2" width="5" height="14"/><path d="M23,2H9V16.8027l3.0422,4.5635.8453,5.9165A2.0094,2.0094,0,0,0,14.8672,29H15a3.0033,3.0033,0,0,0,3-3V20h8a4.0045,4.0045,0,0,0,4-4V9A7.0078,7.0078,0,0,0,23,2Z"/></svg>`;
        const SVG_COPY_NORMAL = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;display:block;"><path d="M27.4,14.7l-6.1-6.1C21,8.2,20.5,8,20,8h-8c-1.1,0-2,0.9-2,2v18c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16.1C28,15.6,27.8,15.1,27.4,14.7z M20,10l5.9,6H20V10z M12,28V10h6v6c0,1.1,0.9,2,2,2h6l0,10H12z"/><path d="M6,18H4V4c0-1.1,0.9-2,2-2h14v2H6V18z"/></svg>`;
        const SVG_COPY_CHECK  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="#16a34a" style="width:16px;height:16px;display:block;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>`;

        const aiCopyBtn = actions.querySelector('.btn-copy');
        aiCopyBtn?.addEventListener('click', () => {
          const cleanText = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
          navigator.clipboard.writeText(cleanText).then(() => {
            aiCopyBtn.innerHTML = SVG_COPY_CHECK;
            setTimeout(() => { aiCopyBtn.innerHTML = SVG_COPY_NORMAL; }, 3000);
          }).catch(err => console.warn('Clipboard write failed', err));
        });

        const btnLike = actions.querySelector('.btn-like');
        const btnDislike = actions.querySelector('.btn-dislike');
        btnLike?.addEventListener('click', () => {
          const isNowActive = btnLike.classList.toggle('active');
          btnDislike?.classList.remove('active');
          btnLike.innerHTML = isNowActive ? SVG_LIKE_FILLED : SVG_LIKE_OUTLINE;
          if (btnDislike) btnDislike.innerHTML = SVG_DISLIKE_OUTLINE;
        });
        btnDislike?.addEventListener('click', () => {
          const isNowActive = btnDislike.classList.toggle('active');
          btnLike?.classList.remove('active');
          btnDislike.innerHTML = isNowActive ? SVG_DISLIKE_FILLED : SVG_DISLIKE_OUTLINE;
          if (btnLike) btnLike.innerHTML = SVG_LIKE_OUTLINE;
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
  const runs = msg.metadata.tool_runs || [];
  const durationSec = msg.metadata?.duration_sec || msg.metadata?.tool_runs_duration_sec || Math.max(1, (runs.length * 2));
  const titleText = `Worked for ${durationSec}s`;
  const hasFailed = runs.some(r => r.status === 'failed');
  const svgCheck = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;"><polyline points="20 6 9 17 4 12"/></svg>';
  const svgCross = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const svgChevron = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"><polyline points="9 18 15 12 9 6"/></svg>';
  const fallbackIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block;vertical-align:middle;"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';

  const statusHtml = hasFailed
    ? `<span style="color:#ef4444;display:inline-flex;align-items:center;gap:4px;">${svgCross} failed</span>`
    : `<span style="color:var(--text-3);display:inline-flex;align-items:center;gap:4px;">${svgCheck} completed</span>`;

  const toolCard = document.createElement('div');
  toolCard.className = 'tool-group-card';
  toolCard.style.cssText = 'margin:6px 0;display:flex;flex-direction:column;font-family:var(--font);font-size:14px;color:var(--text-3);';

  toolCard.innerHTML = `
    <div class="tool-group-header" style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;cursor:pointer;user-select:none;">
      <div style="display:flex;align-items:center;gap:6px;">
        <svg data-chevron="right" class="chevron-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;opacity:0.75;transition:transform 0.15s;display:inline-block;vertical-align:middle;flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
        <span class="tool-group-title" style="font-weight:500;font-size:14.5px;color:var(--text-secondary);">${titleText}</span>
      </div>
      <span class="tool-group-status" style="font-size:13.5px;opacity:0.85;font-weight:400;">${statusHtml}</span>
    </div>
    <div class="tool-group-body" style="display:none;flex-direction:column;padding-left:14px;border-left:1px dashed var(--border-subtle);margin-left:4px;margin-top:2px;gap:4px;">
      ${runs.map(r => {
        const statusSpan = r.status === 'done'
          ? `<span style="color:var(--text-3);display:inline-flex;align-items:center;gap:3.5px;">${svgCheck} done</span>`
          : `<span style="color:#ef4444;display:inline-flex;align-items:center;gap:3.5px;">${svgCross} failed</span>`;
        const reasoningHtml = r.reasoning
          ? `<div class="ai-reasoning-card" style="margin:3px 0 6px 14px;padding:4px 0 4px 10px;border-left:1px dashed var(--border-subtle);background:transparent;font-size:13.5px;font-family:var(--font);color:var(--text-3);line-height:1.5;opacity:0.9;"><div style="white-space:pre-wrap;word-break:break-word;"><span>${escapeHtmlFn(r.reasoning)}</span></div></div>`
          : '';
        const isTerminal = r.label && (r.label.includes('Shell') || r.label.includes('Command') || r.label.includes('System') || r.label.includes('run_command'));
        const outputHtml = r.output
          ? `<div style="width:100%;margin-top:4px;padding-left:21px;box-sizing:border-box;">
              <details style="margin:0;opacity:0.95;width:100%;">
                <summary style="cursor:pointer;color:var(--text-3);font-size:13px;font-weight:500;outline:none;user-select:none;display:inline-flex;align-items:center;gap:2px;padding:2px 0;">
                  ${svgChevron}<span>${isTerminal ? 'Terminal Output' : 'View output details'}</span>
                </summary>
                <pre class="tool-output-block tool-terminal-block">${escapeHtmlFn(r.output)}</pre>
              </details>
            </div>`
          : '';
        const iconToUse = r.icon || fallbackIcon;
        const rLabel = escapeHtmlFn(r.label || '');
        const rSlashDetail = r.detail
          ? `<span style="font-weight:500;font-size:14px;color:var(--text-secondary);white-space:nowrap;">${rLabel}</span><span style="color:var(--text-3);opacity:0.55;margin:0 2px;">/</span><span class="tool-detail" style="color:var(--text-3);font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px;">${r.detail}</span>`
          : `<span style="font-weight:500;font-size:14px;color:var(--text-secondary);white-space:nowrap;">${rLabel}</span>`;

        return `
          <div class="tool-log-card" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;margin:3px 0 4px 0;padding:4px 0;background:transparent;font-size:14px;font-family:var(--font);color:var(--text-3);gap:10px;">
            <div style="display:flex;align-items:center;gap:6px;overflow:hidden;">
              <span style="flex-shrink:0;opacity:0.85;display:inline-flex;align-items:center;">${iconToUse}</span>
              ${rSlashDetail}
            </div>
            <span class="tool-status" style="flex-shrink:0;font-size:13px;color:var(--text-3);white-space:nowrap;opacity:0.85;">${statusSpan}</span>
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
  editContainer.innerHTML = `
    <textarea class="msg-edit-textarea">${escapeHtml(originalText)}</textarea>
    <div class="msg-edit-buttons">
      <button class="msg-edit-btn btn-cancel">Cancel</button>
      <button class="msg-edit-btn save btn-save">Save &amp; Submit</button>
    </div>
  `;
  groupEl.appendChild(editContainer);

  const textarea = editContainer.querySelector('.msg-edit-textarea');
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

  editContainer.querySelector('.btn-cancel').addEventListener('click', () => {
    editContainer.remove();
    bubble.style.display = 'block';
    if (actions) actions.style.display = 'flex';
  });

  editContainer.querySelector('.btn-save').addEventListener('click', () => {
    const newText = textarea.value.trim();
    if (newText) submitEditedText(index, newText, ChatSessionManager, globalSendCallbackRef);
  });
}

function submitEditedText(index, newText, ChatSessionManager, globalSendCallbackRef) {
  const activeId = ChatSessionManager.getActiveChatId();
  if (!activeId) return;
  const chats = ChatSessionManager.getChats();
  const chat = chats.find(c => c.id === activeId);
  if (!chat) return;
  chat.messages[index].text = newText;
  chat.messages[index].timestamp = new Date().toISOString();
  chat.messages = chat.messages.slice(0, index + 1);
  ChatSessionManager.saveChats(chats);
  ChatSessionManager.loadChat(activeId);
  const cb = globalSendCallbackRef();
  if (cb) cb(newText);
}

function triggerRetry(index, ChatSessionManager, globalSendCallbackRef) {
  const activeId = ChatSessionManager.getActiveChatId();
  if (!activeId) return;
  const chats = ChatSessionManager.getChats();
  const chat = chats.find(c => c.id === activeId);
  if (!chat) return;
  const retryText = chat.messages[index].text;
  chat.messages[index].timestamp = new Date().toISOString();
  chat.messages = chat.messages.slice(0, index + 1);
  ChatSessionManager.saveChats(chats);
  ChatSessionManager.loadChat(activeId);
  const cb = globalSendCallbackRef();
  if (cb) cb(retryText);
}
