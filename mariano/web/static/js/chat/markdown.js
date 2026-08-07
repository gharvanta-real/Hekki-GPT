/* === chat/markdown.js — Markdown Enhancement Pipeline === */
import { enhanceImagePreviews, moveTipsToBottom } from './media.js';

// Configure marked parser options and custom link renderer
if (window.marked) {
  try {
    window.marked.use({
      gfm: true,
      breaks: true,
      renderer: {
        link({ href, title, text }) {
          if (!href) return text || '';
          const titleAttr = title ? ` title="${escapeHtmlLocal(title)}"` : '';
          const isExternal = /^https?:\/\//i.test(href) || /^www\./i.test(href);
          const isFile = /^file:\/\/\//i.test(href);
          const fullHref = /^www\./i.test(href) ? `https://${href}` : href;
          const target = (isExternal || isFile) ? ' target="_blank" rel="noopener noreferrer"' : '';

          let linkClass = 'chat-link';
          let iconMarkup = '';
          if (isExternal) {
            linkClass += ' external-link';
            iconMarkup = `<i data-lucide="external-link" class="chat-link-icon"></i>`;
          } else if (isFile) {
            linkClass += ' file-link';
            iconMarkup = `<i data-lucide="file-text" class="chat-link-icon"></i>`;
          }

          return `<a href="${escapeHtmlLocal(fullHref)}"${titleAttr}${target} class="${linkClass}">${text || href}${iconMarkup}</a>`;
        }
      }
    });
  } catch (e) {
    console.warn('Failed to set custom marked options:', e);
  }
}

