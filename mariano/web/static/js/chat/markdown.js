/* === chat/markdown.js — Markdown Enhancement Pipeline === */
import { enhanceImagePreviews, moveTipsToBottom } from './media.js';
import {
  escapeHtmlLocal,
  enhanceTaskLists,
  enhanceCitationsAndFootnotes,
  enhanceLinks,
  autoLinkTextNodes,
  enhanceStorytellingLayout,
  enhanceAudioPlayers
} from './markdown_enhancers.js';

export {
  escapeHtmlLocal,
  enhanceTaskLists,
  enhanceCitationsAndFootnotes,
  enhanceLinks,
  autoLinkTextNodes,
  enhanceStorytellingLayout,
  enhanceAudioPlayers
};

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
          const isFile = /^file:\/\/\//i.test(href) || /^file:\/\//i.test(href) || /^[a-zA-Z]:[\\\/]/.test(href);

          let fullHref = /^www\./i.test(href) ? `https://${href}` : href;
          if (isFile) {
            const cleanPath = fullHref.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, '').replace(/\\/g, '/');
            fullHref = `/api/workspace/render?path=${encodeURIComponent(cleanPath)}`;
          }

          const target = (isExternal || isFile) ? ' target="_blank" rel="noopener noreferrer"' : '';

          let linkClass = 'chat-link';
          let iconMarkup = '';
          if (isExternal) {
            linkClass += ' external-link';
            iconMarkup = `<i data-lucide="external-link" class="chat-link-icon" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-left:3px;"></i>`;
          } else if (isFile) {
            linkClass += ' file-link';
            iconMarkup = `<i data-lucide="file-text" class="chat-link-icon" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-left:3px;"></i>`;
          }

          return `<a href="${escapeHtmlLocal(fullHref)}"${titleAttr}${target} class="${linkClass}">${text || href}${iconMarkup}</a>`;
        }
      }
    });
  } catch (e) {
    console.warn('Failed to set custom marked options:', e);
  }
}

/** Wraps all pre blocks with copy, line-wrap, and live canvas action controls */
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
    if (lang === 'mermaid' && window.mermaid) {
      const mDiv = document.createElement('div');
      mDiv.className = 'mermaid';
      mDiv.textContent = rawCodeText;

      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-block-wrapper';
      wrapper.style.cssText = 'margin:12px 0; background:var(--bg-card); border-radius:var(--radius-lg); padding:14px; display:flex; flex-direction:column; gap:8px; overflow-x:auto; border:none;';

      const mHeader = document.createElement('div');
      mHeader.style.cssText = 'display:flex; align-items:center; justify-content:space-between; width:100%; border-bottom:1px solid var(--border-subtle); padding-bottom:6px;';
      mHeader.innerHTML = `
        <span style="font-size:12.5px; font-weight:600; color:var(--text-3);">Mermaid Diagram</span>
        <button class="code-action-btn btn-canvas" title="Open in Live Canvas" style="display:flex; align-items:center; gap:5px; font-size:12px; padding:4px 10px; border-radius:6px; border:none; background:var(--input-bg); color:var(--text-2); cursor:pointer;">
          <i data-lucide="layout" style="width:14px;height:14px"></i> Open in Canvas
        </button>
      `;

      mHeader.querySelector('.btn-canvas').addEventListener('click', () => {
        if (window.liveCanvas) {
          window.liveCanvas.openArtifact({ type: 'diagram', title: 'Architecture Diagram', code: rawCodeText, language: 'mermaid' });
        }
      });

      wrapper.appendChild(mHeader);
      wrapper.appendChild(mDiv);
      pre.parentNode.insertBefore(wrapper, pre);
      pre.style.display = 'none';

      try {
        window.mermaid.run({ nodes: [mDiv] }).catch(err => {
          pre.style.display = 'block';
          if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
        });
      } catch (e) {
        pre.style.display = 'block';
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      }
      return;
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
        window.liveCanvas.openArtifact({
          type: ['html', 'css', 'js', 'javascript'].includes(lang) ? 'web_app' : 'code',
          title: `${capLang.toUpperCase()} Snippet`,
          code: rawCodeText,
          language: lang
        });
      }
    });

    const wrapBtn = document.createElement('button');
    wrapBtn.className = 'code-action-btn btn-wrap';
    wrapBtn.title = 'Toggle Line Wrap';
    wrapBtn.innerHTML = '<i data-lucide="wrap-text" style="width:14px;height:14px"></i>';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-action-btn btn-copy';
    copyBtn.title = 'Copy Code';
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><path d="M27.4,14.7l-6.1-6.1C21,8.2,20.5,8,20,8h-8c-1.1,0-2,0.9-2,2v18c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16.1C28,15.6,27.8,15.1,27.4,14.7z M20,10l5.9,6H20V10z M12,28V10h6v6c0,1.1,0.9,2,2,2h6l0,10H12z"/><path d="M6,18H4V4c0-1.1,0.9-2,2-2h14v2H6V18z"/></svg>';

    actions.appendChild(canvasBtn);
    actions.appendChild(wrapBtn);
    actions.appendChild(copyBtn);
    header.appendChild(langSpan);
    header.appendChild(actions);

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);

    wrapBtn.addEventListener('click', () => {
      pre.classList.toggle('wrap-lines');
      wrapBtn.classList.toggle('active');
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(rawCodeText);
        copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#16a34a"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>';
        setTimeout(() => {
          copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><path d="M27.4,14.7l-6.1-6.1C21,8.2,20.5,8,20,8h-8c-1.1,0-2,0.9-2,2v18c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16.1C28,15.6,27.8,15.1,27.4,14.7z M20,10l5.9,6H20V10z M12,28V10h6v6c0,1.1,0.9,2,2,2h6l0,10H12z"/><path d="M6,18H4V4c0-1.1,0.9-2,2-2h14v2H6V18z"/></svg>';
        }, 3000);
      } catch (err) { console.error('Failed to copy code', err); }
    });

    if (window.lucide) lucide.createIcons({ parent: header });
  });
}

