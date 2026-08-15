/**
 * images_page.js — Generated Images Gallery
 * Rounded compact cards, floating text on page background, select-to-delete, delete-all, and custom confirmation popup.
 */

export class ImagesPage {
  constructor(showToast) {
    this._showToast = showToast || (() => {});
    this._images = [];
    this._filtered = [];
    this._selectedPaths = new Set();
    this._selectMode = false;
    this._root = null;
    this._mounted = false;
    this._search = '';
    this._sort = 'date';   // 'date' | 'name' | 'size'
    this._lightboxIdx = -1;
    this._pendingConfirmCallback = null;
  }

  mount(container) {
    if (this._mounted && this._root === container) {
      this.refresh();
      return;
    }
    this.destroy(); // Fix: Clean up old event listeners if remounting
    this._root = container;
    this._mounted = true;
    this._render();
    this._load();
  }

  refresh() {
    if (!this._mounted) return;
    this._load();
  }

  // ── Core load ──────────────────────────────────────────────────────────────
  async _load() {
    this._showLoading();
    try {
      const res = await fetch('/api/images');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      this._images = data.images || [];
      this._applyFilter();
      this._renderGrid();
    } catch (err) {
      this._showError('Failed to load images. Is the server running?');
    }
  }

  _applyFilter() {
    let list = [...this._images];
    if (this._search) {
      const q = this._search.toLowerCase();
      list = list.filter(img => img.name.toLowerCase().includes(q));
    }
    if (this._sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this._sort === 'size') {
      list.sort((a, b) => b.size - a.size);
    } else {
      list.sort((a, b) => b.modified - a.modified);
    }
    this._filtered = list;
  }

  // ── Scaffold ───────────────────────────────────────────────────────────────
  _render() {
    this._root.innerHTML = `
      <div class="img-gallery-wrap">
        <div class="img-gallery-body" id="img-gallery-body">
          <div class="img-gallery-loading" id="img-loading"><div class="img-gallery-spinner"></div><span>Loading images…</span></div>
        </div>
      </div>

      <!-- Lightbox -->
      <div class="img-lightbox-overlay hidden" id="img-lightbox">
        <div class="img-lightbox-backdrop" id="img-lightbox-backdrop"></div>
        <div class="img-lightbox-modal" style="position: relative; max-width: min(92vw, 920px); max-height: 88vh; border-radius: 20px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #09090b; border: none !important; box-shadow: none !important;">
          
          <!-- Floating Translucent Toolbar Overlaying Bottom-Center INSIDE Image Frame -->
          <div class="img-lightbox-actions" style="position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); z-index: 100; display: flex; align-items: center; gap: 6px; background: rgba(24, 24, 27, 0.85) !important; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); padding: 5px 10px; border-radius: 30px; border: none !important; box-shadow: none !important;">
            <button class="img-lightbox-btn" id="img-lb-download" title="Download Image" style="width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.14) !important; border:none !important; box-shadow:none !important; color:#ffffff !important; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#ffffff" style="width:14px;height:14px;display:inline-block;"><path d="M26 24v4H6v-4H4v4a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-4zm-11 2.414l-6.707-6.707 1.414-1.414L15 23.586V2h2v21.586l5.293-5.293 1.414 1.414z"/></svg>
            </button>
            <button class="img-lightbox-btn img-card-btn img-del-btn" id="img-lb-delete" title="Delete Image" style="width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.14) !important; border:none !important; box-shadow:none !important; color:#ffffff !important; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#ffffff" style="width:14px;height:14px;display:inline-block;"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
            </button>
            <button class="img-lightbox-btn" id="img-lb-close" title="Close" style="width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.14) !important; border:none !important; box-shadow:none !important; color:#ffffff !important; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#ffffff" style="width:14px;height:14px;display:inline-block;"><polygon points="17.4141 16 26 7.4141 24.5859 6 16 14.5859 7.4143 6 6 7.4141 14.5859 16 6 24.5859 7.4143 26 16 17.4141 24.5859 26 26 24.5859 17.4141 16"/></svg>
            </button>
          </div>

          <!-- Image Display Frame -->
          <div class="img-lightbox-body" style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #09090b; overflow: hidden; border-radius: 20px; border: none !important; box-shadow: none !important;">
            <img class="img-lightbox-img" id="img-lightbox-img" src="" alt="" style="max-width: 100%; max-height: 88vh; object-fit: contain; display: block; border-radius: 20px; user-select: none;" />
          </div>

        </div>
      </div>

      <!-- Custom Confirmation Modal -->
      <div id="img-confirm-modal" class="modal-overlay hidden" style="z-index: 10005;">
        <div class="modal-box compact img-confirm-box">
          <div class="img-confirm-header">
            <h3 class="img-confirm-title" id="img-confirm-title">Delete Images</h3>
            <button class="img-confirm-close" id="img-confirm-close" title="Close"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
          </div>
          <div class="img-confirm-body"><p class="img-confirm-msg" id="img-confirm-msg">Are you sure?</p></div>
          <div class="img-confirm-actions">
            <button class="img-confirm-btn img-confirm-btn-cancel" id="img-confirm-btn-cancel">Cancel</button>
            <button class="img-confirm-btn img-confirm-btn-action" id="img-confirm-btn-action">Confirm</button>
          </div>
        </div>
    `;

    this._bindControls();
    if (window.lucide) lucide.createIcons({ parent: this._root });
  }

