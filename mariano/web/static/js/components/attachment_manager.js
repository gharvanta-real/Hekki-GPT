/**
 * attachment_manager.js — Handles file attachments across all input capsules.
 * Renders ChatGPT-style preview chips with thumbnails & remove (X) buttons.
 */

class AttachmentManager {
  constructor() {
    this._files = []; // Array of { id, file, name, size, type, dataUrl, base64, isImage, ext }
    this._nextId = 1;
  }

  /**
   * Add File objects selected by user.
   * Reads files asynchronously into base64 / dataUrl.
   */
  async addFiles(fileList) {
    const filesArray = Array.from(fileList || []);
    if (!filesArray.length) return;

    for (const file of filesArray) {
      const isImage = file.type.startsWith('image/');
      const ext = file.name.slice(((file.name.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
      
      const item = {
        id: `att_${Date.now()}_${this._nextId++}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        ext: ext || 'doc',
        isImage,
        dataUrl: null,
        base64: null,
        text: null,
      };

      try {
        if (isImage) {
          item.dataUrl = await this._readFileAsDataUrl(file);
          item.base64 = item.dataUrl.split(',')[1] || '';
        } else {
          // Read text for document files (txt, md, py, js, json, csv, etc.)
          if (['txt', 'md', 'py', 'js', 'ts', 'html', 'css', 'json', 'csv', 'xml', 'log', 'yaml', 'yml'].includes(ext)) {
            item.text = await this._readFileAsText(file);
          } else {
            // For binary docs (pdf, docx, etc.), read as dataUrl for backend extraction
            item.dataUrl = await this._readFileAsDataUrl(file);
            item.base64 = item.dataUrl.split(',')[1] || '';
          }
        }
      } catch (err) {
        console.warn('[AttachmentManager] Error reading file:', file.name, err);
      }

      this._files.push(item);
    }

    this.renderAllPreviews();
  }

  removeFile(id) {
    this._files = this._files.filter(f => f.id !== id);
    this.renderAllPreviews();
  }

  clear() {
    this._files = [];
    this.renderAllPreviews();
  }

  getFiles() {
    return [...this._files];
  }

  hasFiles() {
    return this._files.length > 0;
  }

  /**
   * Render preview chips inside preview area containers:
   * #preview-area-home, #preview-area-conv, #preview-area-coder
   */
  renderAllPreviews() {
    const areas = [
      { id: 'preview-area-home', cap: 'input-capsule' },
      { id: 'preview-area-conv', cap: 'input-capsule-conv' },
      { id: 'preview-area-coder', cap: 'coder-input-capsule' },
      { id: 'preview-area-debate', cap: 'debate-input-capsule' }
    ];

    areas.forEach(({ id, cap }) => {
      const container = document.getElementById(id);
      const capsule = document.getElementById(cap);
      if (!container) return;

      if (this._files.length === 0) {
        container.innerHTML = '';
        container.classList.add('hidden');
        if (capsule) capsule.classList.remove('input-capsule-has-attachments');
      } else {
        container.classList.remove('hidden');
        if (capsule) capsule.classList.add('input-capsule-has-attachments');
        container.innerHTML = this._buildChipsHtml();
        this._bindChipEvents(container);
      }
    });

    // Toggle send buttons visibility if attachments exist
    const hasAtt = this.hasFiles();
    ['btn-submit-home', 'btn-submit-conv', 'coder-btn-send', 'btn-debate-start', 'btn-debate-intervene'].forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        if (hasAtt) {
          btn.classList.remove('hidden');
        } else {
          const txId = btnId === 'btn-submit-home' ? 'chat-input' : (btnId === 'btn-submit-conv' ? 'chat-input-conv' : (btnId === 'coder-btn-send' ? 'coder-input' : 'debate-input'));
          const tx = document.getElementById(txId);
          if (!tx || !tx.value.trim()) {
            if (btnId === 'btn-submit-home' || btnId === 'btn-submit-conv' || btnId === 'coder-btn-send') {
              btn.classList.add('hidden');
            }
          }
        }
      }
    });

    // Wire debate attach button if present
    const debateAttachBtn = document.getElementById('btn-attach-debate');
    if (debateAttachBtn && !debateAttachBtn._bound) {
      debateAttachBtn._bound = true;
      debateAttachBtn.addEventListener('click', () => {
        document.getElementById('attach-file-input')?.click();
      });
    }

    if (window.lucide) lucide.createIcons();
  }

  _buildChipsHtml() {
    return this._files.map(f => {
      const sizeStr = this._formatSize(f.size);

      let mediaHtml = '';
      if (f.isImage && f.dataUrl) {
        mediaHtml = `<img class="chip-thumb" src="${f.dataUrl}" alt="${this._esc(f.name)}" />`;
      } else {
        const displayExt = f.ext.length <= 4 ? f.ext : 'doc';
        mediaHtml = `<div class="chip-doc-icon">${displayExt}</div>`;
      }

      return `
        <div class="attachment-chip" data-id="${f.id}" title="${this._esc(f.name)}">
          ${mediaHtml}
          <div class="chip-info">
            <span class="chip-name">${this._esc(f.name)}</span>
            <span class="chip-size">${sizeStr}</span>
          </div>
          <button class="chip-remove-btn" data-id="${f.id}" title="Remove attachment">
            <i data-lucide="x" style="width:11px;height:11px;"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  _bindChipEvents(container) {
    container.querySelectorAll('.chip-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.removeFile(id);
      });
    });
  }

  _readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  _readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  _formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  _esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Bind Clipboard Paste (Ctrl+V / Cmd+V) to textareas.
   * Pasted images and files automatically become preview chips!
   */
  bindPasteSupport(textareaIds = ['chat-input', 'chat-input-conv', 'coder-input', 'debate-input']) {
    textareaIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el._pasteBound) return;
      el._pasteBound = true;

      el.addEventListener('paste', async (e) => {
        const clipboardItems = e.clipboardData?.items;
        if (!clipboardItems) return;

        const filesToAttach = [];
        for (const item of clipboardItems) {
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
              // Give pasted screenshot blobs a readable timestamped name
              if (!file.name || file.name === 'image.png' || file.name === 'blob') {
                const ext = (file.type.split('/')[1] || 'png').toLowerCase();
                const namedFile = new File([file], `Pasted_Image_${Date.now()}.${ext}`, { type: file.type });
                filesToAttach.push(namedFile);
              } else {
                filesToAttach.push(file);
              }
            }
          }
        }

        if (filesToAttach.length > 0) {
          e.preventDefault(); // Don't paste file path/binary string into textarea text
          await this.addFiles(filesToAttach);
        }
      });
    });
  }
}

export const attachmentManager = new AttachmentManager();

// Auto-bind paste listeners when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => attachmentManager.bindPasteSupport());
  } else {
    attachmentManager.bindPasteSupport();
  }
}

