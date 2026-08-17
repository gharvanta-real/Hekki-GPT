/**
 * library_page.js — Universal Asset & Media Library (<500 lines)
 * Categorized view for Generated Images, Voice Summaries, PDFs, and Data/Code files.
 * Uses Global Persistent Audio Player so playback continues across all pages.
 */

import { renderCardContent } from './library_cards.js';

export class LibraryPage {
  constructor(showToast) {
    this._showToast = showToast || (() => {});
    this._items = [];
    this._filtered = [];
    this._counts = { all: 0, image: 0, voice: 0, pdf: 0, data: 0 };
    this._selectedPaths = new Set();
    this._currentCategory = 'all';
    this._selectMode = false;
    this._root = null;
    this._mounted = false;
    this._search = '';
    this._sort = 'date';
    this._lightboxIdx = -1;
    this._pendingConfirmCallback = null;
    this._unsubAudio = null;
  }

  mount(container) {
    if (!container) return;
    if (this._mounted && this._root === container) {
      this.refresh();
      return;
    }
    this.destroy();
    this._root = container;
    this._mounted = true;
    this._render();
    this._load();

    if (window.globalAudioPlayer) {
      this._unsubAudio = window.globalAudioPlayer.on('*', () => {
        if (this._mounted && this._root) this._renderGrid();
      });
    }
  }

  refresh() {
    if (this._mounted && this._root) this._load();
  }

