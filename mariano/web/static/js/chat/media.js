/* === chat/media.js — Rich Media Preview System (YouTube, Images, Grid) === */
import { openImageLightbox } from './dialogs.js';

/** Extract YouTube video ID from any YouTube URL format */
function _getYoutubeId(url) {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Render YouTube thumbnail card for a link element */
function _renderYoutubeCard(a, videoId) {
  a.dataset.hasPreview = 'yt';
  const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const videoTitle = a.textContent.trim() || 'Watch on YouTube';

  const card = document.createElement('div');
  card.className = 'yt-preview-card';
  card.innerHTML = `
    <div class="yt-thumb-wrap" style="position:relative; width:100%; cursor:pointer; border-radius:10px; overflow:hidden; background:#0f0f11; min-height:110px;">
      <img src="${thumbUrl}" alt="${escapeHtmlLocal(videoTitle)}" loading="lazy" style="width:100%; height:130px; object-fit:cover; display:block; border-radius:10px; opacity:0.95;" />
      <div class="yt-play-overlay" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none;">
        <div style="width:38px; height:38px; background:rgba(255,0,0,0.9); border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.4);">
          <i data-lucide="play" style="width:16px;height:16px;color:#fff;margin-left:2px;"></i>
        </div>
      </div>
      <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); color:#fff; width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; text-decoration:none; z-index:5;" title="Open on YouTube">
        <i data-lucide="external-link" style="width:11px; height:11px;"></i>
      </a>
    </div>
  `;

  const imgEl = card.querySelector('img');
  // Detect YouTube 120x90 placeholder for non-existent / broken video IDs
  imgEl.addEventListener('load', () => {
    if (imgEl.naturalWidth === 120 && imgEl.naturalHeight === 90) {
      // Invalid / deleted video ID — convert to clean YouTube search fallback card
      const thumbWrap = card.querySelector('.yt-thumb-wrap');
      if (thumbWrap) {
        thumbWrap.style.background = 'var(--hover, #27272a)';
        thumbWrap.innerHTML = `
          <div style="padding:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32" fill="#ef4444"><path d="M29.41,9.26a3.5,3.5,0,0,0-2.47-2.47C24.76,6.2,16,6.2,16,6.2s-8.76,0-10.94.59A3.5,3.5,0,0,0,2.59,9.26,36.13,36.13,0,0,0,2,16a36.13,36.13,0,0,0,.59,6.74,3.5,3.5,0,0,0,2.47,2.47C7.24,25.8,16,25.8,16,25.8s8.76,0,10.94-.59a3.5,3.5,0,0,0,2.47-2.47A36.13,36.13,0,0,0,30,16,36.13,36.13,0,0,0,29.41,9.26ZM13,20.5V11.5L21,16Z"/></svg>
            <span style="font-size:12px; font-weight:500; color:var(--text);">${escapeHtmlLocal(videoTitle)}</span>
            <span style="font-size:10.5px; color:var(--text-3); opacity:0.8;">Search on YouTube &rarr;</span>
          </div>
        `;
      }
    }
  });

  const thumbWrap = card.querySelector('.yt-thumb-wrap');
  thumbWrap.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    window.open(watchUrl, '_blank');
  });

  if (a.parentNode) {
    a.parentNode.replaceChild(card, a);
  }
  if (window.lucide) lucide.createIcons({ parent: card });
}

