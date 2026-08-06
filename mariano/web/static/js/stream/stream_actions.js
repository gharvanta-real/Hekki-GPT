import { escapeHtml, ChatSessionManager, enhanceMarkdownContent } from '../chat.js';

export function attachAiActions(msgEl, text, toolRuns = []) {
  if (!msgEl || !text || text.trim().length === 0) return;

  // Prevent duplicate actions on the same message element
  if (msgEl.querySelector('.ai-actions') || 
      (msgEl.parentElement && msgEl.parentElement.classList.contains('msg-actions')) ||
      (msgEl.nextElementSibling && msgEl.nextElementSibling.classList && msgEl.nextElementSibling.classList.contains('ai-actions'))) {
    return;
  }

  // Target container element to append actions to
  const container = msgEl.classList.contains('msg') ? msgEl : (msgEl.closest('.msg') || msgEl);

  // Extract web domains mentioned in response links/markdown AND tool runs (web search outputs)
  const urlRegex = /(https?:\/\/[^\s"'<>\)]+)/gi;
  let allContent = text || '';
  if (Array.isArray(toolRuns)) {
    toolRuns.forEach(tr => {
      if (tr.result) allContent += ' ' + (typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result));
      if (tr.output) allContent += ' ' + (typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output));
      if (tr.data)   allContent += ' ' + (typeof tr.data === 'string' ? tr.data : JSON.stringify(tr.data));
    });
  }

  const matches = allContent.match(urlRegex) || [];
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

  actions.querySelector('.btn-fork')?.addEventListener('click', () => {
    if (ChatSessionManager && ChatSessionManager.forkChat) {
      ChatSessionManager.forkChat();
    }
  });

  const fileMatch = text.match(/([\w\-_\/\\\.]+\.(html|js|css|py|json|md))/i);
  if (fileMatch || text.includes('```html') || text.includes('```mermaid') || text.includes('```javascript') || text.includes('```py') || text.includes('```text') || text.includes('Resume')) {
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

  actions.querySelector('.btn-copy')?.addEventListener('click', () => {
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    navigator.clipboard.writeText(cleanText).then(() => {
      const copyIcon = actions.querySelector('.btn-copy i');
      if (copyIcon) {
        copyIcon.setAttribute('data-lucide', 'check');
        if (window.lucide) lucide.createIcons({ parent: actions });
        setTimeout(() => {
          copyIcon.setAttribute('data-lucide', 'copy');
          if (window.lucide) lucide.createIcons({ parent: actions });
        }, 1500);
      }
    });
  });

  actions.querySelector('.btn-like')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.classList.toggle('active-like');
    btn.style.color = btn.classList.contains('active-like') ? '#22c55e' : '';
  });

  actions.querySelector('.btn-dislike')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.classList.toggle('active-dislike');
    btn.style.color = btn.classList.contains('active-dislike') ? '#ef4444' : '';
  });

  container.appendChild(actions);
  if (window.lucide) setTimeout(() => lucide.createIcons({ parent: actions }), 0);
}