/** Wraps all table elements in a clean container with copy as CSV functionality */
export function enhanceTables(container) {
  const tables = container.querySelectorAll('table');
  tables.forEach((table) => {
    if (table.parentNode.classList.contains('table-scroll-container')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'table-copy-btn';
    copyBtn.title = 'Copy Table as CSV';
    copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13.5" height="13.5" viewBox="0 0 32 32" fill="currentColor"><path d="M27.4,14.7l-6.1-6.1C21,8.2,20.5,8,20,8h-8c-1.1,0-2,0.9-2,2v18c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16.1C28,15.6,27.8,15.1,27.4,14.7z M20,10l5.9,6H20V10z M12,28V10h6v6c0,1.1,0.9,2,2,2h6l0,10H12z"/><path d="M6,18H4V4c0-1.1,0.9-2,2-2h14v2H6V18z"/></svg>';

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll-container';

    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(copyBtn);
    wrapper.appendChild(scrollContainer);
    scrollContainer.appendChild(table);

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
        copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#16a34a"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>';
        setTimeout(() => {
          copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13.5" height="13.5" viewBox="0 0 32 32" fill="currentColor"><path d="M27.4,14.7l-6.1-6.1C21,8.2,20.5,8,20,8h-8c-1.1,0-2,0.9-2,2v18c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V16.1C28,15.6,27.8,15.1,27.4,14.7z M20,10l5.9,6H20V10z M12,28V10h6v6c0,1.1,0.9,2,2,2h6l0,10H12z"/><path d="M6,18H4V4c0-1.1,0.9-2,2-2h14v2H6V18z"/></svg>';
        }, 3000);
      } catch (err) { console.error('Failed to copy table', err); }
    });
  });
}

/** 
 * Enhances list items to remove ugly double bullets when emojis/symbols start a line (e.g. • ✅ -> ✅)
 */
export function enhanceLists(container) {
  if (!container) return;
  const listItems = container.querySelectorAll('li');
  const emojiPrefixRegex = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|✅|❌|✨|🔥|🚀|📦|🛠️|💡|📌|⚡|🔍|🎉|📋|⚠️)\s*/u;

  listItems.forEach(li => {
    if (li.classList.contains('chat-task-item')) return;
    const directText = (li.childNodes[0]?.nodeValue || '').trim();
    const firstSpan = li.querySelector(':scope > span, :scope > strong');
    const combinedText = directText || (firstSpan ? firstSpan.innerText : '');

    const match = combinedText.match(emojiPrefixRegex);
    if (match) {
      li.classList.add('emoji-list-item');
      li.style.listStyleType = 'none';
    }
  });
}