/** Render flat image card for a link pointing to an image */
function _renderImageCard(a, srcUrl, href) {
  a.dataset.hasPreview = 'img';

  let displaySrc = srcUrl;
  if (srcUrl.startsWith('file://') || /^[a-zA-Z]:[\\\/]/.test(srcUrl)) {
    const cleanPath = srcUrl.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, '').replace(/\\/g, '/');
    displaySrc = `/api/workspace/render?path=${encodeURIComponent(cleanPath)}`;
  } else if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
    displaySrc = `/api/image-proxy?url=${encodeURIComponent(srcUrl)}`;
  }

  const altText = a.textContent.trim() || a.getAttribute('title') || 'Image';
  const card = document.createElement('div');
  card.className = 'chat-image-preview-card';
  card.innerHTML = `
    <div class="img-preview-box" style="position:relative; width:100%; border-radius:10px; overflow:hidden; cursor:pointer; background:var(--hover);">
      <img src="${displaySrc}" alt="${escapeHtmlLocal(altText)}" loading="lazy" style="width:100%; height:130px; object-fit:cover; display:block; border-radius:10px;" />
      <a href="${href}" target="_blank" rel="noopener noreferrer" class="img-redirect-btn" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); color:#fff; width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; text-decoration:none; z-index:5;" title="Open source">
        <i data-lucide="external-link" style="width:11px; height:11px;"></i>
      </a>
    </div>
  `;

  const imgEl = card.querySelector('img');
  imgEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openImageLightbox(imgEl.src || displaySrc, href);
  });

  imgEl.onerror = () => {
    // 1. Try direct raw src without proxy first if proxied
    if (!imgEl.dataset.tryRaw && displaySrc.includes('/api/image-proxy')) {
      imgEl.dataset.tryRaw = 'true';
      imgEl.src = srcUrl;
      return;
    }

    // 2. Attempt OpenGraph og:image extraction via /api/link-preview
    if (!imgEl.dataset.ogAttempted && href && href.startsWith('http')) {
      imgEl.dataset.ogAttempted = 'true';
      fetch(`/api/link-preview?url=${encodeURIComponent(href)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.image) {
            imgEl.src = data.image.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(data.image)}` : data.image;
          } else {
            _trySearchImagesFallback(card, altText, href);
          }
        })
        .catch(() => _trySearchImagesFallback(card, altText, href));
      return;
    }

    _trySearchImagesFallback(card, altText, href);
  };

  if (a.parentNode) {
    a.parentNode.replaceChild(card, a);
  }
  if (window.lucide) lucide.createIcons({ parent: card });
}

