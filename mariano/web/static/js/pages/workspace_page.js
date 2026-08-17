/**
 * workspace_page.js — Full-page Workspace File Explorer.
 *
 * Responsibilities:
 *   - List files from /api/workspace
 *   - Grid / List view toggle
 *   - Sort order
 *   - File preview / viewer
 *   - Breadcrumb navigation
 *
 * Usage (called by router.js callback):
 *   import { WorkspacePage } from '/static/js/pages/workspace_page.js';
 *   const page = new WorkspacePage();
 *   page.mount(document.getElementById('workspace-pane'));
 */

// ── File type helpers ──────────────────────────────────────
const FILE_ICONS = {
  folder: { icon: 'folder', cls: 'color-folder' },
  md:     { icon: 'file-text', cls: 'color-file'   },
  txt:    { icon: 'file-text', cls: 'color-file'   },
  csv:    { icon: 'sheet', cls: 'color-sheet'  },
  xlsx:   { icon: 'sheet', cls: 'color-sheet'  },
  pdf:    { icon: 'file-text', cls: 'color-pdf'    },
  py:     { icon: 'file-code', cls: 'color-code'   },
  js:     { icon: 'file-code', cls: 'color-code'   },
  json:   { icon: 'braces',  cls: 'color-code'  },
};

function getFileInfo(name, isDir) {
  if (isDir) return FILE_ICONS.folder;
  const ext = name.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || { icon: '📄', cls: 'color-file' };
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── WorkspacePage class ────────────────────────────────────
export class WorkspacePage {
  constructor(showToast) {
    this._showToast = showToast || (() => {});
    this._currentPath = '';
    this._viewMode = 'grid';   // 'grid' | 'list'
    this._sortKey  = 'name';   // 'name' | 'date' | 'size'
    this._items    = [];
    this._root     = null;
    this._mounted  = false;
  }

  /** Mount the explorer into the given container element. */
  mount(container) {
    // If already mounted in same container, just refresh
    if (this._mounted && this._root === container) {
      this.refresh();
      return;
    }
    this._root = container;
    this._mounted = true;
    this._render();
    this._load('');
  }

  /** Refresh (called if the user re-opens the pane). */
  refresh() {
    if (!this._mounted) return;
    this._load(this._currentPath);
  }

  // ── Internal ───────────────────────────────────────────

  async _load(path) {
    this._currentPath = path;
    this._renderLoading();
    try {
      const activePath = localStorage.getItem('mariano_active_project_path') || '';
      const res = await fetch(`/api/workspace?path=${encodeURIComponent(path)}&project_path=${encodeURIComponent(activePath)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._items = data.items || [];
      this._renderExplorer();
    } catch (err) {
      console.error('[WorkspacePage] Load failed:', err);
      this._renderError(err.message);
    }
  }

  async _openFile(relativePath, name) {
    const activePath = localStorage.getItem('mariano_active_project_path') || '';
    try {
      const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(relativePath)}&project_path=${encodeURIComponent(activePath)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._renderViewer(name, relativePath, data.content || '');
    } catch (err) {
      this._showToast?.('Error', `Could not open file: ${err.message}`, 3000);
    }
  }

  openFileByRelativePath(relativePath, name) {
    this._openFile(relativePath, name || relativePath.split('/').pop() || 'File');
  }

  // ── Rendering ─────────────────────────────────────────

  _render() {
    if (!this._root) return;
    this._root.innerHTML = `
      <div id="workspace-explorer">
        <div class="explorer-header">
          <div class="explorer-breadcrumbs" id="ws-breadcrumbs">
            <span class="breadcrumb-item" data-path="">🗂️ Workspace</span>
          </div>
          <div class="explorer-controls">
            <select class="explorer-select" id="ws-sort">
              <option value="name">Sort: Name</option>
              <option value="date">Sort: Date</option>
              <option value="size">Sort: Size</option>
            </select>
            <button class="explorer-btn active" id="ws-btn-grid" title="Grid view">
              <i data-lucide="layout-grid"></i>
            </button>
            <button class="explorer-btn" id="ws-btn-list" title="List view">
              <i data-lucide="list"></i>
            </button>
            <button class="explorer-btn" id="ws-btn-refresh" title="Refresh">
              <i data-lucide="refresh-cw"></i>
            </button>
          </div>
        </div>
        <div class="explorer-body" id="ws-body">
          <div class="explorer-empty">
            <div class="explorer-empty-icon"><i data-lucide="folder-open"></i></div>
            <div>Loading workspace…</div>
          </div>
        </div>
      </div>`;

    // Re-render icons
    if (window.lucide) lucide.createIcons();

    // Bind controls
    this._root.querySelector('#ws-btn-grid')?.addEventListener('click', () => {
      this._viewMode = 'grid';
      this._root.querySelector('#ws-btn-grid')?.classList.add('active');
      this._root.querySelector('#ws-btn-list')?.classList.remove('active');
      this._renderItems();
    });
    this._root.querySelector('#ws-btn-list')?.addEventListener('click', () => {
      this._viewMode = 'list';
      this._root.querySelector('#ws-btn-list')?.classList.add('active');
      this._root.querySelector('#ws-btn-grid')?.classList.remove('active');
      this._renderItems();
    });
    this._root.querySelector('#ws-btn-refresh')?.addEventListener('click', () => {
      this.refresh();
      this._showToast?.('Refreshed', 'Workspace updated.', 1500);
    });
    this._root.querySelector('#ws-sort')?.addEventListener('change', (e) => {
      this._sortKey = e.target.value;
      this._renderItems();
    });
  }

  _renderLoading() {
    const body = this._root?.querySelector('#ws-body');
    if (!body) return;
    body.innerHTML = `<div class="explorer-empty">
      <div class="explorer-empty-icon"><i data-lucide="loader-2" class="animate-spin"></i></div>
      <div>Loading…</div>
    </div>`;
    if (window.lucide) lucide.createIcons();
  }

  _renderError(msg) {
    const body = this._root?.querySelector('#ws-body');
    if (!body) return;
    body.innerHTML = `<div class="explorer-empty">
      <div class="explorer-empty-icon"><i data-lucide="alert-circle" style="color:var(--orange)"></i></div>
      <div style="color:var(--orange)">Error: ${msg}</div>
    </div>`;
    if (window.lucide) lucide.createIcons();
  }

  _renderFileLoading(name) {
    const body = this._root?.querySelector('#ws-body');
    if (!body) return;
    body.innerHTML = `<div class="explorer-empty">
      <div class="explorer-empty-icon"><i data-lucide="file-text"></i></div>
      <div>Opening ${name}…</div>
    </div>`;
    if (window.lucide) lucide.createIcons();
  }

  _renderExplorer() {
    this._renderBreadcrumbs();
    this._renderItems();
  }

  _renderBreadcrumbs() {
    const bc = this._root?.querySelector('#ws-breadcrumbs');
    if (!bc) return;

    const parts = this._currentPath ? this._currentPath.split('/').filter(Boolean) : [];
    let html = `<span class="breadcrumb-item" data-path="" style="display:flex;align-items:center"><i data-lucide="folder" style="width:16px;height:16px"></i></span>`;
    let accumulated = '';

    parts.forEach((part, i) => {
      accumulated += (i > 0 ? '/' : '') + part;
      html += `<span class="breadcrumb-separator"><i data-lucide="chevron-right" style="width:12px;height:12px"></i></span>`;
      html += `<span class="breadcrumb-item" data-path="${accumulated}">${part}</span>`;
    });

    bc.innerHTML = html;
    bc.querySelectorAll('.breadcrumb-item').forEach(el => {
      el.addEventListener('click', () => this._load(el.dataset.path));
    });
    if (window.lucide) lucide.createIcons();
  }

  _sortedItems() {
    const items = [...this._items];
    // Folders first always
    items.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      switch (this._sortKey) {
        case 'date': return (b.modified_time || 0) - (a.modified_time || 0);
        case 'size': return (b.size_bytes || 0) - (a.size_bytes || 0);
        default:     return a.name.localeCompare(b.name);
      }
    });
    return items;
  }

  _renderItems() {
    const body = this._root?.querySelector('#ws-body');
    if (!body) return;

    const items = this._sortedItems();
    if (items.length === 0) {
      body.innerHTML = `<div class="explorer-empty">
        <div class="explorer-empty-icon"><i data-lucide="inbox"></i></div>
        <div>This folder is empty</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:4px">AGI will save files here as it works</div>
      </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    if (this._viewMode === 'grid') {
      body.innerHTML = `<div class="grid-view">${items.map(item => this._gridCard(item)).join('')}</div>`;
    } else {
      body.innerHTML = `
        <div class="list-view">
          <div class="file-row" style="background:var(--bg);cursor:default;padding:6px 14px">
            <div class="file-row-icon"></div>
            <div class="file-row-name" style="color:var(--text-3);font-size:12px;font-weight:400;letter-spacing:.02em">Name</div>
            <div class="file-row-size" style="color:var(--text-3);font-size:12px;font-weight:400">Size</div>
            <div class="file-row-date" style="color:var(--text-3);font-size:12px;font-weight:400">Modified</div>
          </div>
          ${items.map(item => this._listRow(item)).join('')}
        </div>`;
    }

    // Bind click events
    body.querySelectorAll('[data-path]').forEach(el => {
      el.addEventListener('click', () => {
        const path = el.dataset.path;
        const isDir = el.dataset.dir === 'true';
        const name = el.dataset.name;
        if (isDir) this._load(path);
        else this._openFile(path, name);
      });
    });

    // Compile newly added SVG Lucide outline icons
    if (window.lucide) lucide.createIcons();
  }

  _gridCard(item) {
    const info = getFileInfo(item.name, item.is_dir);
    return `
      <div class="file-card"
           data-path="${item.relative_path}"
           data-dir="${item.is_dir}"
           data-name="${item.name}">
        <div class="file-card-icon ${info.cls}"><i data-lucide="${info.icon}"></i></div>
        <div class="file-card-name" title="${item.name}">${item.name}</div>
        <div class="file-card-meta">${item.is_dir ? 'Folder' : formatBytes(item.size_bytes)}</div>
      </div>`;
  }

  _listRow(item) {
    const info = getFileInfo(item.name, item.is_dir);
    return `
      <div class="file-row"
           data-path="${item.relative_path}"
           data-dir="${item.is_dir}"
           data-name="${item.name}">
        <div class="file-row-icon ${info.cls}"><i data-lucide="${info.icon}"></i></div>
        <div class="file-row-name" title="${item.name}">${item.name}</div>
        <div class="file-row-size">${item.is_dir ? '—' : formatBytes(item.size_bytes)}</div>
        <div class="file-row-date">${formatDate(item.modified_time)}</div>
      </div>`;
  }

  _renderViewer(name, relativePath, content) {
    const body = this._root?.querySelector('#ws-body');
    if (!body) return;

    const info = getFileInfo(name, false);
    body.innerHTML = `
      <div class="workspace-file-viewer">
        <div class="viewer-header">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="${info.cls}"><i data-lucide="${info.icon}"></i></span>
            <div class="viewer-title">${name}</div>
          </div>
          <button class="explorer-btn" id="ws-viewer-back">
            <i data-lucide="arrow-left"></i>
            Back
          </button>
        </div>
        <div class="viewer-body">${this._escapeHtml(content)}</div>
      </div>`;

    if (window.lucide) lucide.createIcons();
    body.querySelector('#ws-viewer-back')?.addEventListener('click', () => {
      const parentPath = relativePath.includes('/') ? relativePath.split('/').slice(0, -1).join('/') : '';
      this._load(parentPath);
    });
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
