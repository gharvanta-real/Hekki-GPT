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
  const ignoreList = ['localhost', '127.0.0.1', 'cloudflare.com', 'cloudflare.net', 'nel.cloudflare.com', 'w3.org', 'schema.org', 'gstatic.com', 'googleapis.com'];
  matches.forEach(u => {
    try {
      const cleanUrl = u.replace(/[`'"><\)]+$/, '');
      const parsed = new URL(cleanUrl);
      let host = parsed.hostname.toLowerCase().replace(/^www\./, '').trim();
      if (host && host.includes('.') && !ignoreList.some(ig => host === ig || host.endsWith('.' + ig))) {
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
          const isValidDomain = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(dom);
          if (!isValidDomain) return '';
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

  const SVG_LIKE_OUTLINE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="M26,12H20V6a3.0033,3.0033,0,0,0-3-3H14.8672a2.0094,2.0094,0,0,0-1.98,1.7173l-.8453,5.9165L8.4648,16H2V30H23a7.0078,7.0078,0,0,0,7-7V16A4.0045,4.0045,0,0,0,26,12ZM8,28H4V18H8Zm20-5a5.0057,5.0057,0,0,1-5,5H10V17.3027l3.9578-5.9365L14.8672,5H17a1.0008,1.0008,0,0,1,1,1v8h8a2.0025,2.0025,0,0,1,2,2Z"/></svg>`;
  const SVG_LIKE_FILLED  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><rect x="2" y="16" width="5" height="14"/><path d="M23,30H9V15.1973l3.0422-4.5635.8453-5.9165A2.0094,2.0094,0,0,1,14.8672,3H15a3.0033,3.0033,0,0,1,3,3v6h8a4.0045,4.0045,0,0,1,4,4v7A7.0078,7.0078,0,0,1,23,30Z"/></svg>`;
  const SVG_DISLIKE_OUTLINE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="M30,16V9a7.0078,7.0078,0,0,0-7-7H2V16H8.4648l3.5774,5.3662.8453,5.9165A2.0094,2.0094,0,0,0,14.8672,29H17a3.0033,3.0033,0,0,0,3-3V20h6A4.0045,4.0045,0,0,0,30,16ZM8,14H4V4H8Zm20,2a2.0025,2.0025,0,0,1-2,2H18v8a1.0008,1.0008,0,0,1-1,1H14.8672l-.9094-6.3662L10,14.6973V4H23a5.0057,5.0057,0,0,1,5,5Z"/></svg>`;
  const SVG_DISLIKE_FILLED  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><rect x="2" y="2" width="5" height="14"/><path d="M23,2H9V16.8027l3.0422,4.5635.8453,5.9165A2.0094,2.0094,0,0,0,14.8672,29H15a3.0033,3.0033,0,0,0,3-3V20h8a4.0045,4.0045,0,0,0,4-4V9A7.0078,7.0078,0,0,0,23,2Z"/></svg>`;
  const SVG_COPY_NORMAL = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;display:block;"><path d="M27.4,14.7l-6.1-6.1C21,8.2,20.5,8,20,8h-8c-1.1,0-2,0.9-2,2v18c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16.1C28,15.6,27.8,15.1,27.4,14.7z M20,10l5.9,6H20V10z M12,28V10h6v6c0,1.1,0.9,2,2,2h6l0,10H12z"/><path d="M6,18H4V4c0-1.1,0.9-2,2-2h14v2H6V18z"/></svg>`;
  const SVG_COPY_CHECK  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="#16a34a" style="width:16px;height:16px;display:block;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>`;
  const SVG_FORK = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="m20,6c0,1.8584,1.2798,3.4106,3,3.8579v5.1421h-14v-5.1421c1.7202-.4473,3-1.9995,3-3.8579,0-2.2056-1.7944-4-4-4s-4,1.7944-4,4c0,1.8584,1.2798,3.4106,3,3.8579v5.1421c0,1.103.897,2,2,2h6v5.1421c-1.7202.4473-3,1.9995-3,3.8579,0,2.2056,1.7944,4,4,4s4-1.7944,4-4c0-1.8584-1.2798-3.4106-3-3.8579v-5.1421h6c1.103,0,2-.897,2-2v-5.1421c1.7202-.4473,3-1.9995,3-3.8579,0-2.2056-1.7944-4-4-4s-4,1.7944-4,4Zm-14,0c0-1.103.897-2,2-2s2,.897,2,2c0,1.103-.897,2-2,2s-2-.897-2-2Zm12,20c0,1.103-.897,2-2,2s-2-.897-2-2c0-1.103.897-2,2-2s2,.897,2,2ZM26,6c0,1.103-.897,2-2,2s-2-.897-2-2c0-1.103.897-2,2-2s2,.897,2,2Z"/></svg>`;

  const actions = document.createElement('div');
  actions.className = 'msg-actions ai-actions';
  actions.style.cssText = 'display:flex; align-items:center; justify-content:flex-end; gap:6px; margin-top:6px; flex-wrap:wrap; width:100%;';
  actions.innerHTML = `
    ${faviconsHtml}
    <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
      <button class="action-btn btn-copy" title="Copy response">${SVG_COPY_NORMAL}</button>
      <button class="action-btn btn-like" title="Good response">${SVG_LIKE_OUTLINE}</button>
      <button class="action-btn btn-dislike" title="Bad response">${SVG_DISLIKE_OUTLINE}</button>
      <button class="action-btn btn-fork" title="Fork conversation branch from here">${SVG_FORK}</button>
    </div>
  `;

  actions.querySelector('.btn-fork')?.addEventListener('click', () => {
    if (ChatSessionManager && ChatSessionManager.forkChat) {
      ChatSessionManager.forkChat();
    }
  });

  const streamCopyBtn = actions.querySelector('.btn-copy');
  streamCopyBtn?.addEventListener('click', () => {
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    navigator.clipboard.writeText(cleanText).then(() => {
      streamCopyBtn.innerHTML = SVG_COPY_CHECK;
      setTimeout(() => {
        streamCopyBtn.innerHTML = SVG_COPY_NORMAL;
      }, 3000);
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

  container.appendChild(actions);
}