function escapeHtmlLocal(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** Try search-images API before falling back to empty card placeholder */
function _trySearchImagesFallback(card, queryText, targetUrl) {
  const imgEl = card.querySelector('img');
  if (imgEl && !imgEl.dataset.searchAttempted && queryText && queryText.length > 2 && queryText !== 'Image') {
    imgEl.dataset.searchAttempted = 'true';
    fetch(`/api/search-images?q=${encodeURIComponent(queryText)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.images && data.images.length > 0) {
          imgEl.src = data.images[0];
        } else {
          _showCardFallback(card, targetUrl);
        }
      })
      .catch(() => _showCardFallback(card, targetUrl));
    return;
  }
  _showCardFallback(card, targetUrl);
}

/** Helper to render clean fallback box when image load fails completely */
function _showCardFallback(card, targetUrl) {
  const box = card.querySelector('.img-preview-box');
  if (box) {
    box.innerHTML = `
      <div style="width:100%; height:130px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; background:var(--hover); border-radius:10px; color:var(--text-3); font-size:11px;">
        <i data-lucide="image-off" style="width:20px;height:20px;opacity:0.4;"></i>
        <span style="opacity:0.5;">Preview unavailable</span>
      </div>
      <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="img-redirect-btn" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); color:#fff; width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; text-decoration:none; z-index:5;" title="Open source">
        <i data-lucide="external-link" style="width:11px; height:11px;"></i>
      </a>
    `;
    if (window.lucide) lucide.createIcons({ parent: box });
  }
}

/** Post-pass: Group ONLY Visual Media Cards (Photos & YouTube Videos) in 1 single horizontal row (max 4 cards)
 *  PLACEMENT RULE: Always after the first <p> (intro text), before lists/tables/summary.
 *  Layout result: Intro text → [MEDIA GRID] → Body content → Tip (at bottom)
 */
export function groupPreviewCardsIntoGrid(container) {
  const cards = Array.from(container.querySelectorAll('.yt-preview-card, .chat-image-preview-card'))
    .filter(c => !c.closest('.media-preview-grid'));
  if (cards.length === 0) return;

  const msgBubbles = new Map();
  cards.forEach(card => {
    const msgEl = card.closest('.msg') || card.closest('.chat-col') || container;
    if (!msgBubbles.has(msgEl)) msgBubbles.set(msgEl, []);
    msgBubbles.get(msgEl).push(card);
  });

  msgBubbles.forEach((cardList, msgEl) => {
    if (cardList.length === 0) return;

    // Reuse existing grid if already placed
    let grid = msgEl.querySelector('.media-preview-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'media-preview-grid';

      // PLACEMENT: After first <p> intro text. If none, insert at top of message.
      // This gives: Intro paragraph → GRID → body (lists/tables/headings) → tip (bottom)
      const allChildren = Array.from(msgEl.children);

      // Find the first real text paragraph (not headings, not callouts, not already-placed cards)
      const firstP = allChildren.find(el =>
        el.tagName === 'P' &&
        !el.closest('.chat-callout') &&
        !el.closest('.media-preview-grid') &&
        el.textContent.trim().length > 0
      );

      if (firstP && firstP.nextSibling) {
        // Insert AFTER the first intro paragraph
        msgEl.insertBefore(grid, firstP.nextSibling);
      } else if (firstP) {
        // First paragraph is the last child — append after it
        msgEl.appendChild(grid);
      } else {
        // No paragraphs at all — put grid at the very top
        msgEl.insertBefore(grid, msgEl.firstChild);
      }
    }

    // STRICT LIMIT: Max 4 visual media cards in 1 single horizontal grid row per message
    cardList.slice(0, 4).forEach(card => grid.appendChild(card));
  });
}


/** Post-pass: Move Tip callouts to the VERY LAST/BOTTOM of the message bubble */
export function moveTipsToBottom(container) {
  if (!container) return;

  const callouts = Array.from(container.querySelectorAll('.chat-callout, blockquote'));
  callouts.forEach(card => {
    const text = card.textContent.trim();
    if (text.includes('Tip:') || card.classList.contains('callout-tip')) {
      const msgEl = card.closest('.msg') || card.closest('.chat-col') || container;
      msgEl.appendChild(card);
    }
  });

  const ps = Array.from(container.querySelectorAll('p')).filter(p => !p.closest('.chat-callout'));
  ps.forEach(p => {
    const text = p.textContent.trim();
    if (text.startsWith('💡 Tip:') || text.startsWith('Tip:')) {
      const msgEl = p.closest('.msg') || p.closest('.chat-col') || container;
      msgEl.appendChild(p);
    }
  });
}

/** Main: scan container and enhance visual media (photos & videos) with rich previews */
export function enhanceImagePreviews(container) {
  if (!container) return;

  // Convert local file:/// or absolute paths on <img> tags to HTTP /api/workspace/render endpoint
  container.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('file://') || /^[a-zA-Z]:[\\\/]/.test(src)) {
      const cleanPath = src.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, '').replace(/\\/g, '/');
      img.src = `/api/workspace/render?path=${encodeURIComponent(cleanPath)}`;
    }
  });

  // Convert local file:/// links on <a> tags
  container.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('file://') || /^[a-zA-Z]:[\\\/]/.test(href)) {
      const cleanPath = href.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, '').replace(/\\/g, '/');
      const httpUrl = `/api/workspace/render?path=${encodeURIComponent(cleanPath)}`;
      a.href = httpUrl;
      
      // If link is an image, convert to image preview card!
      if (/\.(png|jpg|jpeg|webp|gif)$/i.test(cleanPath) && !a.dataset.hasPreview) {
        _renderImageCard(a, httpUrl, httpUrl);
      }
    }
  });

  // ── Reference images from AI are BLOCKED (user preference) ──────────────
  // Hide all inline <img> tags rendered from AI markdown (not user-uploaded or generated cards)
  container.querySelectorAll('img').forEach(img => {
    if (img.closest('.chat-image-preview-card') || img.closest('.yt-preview-card') || img.closest('.image-generation-card') || img.closest('.chat-image-generating-card')) return;
    if (img.closest('.msg.user')) return; // Keep user-uploaded images
    // Remove the wrapping <p> or the img itself
    const parent = img.closest('p') || img.parentNode;
    if (parent && parent.parentNode && parent !== container) {
      parent.remove();
    } else if (img.parentNode) {
      img.remove();
    }
  });

  // 2. Scan all links — render YouTube cards or local image cards
  const links = container.querySelectorAll('a[href]');
  links.forEach(a => {
    const href = a.getAttribute('href');
    if (!href || a.dataset.hasPreview) return;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
    if (a.closest('table') || a.closest('.table-wrapper') || a.closest('h1,h2,h3,h4,h5,h6')) return;
    if (a.closest('.chat-image-preview-card') || a.closest('.yt-preview-card')) return;

    // YouTube only ✅
    const ytId = _getYoutubeId(href);
    if (ytId) { _renderYoutubeCard(a, ytId); return; }

    // All other image link renders are BLOCKED ❌
  });

  // 3. Group visual media cards into grid (only YT cards now)
  groupPreviewCardsIntoGrid(container);
}
