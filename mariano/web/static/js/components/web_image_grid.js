/**
 * web_image_grid.js — ChatGPT-style web image grid + full-screen lightbox
 * Renders a 3-column image grid from web_search results and opens a
 * full-screen lightbox with navigation, counter, and source attribution.
 */

/* ─── Public API ──────────────────────────────────────────────────────────── */

/**
 * Render a 3-column image grid card and append it to `container`.
 * @param {Array<{url,title,source,favicon,source_url}>} images
 * @param {HTMLElement} container  — the chat column element
 * @returns {HTMLElement}  the created grid element
 */
export function renderWebImageGrid(images, container) {
  if (!images || images.length === 0) return null;

  const grid = document.createElement('div');
  grid.className = 'web-image-grid';
  grid.dataset.images = JSON.stringify(images);

  images.forEach((img, idx) => {
    const thumb = document.createElement('div');
    thumb.className = 'web-image-thumb';
    thumb.title = img.title || img.source || '';

    const imgEl = document.createElement('img');
    imgEl.src = img.url;
    imgEl.alt = img.title || 'Image';
    imgEl.loading = 'lazy';
    imgEl.draggable = false;

    // Error: hide broken images
    imgEl.onerror = () => { thumb.style.display = 'none'; };

    thumb.appendChild(imgEl);
    thumb.addEventListener('click', () => openImageLightbox(images, idx));
    grid.appendChild(thumb);
  });

  // Count badge on last visible thumb (like ChatGPT "+N more")
  if (images.length > 3) {
    const lastThumb = grid.querySelectorAll('.web-image-thumb')[2];
    if (lastThumb) {
      const badge = document.createElement('div');
      badge.className = 'web-image-more-badge';
      badge.textContent = `+${images.length - 3}`;
      lastThumb.appendChild(badge);
    }
  }

  container.appendChild(grid);
  return grid;
}

/* ─── Lightbox ────────────────────────────────────────────────────────────── */

let _lightboxEl = null;
let _currentImages = [];
let _currentIndex = 0;

/**
 * Open the full-screen image lightbox at the given index.
 * @param {Array} images
 * @param {number} startIndex
 */
export function openImageLightbox(images, startIndex = 0) {
  _currentImages = images;
  _currentIndex = startIndex;

  // Remove any existing lightbox
  if (_lightboxEl) _lightboxEl.remove();

  _lightboxEl = document.createElement('div');
  _lightboxEl.className = 'web-lightbox-overlay';
  _lightboxEl.id = 'web-lightbox';

  _lightboxEl.innerHTML = `
    <div class="web-lightbox-close" id="lb-close" title="Close">✕</div>
    <div class="web-lightbox-counter" id="lb-counter"></div>

    <div class="web-lightbox-body">
      <button class="web-lightbox-nav web-lightbox-prev" id="lb-prev" title="Previous">
        <i data-lucide="chevron-left" style="width:24px;height:24px;"></i>
      </button>

      <div class="web-lightbox-main">
        <img class="web-lightbox-img" id="lb-img" src="" alt="" draggable="false" />
      </div>

      <button class="web-lightbox-nav web-lightbox-next" id="lb-next" title="Next">
        <i data-lucide="chevron-right" style="width:24px;height:24px;"></i>
      </button>
    </div>

    <div class="web-lightbox-filmstrip" id="lb-filmstrip"></div>

    <div class="web-lightbox-source-bar" id="lb-source">
      <img class="lb-favicon" id="lb-favicon" src="" alt="" />
      <span class="lb-source-title" id="lb-source-title"></span>
      <a class="lb-source-link" id="lb-source-link" href="#" target="_blank" rel="noopener noreferrer">
        <i data-lucide="external-link" style="width:12px;height:12px;"></i>
        Visit site
      </a>
    </div>
  `;

  document.body.appendChild(_lightboxEl);
  _buildFilmstrip();
  _showFrame(_currentIndex);

  // Event listeners
  _lightboxEl.querySelector('#lb-close').addEventListener('click', closeLightbox);
  _lightboxEl.querySelector('#lb-prev').addEventListener('click', (e) => { e.stopPropagation(); _navigate(-1); });
  _lightboxEl.querySelector('#lb-next').addEventListener('click', (e) => { e.stopPropagation(); _navigate(1); });

  // Click outside main image → close
  _lightboxEl.addEventListener('click', (e) => {
    if (e.target === _lightboxEl) closeLightbox();
  });

  // Keyboard navigation
  document.addEventListener('keydown', _onKeyDown);

  // Touch swipe support
  _attachSwipe(_lightboxEl);

  // Animate in
  requestAnimationFrame(() => _lightboxEl.classList.add('web-lightbox-visible'));
}

