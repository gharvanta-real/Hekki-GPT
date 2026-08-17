/**
 * live_canvas_render.js — Rendering Helpers for Live Canvas Engine
 * Handles sandboxed iframe HTML preview, markdown parsing, and mermaid rendering.
 */

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getFileExtension(lang) {
  switch ((lang || '').toLowerCase()) {
    case 'html': return 'html';
    case 'css': return 'css';
    case 'javascript': case 'js': return 'js';
    case 'python': case 'py': return 'py';
    case 'json': return 'json';
    case 'mermaid': return 'mmd';
    default: return 'txt';
  }
}

/**
 * Render markdown text using marked.js with XSS-safe fallback.
 */
export function renderMarkdown(rawText) {
  if (!rawText) return '<p style="color:var(--text-3);font-size:13px;">Empty document</p>';

  if (window.marked) {
    try {
      const parseFn = typeof window.marked.parse === 'function' ? window.marked.parse : (typeof window.marked === 'function' ? window.marked : null);
      if (window.marked.setOptions) {
        window.marked.setOptions({ breaks: true, gfm: true });
      }
      if (parseFn) return parseFn(rawText);
    } catch (e) {
      console.warn('marked.js parse error:', e);
    }
  }

  // Enhanced Fallback Markdown Parser
  let html = rawText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>');

  return html.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

/**
 * Transform raw text / markdown into a professional formatted document
 */
export function formatDocumentToA4(rawText) {
  if (!rawText) return '<p>Empty Document</p>';

  const lines = rawText.trim().split('\n');
  const hasResumeStructure = rawText.includes('[Professional Summary]') || 
                             rawText.includes('[Skills]') || 
                             rawText.includes('[Experience]') || 
                             rawText.includes('[Education]') || 
                             rawText.includes('Resume');

  if (hasResumeStructure && lines.length >= 2) {
    const nameLine = lines[0].trim();
    const contactLine = lines[1].trim();
    let restLines = lines.slice(2).join('\n');
    restLines = restLines.replace(/^\[(.*?)\]$/gm, '## $1');
    const bodyHtml = renderMarkdown(restLines);
    return `
      <div class="paper-resume-header">
        <h1 class="paper-candidate-name">${escapeHtml(nameLine)}</h1>
        <div class="paper-contact-info">${escapeHtml(contactLine)}</div>
      </div>
      <div class="paper-resume-body">
        ${bodyHtml}
      </div>
    `;
  }

  let content = rawText.replace(/^\[(.*?)\]$/gm, '## $1');
  return renderMarkdown(content);
}

/**
 * Update sandboxed iframe preview with theme-synchronized background and complete HTML/CSS/JS
 */
export function updateIframePreview(iframe, artifact) {
  if (!iframe || !artifact) return;

  let fullHtml = artifact.code || artifact.html || '';
  const css = artifact.css || '';
  const js = artifact.js || '';

  const isDark = document.body.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
  const isOled = document.body.classList.contains('oled') || document.documentElement.getAttribute('data-theme') === 'oled';
  const defaultBg = isOled ? '#000000' : (isDark ? '#141416' : '#FCFCFC');
  const defaultColor = (isDark || isOled) ? '#F1F3F6' : '#111827';

  if (!fullHtml.includes('<html')) {
    fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          :root {
            --bg: ${defaultBg};
            --text: ${defaultColor};
          }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; margin: 0; background: ${defaultBg}; color: ${defaultColor}; }
          ${css}
        </style>
      </head>
      <body>
        ${fullHtml}
        <script>${js}</script>
      </body>
      </html>
    `;
  } else {
    // Inject theme styles if not present
    const themeStyle = `<style>:root{--bg:${defaultBg};--text:${defaultColor};}body{background:${defaultBg};color:${defaultColor};}${css}</style>`;
    if (fullHtml.includes('</head>')) {
      fullHtml = fullHtml.replace('</head>', `${themeStyle}</head>`);
    } else {
      fullHtml = themeStyle + fullHtml;
    }
    if (js && !fullHtml.includes(js)) {
      if (fullHtml.includes('</body>')) {
        fullHtml = fullHtml.replace('</body>', `<script>${js}</script></body>`);
      } else {
        fullHtml += `<script>${js}</script>`;
      }
    }
  }

  try {
    iframe.srcdoc = fullHtml;
  } catch (e) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(fullHtml);
        doc.close();
      }
    } catch (err) {}
  }
}

/**
 * Render Mermaid diagram
 */
export function renderMermaidDiagram(container, code) {
  if (!container || !code) return;
  const mermaidCode = code.replace(/```mermaid/gi, '').replace(/```/g, '').trim();

  if (window.mermaid) {
    try {
      const id = 'mermaid-svg-' + Math.random().toString(36).substring(2, 9);
      window.mermaid.render(id, mermaidCode).then((res) => {
        container.innerHTML = res.svg;
      }).catch((err) => {
        container.innerHTML = `<div class="mermaid-error">Diagram render error: ${escapeHtml(err.message || String(err))}</div>`;
      });
    } catch (e) {
      container.innerHTML = `<div class="mermaid-error">Diagram error: ${escapeHtml(e.message)}</div>`;
    }
  } else {
    container.innerHTML = `
      <div class="mermaid-fallback">
        <pre style="background:var(--card);padding:14px;border-radius:8px;font-family:var(--font);font-size:12.5px;">${escapeHtml(mermaidCode)}</pre>
      </div>
    `;
  }
}