/** Transforms GitHub GFM callouts and blockquotes into modern styled cards */
export function enhanceCallouts(container) {
  if (!container) return;

  function processElement(el) {
    if (el.classList.contains('chat-callout')) return;
    let text = el.innerText.trim();
    let type = null;
    let icon = 'info';

    const gfmMatch = text.match(/^\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
    if (gfmMatch) {
      type = gfmMatch[1].toUpperCase();
    } else if (text.startsWith('💡') || text.toLowerCase().startsWith('tip:') || text.toLowerCase().startsWith('tip :') || text.startsWith('टिप:') || text.startsWith('टिप :')) {
      type = 'TIP';
    } else if (text.toLowerCase().startsWith('warning:')) {
      type = 'WARNING';
    } else if (text.toLowerCase().startsWith('important:')) {
      type = 'IMPORTANT';
    } else if (text.toLowerCase().startsWith('caution:')) {
      type = 'CAUTION';
    } else if (text.toLowerCase().startsWith('note:')) {
      type = 'NOTE';
    } else if (el.tagName === 'BLOCKQUOTE' && text.length > 0) {
      return; // Keep generic blockquotes clean
    }

    if (!type) return;

    if (type === 'WARNING') icon = 'alert-triangle';
    else if (type === 'IMPORTANT') icon = 'star';
    else if (type === 'CAUTION') icon = 'alert-octagon';

    let cleanHtml = el.innerHTML;
    cleanHtml = cleanHtml.replace(/^<p>\s*\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br\/?>)?\s*/i, '<p>');
    cleanHtml = cleanHtml.replace(/^\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, '');
    cleanHtml = cleanHtml.replace(/<p>[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}💡ℹ️⚠️🛑⭐]*(?:<strong>|<b>)?[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}💡ℹ️⚠️🛑⭐]*(?:Tip|Note|Warning|Caution|Important|Bottom Line|टिप|सलाह)[\s:]*(?:<\/strong>|<\/b>)?[\s:]*/iu, '<p>');
    cleanHtml = cleanHtml.replace(/^[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}💡ℹ️⚠️🛑⭐]*(?:<strong>|<b>)?[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}💡ℹ️⚠️🛑⭐]*(?:Tip|Note|Warning|Caution|Important|Bottom Line|टिप|सलाह)[\s:]*(?:<\/strong>|<\/b>)?[\s:]*/iu, '');
    cleanHtml = cleanHtml.replace(/<p>[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}💡ℹ️⚠️🛑⭐]+/iu, '<p>');
    cleanHtml = cleanHtml.replace(/^[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}💡ℹ️⚠️🛑⭐]+/iu, '');

    // Tips render with a sleek thin horizontal line and clean text (NO bulky card container)
    if (type === 'TIP') {
      const tipWrapper = document.createElement('div');
      tipWrapper.className = 'chat-tip-footer';
      tipWrapper.innerHTML = `
        <hr class="tip-divider" />
        <div class="tip-row">
          <span class="tip-icon">💡</span>
          <div class="tip-text">${cleanHtml}</div>
        </div>
      `;
      if (el.parentNode) el.parentNode.replaceChild(tipWrapper, el);
      return;
    }

    const callout = document.createElement('div');
    callout.className = `chat-callout callout-${type.toLowerCase()}`;

    callout.innerHTML = `
      <div class="callout-header">
        <i data-lucide="${icon}" style="width:14px;height:14px;"></i>
        <span>${type.charAt(0) + type.slice(1).toLowerCase()}</span>
      </div>
      <div class="callout-body">${cleanHtml}</div>
    `;

    if (el.parentNode) el.parentNode.replaceChild(callout, el);
    if (window.lucide) { try { lucide.createIcons({ parent: callout }); } catch (e) {} }
  }

  // 1. Process blockquotes
  const blockquotes = Array.from(container.querySelectorAll('blockquote'));
  blockquotes.forEach(processElement);

  // 2. Process standalone paragraphs with callout prefixes
  const paragraphs = Array.from(container.querySelectorAll('p')).filter(p => !p.closest('.chat-callout') && !p.closest('.chat-tip-footer') && !p.closest('blockquote'));
  paragraphs.forEach(p => {
    const text = p.innerText.trim();
    if (text.startsWith('💡') || text.toLowerCase().startsWith('tip:') || text.startsWith('टिप:') || text.toLowerCase().startsWith('note:') || text.toLowerCase().startsWith('warning:') || text.match(/^\[\!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)) {
      processElement(p);
    }
  });
}

/** Complete markdown response enhancement pipeline */
export function enhanceMarkdownContent(container) {
  if (!container) return;
  try { enhanceLinks(container); } catch (e) { console.error(e); }
  try { enhanceCallouts(container); } catch (e) { console.error(e); }
  try { enhanceCodeBlocks(container); } catch (e) { console.error(e); }
  try { enhanceTables(container); } catch (e) { console.error(e); }
  try { enhanceLists(container); } catch (e) { console.error(e); }
  try { enhanceStorytellingLayout(container); } catch (e) { console.error(e); }
  try { enhanceImagePreviews(container); } catch (e) { console.error(e); }
  try { enhanceCitationsAndFootnotes(container); } catch (e) { console.error(e); }
  try { moveTipsToBottom(container); } catch (e) { console.error(e); }
  try { enhanceTaskLists(container); } catch (e) { console.error(e); }
  try { enhanceAudioPlayers(container); } catch (e) { console.error(e); }
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
