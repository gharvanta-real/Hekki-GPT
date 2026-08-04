/**
 * live_canvas.js — Interactive Live Canvas & Artifacts Engine
 * (Claude Canvas / ChatGPT Canvas Style)
 *
 * Features:
 * - Side-by-side split workspace in #app-pane
 * - Real-time HTML/CSS/JS live Web Application Preview (iframe sandbox with hot reload)
 * - Pair-editing Code Editor with live preview sync
 * - Interactive Mermaid Architecture Flowchart & SVG rendering
 * - Toolbar: View mode tabs, Copy, Hot Reload, Fullscreen modal, Save to Workspace
 */

export class LiveCanvasEngine {
  constructor() {
    this._appPane = document.getElementById('app-pane');
    this._resizer = document.getElementById('app-pane-resizer');
    this._activeArtifact = null;
    this._currentViewMode = 'preview'; // 'editor' | 'preview' | 'diagram' | 'doc'
    this._isInitialized = false;

    this.init();
  }

  init() {
    if (this._isInitialized) return;
    this._isInitialized = true;
    this._setupResizer();
  }

  /** Setup split-view resizer drag functionality between chat-pane and app-pane */
  _setupResizer() {
    if (!this._resizer || !this._appPane) return;
    let isDragging = false;
    let animationFrameId = null;
    let currentX = 0;

    const onMouseDown = (e) => {
      e.preventDefault();
      isDragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      this._appPane.classList.add('no-transition');

      // Temporarily disable iframe pointer events to prevent mouse capture lag
      document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      currentX = e.clientX;

      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(() => {
          animationFrameId = null;
          const containerWidth = window.innerWidth;
          const newWidth = Math.max(320, Math.min(containerWidth - 320, containerWidth - currentX));
          this._appPane.style.width = `${newWidth}px`;
        });
      }
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        this._appPane.classList.remove('no-transition');

        // Re-enable iframe pointer events
        document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');

        window.dispatchEvent(new Event('resize'));
      }
    };

    this._resizer.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /** Show and expand the side-by-side app-pane workspace */
  showPane() {
    if (this._appPane) {
      this._appPane.classList.remove('hidden-pane');
      if (this._resizer) this._resizer.classList.remove('hidden-pane');
      window.dispatchEvent(new Event('resize'));
    }
  }

  /** Hide the side-by-side app-pane workspace */
  hidePane() {
    if (this._appPane) {
      this._appPane.classList.add('hidden-pane');
      if (this._resizer) this._resizer.classList.add('hidden-pane');
      window.dispatchEvent(new Event('resize'));
    }
  }

  /**
   * Open an artifact in the Live Canvas
   * @param {Object} opts - { type: 'web_app'|'code'|'diagram'|'pdf'|'document', title, code, html, css, js, language, filepath }
   */
  openArtifact(opts = {}) {
    const lang = (opts.language || '').toLowerCase();
    const rawCode = opts.code || opts.html || '';

    const isDocType = opts.type === 'pdf' || opts.type === 'document' || 
                      ['pdf', 'markdown', 'md', 'doc', 'docx', 'text', 'txt', 'plaintext'].includes(lang) ||
                      rawCode.includes('[Professional Summary]') || rawCode.includes('[Skills]') || rawCode.includes('Resume');

    const type = opts.type || (
      lang === 'html' || (rawCode && rawCode.includes('<html')) ? 'web_app' : (
        lang === 'mermaid' ? 'diagram' : (
          isDocType ? 'document' : 'code'
        )
      )
    );

    const title = opts.title || (
      type === 'web_app' ? 'Web Application' : (
        type === 'diagram' ? 'Architecture Diagram' : (
          type === 'document' || type === 'pdf' ? (opts.title && opts.title !== 'TEXT Artifact' ? opts.title : 'Document Preview') : 'Code Artifact'
        )
      )
    );

    this._activeArtifact = {
      type,
      title,
      code: rawCode,
      html: opts.html || (type === 'web_app' ? rawCode : ''),
      css: opts.css || '',
      js: opts.js || '',
      language: opts.language || (type === 'document' ? 'pdf' : 'html'),
      filepath: opts.filepath || ''
    };

    // Default view mode based on type
    if (type === 'web_app') this._currentViewMode = 'preview';
    else if (type === 'diagram') this._currentViewMode = 'diagram';
    else if (type === 'document' || type === 'pdf') this._currentViewMode = 'document';
    else this._currentViewMode = 'editor';

    this.showPane();
    this.render();
  }

  /** Render the full Live Canvas interface into #app-pane */
  render() {
    if (!this._appPane || !this._activeArtifact) return;

    const art = this._activeArtifact;
    const isWebApp = art.type === 'web_app' || art.language === 'html' || art.code.includes('<html');
    const isDiagram = art.type === 'diagram' || art.language === 'mermaid';
    const isDoc = art.type === 'document' || art.type === 'pdf' || art.language === 'pdf' || art.language === 'markdown' || art.language === 'doc';

    const modeBtnHtml = isWebApp ? (
      this._currentViewMode === 'preview' 
        ? `<button class="canvas-btn" id="canvas-btn-toggle-mode" data-target="editor" title="Switch to Code Editor"><i data-lucide="code-2" style="width:13px;height:13px;"></i> Code</button>`
        : `<button class="canvas-btn" id="canvas-btn-toggle-mode" data-target="preview" title="Switch to Live Preview"><i data-lucide="eye" style="width:13px;height:13px;"></i> Preview</button>`
    ) : (
      isDiagram ? (
        this._currentViewMode === 'diagram'
          ? `<button class="canvas-btn" id="canvas-btn-toggle-mode" data-target="editor" title="Switch to Code Editor"><i data-lucide="code-2" style="width:13px;height:13px;"></i> Code</button>`
          : `<button class="canvas-btn" id="canvas-btn-toggle-mode" data-target="diagram" title="Switch to Diagram"><i data-lucide="network" style="width:13px;height:13px;"></i> Diagram</button>`
      ) : (
        isDoc ? (
          this._currentViewMode === 'document'
            ? `<button class="canvas-btn" id="canvas-btn-toggle-mode" data-target="editor" title="Switch to Raw/Editor"><i data-lucide="code-2" style="width:13px;height:13px;"></i> Raw</button>`
            : `<button class="canvas-btn" id="canvas-btn-toggle-mode" data-target="document" title="Switch to Document Page"><i data-lucide="file-text" style="width:13px;height:13px;"></i> Page</button>`
        ) : ''
      )
    );

    const toolbarActionsHtml = `
      <div class="canvas-actions">
        ${modeBtnHtml}
        
        <div class="canvas-menu-wrapper" style="position:relative;">
          <button class="canvas-btn" id="canvas-btn-more" title="More Options">
            <i data-lucide="more-vertical" style="width:14px;height:14px;"></i>
          </button>
          
          <div class="canvas-dropdown hidden" id="canvas-dropdown-menu">
            <button class="canvas-dropdown-item" id="canvas-btn-copy">
              <i data-lucide="copy" style="width:13px;height:13px;"></i> Copy Code
            </button>
            ${isWebApp ? `
              <button class="canvas-dropdown-item" id="canvas-btn-reload">
                <i data-lucide="refresh-cw" style="width:13px;height:13px;"></i> Reload Preview
              </button>
            ` : ''}
            <button class="canvas-dropdown-item" id="canvas-btn-print">
              <i data-lucide="download" style="width:13px;height:13px;"></i> Print / Save PDF
            </button>
            <button class="canvas-dropdown-item" id="canvas-btn-save">
              <i data-lucide="save" style="width:13px;height:13px;"></i> Save to Workspace
            </button>
          </div>
        </div>

        <button class="canvas-btn canvas-btn-close" id="canvas-btn-close" title="Close Canvas">
          <i data-lucide="x" style="width:14px;height:14px;"></i>
        </button>
      </div>
    `;

    const langIcon = isWebApp ? 'file-code-2' : (isDiagram ? 'network' : (isDoc ? 'file-text' : 'file-code-2'));

    this._appPane.innerHTML = `
      <div class="canvas-container">
        <!-- Canvas Top Bar -->
        <div class="canvas-header">
          <div class="canvas-title-group">
            <span class="canvas-title-icon" style="display:inline-flex;align-items:center;margin-right:2px;">
              <i data-lucide="${langIcon}" style="width:15px;height:15px;color:var(--text-2);"></i>
            </span>
            <span class="canvas-title">${this._escapeHtml(art.title)}</span>
          </div>
          ${toolbarActionsHtml}
        </div>

        <!-- Canvas Body Viewport -->
        <div class="canvas-body" id="canvas-body">
          ${this._renderBodyContent()}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons({ parent: this._appPane });
    this._bindEvents();

    // Render diagram or boot preview if active
    if (this._currentViewMode === 'preview' && isWebApp) {
      this._updateIframePreview();
    } else if (this._currentViewMode === 'diagram' && isDiagram) {
      this._renderMermaidDiagram();
    }
  }

  _renderBodyContent() {
    const art = this._activeArtifact;

    if (this._currentViewMode === 'preview') {
      return `
        <div class="canvas-preview-wrapper">
          <iframe id="canvas-iframe" class="canvas-iframe" sandbox="allow-scripts allow-modals allow-forms allow-same-origin"></iframe>
        </div>
      `;
    }

    if (this._currentViewMode === 'diagram') {
      return `
        <div class="canvas-diagram-wrapper">
          <div id="mermaid-diagram-container" class="mermaid-container">
            <div class="mermaid-loading">Rendering Diagram...</div>
          </div>
        </div>
      `;
    }

    if (this._currentViewMode === 'document') {
      const formattedHtml = this._formatDocumentToA4(art.code || '');
      return `
        <div class="canvas-paper-viewport">
          <div class="canvas-paper-page">
            ${formattedHtml}
          </div>
          <div class="canvas-page-counter">Page 1 / 1</div>
        </div>
      `;
    }

    // Default: Pair-Editing Live Code Editor with Line Numbers Index
    return `
      <div class="canvas-editor-wrapper">
        <div class="canvas-line-numbers" id="canvas-line-numbers"></div>
        <textarea id="canvas-code-input" class="canvas-code-textarea" spellcheck="false" wrap="off">${this._escapeHtml(art.code)}</textarea>
      </div>
    `;
  }

  _bindEvents() {
    // Mode toggle button (Preview <-> Code Editor)
    this._appPane.querySelector('#canvas-btn-toggle-mode')?.addEventListener('click', (e) => {
      const targetMode = e.currentTarget.dataset.target;
      if (targetMode) {
        this._currentViewMode = targetMode;
        this.render();
      }
    });

    // 3-dot dropdown menu toggle
    const moreBtn = this._appPane.querySelector('#canvas-btn-more');
    const dropdownMenu = this._appPane.querySelector('#canvas-dropdown-menu');
    if (moreBtn && dropdownMenu) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && e.target !== moreBtn) {
          dropdownMenu.classList.add('hidden');
        }
      });
    }

    // Close button
    this._appPane.querySelector('#canvas-btn-close')?.addEventListener('click', () => {
      this.hidePane();
    });

    // Copy button
    this._appPane.querySelector('#canvas-btn-copy')?.addEventListener('click', () => {
      const codeToCopy = this._activeArtifact ? this._activeArtifact.code : '';
      navigator.clipboard.writeText(codeToCopy).then(() => {
        const btn = this._appPane.querySelector('#canvas-btn-copy');
        if (btn) {
          btn.innerHTML = `<i data-lucide="check" style="width:13px;height:13px;"></i> Copied!`;
          if (window.lucide) lucide.createIcons({ parent: btn });
          setTimeout(() => {
            btn.innerHTML = `<i data-lucide="copy" style="width:13px;height:13px;"></i> Copy`;
            if (window.lucide) lucide.createIcons({ parent: btn });
          }, 1500);
        }
      });
    });

    // Hot Reload button
    this._appPane.querySelector('#canvas-btn-reload')?.addEventListener('click', () => {
      if (this._currentViewMode === 'preview') {
        this._updateIframePreview();
      }
    });

    // Print / Save PDF button
    this._appPane.querySelector('#canvas-btn-print')?.addEventListener('click', () => {
      const art = this._activeArtifact;
      const pageEl = this._appPane.querySelector('.canvas-paper-page') || this._appPane.querySelector('.canvas-body');
      if (!pageEl || !art) return;
      const printWin = window.open('', '_blank');
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${this._escapeHtml(art.title)}</title>
            <style>
              body { font-family: 'Open Sans', -apple-system, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; }
              h1, h2, h3 { color: #0f172a; margin-top: 24px; font-weight: 600; }
              table { width: 100%; border-collapse: collapse; margin: 16px 0; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
              th { background: #f8fafc; font-weight: 600; }
              code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
              pre { background: #f8fafc; padding: 14px; border-radius: 6px; overflow-x: auto; }
              @media print { body { padding: 0; max-width: 100%; } }
            </style>
          </head>
          <body>
            ${pageEl.innerHTML}
          </body>
        </html>
      `);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 350);
    });

    // Save button
    this._appPane.querySelector('#canvas-btn-save')?.addEventListener('click', async () => {
      const codeInput = this._appPane.querySelector('#canvas-code-input');
      if (codeInput && this._activeArtifact) {
        this._activeArtifact.code = codeInput.value;
      }
      await this._saveArtifactToWorkspace();
    });

    // Live pair-editing input sync & line numbers indexing
    const codeInput = this._appPane.querySelector('#canvas-code-input');
    const lineNumbers = this._appPane.querySelector('#canvas-line-numbers');

    const updateLineNumbers = () => {
      if (!codeInput || !lineNumbers) return;
      const count = (codeInput.value.match(/\n/g) || []).length + 1;
      let html = '';
      for (let i = 1; i <= count; i++) {
        html += `<div>${i}</div>`;
      }
      lineNumbers.innerHTML = html;
    };

    if (codeInput) {
      updateLineNumbers();

      codeInput.addEventListener('input', (e) => {
        if (this._activeArtifact) {
          this._activeArtifact.code = e.target.value;
        }
        updateLineNumbers();
      });

      if (lineNumbers) {
        codeInput.addEventListener('scroll', () => {
          lineNumbers.scrollTop = codeInput.scrollTop;
        });
      }
    }
  }

  /** Update sandboxed iframe preview with complete HTML/CSS/JS */
  _updateIframePreview() {
    const iframe = this._appPane?.querySelector('#canvas-iframe');
    if (!iframe || !this._activeArtifact) return;

    let fullHtml = this._activeArtifact.code || this._activeArtifact.html || '';
    const css = this._activeArtifact.css || '';
    const js = this._activeArtifact.js || '';

    if (!fullHtml.includes('<html')) {
      fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; margin: 0; background: #ffffff; color: #111; }
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
      if (css && !fullHtml.includes(css)) {
        if (fullHtml.includes('</head>')) {
          fullHtml = fullHtml.replace('</head>', `<style>${css}</style></head>`);
        } else {
          fullHtml = `<style>${css}</style>` + fullHtml;
        }
      }
      if (js && !fullHtml.includes(js)) {
        if (fullHtml.includes('</body>')) {
          fullHtml = fullHtml.replace('</body>', `<script>${js}</script></body>`);
        } else {
          fullHtml += `<script>${js}</script>`;
        }
      }
    }

    const doc = iframe.contentWindow || iframe.contentDocument;
    if (doc.document) {
      doc.document.open();
      doc.document.write(fullHtml);
      doc.document.close();
    }
  }

  /** Render Mermaid diagram if mermaid library is loaded */
  _renderMermaidDiagram() {
    const container = this._appPane?.querySelector('#mermaid-diagram-container');
    if (!container || !this._activeArtifact) return;

    const mermaidCode = this._activeArtifact.code.replace(/```mermaid/gi, '').replace(/```/g, '').trim();

    if (window.mermaid) {
      try {
        const id = 'mermaid-svg-' + Math.random().toString(36).substring(2, 9);
        window.mermaid.render(id, mermaidCode).then((res) => {
          container.innerHTML = res.svg;
        }).catch((err) => {
          container.innerHTML = `<div class="mermaid-error">Diagram render error: ${this._escapeHtml(err.message || String(err))}</div>`;
        });
      } catch (e) {
        container.innerHTML = `<div class="mermaid-error">Diagram error: ${this._escapeHtml(e.message)}</div>`;
      }
    } else {
      container.innerHTML = `
        <div class="mermaid-fallback">
          <pre style="background:var(--card);padding:14px;border-radius:8px;font-family:var(--font);font-size:12.5px;">${this._escapeHtml(mermaidCode)}</pre>
        </div>
      `;
    }
  }

  /** Save active artifact to backend workspace */
  async _saveArtifactToWorkspace() {
    if (!this._activeArtifact) return;

    const filename = this._activeArtifact.filepath || `canvas_artifact_${Date.now()}.${this._getFileExtension(this._activeArtifact.language)}`;
    try {
      const resp = await fetch('/api/canvas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: filename,
          code: this._activeArtifact.code
        })
      });
      const data = await resp.json();
      if (data.status === 'ok') {
        const saveBtn = this._appPane.querySelector('#canvas-btn-save');
        if (saveBtn) {
          saveBtn.innerHTML = `<i data-lucide="check" style="width:13px;height:13px;"></i> Saved!`;
          if (window.lucide) lucide.createIcons({ parent: saveBtn });
          setTimeout(() => {
            saveBtn.innerHTML = `<i data-lucide="save" style="width:13px;height:13px;"></i> Save`;
            if (window.lucide) lucide.createIcons({ parent: saveBtn });
          }, 1500);
        }
      }
    } catch (e) {
      console.error("Failed to save artifact:", e);
    }
  }

  /** Transform raw text / markdown into a professional A4 formatted document */
  _formatDocumentToA4(rawText) {
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

      // Convert [Section Name] lines into markdown ## Section Name
      restLines = restLines.replace(/^\[(.*?)\]$/gm, '## $1');
      const bodyHtml = window.marked ? window.marked.parse(restLines) : this._escapeHtml(restLines).replace(/\n/g, '<br>');

      return `
        <div class="paper-resume-header">
          <h1 class="paper-candidate-name">${this._escapeHtml(nameLine)}</h1>
          <div class="paper-contact-info">${this._escapeHtml(contactLine)}</div>
        </div>
        <div class="paper-resume-body">
          ${bodyHtml}
        </div>
      `;
    }

    // Standard Document Formatting
    let content = rawText.replace(/^\[(.*?)\]$/gm, '## $1');
    return window.marked ? window.marked.parse(content) : this._escapeHtml(content).replace(/\n/g, '<br>');
  }

  _getFileExtension(lang) {
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

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate global live canvas engine
window.liveCanvas = new LiveCanvasEngine();