  async _load() {
    this._showLoading();
    try {
      const res = await fetch(`/api/library?category=${encodeURIComponent(this._currentCategory)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      this._items = data.items || [];
      this._counts = data.counts || this._counts;
      this._applyFilter();
      this._renderGrid();
    } catch {
      this._showError('Failed to load library items. Is the server running?');
    }
  }

  _applyFilter() {
    let list = [...this._items];
    if (this._currentCategory !== 'all') {
      list = list.filter(it => it.type === this._currentCategory);
    }
    if (this._search) {
      const q = this._search.toLowerCase();
      list = list.filter(it => it.name.toLowerCase().includes(q));
    }
    if (this._sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (this._sort === 'size') list.sort((a, b) => b.size - a.size);
    else list.sort((a, b) => b.modified - a.modified);
    this._filtered = list;
  }

  _render() {
    if (!this._root) return;
    this._root.innerHTML = `
      <div class="img-gallery-wrap">
        <div class="img-gallery-body" id="lib-gallery-body">
          <div class="img-gallery-loading" id="lib-loading"><div class="img-gallery-spinner"></div><span>Loading library…</span></div>
        </div>
      </div>
      <!-- Lightbox Modal -->
      <div class="img-lightbox-overlay hidden" id="lib-lightbox">
        <div class="img-lightbox-backdrop" id="lib-lightbox-backdrop"></div>
        <div class="img-lightbox-modal" style="position:relative; max-width:min(92vw,920px); max-height:88vh; border-radius:20px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:var(--card); border:none !important;">
          <div class="img-lightbox-actions" style="position:absolute; bottom:18px; left:50%; transform:translateX(-50%); z-index:100; display:flex; align-items:center; gap:6px; background:var(--input-bg) !important; backdrop-filter:blur(16px); padding:5px 10px; border-radius:30px; border:none !important;">
            <button class="img-lightbox-btn" id="lib-lb-download" title="Download" style="width:30px; height:30px; border-radius:50%; background:var(--card) !important; border:none !important; color:var(--text-primary) !important; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 32 32" fill="currentColor"><path d="M23.5,22H23V20h.5a4.5,4.5,0,0,0,.36-9L23,11l-.1-.82a7,7,0,0,0-13.88,0L9,11,8.14,11a4.5,4.5,0,0,0,.36,9H9v2H8.5A6.5,6.5,0,0,1,7.2,9.14a9,9,0,0,1,17.6,0A6.5,6.5,0,0,1,23.5,22Z"/><polygon points="17 26.17 17 14 15 14 15 26.17 12.41 23.59 11 25 16 30 21 25 19.59 23.59 17 26.17"/></svg>
            </button>
            <button class="img-lightbox-btn" id="lib-lb-delete" title="Delete" style="width:30px; height:30px; border-radius:50%; background:var(--card) !important; border:none !important; color:var(--red, #ef4444) !important; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
            </button>
            <button class="img-lightbox-btn" id="lib-lb-close" title="Close" style="width:30px; height:30px; border-radius:50%; background:var(--card) !important; border:none !important; color:var(--text-primary) !important; cursor:pointer; display:flex; align-items:center; justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor"><polygon points="17.4141 16 26 7.4141 24.5859 6 16 14.5859 7.4143 6 6 7.4141 14.5859 16 6 24.5859 7.4143 26 16 17.4141 24.5859 26 26 24.5859 17.4141 16"/></svg>
            </button>
          </div>
          <div class="img-lightbox-body" style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:var(--card); overflow:hidden; border-radius:20px; border:none !important;">
            <img class="img-lightbox-img" id="lib-lightbox-img" src="" alt="" style="max-width:100%; max-height:88vh; object-fit:contain; display:block; border-radius:20px; user-select:none;" />
          </div>
        </div>
      </div>
      <!-- Confirm Modal -->
      <div id="lib-confirm-modal" class="img-confirm-modal-overlay hidden" style="position:fixed; inset:0; z-index:10005; display:flex; align-items:center; justify-content:center;">
        <div class="img-confirm-backdrop" id="lib-confirm-backdrop" style="position:absolute; inset:0; background:rgba(0,0,0,0.45); backdrop-filter:blur(4px);"></div>
        <div class="img-confirm-dialog" style="position:relative; z-index:2; width:100%; max-width:400px; background:var(--card); border:1px solid var(--border) !important; border-radius:16px; padding:22px 24px; display:flex; flex-direction:column; gap:14px;">
          <div class="img-confirm-header" style="display:flex; align-items:center; justify-content:space-between; width:100%;">
            <h3 class="img-confirm-title" id="lib-confirm-title" style="margin:0; font-size:14px; font-weight:500; color:var(--text-primary);">Delete Confirmation</h3>
            <button class="img-confirm-close" id="lib-confirm-close" style="background:transparent; border:none; color:var(--text-3); cursor:pointer;"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
          </div>
          <p class="img-confirm-msg" id="lib-confirm-msg" style="margin:0; font-size:13px; color:var(--text-2); line-height:1.5;">Are you sure?</p>
          <div class="img-confirm-actions" style="display:flex; align-items:center; justify-content:flex-end; gap:8px; width:100%; margin-top:6px;">
            <button class="img-confirm-btn" id="lib-confirm-btn-cancel" style="padding:5px 16px; font-size:12.5px; border-radius:16px; border:1px solid var(--border); background:var(--input-bg); color:var(--text-2); cursor:pointer;">Cancel</button>
            <button class="img-confirm-btn" id="lib-confirm-btn-action" style="padding:5px 16px; font-size:12.5px; font-weight:500; border-radius:16px; border:none; background:var(--btn-danger-bg, #ef4444); color:var(--btn-danger-text, #ffffff); cursor:pointer;">Delete</button>
          </div>
        </div>
      </div>
    `;
    this._bindControls();
    if (window.lucide) lucide.createIcons({ parent: this._root });
  }

  _bindControls() {
    if (!this._root) return;
    const $ = id => this._root.querySelector(`#${id}`);
    $('lib-confirm-close')?.addEventListener('click', () => this._hideConfirmModal());
    $('lib-confirm-btn-cancel')?.addEventListener('click', () => this._hideConfirmModal());
    $('lib-confirm-backdrop')?.addEventListener('click', () => this._hideConfirmModal());
    $('lib-confirm-btn-action')?.addEventListener('click', () => {
      if (typeof this._pendingConfirmCallback === 'function') {
        const cb = this._pendingConfirmCallback;
        this._hideConfirmModal();
        cb();
      }
    });

    $('lib-lb-close')?.addEventListener('click', () => this._closeLightbox());
    $('lib-lightbox-backdrop')?.addEventListener('click', () => this._closeLightbox());
    $('lib-lb-download')?.addEventListener('click', () => {
      if (this._lightboxIdx >= 0 && this._filtered[this._lightboxIdx]) this._downloadItem(this._filtered[this._lightboxIdx]);
    });
    $('lib-lb-delete')?.addEventListener('click', () => {
      if (this._lightboxIdx < 0) return;
      const it = this._filtered[this._lightboxIdx];
      if (it) {
        this._askConfirm({
          title: `Delete ${it.type}`,
          message: `Are you sure you want to delete "${it.name}"?`,
          confirmText: 'Delete',
          onConfirm: () => { this._closeLightbox(); this._deleteItems([it.path]); }
        });
      }
    });

    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    document.addEventListener('keydown', this._keyHandler = (e) => {
      if (!this._root) return;
      const modal = this._root.querySelector('#lib-confirm-modal');
      if (modal && !modal.classList.contains('hidden')) {
        if (e.key === 'Escape') this._hideConfirmModal();
        return;
      }
      const lb = this._root.querySelector('#lib-lightbox');
      if (!lb || lb.classList.contains('hidden')) return;
      if (e.key === 'Escape') this._closeLightbox();
      if (e.key === 'ArrowLeft') this._lightboxNav(-1);
      if (e.key === 'ArrowRight') this._lightboxNav(1);
    });
  }

  _lightboxNav(dir) {
    const imgItems = this._filtered.filter(it => it.type === 'image');
    if (this._lightboxIdx < 0 || imgItems.length === 0) return;
    this._lightboxIdx = (this._lightboxIdx + dir + imgItems.length) % imgItems.length;
    this._syncLightbox();
  }

  _renderGrid() {
    if (!this._root) return;
    const body = this._root.querySelector('#lib-gallery-body');
    if (!body) return;

    const selCount = this._selectedPaths.size;
    const dlText = selCount > 0 ? `Download (${selCount})` : 'Download All';
    const delText = selCount > 0 ? `Delete (${selCount})` : 'Delete All';

    const categories = [
      { id: 'all', label: `All (${this._counts.all || this._items.length})` },
      { id: 'image', label: `Images (${this._counts.image || 0})` },
      { id: 'voice', label: `Voice Audio (${this._counts.voice || 0})` },
      { id: 'pdf', label: `PDFs & Docs (${this._counts.pdf || 0})` },
      { id: 'data', label: `Data & Code (${this._counts.data || 0})` }
    ];

    const categoryTabsHtml = `
      <div class="lib-category-tabs">
        ${categories.map(c => `
          <button class="lib-cat-tab ${this._currentCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
            ${c.label}
          </button>
        `).join('')}
      </div>
    `;

    if (this._filtered.length === 0) {
      body.innerHTML = `
        <div class="library-container">
          <div class="library-header-row"><h1 class="library-main-title">Library</h1></div>
          ${categoryTabsHtml}
          <div class="img-gallery-empty">
            <div class="img-gallery-empty-icon"><i data-lucide="folder-open" style="width:36px;height:36px;opacity:0.3;"></i></div>
            <p class="img-gallery-empty-title">No assets found</p>
            <p class="img-gallery-empty-sub">Generated images, voice overviews, documents, and data artifacts will appear here</p>
          </div>
        </div>`;
      this._bindCategoryTabs(body);
      if (window.lucide) lucide.createIcons({ parent: body });
      return;
    }

    const groups = new Map();
    this._filtered.forEach((it, idx) => {
      const category = this._getDateCategory(it.modified_iso);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push({ it, idx });
    });

    let sectionsHtml = '';
    for (const [category, items] of groups.entries()) {
      const allCatSelected = items.length > 0 && items.every(({ it }) => this._selectedPaths.has(it.path));
      sectionsHtml += `
        <div class="img-gallery-date-group">
          <div class="img-gallery-date-header">
            <div class="img-gallery-date-info">
              <h3 class="img-gallery-date-title">${category}</h3>
              <span class="img-gallery-date-count">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>
            </div>
            <div class="img-category-checkbox ${allCatSelected ? 'checked' : ''}" data-cat="${this._escHtml(category)}" title="Select all in ${this._escHtml(category)}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor"><path d="M23.5,22H23V20h.5a4.5,4.5,0,0,0,.36-9L23,11l-.1-.82a7,7,0,0,0-13.88,0L9,11,8.14,11a4.5,4.5,0,0,0,.36,9H9v2H8.5A6.5,6.5,0,0,1,7.2,9.14a9,9,0,0,1,17.6,0A6.5,6.5,0,0,1,23.5,22Z"/><polygon points="17 26.17 17 14 15 14 15 26.17 12.41 23.59 11 25 16 30 21 25 19.59 23.59 17 26.17"/></svg>
              <span>${dlText}</span>
            </button>
            <button class="library-action-btn" id="lib-delete-all-btn" title="${delText}">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="currentColor"><rect x="12" y="12" width="2" height="12"/><rect x="18" y="12" width="2" height="12"/><path d="M4,6V8H6V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V8h2V6ZM8,28V8H24V28Z"/><rect x="12" y="2" width="8" height="2"/></svg>
              <span>${delText}</span>
            </button>
          </div>
        </div>
        ${categoryTabsHtml}
        ${sectionsHtml}
      </div>
    `;

    this._bindCategoryTabs(body);

    body.querySelector('#lib-download-all-btn')?.addEventListener('click', () => {
      const targets = this._selectedPaths.size > 0 ? this._filtered.filter(it => this._selectedPaths.has(it.path)) : this._filtered;
      this._downloadBatch(targets);
    });

    body.querySelector('#lib-delete-all-btn')?.addEventListener('click', () => {
      const count = this._selectedPaths.size;
      const isAll = count === 0 || count === this._filtered.length;
      this._askConfirm({
        title: isAll ? 'Delete All Items' : `Delete Selected (${count})`,
        message: isAll ? `Are you sure you want to delete all ${this._filtered.length} items?` : `Are you sure you want to delete ${count} selected items?`,
        confirmText: 'Delete',
        onConfirm: () => this._deleteItems(isAll ? [] : [...this._selectedPaths], isAll)
      });
    });

    body.querySelectorAll('.img-category-checkbox').forEach(cb => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = cb.dataset.cat;
        const items = groups.get(cat) || [];
        const allSelected = items.length > 0 && items.every(({ it }) => this._selectedPaths.has(it.path));
        items.forEach(({ it }) => {
          if (allSelected) this._selectedPaths.delete(it.path);
          else this._selectedPaths.add(it.path);
        });
        this._selectMode = this._selectedPaths.size > 0;
        this._renderGrid();
      });
    });

    for (const [category, items] of groups.entries()) {
      const grid = body.querySelector(`.img-gallery-grid[data-group="${CSS.escape(category)}"]`);
      if (!grid) continue;

      items.forEach(({ it, idx }) => {
        const isSelected = this._selectedPaths.has(it.path);
        const isPlaying = window.globalAudioPlayer ? window.globalAudioPlayer.isPlaying(it.render_url) : false;
        const card = document.createElement('div');
        card.className = `img-gallery-card ${this._selectMode ? 'select-mode' : ''} ${isSelected ? 'selected' : ''}`;
        card.dataset.idx = idx;
        card.dataset.path = it.path;

        card.innerHTML = renderCardContent(it, isSelected, idx, str => this._escHtml(str), isPlaying);

        card.querySelector('.img-card-checkbox')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleSelect(it.path);
        });

        card.querySelector('.img-play-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.globalAudioPlayer) {
            window.globalAudioPlayer.play(it.render_url, it.name);
          }
        });