// Local helper to avoid circular dep with input.js
function escapeHtmlLocal(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** Wraps all pre blocks with copy & wrap-text icons */
export function enhanceCodeBlocks(container) {
  const preElements = container.querySelectorAll('pre');
  preElements.forEach((pre) => {
    if (pre.parentNode.classList.contains('code-block-wrapper') || pre.parentNode.classList.contains('mermaid-block-wrapper')) return;

    const code = pre.querySelector('code');
    if (!code) return;
    const rawCodeText = code.innerText;

    let lang = 'code';
    const classes = code.className.split(' ');
    for (const cls of classes) {
      if (cls.startsWith('language-')) { lang = cls.replace('language-', ''); break; }
    }

    // Mermaid Flowchart Rendering
    if (lang === 'mermaid') {
      if (window.mermaid) {
        const mDiv = document.createElement('div');
        mDiv.className = 'mermaid';
        mDiv.textContent = rawCodeText;

        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-block-wrapper';
        wrapper.style.cssText = 'margin:12px 0; background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px; overflow-x:auto;';

        const mHeader = document.createElement('div');
        mHeader.style.cssText = 'display:flex; align-items:center; justify-content:space-between; width:100%; border-bottom:1px solid var(--border); padding-bottom:6px;';
        mHeader.innerHTML = `
          <span style="font-size:11px; font-weight:600; color:var(--text-3);">Mermaid Diagram</span>
          <button class="code-action-btn btn-canvas" title="Open in Live Canvas" style="display:flex; align-items:center; gap:4px; font-size:11.5px; padding:3px 8px; border-radius:5px; border:1px solid var(--border); background:var(--bg); color:var(--text-2); cursor:pointer;">
            <i data-lucide="layout" style="width:13px;height:13px"></i> Open in Canvas
          </button>
        `;

        mHeader.querySelector('.btn-canvas').addEventListener('click', () => {
          if (window.liveCanvas) {
            window.liveCanvas.openArtifact({
              type: 'diagram',
              title: 'Architecture Diagram',
              code: rawCodeText,
              language: 'mermaid'
            });
          }
        });

        wrapper.appendChild(mHeader);
        wrapper.appendChild(mDiv);

        pre.parentNode.insertBefore(wrapper, pre);
        pre.style.display = 'none';

        try {
          window.mermaid.run({ nodes: [mDiv] }).catch(err => {
            console.error('[Mermaid] async render failed', err);
            pre.style.display = 'block';
            if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
          });
        } catch (e) {
          console.error('[Mermaid] render failed', e);
          pre.style.display = 'block';
          if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
        }
        return;
      }
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';

    const header = document.createElement('div');
    header.className = 'code-block-header';

    const langSpan = document.createElement('span');
    langSpan.className = 'code-block-lang';
    const capLang = (lang || 'code').toLowerCase();
    langSpan.innerText = capLang;

    const actions = document.createElement('div');
    actions.className = 'code-block-actions';

    const canvasBtn = document.createElement('button');
    canvasBtn.className = 'code-action-btn btn-canvas';
    canvasBtn.title = 'Open in Live Canvas';
    canvasBtn.innerHTML = '<i data-lucide="layout" style="width:13px;height:13px"></i> Canvas';
    canvasBtn.addEventListener('click', () => {
      if (window.liveCanvas) {
        const msgParent = pre.closest('.msg') || pre.closest('.msg-group');
        let bundledHtml = '';
        let bundledCss = '';
        let bundledJs = '';

        if (msgParent) {
          const allPreBlocks = msgParent.querySelectorAll('pre');
          allPreBlocks.forEach(p => {
            const c = p.querySelector('code');
            if (!c) return;
            const codeText = c.innerText;
            const classNames = c.className.split(' ');
            let codeLang = 'code';
            for (const cls of classNames) {
              if (cls.startsWith('language-')) { codeLang = cls.replace('language-', ''); break; }
            }

            if (codeLang === 'html' || codeText.includes('<html') || codeText.includes('<!DOCTYPE')) {
              bundledHtml += (bundledHtml ? '\n' : '') + codeText;
            } else if (codeLang === 'css' || (codeText.includes('{') && codeText.includes('}'))) {
              bundledCss += (bundledCss ? '\n' : '') + codeText;
            } else if (codeLang === 'js' || codeLang === 'javascript') {
              bundledJs += (bundledJs ? '\n' : '') + codeText;
            }
          });
        }

        const isWebApp = lang === 'html' || rawCodeText.includes('<html') || bundledHtml.length > 0 || (bundledCss && bundledJs);

        if (isWebApp) {
          const mainHtml = bundledHtml || (lang === 'html' ? rawCodeText : `<div id="app"></div>`);
          window.liveCanvas.openArtifact({
            type: 'web_app',
            title: 'Interactive Web Application',
            code: mainHtml,
            html: mainHtml,
            css: bundledCss || (lang === 'css' ? rawCodeText : ''),
            js: bundledJs || (lang === 'js' || lang === 'javascript' ? rawCodeText : ''),
            language: 'html'
          });
        } else {
          const isDoc = ['text', 'txt', 'plaintext', 'markdown', 'md', 'pdf', 'doc', 'docx'].includes(lang) || 
                        rawCodeText.includes('[Professional Summary]') || 
                        rawCodeText.includes('[Skills]') || 
                        rawCodeText.includes('[Experience]') || 
                        rawCodeText.includes('Resume');

          window.liveCanvas.openArtifact({
            type: lang === 'mermaid' ? 'diagram' : (isDoc ? 'document' : 'code'),
            title: isDoc ? 'Document Preview' : `${lang.toUpperCase()} Artifact`,
            code: rawCodeText,
            language: isDoc ? 'pdf' : lang
          });
        }
      }
    });

    const wrapBtn = document.createElement('button');
    wrapBtn.className = 'code-action-btn btn-wrap';
    wrapBtn.title = 'Toggle Line Wrap';
    wrapBtn.innerHTML = '<i data-lucide="wrap-text" style="width:14px;height:14px"></i>';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-action-btn btn-copy';
    copyBtn.title = 'Copy Code';
    copyBtn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px"></i>';

    actions.appendChild(canvasBtn);

    let iframeContainer = null;
    let iframe = null;
    if (lang === 'html' || lang === 'svg' || lang === 'xml') {
      iframeContainer = document.createElement('div');
      iframeContainer.className = 'inline-preview-container';
      iframeContainer.style.cssText = 'display:none; width:100%; height:350px; background:#ffffff; border-top:1px solid var(--border); overflow:hidden; border-bottom-left-radius:12px; border-bottom-right-radius:12px;';

      iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%; height:100%; border:none; background:#ffffff;';
      iframe.sandbox = 'allow-scripts allow-modals';
      iframeContainer.appendChild(iframe);

      const previewBtn = document.createElement('button');
      previewBtn.className = 'code-action-btn btn-preview';
      previewBtn.title = 'Toggle Inline Preview';
      previewBtn.innerHTML = '<i data-lucide="eye" style="width:14px;height:14px"></i>';
      actions.appendChild(previewBtn);

      let isPreviewing = false;
      previewBtn.addEventListener('click', () => {
        isPreviewing = !isPreviewing;
        if (isPreviewing) {
          pre.style.display = 'none';
          iframeContainer.style.display = 'block';
          iframe.srcdoc = rawCodeText;
          previewBtn.classList.add('active');
          previewBtn.style.color = '#3b82f6';
          wrapBtn.style.display = 'none';
          langSpan.innerText = `${capLang} Preview`;
          langSpan.style.fontWeight = '400';
          langSpan.style.fontSize = '11px';
          langSpan.style.textTransform = 'none';
        } else {
          pre.style.display = 'block';
          iframeContainer.style.display = 'none';
          previewBtn.classList.remove('active');
          previewBtn.style.color = '';
          wrapBtn.style.display = 'inline-block';
          langSpan.innerText = capLang;
          langSpan.style.fontWeight = '';
          langSpan.style.fontSize = '';
          langSpan.style.textTransform = '';
        }
      });
    }

    actions.appendChild(wrapBtn);
    actions.appendChild(copyBtn);
    header.appendChild(langSpan);
    header.appendChild(actions);

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
    if (iframeContainer) wrapper.appendChild(iframeContainer);

    wrapBtn.addEventListener('click', () => {
      pre.classList.toggle('wrap-lines');
      wrapBtn.classList.toggle('active');
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(rawCodeText);
        copyBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;color:#16a34a"></i>';
        if (window.lucide) lucide.createIcons({ parent: copyBtn });
        setTimeout(() => {
          copyBtn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px"></i>';
          if (window.lucide) lucide.createIcons({ parent: copyBtn });
        }, 3000);
      } catch (err) { console.error('Failed to copy code', err); }
    });

    if (window.lucide) lucide.createIcons({ parent: header });
  });
}

/** Wraps all table elements in a clean container and adds a top-right floating copy button */
export function enhanceTables(container) {
  const tables = container.querySelectorAll('table');
  tables.forEach((table) => {
    if (table.parentNode.classList.contains('table-scroll-container')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'table-copy-btn';
    copyBtn.title = 'Copy Table as CSV';
    copyBtn.innerHTML = '<i data-lucide="copy" style="width:13.5px;height:13.5px"></i>';

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll-container';

    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(copyBtn);
    wrapper.appendChild(scrollContainer);
    scrollContainer.appendChild(table);

    if (window.lucide) lucide.createIcons({ parent: copyBtn });

    copyBtn.addEventListener('click', async () => {
      const rows = Array.from(table.querySelectorAll('tr'));
      const csvContent = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map(cell => {
          let text = cell.innerText.replace(/"/g, '""');
          if (text.includes(',') || text.includes('\n')) text = `"${text}"`;
          return text;
        }).join(',');
      }).join('\n');

      try {
        await navigator.clipboard.writeText(csvContent);
        copyBtn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;color:#16a34a"></i>';
        if (window.lucide) lucide.createIcons({ parent: copyBtn });
        setTimeout(() => {
          copyBtn.innerHTML = '<i data-lucide="copy" style="width:14px;height:14px"></i>';
          if (window.lucide) lucide.createIcons({ parent: copyBtn });
        }, 3000);
      } catch (err) { console.error('Failed to copy table', err); }
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

/** Transforms GitHub GFM callouts and "Tip:" paragraphs/blockquotes into styled callout cards */
export function enhanceCallouts(container) {
  if (!container) return;

  const blockquotes = container.querySelectorAll('blockquote');
  blockquotes.forEach((bq) => {
    if (bq.classList.contains('chat-callout')) return;
    let text = bq.innerText.trim();
    let type = null;
    const gfmMatch = text.match(/^\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
    if (gfmMatch) { type = gfmMatch[1].toUpperCase(); }
    else if (text.startsWith('💡 Tip:') || text.startsWith('Tip:') || text.toLowerCase().includes('tip:')) { type = 'TIP'; }
    else if (text.toLowerCase().startsWith('note:')) { type = 'NOTE'; }
    else if (text.toLowerCase().startsWith('warning:')) { type = 'WARNING'; }
    if (!type) return;

    let iconName = 'sparkles', titleText = 'Tip', typeClass = 'callout-tip';
    switch (type) {
      case 'TIP': iconName = 'sparkles'; titleText = 'Tip'; typeClass = 'callout-tip'; break;
      case 'IMPORTANT': iconName = 'alert-circle'; titleText = 'Important'; typeClass = 'callout-important'; break;
      case 'WARNING': iconName = 'triangle-alert'; titleText = 'Warning'; typeClass = 'callout-warning'; break;
      case 'CAUTION': iconName = 'shield-alert'; titleText = 'Caution'; typeClass = 'callout-caution'; break;
      default: iconName = 'info'; titleText = 'Note'; typeClass = 'callout-note'; break;
    }

    const callout = document.createElement('div');
    callout.className = `chat-callout ${typeClass}`;
    const body = document.createElement('div');
    body.className = 'callout-body';
    body.innerHTML = bq.innerHTML;
    if (typeClass !== 'callout-tip') {
      const header = document.createElement('div');
      header.className = 'callout-header';
      header.innerHTML = `<i data-lucide="${iconName}" class="callout-icon"></i><span>${titleText}</span>`;
      callout.appendChild(header);
    }
    callout.appendChild(body);
    if (bq.parentNode) bq.parentNode.replaceChild(callout, bq);
  });

  const standalonePs = Array.from(container.querySelectorAll('p')).filter(p => !p.closest('.chat-callout') && !p.closest('blockquote'));
  standalonePs.forEach(p => {
    const text = p.innerText.trim();
    if (text.startsWith('💡 Tip:') || text.startsWith('Tip:')) {
      const callout = document.createElement('div');
      callout.className = 'chat-callout callout-tip';
      const body = document.createElement('div');
      body.className = 'callout-body';
      body.innerHTML = p.innerHTML;
      callout.appendChild(body);
      p.parentNode.replaceChild(callout, p);
    }
  });
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

/** Enhances inline markdown citations & links with hover snippet tooltips (Legacy Flat Monochromatic Style) */
export function enhanceCitationsAndFootnotes(container) {
  if (!container) return;
  const externalLinks = container.querySelectorAll('a.external-link');

  externalLinks.forEach(link => {
    if (link.dataset.hasCitation) return;
    link.dataset.hasCitation = 'true';

    const href = link.getAttribute('href') || '';
    let domain = '';
    try {
      const parsed = new URL(href);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch (e) {}

    if (!domain) return;

    const category = getDomainCategoryBadge(domain);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    const linkText = link.textContent.trim();

    let tooltipEl = null;

    link.addEventListener('mouseenter', () => {
      if (tooltipEl) tooltipEl.remove();

      tooltipEl = document.createElement('div');
      tooltipEl.className = 'ref-hover-tooltip';
      tooltipEl.style.cssText = 'position: fixed; background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; max-width: 280px; z-index: 10005; font-family: var(--font); pointer-events: none; opacity: 0; transition: opacity 0.12s ease-out; box-shadow: none; font-weight: 400;';

      const catBadge = category.label ? `<span style="font-size: 10px; opacity: 0.75; background: var(--hover); padding: 1px 5px; border-radius: 4px; color: var(--text-3); font-weight: 500; margin-left: auto;">${category.icon} ${category.label}</span>` : '';

      tooltipEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <img src="${faviconUrl}" style="width: 12px; height: 12px; border-radius: 2px;" onerror="this.style.display='none'" />
          <span style="font-size: 11.5px; font-weight: 600; color: var(--text);">${domain}</span>
          ${catBadge}
        </div>
        <div style="font-size: 11.5px; color: var(--text-3); font-weight: 400; line-height: 1.35; max-height: 48px; overflow: hidden; text-overflow: ellipsis;">${escapeHtmlLocal(linkText || domain)}</div>
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

/** Complete markdown response enhancement pipeline */
export function enhanceMarkdownContent(container) {
  if (!container) return;
  try { enhanceLinks(container); } catch (e) { console.error(e); }
  try { enhanceCallouts(container); } catch (e) { console.error(e); }
  try { enhanceCodeBlocks(container); } catch (e) { console.error(e); }
  try { enhanceTables(container); } catch (e) { console.error(e); }
  try { enhanceImagePreviews(container); } catch (e) { console.error(e); }
  try { enhanceCitationsAndFootnotes(container); } catch (e) { console.error(e); }
  try { moveTipsToBottom(container); } catch (e) { console.error(e); }
  try { enhanceTaskLists(container); } catch (e) { console.error(e); }
  if (window.renderMathInElement) {
    try {
      renderMathInElement(container, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
        strict: "ignore"
      });
    } catch (e) {}
  }
  if (window.lucide) { try { lucide.createIcons({ parent: container }); } catch (e) {} }
}
