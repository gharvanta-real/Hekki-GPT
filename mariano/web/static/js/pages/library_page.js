import {
  renderCardContent,
  renderLightboxHtml,
  renderConfirmModalHtml,
  renderCategoryTabsHtml,
  renderEmptyStateHtml,
  getDateCategory,
  SVG_ICONS
} from './library_cards.js';

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
    if (this._root === container && this._mounted) {
      this.refresh();
      return;
    }
    this.destroy();
    this._root = container;
    this._mounted = true;
    this._render();
    this._load();

    if (window.globalAudioPlayer) {
      this._unsubAudio = window.globalAudioPlayer.on('*', ({ event, currentUrl, isPlaying }) => {
        if (event === 'timeupdate' || event === 'speed') return;
        if (this._mounted && this._root) {
          this._updatePlayingCardUI(currentUrl, isPlaying);
        }
      });
    }
  }

  refresh() {
    if (this._mounted && this._root) this._load();
  }

  async _load() {
    this._showLoading();
    let data;
    try {
      const res = await fetch(`/api/library?category=${encodeURIComponent(this._currentCategory)}`);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error('Library fetch error:', err);
      this._showError('Failed to load library items. Is the server running?');
      return;
    }

    try {
      this._items = data.items || [];
      this._counts = data.counts || this._counts;
      this._applyFilter();
      this._renderGrid();
    } catch (renderErr) {
      console.error('Library render error:', renderErr);
      this._showError(`Error displaying library: ${renderErr.message}`);
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
      ${renderLightboxHtml()}
      ${renderConfirmModalHtml()}
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

    const categoryTabsHtml = renderCategoryTabsHtml(categories, this._currentCategory);

    if (this._filtered.length === 0) {
      body.innerHTML = renderEmptyStateHtml(categoryTabsHtml);
      this._bindCategoryTabs(body);
      if (window.lucide) lucide.createIcons({ parent: body });
      return;
    }

    const groups = new Map();
    this._filtered.forEach((it, idx) => {
      const category = getDateCategory(it.modified_iso);
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
    if (body) {
      body.innerHTML = `
        <div class="img-gallery-empty">
          <p class="img-gallery-empty-title" style="color:var(--red, #ef4444);">⚠ ${this._escHtml(msg)}</p>
          <button id="lib-retry-load-btn" style="margin-top:12px; padding:6px 18px; border-radius:14px; background:var(--input-bg); border:1px solid var(--border); color:var(--text); cursor:pointer; font-size:12.5px;">Retry</button>
        </div>
      `;
      body.querySelector('#lib-retry-load-btn')?.addEventListener('click', () => this._load());
    }
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

  _updatePlayingCardUI(currentUrl, isPlaying) {
    if (!this._root) return;
    const cards = this._root.querySelectorAll('.img-gallery-card');
    cards.forEach(card => {
      const idx = parseInt(card.dataset.idx, 10);
      const it = this._filtered[idx];
      if (!it || it.type !== 'voice') return;

      const cardIsThisTrack = it.render_url === currentUrl;
      const cardPlaying = cardIsThisTrack && isPlaying;

      const iconBox = card.querySelector('.lib-icon-box');
      const playBtn = card.querySelector('.img-play-btn');

      if (iconBox) {
        iconBox.innerHTML = cardPlaying ? `
          <div class="lib-equalizer">
            <span class="lib-eq-bar"></span>
            <span class="lib-eq-bar"></span>
            <span class="lib-eq-bar"></span>
            <span class="lib-eq-bar"></span>
          </div>
        ` : SVG_ICONS.voice;
        iconBox.style.background = cardPlaying ? 'var(--hover)' : 'var(--input-bg)';
      }

      if (playBtn) {
        playBtn.className = `img-card-btn img-play-btn ${cardPlaying ? 'playing' : ''}`;
        playBtn.title = cardPlaying ? 'Pause Audio' : 'Play Audio';
        playBtn.style.background = cardPlaying ? 'var(--hover)' : 'var(--input-bg)';
        playBtn.innerHTML = cardPlaying ? `
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ` : `
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        `;
      }
    });
  }

  destroy() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this._unsubAudio) {
      this._unsubAudio();
      this._unsubAudio = null;
    }
    this._mounted = false;
  }
}
