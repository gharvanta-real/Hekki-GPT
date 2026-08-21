/* === chat/markdown_enhancers.js — Citations, Link Tooltips & Task Lists === */

export function escapeHtmlLocal(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** Enhances GFM task checkboxes with custom styling */
export function enhanceTaskLists(container) {
  if (!container) return;
  const checkboxes = container.querySelectorAll('li > input[type="checkbox"]');
  checkboxes.forEach((cb) => {
    const li = cb.parentElement;
    if (li) {
      li.classList.add('chat-task-item');
      if (cb.checked) li.classList.add('task-completed');
    }
  });
}

export function getDomainCategoryBadge(domain) {
  if (!domain) return { icon: '', label: '' };
  const d = domain.toLowerCase();
  if (d.includes('.gov') || d.includes('.edu') || d.includes('official') || d.includes('nseindia.com') || d.includes('bseindia.com') || d.includes('sebi.gov.in') || d.includes('rbi.org.in')) {
    return { icon: '🏛️', label: 'Official' };
  }
  if (d.includes('news') || d.includes('reuters.com') || d.includes('bloomberg.com') || d.includes('economictimes') || d.includes('moneycontrol') || d.includes('ndtv') || d.includes('bbc') || d.includes('cnn') || d.includes('thehindu') || d.includes('livemint')) {
    return { icon: '📰', label: 'News' };
  }
  if (d.includes('wikipedia') || d.includes('arxiv') || d.includes('github') || d.includes('quora') || d.includes('stackoverflow') || d.includes('medium')) {
    return { icon: '📚', label: 'Reference' };
  }
  return { icon: '', label: '' };
}

/** Enhances inline markdown citations & links with hover snippet tooltips */
export function enhanceCitationsAndFootnotes(container) {
  if (!container) return;
  const externalLinks = container.querySelectorAll('a.external-link');

  externalLinks.forEach(link => {
    if (link.dataset.hasCitation) return;
    link.dataset.hasCitation = 'true';

    const href = link.getAttribute('href') || '';
    let domain = '';
    try {
      const cleanHref = href.replace(/[`'"><\)]+$/, '').replace(/\.$/, '');
      const parsed = new URL(cleanHref);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '').trim();
      if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(host)) {
        domain = host;
      }
    } catch (e) {}

    if (!domain) return;

    const category = getDomainCategoryBadge(domain);
    const rootDom = (domain || '').split('.').slice(-2).join('.');
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(rootDom)}&sz=32`;
    const linkText = link.textContent.trim();

    let tooltipEl = null;

    link.addEventListener('mouseenter', () => {
      if (tooltipEl) tooltipEl.remove();
      document.querySelectorAll('.ref-hover-tooltip').forEach(el => el.remove());

      tooltipEl = document.createElement('div');
      tooltipEl.className = 'ref-hover-tooltip';
      tooltipEl.style.cssText = 'position: fixed; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 8px 12px; max-width: 280px; z-index: 10005; font-family: var(--font); pointer-events: none; opacity: 0; transition: opacity 0.12s ease-out; box-shadow: none; font-weight: 400;';

      const catBadge = category.label ? `<span style="font-size: 11px; background: var(--input-bg); padding: 2px 6px; border-radius: 4px; color: var(--text-3); font-weight: 500; margin-left: auto;">${category.icon} ${category.label}</span>` : '';

      tooltipEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <img src="${faviconUrl}" style="width: 14px; height: 14px; border-radius: 3px;" onerror="this.onerror=null; this.removeAttribute('src'); this.style.display='none';" />
          <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${domain}</span>
          ${catBadge}
        </div>
        <div style="font-size: 12px; color: var(--text-2); font-weight: 400; line-height: 1.4; max-height: 52px; overflow: hidden; text-overflow: ellipsis;">${escapeHtmlLocal(linkText || domain)}</div>
      `;

      document.body.appendChild(tooltipEl);

      const rect = link.getBoundingClientRect();
      tooltipEl.style.left = `${Math.max(10, rect.left)}px`;
      tooltipEl.style.top = `${Math.max(10, rect.top - tooltipEl.offsetHeight - 6)}px`;
      requestAnimationFrame(() => {
        if (tooltipEl) tooltipEl.style.opacity = '1';
      });
    });

    link.addEventListener('mouseleave', () => {
      if (tooltipEl) {
        tooltipEl.style.opacity = '0';
        setTimeout(() => { if (tooltipEl) tooltipEl.remove(); tooltipEl = null; }, 120);
      }
    });
  });
}

/** Enhances all <a> tags and auto-links raw URLs with icons and Desktop handlers */
export function autoLinkTextNodes(container) {
  if (!container) return;
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;

  function walk(node) {
    if (!node) return;
    const tag = node.nodeName ? node.nodeName.toLowerCase() : '';
    if (['pre', 'code', 'a', 'script', 'style', 'textarea', 'input', 'iframe', 'svg'].includes(tag)) return;
    if (node.classList && (node.classList.contains('thought-header') || node.classList.contains('code-block-wrapper') || node.classList.contains('mermaid'))) return;

    if (node.nodeType === 3) {
      const text = node.nodeValue;
      if (!text || !urlRegex.test(text)) return;
      urlRegex.lastIndex = 0;

      const fragment = document.createDocumentFragment();
      let lastIdx = 0;
      let match;

      while ((match = urlRegex.exec(text)) !== null) {
        const urlText = match[0];
        const matchIdx = match.index;
        if (matchIdx > lastIdx) fragment.appendChild(document.createTextNode(text.substring(lastIdx, matchIdx)));

        const fullHref = urlText.toLowerCase().startsWith('www.') ? `https://${urlText}` : urlText;
        const a = document.createElement('a');
        a.href = fullHref;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'chat-link external-link';
        a.textContent = urlText;
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'external-link');
        icon.className = 'chat-link-icon';
        a.appendChild(icon);
        fragment.appendChild(a);
        lastIdx = matchIdx + urlText.length;
      }

      if (lastIdx < text.length) fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
      if (node.parentNode) node.parentNode.replaceChild(fragment, node);
    } else if (node.nodeType === 1) {
      const children = Array.from(node.childNodes);
      for (const child of children) walk(child);
    }
  }

  walk(container);
}

export function enhanceLinks(container) {
  if (!container) return;
  const links = container.querySelectorAll('a');
  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href) return;
    if (a.closest('.map-canvas-card') || a.classList.contains('no-chat-link-icon')) return;
    const isExternal = /^https?:\/\//i.test(href) || /^www\./i.test(href);
    const isFile = /^file:\/\/\//i.test(href);
    if (isExternal || isFile) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      if (!a.classList.contains('chat-link')) a.classList.add('chat-link');
      if (isExternal && !a.classList.contains('external-link')) a.classList.add('external-link');
      else if (isFile && !a.classList.contains('file-link')) a.classList.add('file-link');
      if (!a.querySelector('.chat-link-icon') && !a.querySelector('i[data-lucide]')) {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', isFile ? 'file-text' : 'external-link');
        icon.className = 'chat-link-icon';
        a.appendChild(icon);
      }
      a.onclick = (e) => {
        if (window.electronAPI?.openExternal) { e.preventDefault(); window.electronAPI.openExternal(a.href); }
        else if (window.overlayAPI?.openExternal) { e.preventDefault(); window.overlayAPI.openExternal(a.href); }
      };
    }
  });
  autoLinkTextNodes(container);
}

