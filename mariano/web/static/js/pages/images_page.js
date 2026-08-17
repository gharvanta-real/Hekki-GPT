/**
 * images_page.js — Generated Images Gallery
 * Date-wise categorization, category-level select, top library header action toolbar (Select, Download All, Delete All).
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
    this._sort = 'date';
    this._lightboxIdx = -1;
    this._pendingConfirmCallback = null;
  }

  mount(container) {
    if (this._mounted && this._root === container) {
      this.refresh();
      return;
    }
    this.destroy();
    this._root = container;
    this._mounted = true;
    this._render();
    this._load();
  }

  refresh() {
    if (this._mounted) this._load();
  }

  async _load() {
    this._showLoading();
    try {
      const res = await fetch('/api/images');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      this._images = data.images || [];
      this._applyFilter();
      this._renderGrid();
    } catch {
      this._showError('Failed to load images. Is the server running?');
    }
  }

  _applyFilter() {
    let list = [...this._images];
    if (this._search) {
      const q = this._search.toLowerCase();
      list = list.filter(img => img.name.toLowerCase().includes(q));
    }
    if (this._sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (this._sort === 'size') list.sort((a, b) => b.size - a.size);
    else list.sort((a, b) => b.modified - a.modified);
    this._filtered = list;
  }

  _render() {
    this._root.innerHTML = `
      <div class="img-gallery-wrap">
        <div class="img-gallery-body" id="img-gallery-body">
          <div class="img-gallery-loading" id="img-loading"><div class="img-gallery-spinner"></div><span>Loading images…</span></div>
        </div>
      </div>
      <!-- Lightbox Modal -->
      <div class="img-lightbox-overlay hidden" id="img-lightbox">
        <div class="img-lightbox-backdrop" id="img-lightbox-backdrop"></div>
        <div class="img-lightbox-modal" style="position:relative; max-width:min(92vw,920px); max-height:88vh; border-radius:20px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#09090b; border:none !important; box-shadow:none !important;">
          <div class="img-lightbox-actions" style="position:absolute; bottom:18px; left:50%; transform:translateX(-50%); z-index:100; display:flex; align-items:center; gap:6px; background:rgba(24,24,27,0.85) !important; backdrop-filter:blur(16px); padding:5px 10px; border-radius:30px; border:none !important;">
            <button class="img-lightbox-btn" id="img-lb-download" title="Download Image" style="width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.14) !important; border:none !important; color:#ffffff !important; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 32 32" fill="currentColor" style="width:15px;height:15px;display:inline-block;"><path d="M23.5,22H23V20h.5a4.5,4.5,0,0,0,.36-9L23,11l-.1-.82a7,7,0,0,0-13.88,0L9,11,8.14,11a4.5,4.5,0,0,0,.36,9H9v2H8.5A6.5,6.5,0,0,1,7.2,9.14a9,9,0,0,1,17.6,0A6.5,6.5,0,0,1,23.5,22Z"/><polygon points="17 26.17 17 14 15 14 15 26.17 12.41 23.59 11 25 16 30 21 25 19.59 23.59 17 26.17"/></svg>
            </button>
            <button class="img-lightbox-btn img-card-btn img-del-btn" id="img-lb-delete" title="Delete Image" style="width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.14) !important; border:none !important; color:#ffffff !important; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#ffffff" style="width:14px;height:14px;display:inline-block;"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
            </button>
            <button class="img-lightbox-btn" id="img-lb-close" title="Close" style="width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.14) !important; border:none !important; color:#ffffff !important; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#ffffff" style="width:14px;height:14px;display:inline-block;"><polygon points="17.4141 16 26 7.4141 24.5859 6 16 14.5859 7.4143 6 6 7.4141 14.5859 16 6 24.5859 7.4143 26 16 17.4141 24.5859 26 26 24.5859 17.4141 16"/></svg>
            </button>
          </div>
          <div class="img-lightbox-body" style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#09090b; overflow:hidden; border-radius:20px; border:none !important;">
            <img class="img-lightbox-img" id="img-lightbox-img" src="" alt="" style="max-width:100%; max-height:88vh; object-fit:contain; display:block; border-radius:20px; user-select:none;" />
          </div>
        </div>
      </div>
      <!-- Custom Confirmation Modal -->
      <div id="img-confirm-modal" class="img-confirm-modal-overlay hidden" style="position:fixed; inset:0; z-index:10005; display:flex; align-items:center; justify-content:center;">
        <div class="img-confirm-backdrop" id="img-confirm-backdrop" style="position:absolute; inset:0; background:rgba(0,0,0,0.55); backdrop-filter:blur(4px);"></div>
        <div class="img-confirm-dialog" style="position:relative; z-index:2; width:100%; max-width:400px; background:var(--card); border:1px solid var(--border) !important; border-radius:16px; padding:22px 24px; box-shadow:none !important; display:flex; flex-direction:column; text-align:left; gap:14px;">
          <div class="img-confirm-header" style="display:flex; align-items:center; justify-content:space-between; width:100%;">
            <h3 class="img-confirm-title" id="img-confirm-title" style="margin:0; font-size:15px; font-weight:400; color:var(--text); font-family:var(--font);">Delete Image</h3>
            <button class="img-confirm-close" id="img-confirm-close" title="Close" style="background:transparent; border:none; color:var(--text-3); cursor:pointer; display:flex; align-items:center; justify-content:center; padding:4px;"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
          </div>
          <div class="img-confirm-body" style="margin:0;">
            <p class="img-confirm-msg" id="img-confirm-msg" style="margin:0; font-size:13px; color:var(--text-3); font-family:var(--font); line-height:1.5; font-weight:400; word-break:break-word;">Are you sure?</p>
          </div>
          <div class="img-confirm-actions" style="display:flex; align-items:center; justify-content:flex-end; gap:8px; width:100%; margin-top:6px;">
            <button class="img-confirm-btn img-confirm-btn-cancel" id="img-confirm-btn-cancel" style="padding:6px 16px; font-size:12.5px; font-weight:400; border-radius:16px; border:1px solid var(--border) !important; background:var(--input-bg) !important; color:var(--text-2) !important; cursor:pointer;">Cancel</button>
            <button class="img-confirm-btn img-confirm-btn-action" id="img-confirm-btn-action" style="padding:6px 16px; font-size:12.5px; font-weight:500; border-radius:16px; border:none !important; background:var(--btn-primary-bg) !important; color:var(--btn-primary-text) !important; cursor:pointer;">Delete Image</button>
          </div>
        </div>
      </div>
    `;
    this._bindControls();
    if (window.lucide) lucide.createIcons({ parent: this._root });
  }

  _askConfirm({ title = 'Delete Confirmation', message = 'Are you sure?', confirmText = 'Confirm', onConfirm }) {
    const modal = this._root.querySelector('#img-confirm-modal');
    if (!modal) return;
    const titleEl = this._root.querySelector('#img-confirm-title');
    const msgEl = this._root.querySelector('#img-confirm-msg');
    const actionBtn = this._root.querySelector('#img-confirm-btn-action');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (actionBtn) actionBtn.textContent = confirmText;
    this._pendingConfirmCallback = onConfirm;
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons({ parent: modal });
  }

  _hideConfirmModal() {
    const modal = this._root.querySelector('#img-confirm-modal');
    if (modal) modal.classList.add('hidden');
    this._pendingConfirmCallback = null;
  }

  _bindControls() {
    const $ = id => this._root.querySelector(`#${id}`);
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

    $('img-lb-close')?.addEventListener('click', () => this._closeLightbox());
    $('img-lightbox-backdrop')?.addEventListener('click', () => this._closeLightbox());
    $('img-lb-download')?.addEventListener('click', () => {
      if (this._lightboxIdx >= 0 && this._filtered[this._lightboxIdx]) this._downloadImage(this._filtered[this._lightboxIdx]);
    });
    $('img-lb-delete')?.addEventListener('click', () => {
      if (this._lightboxIdx < 0) return;
      const img = this._filtered[this._lightboxIdx];
      if (img) {
        this._askConfirm({
          title: 'Delete Image',
          message: `Are you sure you want to delete "${img.name}"?`,
          confirmText: 'Delete Image',
          onConfirm: () => { this._closeLightbox(); this._deleteImages([img.path]); }
        });
      }
    });

    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
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

  _lightboxNav(dir) {
    if (this._lightboxIdx < 0 || this._filtered.length === 0) return;
    this._lightboxIdx = (this._lightboxIdx + dir + this._filtered.length) % this._filtered.length;
    this._syncLightbox();
  }

  // ── Grid render ────────────────────────────────────────────────────────────
  _renderGrid() {
    const body = this._root.querySelector('#img-gallery-body');
    if (!body) return;

    if (this._filtered.length === 0) {
      body.innerHTML = `
        <div class="library-container">
          <div class="library-header-row">
            <h1 class="library-main-title">Library</h1>
          </div>
          <div class="img-gallery-empty">
            <div class="img-gallery-empty-icon"><i data-lucide="image-off" style="width:36px;height:36px;opacity:0.3;"></i></div>
            <p class="img-gallery-empty-title">${this._search ? 'No media matches your search' : 'No media yet'}</p>
            <p class="img-gallery-empty-sub">${this._search ? 'Try a different keyword' : 'Generated images will appear here'}</p>
          </div>
        </div>`;
      if (window.lucide) lucide.createIcons({ parent: body });
      return;
    }

    // Group images by Date Category
    const groups = new Map();
    this._filtered.forEach((img, idx) => {
      const category = this._getDateCategory(img.modified_iso);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push({ img, idx });
    });

    const selCount = this._selectedPaths.size;
    const dlText = selCount > 0 ? `Download (${selCount})` : 'Download All';
    const delText = selCount > 0 ? `Delete (${selCount})` : 'Delete All';

    let sectionsHtml = '';
    for (const [category, items] of groups.entries()) {
      const allCatSelected = items.length > 0 && items.every(({ img }) => this._selectedPaths.has(img.path));
      sectionsHtml += `
        <div class="img-gallery-date-group">
          <div class="img-gallery-date-header">
            <div class="img-gallery-date-info">
              <h3 class="img-gallery-date-title">${category}</h3>
              <span class="img-gallery-date-count">${items.length} ${items.length === 1 ? 'photo' : 'photos'}</span>
            </div>
            <div class="img-category-checkbox ${allCatSelected ? 'checked' : ''}" data-cat="${this._escHtml(category)}" title="Select all in ${this._escHtml(category)}">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <div class="img-gallery-grid" data-group="${this._escHtml(category)}"></div>
        </div>
      `;
    }

    body.innerHTML = `
      <div class="library-container">
        <div class="library-header-row">
          <h1 class="library-main-title">Library</h1>
          <div class="library-actions">
            <button class="library-action-btn" id="lib-download-all-btn" title="${dlText}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><path d="M23.5,22H23V20h.5a4.5,4.5,0,0,0,.36-9L23,11l-.1-.82a7,7,0,0,0-13.88,0L9,11,8.14,11a4.5,4.5,0,0,0,.36,9H9v2H8.5A6.5,6.5,0,0,1,7.2,9.14a9,9,0,0,1,17.6,0A6.5,6.5,0,0,1,23.5,22Z"/><polygon points="17 26.17 17 14 15 14 15 26.17 12.41 23.59 11 25 16 30 21 25 19.59 23.59 17 26.17"/></svg>
              <span>${dlText}</span>
            </button>
            <button class="library-action-btn" id="lib-delete-all-btn" title="${delText}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
              <span>${delText}</span>
            </button>
          </div>
        </div>
        ${sectionsHtml}
      </div>
    `;

    body.querySelector('#lib-download-all-btn')?.addEventListener('click', () => {
      const targets = this._selectedPaths.size > 0 
        ? this._filtered.filter(img => this._selectedPaths.has(img.path))
        : this._filtered;
      this._downloadBatch(targets);
    });

    body.querySelector('#lib-delete-all-btn')?.addEventListener('click', () => {
      const count = this._selectedPaths.size;
      const isAll = count === 0 || count === this._filtered.length;
      this._askConfirm({
        title: isAll ? 'Delete All Images' : `Delete Selected (${count})`,
        message: isAll ? `Are you sure you want to delete all ${this._filtered.length} images?` : `Are you sure you want to delete ${count} selected images?`,
        confirmText: 'Delete Images',
        onConfirm: () => this._deleteImages(isAll ? [] : [...this._selectedPaths], isAll)
      });
    });

    // Bind category selection circular checkboxes
    body.querySelectorAll('.img-category-checkbox').forEach(cb => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = cb.dataset.cat;
        const items = groups.get(cat) || [];
        const allSelected = items.length > 0 && items.every(({ img }) => this._selectedPaths.has(img.path));
        items.forEach(({ img }) => {
          if (allSelected) this._selectedPaths.delete(img.path);
          else this._selectedPaths.add(img.path);
        });
        this._selectMode = this._selectedPaths.size > 0;
        this._renderGrid();
      });
    });

    // Render cards into respective date group grids
    for (const [category, items] of groups.entries()) {
      const grid = body.querySelector(`.img-gallery-grid[data-group="${CSS.escape(category)}"]`);
      if (!grid) continue;

      items.forEach(({ img, idx }) => {
        const isSelected = this._selectedPaths.has(img.path);
        const card = document.createElement('div');
        card.className = `img-gallery-card ${this._selectMode ? 'select-mode' : ''} ${isSelected ? 'selected' : ''}`;
        card.dataset.idx = idx;
        card.dataset.path = img.path;

        card.innerHTML = `
          <div class="img-gallery-thumb-wrap">
            <img class="img-gallery-thumb" src="${img.render_url}" alt="${this._escHtml(img.name)}" loading="lazy" />
            <div class="img-gallery-top-overlay">
              <div class="img-card-checkbox ${isSelected ? 'checked' : ''}" data-idx="${idx}">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div class="img-card-actions">
                <button class="img-card-btn img-dl-btn" data-idx="${idx}" title="Download">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><path d="M23.5,22H23V20h.5a4.5,4.5,0,0,0,.36-9L23,11l-.1-.82a7,7,0,0,0-13.88,0L9,11,8.14,11a4.5,4.5,0,0,0,.36,9H9v2H8.5A6.5,6.5,0,0,1,7.2,9.14a9,9,0,0,1,17.6,0A6.5,6.5,0,0,1,23.5,22Z"/><polygon points="17 26.17 17 14 15 14 15 26.17 12.41 23.59 11 25 16 30 21 25 19.59 23.59 17 26.17"/></svg>
                </button>
                <button class="img-card-btn img-del-btn" data-idx="${idx}" title="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;

        card.querySelector('.img-card-checkbox')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleSelect(img.path);
        });

        card.querySelector('.img-dl-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._downloadImage(img);
        });

        card.querySelector('.img-del-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._askConfirm({
            title: 'Delete Image',
            message: `Are you sure you want to delete "${img.name}"?`,
            confirmText: 'Delete Image',
            onConfirm: () => this._deleteImages([img.path])
          });
        });

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
    }

    if (window.lucide) lucide.createIcons({ parent: body });
  }

  _getDateCategory(iso) {
    if (!iso) return 'Earlier';
    try {
      const d = new Date(iso);
      const now = new Date();
      const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round((nowDate - dDate) / 86400000);
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
      if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
      return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return 'Earlier'; }
  }

  _toggleSelect(path) {
    if (this._selectedPaths.has(path)) this._selectedPaths.delete(path);
    else this._selectedPaths.add(path);
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
    } catch {
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
    this._root.querySelector('#img-lightbox')?.classList.remove('hidden');
  }

  _closeLightbox() {
    this._root.querySelector('#img-lightbox')?.classList.add('hidden');
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
    this._showToast('Download', `Downloading ${img.name}`, 1500);
  }

  _downloadBatch(images) {
    if (!images || images.length === 0) return;
    this._showToast('Download', `Starting download for ${images.length} image(s)...`, 2000);
    images.forEach((img, index) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = img.render_url;
        a.download = img.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, index * 200);
    });
  }

  _escHtml(str) { return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  destroy() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    this._mounted = false;
  }
}