export function closeLightbox() {
  if (!_lightboxEl) return;
  document.removeEventListener('keydown', _onKeyDown);
  _lightboxEl.classList.remove('web-lightbox-visible');
  setTimeout(() => {
    if (_lightboxEl) { _lightboxEl.remove(); _lightboxEl = null; }
  }, 220);
}

/* ─── Internal helpers ────────────────────────────────────────────────────── */

function _navigate(delta) {
  _currentIndex = (_currentIndex + delta + _currentImages.length) % _currentImages.length;
  _showFrame(_currentIndex);
}

function _showFrame(idx) {
  const img  = _currentImages[idx];
  const lbImg = document.getElementById('lb-img');
  const counter = document.getElementById('lb-counter');
  const favicon = document.getElementById('lb-favicon');
  const sourceTitle = document.getElementById('lb-source-title');
  const sourceLink = document.getElementById('lb-source-link');

  if (!lbImg) return;

  // Fade transition
  lbImg.style.opacity = '0';
  lbImg.onload = () => { lbImg.style.opacity = '1'; };
  lbImg.onerror = () => { lbImg.src = ''; lbImg.style.opacity = '0.3'; };
  lbImg.src = img.url;
  lbImg.alt = img.title || '';

  counter.textContent = `${idx + 1} / ${_currentImages.length}`;

  // Source bar
  if (img.favicon) {
    favicon.src = img.favicon;
    favicon.style.display = 'block';
  } else {
    favicon.style.display = 'none';
  }

  sourceTitle.textContent = img.title
    ? (img.title.length > 70 ? img.title.slice(0, 70) + '…' : img.title)
    : (img.source || '');

  if (img.source_url) {
    sourceLink.href = img.source_url;
    sourceLink.style.display = 'flex';
  } else {
    sourceLink.style.display = 'none';
  }

  // Show/hide nav buttons
  const prevBtn = document.getElementById('lb-prev');
  const nextBtn = document.getElementById('lb-next');
  if (prevBtn) prevBtn.style.opacity = _currentImages.length > 1 ? '1' : '0';
  if (nextBtn) nextBtn.style.opacity = _currentImages.length > 1 ? '1' : '0';

  // Highlight filmstrip
  _updateFilmstrip(idx);
}

function _buildFilmstrip() {
  const fs = document.getElementById('lb-filmstrip');
  if (!fs) return;
  fs.innerHTML = '';
  _currentImages.forEach((img, idx) => {
    const thumb = document.createElement('img');
    thumb.src = img.url;
    thumb.alt = '';
    thumb.className = 'lb-film-thumb';
    thumb.loading = 'lazy';
    thumb.draggable = false;
    thumb.onerror = () => { thumb.style.display = 'none'; };
    thumb.addEventListener('click', (e) => { e.stopPropagation(); _currentIndex = idx; _showFrame(idx); });
    fs.appendChild(thumb);
  });
}

function _updateFilmstrip(activeIdx) {
  const thumbs = document.querySelectorAll('.lb-film-thumb');
  thumbs.forEach((t, i) => {
    t.classList.toggle('lb-film-active', i === activeIdx);
  });
  // Auto-scroll filmstrip to keep active thumb visible
  if (thumbs[activeIdx]) {
    thumbs[activeIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function _onKeyDown(e) {
  if (e.key === 'ArrowLeft')  _navigate(-1);
  if (e.key === 'ArrowRight') _navigate(1);
  if (e.key === 'Escape')     closeLightbox();
}

function _attachSwipe(el) {
  let startX = 0;
  el.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) _navigate(dx < 0 ? 1 : -1);
  });
}