/** Transforms news and storytelling markers into rich interactive layout components */
export function enhanceStorytellingLayout(container) {
  if (!container) return;

  // 1. Category Headers (h2 with emojis like ## 🇮🇳 India, ## 🌍 World, ## 💻 Tech, ## 🔥 Top Story)
  const h2Elements = container.querySelectorAll('h2');
  const catRegex = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|🇮🇳|🌍|💻|📈|🔥|⚡|🚀|🏛️|⚽|🏏|🔬|💡|📌)\s*(.+)/u;
  h2Elements.forEach(h2 => {
    if (h2.classList.contains('chat-category-hdr')) return;
    const text = h2.innerText.trim();
    const match = text.match(catRegex);
    if (match) {
      h2.classList.add('chat-category-hdr');
      h2.innerHTML = `<span class="cat-icon">${match[1]}</span><span class="cat-title">${escapeHtmlLocal(match[2])}</span>`;
    }
  });

  // 2. Storytelling Meta Tags & Metrics (What happened, Why it matters, Impact, Next)
  const strongElements = container.querySelectorAll('strong, b');
  strongElements.forEach(st => {
    if (st.classList.contains('story-tag-pill')) return;
    const raw = st.innerText.trim().replace(/:$/, '').toLowerCase();
    let tagType = null;
    let icon = '';

    if (raw.includes('why it matters') || raw.includes('why you should care') || raw.includes('why this matters')) {
      tagType = 'why';
      icon = '⚡';
    } else if (raw.includes('what happened') || raw.includes('what we know')) {
      tagType = 'what';
      icon = '📌';
    } else if (raw.includes('impact') || raw.includes('market impact') || raw.includes('key takeaways')) {
      tagType = 'impact';
      icon = '📈';
    } else if (raw.includes('what happens next') || raw.includes('what to watch') || raw.includes('what\'s next')) {
      tagType = 'next';
      icon = '🔮';
    } else if (raw.includes('tl;dr') || raw.includes('in 10 seconds') || raw.includes('quick take') || raw.includes('key point')) {
      tagType = 'tldr';
      icon = '🎯';
    }

    if (tagType) {
      st.classList.add('story-tag-pill', `tag-${tagType}`);
      const cleanLabel = st.innerText.trim().replace(/^[\u{1F300}-\u{1F9FF}\s]+/u, '');
      st.innerHTML = `<span class="tag-icon">${icon}</span><span>${escapeHtmlLocal(cleanLabel)}</span>`;
    }
  });

  // 3. Transform Impact Metrics strips with arrows (e.g. 🛢️ Oil ↑ | 📈 Markets ⚠️)
  const paragraphs = container.querySelectorAll('p');
  paragraphs.forEach(p => {
    const text = p.innerText.trim();
    if ((text.includes('↑') || text.includes('↓') || text.includes('→')) && text.includes('|') && !p.classList.contains('chat-metric-strip')) {
      p.classList.add('chat-metric-strip');
      const parts = p.innerHTML.split(/\s*\|\s*/);
      p.innerHTML = parts.map(part => `<span class="metric-item">${part.trim()}</span>`).join('');
    }
  });
}

