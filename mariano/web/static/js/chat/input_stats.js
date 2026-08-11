/* === chat/input_stats.js — Real-time Input Stats & Text Snippet Modal === */
import { showToast } from '../components/toast.js';

export function calculateTextStats(text) {
  if (!text || !text.trim()) {
    return { charCount: 0, wordCount: 0, lineCount: 0 };
  }
  const charCount = text.length;
  const lineCount = text.split('\n').length;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return { charCount, wordCount, lineCount };
}

/**
 * Creates or updates a live text statistics indicator under active input capsules.
 */
export function updateInputStatsIndicator(textareaId, indicatorId) {
  const textarea = document.getElementById(textareaId);
  let indicator = document.getElementById(indicatorId);
  
  if (!textarea) return;

  const text = textarea.value;
  const stats = calculateTextStats(text);

  if (!indicator && stats.wordCount > 50) {
    indicator = document.createElement('div');
    indicator.id = indicatorId;
    indicator.className = 'input-stats-badge';
    textarea.parentNode?.appendChild(indicator);
  }

  if (indicator) {
    if (stats.wordCount === 0) {
      indicator.style.display = 'none';
    } else {
      indicator.style.display = 'inline-flex';
      let formattedWordCount = stats.wordCount >= 1000 ? `${(stats.wordCount / 1000).toFixed(1)}k` : stats.wordCount;
      indicator.textContent = `${formattedWordCount} words • ${stats.lineCount} lines`;
      
      if (stats.lineCount >= 400 || stats.wordCount >= 800) {
        indicator.classList.add('near-limit');
      } else {
        indicator.classList.remove('near-limit');
      }
    }
  }
}

/**
 * Displays a full modal dialog allowing the user to view or edit a large pasted text snippet,
 * or revert it back into the input textarea as raw text.
 */
export function openSnippetModal(attachmentItem, onRevertCallback) {
  let modal = document.getElementById('snippet-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'snippet-preview-modal';
    modal.className = 'snippet-modal-overlay';
    modal.innerHTML = `
      <div class="snippet-modal-card">
        <div class="snippet-modal-header">
          <div class="snippet-modal-title">
            <span id="snippet-file-name">Document Snippet</span>
            <span id="snippet-file-stats" class="snippet-modal-subtitle">0 lines</span>
          </div>
          <div class="snippet-modal-actions">
            <button id="btn-snippet-revert" class="snippet-btn-secondary" title="Convert back into text box">
              <i data-lucide="corner-down-left" style="width:13px;height:13px;margin-right:4px;"></i> Expand to Text
            </button>
            <button id="btn-snippet-close" class="snippet-btn-close" title="Close preview">
              <i data-lucide="x" style="width:14px;height:14px;"></i>
            </button>
          </div>
        </div>
        <div class="snippet-modal-body">
          <textarea id="snippet-modal-textarea" readonly></textarea>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-snippet-close')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  const nameEl = document.getElementById('snippet-file-name');
  const statsEl = document.getElementById('snippet-file-stats');
  const textEl = document.getElementById('snippet-modal-textarea');
  const revertBtn = document.getElementById('btn-snippet-revert');

  if (nameEl) nameEl.textContent = attachmentItem.name || 'Text Snippet';
  if (textEl) textEl.value = attachmentItem.text || '';
  
  const stats = calculateTextStats(attachmentItem.text || '');
  if (statsEl) statsEl.textContent = `${stats.lineCount} lines • ${stats.wordCount} words • ${(attachmentItem.size / 1024).toFixed(1)} KB`;

  if (revertBtn) {
    revertBtn.onclick = () => {
      modal.classList.remove('active');
      if (onRevertCallback) onRevertCallback(attachmentItem);
    };
  }

  modal.classList.add('active');
  if (window.lucide) lucide.createIcons();
}