  // ── Custom Confirmation Dialog Helper ────────────────────────────────────
  _askConfirm({ title = 'Delete Confirmation', message = 'Are you sure?', confirmText = 'Confirm', danger = true, onConfirm }) {
    const modal = this._root.querySelector('#img-confirm-modal');
    if (!modal) return;

    const titleEl = this._root.querySelector('#img-confirm-title');
    const msgEl = this._root.querySelector('#img-confirm-msg');
    const actionBtn = this._root.querySelector('#img-confirm-btn-action');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (actionBtn) {
      actionBtn.textContent = confirmText;
    }

    this._pendingConfirmCallback = onConfirm;
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons({ parent: modal });
  }

  _hideConfirmModal() {
    const modal = this._root.querySelector('#img-confirm-modal');
    if (modal) modal.classList.add('hidden');
    this._pendingConfirmCallback = null;
  }

  // ── Controls ───────────────────────────────────────────────────────────────
  _bindControls() {
    const $ = id => this._root.querySelector(`#${id}`);

    // Search
    const searchEl = $('img-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        this._search = searchEl.value.trim();
        this._applyFilter();
        this._renderGrid();
      });
    }

    // Sort
    const sortEl = $('img-sort');
    if (sortEl) {
      sortEl.addEventListener('change', () => {
        this._sort = sortEl.value;
        this._applyFilter();
        this._renderGrid();
      });
    }

    // Select Mode Toggle
    $('img-select-toggle')?.addEventListener('click', () => {
      this._selectMode = !this._selectMode;
      if (!this._selectMode) this._selectedPaths.clear();
      this._updateSelectUI();
      this._renderGrid();
    });

    // Custom Confirmation Modal Controls
    $('img-confirm-close')?.addEventListener('click', () => this._hideConfirmModal());
    $('img-confirm-btn-cancel')?.addEventListener('click', () => this._hideConfirmModal());
    $('img-confirm-backdrop')?.addEventListener('click', () => this._hideConfirmModal());
    $('img-confirm-btn-action')?.addEventListener('click', () => {
      if (typeof this._pendingConfirmCallback === 'function') {
        const cb = this._pendingConfirmCallback;
        this._hideConfirmModal();
        cb();
      }
    });

    // Smart Single Delete Button
    $('img-delete-btn')?.addEventListener('click', () => {
      const count = this._selectedPaths.size;
      if (count === 0) return;
      const isAll = count === this._images.length;
      if (isAll) {
        this._askConfirm({
          title: 'Delete All Images',
          message: `Are you sure you want to delete ALL ${count} images? This action cannot be undone.`,
          confirmText: 'Confirm',
          danger: true,
          onConfirm: () => this._deleteImages([], true)
        });
      } else {
        this._askConfirm({
          title: count === 1 ? 'Delete Image' : 'Delete Selected Images',
          message: `Are you sure you want to delete ${count} selected image(s)? This action cannot be undone.`,
          confirmText: 'Confirm',
          danger: true,
          onConfirm: () => this._deleteImages([...this._selectedPaths])
        });
      }
    });

    // Refresh
    $('img-refresh')?.addEventListener('click', () => {
      this._load();
    });

    // Lightbox actions
    $('img-lb-close')?.addEventListener('click', () => this._closeLightbox());
    $('img-lightbox-backdrop')?.addEventListener('click', () => this._closeLightbox());

    $('img-lb-download')?.addEventListener('click', () => {
      if (this._lightboxIdx < 0) return;
      const img = this._filtered[this._lightboxIdx];
      if (img) this._downloadImage(img);
    });

    $('img-lb-delete')?.addEventListener('click', () => {
      if (this._lightboxIdx < 0) return;
      const img = this._filtered[this._lightboxIdx];
      if (img) {
        this._askConfirm({
          title: 'Delete Image',
          message: `Are you sure you want to delete "${img.name}"?`,
          confirmText: 'Delete Image',
          danger: true,
          onConfirm: () => {
            this._closeLightbox();
            this._deleteImages([img.path]);
          }
        });
      }
    });

    // Keyboard nav
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
    document.addEventListener('keydown', this._keyHandler = (e) => {
      const modal = this._root.querySelector('#img-confirm-modal');
      if (modal && !modal.classList.contains('hidden')) {
        if (e.key === 'Escape') this._hideConfirmModal();
        return;
      }
      const lb = this._root.querySelector('#img-lightbox');
      if (!lb || lb.classList.contains('hidden')) return;
      if (e.key === 'Escape') this._closeLightbox();
      if (e.key === 'ArrowLeft') this._lightboxNav(-1);
      if (e.key === 'ArrowRight') this._lightboxNav(1);
    });
  }

  _updateSelectUI() {
    const $ = id => this._root.querySelector(`#${id}`);
    const toggleBtn = $('img-select-toggle');
    const toggleLabel = $('img-select-toggle-label');
    const delBtn = $('img-delete-btn');
    const delLabel = $('img-delete-btn-label');

    const count = this._selectedPaths.size;
    const isAll = count > 0 && count === this._images.length;

    if (toggleBtn) {
      toggleBtn.classList.toggle('img-gallery-btn-active', this._selectMode);
      toggleBtn.title = this._selectMode ? 'Cancel Select' : 'Toggle Select Mode';
    }
    if (toggleLabel) {
      toggleLabel.textContent = this._selectMode ? 'Cancel Select' : 'Select';
    }
    if (delBtn) {
      if (count > 0) {
        delBtn.classList.remove('hidden');
        const titleText = isAll ? `Delete All (${count})` : `Delete Selected (${count})`;
        delBtn.title = titleText;
        if (delLabel) delLabel.textContent = titleText;
      } else {
        delBtn.classList.add('hidden');
      }
    }
  }

  // ── Grid render ────────────────────────────────────────────────────────────
  _renderGrid() {
    const body = this._root.querySelector('#img-gallery-body');
    const badge = this._root.querySelector('#img-count-badge');
    if (!body) return;
    if (badge) badge.textContent = this._filtered.length;

    this._updateSelectUI();

    let mediaContent = '';
    if (this._filtered.length === 0) {
      mediaContent = `
        <div class="img-gallery-empty">
          <div class="img-gallery-empty-icon">
            <i data-lucide="image-off" style="width:36px;height:36px;opacity:0.3;"></i>
          </div>
          <p class="img-gallery-empty-title">${this._search ? 'No media matches your search' : 'No media yet'}</p>
          <p class="img-gallery-empty-sub">${this._search ? 'Try a different keyword' : 'Generated images will appear here'}</p>
        </div>`;
    } else {
      mediaContent = `<div class="img-gallery-grid" id="img-grid"></div>`;
    }

    body.innerHTML = `
      <div class="library-container">
        <h1 class="library-main-title">Library</h1>

        <!-- Media Section -->
        <div class="library-section">
          <h2 class="library-section-title">Media</h2>
          ${mediaContent}
        </div>
      </div>
    `;

    if (this._filtered.length === 0) {
      if (window.lucide) lucide.createIcons({ parent: body });
      return;
    }

    const grid = body.querySelector('#img-grid');

    this._filtered.forEach((img, idx) => {
      const sizeStr = this._formatSize(img.size);
      const dateStr = this._formatDate(img.modified_iso);
      const isSelected = this._selectedPaths.has(img.path);

      const card = document.createElement('div');
      card.className = `img-gallery-card ${this._selectMode ? 'select-mode' : ''} ${isSelected ? 'selected' : ''}`;
      card.dataset.idx = idx;
      card.dataset.path = img.path;

      card.innerHTML = `
        <div class="img-gallery-thumb-wrap">
          <img
            class="img-gallery-thumb"
            src="${img.render_url}"
            alt="${this._escHtml(img.name)}"
            loading="lazy"
          />

          <!-- Top Overlay: Select Checkbox + Action Buttons -->
          <div class="img-gallery-top-overlay">
            <div class="img-card-checkbox ${isSelected ? 'checked' : ''}" data-idx="${idx}">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor" style="width:13px;height:13px;display:inline-block;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>
            </div>
            <div class="img-card-actions">
              <button class="img-card-btn img-dl-btn" data-idx="${idx}" title="Download">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;"><path d="M26 24v4H6v-4H4v4a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-4zm-11 2.414l-6.707-6.707 1.414-1.414L15 23.586V2h2v21.586l5.293-5.293 1.414 1.414z"/></svg>
              </button>
              <button class="img-card-btn img-del-btn" data-idx="${idx}" title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;

      // Checkbox click
      const cb = card.querySelector('.img-card-checkbox');
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleSelect(img.path);
      });

      // Download button
      card.querySelector('.img-dl-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this._downloadImage(img);
      });

      // Single Delete button
      card.querySelector('.img-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this._askConfirm({
          title: 'Delete Image',
          message: `Are you sure you want to delete "${img.name}"?`,
          confirmText: 'Delete Image',
          danger: true,
          onConfirm: () => this._deleteImages([img.path])
        });
      });

      // Card click
      card.addEventListener('click', (e) => {
        if (e.target.closest('.img-card-btn') || e.target.closest('.img-card-checkbox')) return;
        if (this._selectMode) {
          this._toggleSelect(img.path);
        } else {
          this._openLightbox(idx);
        }
      });

      grid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons({ parent: grid });
  }

  _toggleSelect(path) {
    if (this._selectedPaths.has(path)) {
      this._selectedPaths.delete(path);
    } else {
      this._selectedPaths.add(path);
    }
    this._renderGrid();
  }

  async _deleteImages(paths, deleteAll = false) {
    this._showLoading();
    try {
      const res = await fetch('/api/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: paths, delete_all: deleteAll })
      });
      const data = await res.json();
      if (data.success) {
        this._showToast('Deleted', `Successfully deleted ${data.deleted_count} image(s).`, 2500);
        this._selectedPaths.clear();
        this._load();
      } else {
        this._showError('Failed to delete image(s).');
      }
    } catch (err) {
      this._showError('Error executing delete operation.');
    }
  }

  _showLoading() {
    const body = this._root.querySelector('#img-gallery-body');
    if (body) body.innerHTML = `<div class="img-gallery-loading"><div class="img-gallery-spinner"></div><span>Loading images…</span></div>`;
  }

  _showError(msg) {
    const body = this._root.querySelector('#img-gallery-body');
    if (body) body.innerHTML = `<div class="img-gallery-empty"><p class="img-gallery-empty-title" style="color:#ef4444;">⚠ ${msg}</p></div>`;
  }

  _openLightbox(idx) {
    this._lightboxIdx = idx;
    this._syncLightbox();
    const lb = this._root.querySelector('#img-lightbox');
    if (lb) lb.classList.remove('hidden');
  }

  _closeLightbox() {
    const lb = this._root.querySelector('#img-lightbox');
    if (lb) lb.classList.add('hidden');
    this._lightboxIdx = -1;
  }

  _syncLightbox() {
    const img = this._filtered[this._lightboxIdx];
    if (!img) return;
    const imgEl = this._root.querySelector('#img-lightbox-img');
    if (imgEl) { imgEl.src = img.render_url; imgEl.alt = img.name; }
  }

  _downloadImage(img) {
    const a = document.createElement('a');
    a.href = img.render_url; a.download = img.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    this._showToast('Download', `Downloading ${img.name}`, 2000);
  }

  _formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  _formatDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso), diffH = Math.floor((new Date() - d) / 3600000);
      if (diffH < 1) return 'Just now';
      if (diffH < 24) return `${diffH}h ago`;
      const diffD = Math.floor(diffH / 24);
      if (diffD < 7) return `${diffD}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch { return ''; }
  }

  _escHtml(str) { return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  destroy() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    this._mounted = false;
  }
}