/** Converts [AUDIO_PLAYER:url] tags into full interactive studio audio player widgets */
export function enhanceAudioPlayers(container) {
  if (!container) return;
  const walkers = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let node;
  while ((node = walkers.nextNode())) {
    if (node.nodeValue && node.nodeValue.includes('[AUDIO_PLAYER:')) {
      textNodes.push(node);
    }
  }

  textNodes.forEach(textNode => {
    const parent = textNode.parentNode;
    if (!parent) return;
    const regex = /\[AUDIO_PLAYER:\s*([^\]|]+)(?:\|([^\]]+))?\]/g;
    const text = textNode.nodeValue;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }
      const audioUrl = match[1].trim();
      const title = (match[2] || 'Audio Overview').trim();

      const playerWrapper = document.createElement('div');
      playerWrapper.className = 'inline-audio-player-wrapper';
      playerWrapper.style.cssText = 'margin: 8px 0; max-width: 100%;';
      if (window.audioOverviewManager) {
        window.audioOverviewManager.mountAudioPlayer(playerWrapper, audioUrl, title);
      }
      frag.appendChild(playerWrapper);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    parent.replaceChild(frag, textNode);
  });
}

export { enhanceTranslationCards } from './translation_card.js';
export { enhanceVoiceSummaryCards } from './voice_summary_card.js';
export { enhanceMapCanvasCards } from './map_canvas_card.js';


