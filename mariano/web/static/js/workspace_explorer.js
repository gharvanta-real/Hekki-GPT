/* === WORKSPACE FILE EXPLORER CONTROLLER === */

const $ = id => document.getElementById(id);

export class WorkspaceExplorer {
  constructor(tabs, showToastCallback) {
    this.tabs = tabs;
    this.showToast = showToastCallback;
    
    // States
    this.currentPath = "";
    this.viewMode = localStorage.getItem('explorer_view_mode') || 'grid'; // grid | list
    this.sortBy = 'name'; // name | size | date
    this.items = [];
    this.container = null;
  }

  /**
   * Main entry point to render the workspace panel.
   */
  async load(containerEl) {
    if (!containerEl) return;
    this.container = containerEl;
    
    // Render initial structure
    this.container.innerHTML = `
      <div id="workspace-explorer">
        <!-- Explorer Header -->
        <div class="explorer-header">
          <div class="explorer-breadcrumbs" id="explorer-breadcrumbs">Home</div>
          <div class="explorer-controls">
            <!-- Sorting -->
            <select class="explorer-select" id="explorer-sort" title="Sort files">
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
              <option value="date">Sort by Date</option>
            </select>
            <!-- Grid View Toggle -->
            <button class="explorer-btn ${this.viewMode === 'grid' ? 'active' : ''}" id="btn-view-grid" title="Grid View">
              <i data-lucide="layout-grid"></i>
            </button>
            <!-- List View Toggle -->
            <button class="explorer-btn ${this.viewMode === 'list' ? 'active' : ''}" id="btn-view-list" title="List View">
              <i data-lucide="list"></i>
            </button>
            <!-- Reload -->
            <button class="explorer-btn" id="btn-explorer-refresh" title="Refresh">
              <i data-lucide="refresh-cw"></i>
            </button>
          </div>
        </div>
        <!-- Explorer Body -->
        <div class="explorer-body" id="explorer-body">
          <div class="explorer-empty">
            <i data-lucide="loader-circle" class="explorer-empty-icon" style="animation:spin 1.2s linear infinite;"></i>
            <div>Loading workspace...</div>
          </div>
        </div>
      </div>
    `;

    // Bind event handlers
    $('btn-view-grid')?.addEventListener('click', () => this.setViewMode('grid'));
    $('btn-view-list')?.addEventListener('click', () => this.setViewMode('list'));
    $('btn-explorer-refresh')?.addEventListener('click', () => this.fetchFiles(this.currentPath));
    $('explorer-sort')?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.render();
    });

    // Load Lucide Icons on container structures
    if (window.lucide) window.lucide.createIcons();

    // Initial fetch
    await this.fetchFiles(this.currentPath);
  }

  async setViewMode(mode) {
    this.viewMode = mode;
    localStorage.setItem('explorer_view_mode', mode);
    
    // Toggle active classes
    $('btn-view-grid')?.classList.toggle('active', mode === 'grid');
    $('btn-view-list')?.classList.toggle('active', mode === 'list');
    
    this.render();
  }

  async fetchFiles(path) {
    const body = $('explorer-body');
    if (body) {
      body.innerHTML = `
        <div class="explorer-empty">
          <i data-lucide="loader-circle" class="explorer-empty-icon" style="animation:spin 1.2s linear infinite;"></i>
          <div>Scanning workspace...</div>
        </div>
      `;
    }

    try {
      const url = `/api/workspace?path=${encodeURIComponent(path)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch workspace items");
      
      const data = await res.json();
      this.currentPath = data.current_path || "";
      this.items = data.items || [];
      this.render();
    } catch (err) {
      console.error("Error loading workspace files:", err);
      if (body) {
        body.innerHTML = `
          <div class="explorer-empty">
            <i data-lucide="circle-alert" class="explorer-empty-icon" style="color:#dc2626;"></i>
            <div>Error scanning files</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:4px">${err.message}</div>
          </div>
        `;
      }
    }
  }

  render() {
    const body = $('explorer-body');
    if (!body) return;

    this.renderBreadcrumbs();

    if (this.items.length === 0) {
      body.innerHTML = `
        <div class="explorer-empty">
          <i data-lucide="folder-open" class="explorer-empty-icon"></i>
          <div>Workspace folder is empty</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px">Ask Hekki to create files here!</div>
        </div>
      `;
      return;
    }

    // Sort items: Folders always first, then files based on selected criteria
    const sorted = [...this.items].sort((a, b) => {
      if (a.is_dir !== b.is_dir) {
        return a.is_dir ? -1 : 1; // folders first
      }
      
      if (this.sortBy === 'size') {
        return b.size_bytes - a.size_bytes;
      }
      if (this.sortBy === 'date') {
        return b.modified_time - a.modified_time;
      }
      return a.name.localeCompare(b.name);
    });

    if (this.viewMode === 'grid') {
      this.renderGrid(body, sorted);
    } else {
      this.renderList(body, sorted);
    }

    // Re-bind Lucide icons if dynamically loaded elements exist
    if (window.lucide) window.lucide.createIcons();
  }

  renderBreadcrumbs() {
    const el = $('explorer-breadcrumbs');
    if (!el) return;

    const parts = this.currentPath.split("/").filter(Boolean);
    let html = `<span class="breadcrumb-item" id="crumb-root">Workspace</span>`;
    
    let pathAcc = "";
    parts.forEach((p, idx) => {
      pathAcc += (idx === 0 ? "" : "/") + p;
      html += `
        <span class="breadcrumb-separator"><i data-lucide="chevron-right" style="width:12px;height:12px;display:inline-block;vertical-align:middle;"></i></span>
        <span class="breadcrumb-item" data-path="${pathAcc}">${p}</span>
      `;
    });

    el.innerHTML = html;

    // Bind clicks
    el.querySelector('#crumb-root')?.addEventListener('click', () => this.fetchFiles(""));
    el.querySelectorAll('.breadcrumb-item[data-path]').forEach(item => {
      item.addEventListener('click', () => {
        this.fetchFiles(item.dataset.path);
      });
    });
  }

  renderGrid(container, items) {
    let html = `<div class="grid-view">`;
    
    items.forEach((item, idx) => {
      const icon = this.getFileIcon(item);
      const colorClass = this.getFileIconColor(item);
      const sizeStr = item.is_dir ? "Folder" : this.formatSize(item.size_bytes);
      
      html += `
        <div class="file-card" data-idx="${idx}">
          <div class="file-card-icon ${colorClass}">
            <i data-lucide="${icon}" style="width:22px;height:22px;"></i>
          </div>
          <div class="file-card-name" title="${item.name}">${item.name}</div>
          <div class="file-card-meta">${sizeStr}</div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

    // Bind item click
    container.querySelectorAll('.file-card').forEach(card => {
      card.addEventListener('click', () => {
        const item = items[parseInt(card.dataset.idx)];
        this.handleItemClick(item);
      });
    });
  }

  renderList(container, items) {
    let html = `
      <div class="list-view">
    `;

    items.forEach((item, idx) => {
      const icon = this.getFileIcon(item);
      const colorClass = this.getFileIconColor(item);
      const sizeStr = item.is_dir ? "--" : this.formatSize(item.size_bytes);
      const dateStr = new Date(item.modified_time * 1000).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      html += `
        <div class="file-row" data-idx="${idx}">
          <span class="file-row-icon ${colorClass}"><i data-lucide="${icon}" style="width:15px;height:15px;display:inline-block;vertical-align:middle;"></i></span>
          <span class="file-row-name" title="${item.name}">${item.name}</span>
          <span class="file-row-size">${sizeStr}</span>
          <span class="file-row-date">${dateStr}</span>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

    // Bind item click
    container.querySelectorAll('.file-row').forEach(row => {
      row.addEventListener('click', () => {
        const item = items[parseInt(row.dataset.idx)];
        this.handleItemClick(item);
      });
    });
  }

  handleItemClick(item) {
    if (item.is_dir) {
      // Navigate deep
      this.fetchFiles(item.relative_path);
    } else {
      // Read file content and open in full workspace editor view
      this.openFile(item);
    }
  }

  async openFile(item) {
    try {
      const url = `/api/workspace/read?file_path=${encodeURIComponent(item.relative_path)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to read file content");
      const data = await res.json();

      if (!this.container) return;

      const contentEscaped = this.escapeHtml(data.content || "");
      
      this.container.innerHTML = `
        <div class="workspace-file-viewer">
          <div class="viewer-header">
            <div style="display:flex;align-items:center;gap:12px">
              <button class="explorer-btn" id="btn-viewer-back">
                <i data-lucide="arrow-left" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Back to Files
              </button>
              <span class="viewer-title">✴ ${item.name}</span>
            </div>
            <div style="font-size:11px;color:var(--text-3)">Size: ${this.formatSize(item.size_bytes)} | Path: data/workspace/${item.relative_path}</div>
          </div>
          <div class="viewer-body">${contentEscaped || '[Empty File]'}</div>
        </div>
      `;

      // Bind back button
      $('btn-viewer-back')?.addEventListener('click', () => {
        this.load(this.container);
      });

      if (window.lucide) window.lucide.createIcons();
      this.showToast('Workspace', `Loaded ${item.name} inside workspace page.`, 2000);
    } catch (err) {
      console.error("Error opening file:", err);
      this.showToast('Workspace Error', `Failed to open file: ${err.message}`, 4000);
    }
  }

  getFileIcon(item) {
    if (item.is_dir) return "folder";
    const ext = item.name.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'xlsx': case 'xls': case 'csv':
        return "table";
      case 'pdf':
        return "file-text";
      case 'py': case 'js': case 'json': case 'html': case 'css': case 'rs': case 'bat': case 'toml':
        return "square-terminal";
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg':
        return "image";
      case 'md': case 'txt':
        return "file-text";
      default:
        return "file";
    }
  }

  getFileIconColor(item) {
    if (item.is_dir) return "color-folder";
    const ext = item.name.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'xlsx': case 'xls': case 'csv':
        return "color-sheet";
      case 'pdf':
        return "color-pdf";
      case 'py': case 'js': case 'json': case 'html': case 'css': case 'rs': case 'bat': case 'toml':
        return "color-code";
      default:
        return "color-file";
    }
  }

  formatSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  escapeHtml(string) {
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