        card.querySelector('.img-dl-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._downloadItem(it);
        });

        card.querySelector('.img-del-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this._askConfirm({
            title: `Delete ${it.type}`,
            message: `Are you sure you want to delete "${it.name}"?`,
            confirmText: 'Delete',
            onConfirm: () => this._deleteItems([it.path])
          });
        });

        card.addEventListener('click', (e) => {
          if (e.target.closest('.img-card-btn') || e.target.closest('.img-card-checkbox')) return;
          if (this._selectMode) {
            this._toggleSelect(it.path);
          } else if (it.type === 'image') {
            this._openLightbox(idx);
          } else if (it.type === 'voice') {
            if (window.globalAudioPlayer) window.globalAudioPlayer.play(it.render_url, it.name);
          } else {
            window.open(it.render_url, '_blank');
          }
        });

        grid.appendChild(card);
      });
    }

    if (window.lucide) lucide.createIcons({ parent: body });
  }

  _bindCategoryTabs(body) {
    body.querySelectorAll('.lib-cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._currentCategory = tab.dataset.cat;
        this._selectedPaths.clear();
        this._selectMode = false;
        this._load();
      });
    });
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

  async _deleteItems(paths, deleteAll = false) {
    this._showLoading();
    try {
      const res = await fetch('/api/library/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: paths.map(p => ({ path: p })), delete_all: deleteAll, category: this._currentCategory })
      });
      const data = await res.json();
      if (data.success) {
        this._showToast('Deleted', `Successfully deleted ${data.deleted_count} item(s).`, 2500);
        this._selectedPaths.clear();
        this._load();
      } else {
        this._showError('Failed to delete item(s).');
      }
    } catch {
      this._showError('Error executing delete operation.');
    }
  }

  _askConfirm({ title = 'Delete Confirmation', message = 'Are you sure?', confirmText = 'Confirm', onConfirm }) {
    if (!this._root) return;
    const modal = this._root.querySelector('#lib-confirm-modal');
    if (!modal) return;
    const titleEl = this._root.querySelector('#lib-confirm-title');
    const msgEl = this._root.querySelector('#lib-confirm-msg');
    const actionBtn = this._root.querySelector('#lib-confirm-btn-action');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (actionBtn) actionBtn.textContent = confirmText;
    this._pendingConfirmCallback = onConfirm;
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons({ parent: modal });
  }

  _hideConfirmModal() {
    if (!this._root) return;
    const modal = this._root.querySelector('#lib-confirm-modal');
    if (modal) modal.classList.add('hidden');
    this._pendingConfirmCallback = null;
  }

  _showLoading() {
    if (!this._root) return;
    const body = this._root.querySelector('#lib-gallery-body');
    if (body) body.innerHTML = `<div class="img-gallery-loading"><div class="img-gallery-spinner"></div><span>Loading library…</span></div>`;
  }

  _showError(msg) {
    if (!this._root) return;
    const body = this._root.querySelector('#lib-gallery-body');
    if (body) body.innerHTML = `<div class="img-gallery-empty"><p class="img-gallery-empty-title" style="color:var(--red, #ef4444);">⚠ ${msg}</p></div>`;
  }

  _openLightbox(idx) {
    if (!this._root) return;
    this._lightboxIdx = idx;
    this._syncLightbox();
    this._root.querySelector('#lib-lightbox')?.classList.remove('hidden');
  }

  _closeLightbox() {
    if (!this._root) return;
    this._root.querySelector('#lib-lightbox')?.classList.add('hidden');
    this._lightboxIdx = -1;
  }

  _syncLightbox() {
    if (!this._root) return;
    const it = this._filtered[this._lightboxIdx];
    if (!it) return;
    const imgEl = this._root.querySelector('#lib-lightbox-img');
    if (imgEl) { imgEl.src = it.render_url; imgEl.alt = it.name; }
  }

  _downloadItem(it) {
    const a = document.createElement('a');
    a.href = it.download_url || it.render_url;
    a.download = it.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this._showToast('Download', `Downloading ${it.name}`, 1500);
  }

  _downloadBatch(items) {
    if (!items || items.length === 0) return;
    this._showToast('Download', `Starting download for ${items.length} item(s)...`, 2000);
    items.forEach((it, index) => {
      setTimeout(() => this._downloadItem(it), index * 200);
    });
  }

  _escHtml(str) { return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  destroy() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._unsubAudio) {
      this._unsubAudio();
      this._unsubAudio = null;
    }
    this._mounted = false;
  }
}
