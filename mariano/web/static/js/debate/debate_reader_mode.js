/**
 * debate_reader_mode.js — Fullscreen reader mode viewer & documentary exporter
 */
import { showToast } from '../components/toast.js';

let _currentReaderDoc = null;

export function openReaderMode(paperHtml, title = 'Synthesis Paper', rawMarkdown = '') {
  const viewer = document.getElementById('debate-doc-viewer');
  const contentEl = document.getElementById('doc-viewer-content');
  if (!viewer || !contentEl) return;

  _currentReaderDoc = {
    title,
    contentHtml: paperHtml,
    content: rawMarkdown,
    date: new Date().toLocaleDateString(),
  };

  contentEl.innerHTML = `
    <div class="reader-mode-container" style="max-width: 820px; margin: 0 auto; padding: 32px 24px; font-family: var(--font); color: var(--text);">
      <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 12px; line-height: 1.3;">${title}</h1>
      <div style="font-size: 11.5px; color: var(--text-3); margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
        Hekki Arena Synthesis Document · Published ${new Date().toLocaleDateString()}
      </div>
      <div class="markdown-body reader-body" style="font-size: 14px; line-height: 1.7;">
        ${paperHtml}
      </div>
    </div>
  `;

  viewer.style.display = 'block';

  // Bind close button
  document.getElementById('btn-doc-close')?.addEventListener('click', closeReaderMode);

  // Bind copy button
  document.getElementById('btn-doc-copy')?.addEventListener('click', () => {
    const textToCopy = rawMarkdown || contentEl.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('Copied', 'Document content copied to clipboard.', 2500);
    });
  });
}

export function closeReaderMode() {
  const viewer = document.getElementById('debate-doc-viewer');
  if (viewer) viewer.style.display = 'none';
  _currentReaderDoc = null;
}

window.openReaderModeWithDoc = function(doc) {
  if (!doc) return;
  openReaderMode(doc.contentHtml || doc.content, doc.title, doc.content);
};
