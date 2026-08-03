/* === chat/media.js — Rich Media Preview System (YouTube, Images, Grid) === */

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

  const card = document.createElement('div');
  card.className = 'yt-preview-card';
  card.innerHTML = `
    <div class="yt-thumb-wrap" style="position:relative; width:100%; cursor:pointer; border-radius:10px; overflow:hidden; background:#000;">
      <img src="${thumbUrl}" loading="lazy" style="width:100%; height:130px; object-fit:cover; display:block; border-radius:10px; opacity:0.92;" />
      <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none;">
        <div style="width:38px; height:38px; background:rgba(255,0,0,0.88); border-radius:50%; display:flex; align-items:center; justify-content:center;">
          <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#fff;margin-left:2px"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); color:#fff; width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; text-decoration:none; z-index:5;" title="Open on YouTube">
        <i data-lucide="external-link" style="width:11px; height:11px;"></i>
      </a>
    </div>
  `;

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

  const card = document.createElement('div');
  card.className = 'chat-image-preview-card';
  card.innerHTML = `
    <div class="img-preview-box" style="position:relative; width:100%; border-radius:10px; overflow:hidden; cursor:pointer; background:var(--hover);">
      <img src="${srcUrl}" loading="lazy" style="width:100%; height:130px; object-fit:cover; display:block; border-radius:10px;" />
      <a href="${href}" target="_blank" rel="noopener noreferrer" class="img-redirect-btn" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); color:#fff; width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; text-decoration:none; z-index:5;" title="Open source">
        <i data-lucide="external-link" style="width:11px; height:11px;"></i>
      </a>
    </div>
  `;

  const imgEl = card.querySelector('img');
  imgEl.addEventListener('click', (e) => { e.stopPropagation(); window.open(href, '_blank'); });
  imgEl.onerror = () => {
    // Show fallback placeholder instead of hiding the card entirely
    const box = card.querySelector('.img-preview-box');
    if (box) {
      box.innerHTML = `
        <div style="width:100%; height:130px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; background:var(--hover); border-radius:10px; color:var(--text-3); font-size:11px;">
          <i data-lucide="image-off" style="width:20px;height:20px;opacity:0.4;"></i>
          <span style="opacity:0.5;">Preview unavailable</span>
        </div>
        <a href="${href}" target="_blank" rel="noopener noreferrer" class="img-redirect-btn" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); color:#fff; width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; text-decoration:none; z-index:5;" title="Open source">
          <i data-lucide="external-link" style="width:11px; height:11px;"></i>
        </a>
      `;
      if (window.lucide) lucide.createIcons({ parent: box });
    }
  };

  if (a.parentNode) {
    a.parentNode.replaceChild(card, a);
  }
  if (window.lucide) lucide.createIcons({ parent: card });
}

/** Post-pass: Group ONLY Visual Media Cards (Photos & YouTube Videos) in 1 single horizontal row (max 4 cards) */
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

    let grid = msgEl.querySelector('.media-preview-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'media-preview-grid';

      // POSITIONING: Place in the middle — BEFORE table or BEFORE tip/callout or after intro paragraph
      const table = msgEl.querySelector('table') || msgEl.querySelector('.table-wrapper');
      const tipCallout = msgEl.querySelector('.chat-callout') || msgEl.querySelector('blockquote');

      if (table) {
        const target = table.closest('.table-wrapper') || table.closest('div') || table;
        target.parentNode.insertBefore(grid, target);
      } else if (tipCallout) {
        tipCallout.parentNode.insertBefore(grid, tipCallout);
      } else {
        const firstP = msgEl.querySelector('p, ul, ol');
        if (firstP && firstP.nextSibling) {
          firstP.parentNode.insertBefore(grid, firstP.nextSibling);
        } else {
          msgEl.appendChild(grid);
        }
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

  // 1. Convert markdown inline images (![alt](url)) rendered as <img> tags into flat image cards
  container.querySelectorAll('img').forEach(img => {
    if (img.dataset.hasPreview || img.closest('.chat-image-preview-card') || img.closest('.yt-preview-card')) return;
    let src = img.getAttribute('src') || '';
    if (!src) return;

    // Fix file:/// paths
    if (src.startsWith('file:///')) {
      src = `/api/workspace/render?path=${encodeURIComponent(decodeURIComponent(src.replace('file:///', '')))}`;
    }

    // Only process external http images (not UI icons)
    if (!src.startsWith('http') && !src.startsWith('/api/')) return;

    img.dataset.hasPreview = 'img';

    const targetUrl = img.closest('a')?.getAttribute('href') || src;
    const card = document.createElement('div');
    card.className = 'chat-image-preview-card';
    card.innerHTML = `
      <div class="img-preview-box" style="position:relative; width:100%; border-radius:10px; overflow:hidden; cursor:pointer; background:var(--hover);">
        <img src="${src}" loading="lazy" style="width:100%; height:130px; object-fit:cover; display:block; border-radius:10px;" />
        <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="img-redirect-btn" style="position:absolute; bottom:6px; right:6px; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); color:#fff; width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; text-decoration:none; z-index:5;" title="Open source">
          <i data-lucide="external-link" style="width:11px; height:11px;"></i>
        </a>
      </div>
    `;

    const newImg = card.querySelector('img');
    newImg.addEventListener('click', (e) => { e.stopPropagation(); window.open(targetUrl, '_blank'); });
    newImg.onerror = () => {
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
    };

    // Replace the img's closest block parent (p tag usually)
    const parent = img.closest('p') || img.parentNode;
    if (parent && parent.parentNode && parent !== container) {
      parent.parentNode.replaceChild(card, parent);
    } else if (img.parentNode) {
      img.parentNode.replaceChild(card, img);
    }
    if (window.lucide) lucide.createIcons({ parent: card });
  });

  // 2. Scan all links for YouTube and image URLs
  const links = container.querySelectorAll('a[href]');
  links.forEach(a => {
    const href = a.getAttribute('href');
    if (!href || a.dataset.hasPreview) return;

    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
    if (a.closest('table') || a.closest('.table-wrapper') || a.closest('h1,h2,h3,h4,h5,h6')) return;
    if (a.closest('.chat-image-preview-card') || a.closest('.yt-preview-card')) return;

    const ytId = _getYoutubeId(href);
    if (ytId) { _renderYoutubeCard(a, ytId); return; }

    let srcUrl = href;
    if (href.startsWith('file:///')) {
      const decoded = decodeURIComponent(href.replace('file:///', ''));
      if (!decoded.match(/\.(jpeg|jpg|gif|png|webp|svg)(?:\?.*)?$/i)) return;
      srcUrl = `/api/workspace/render?path=${encodeURIComponent(decoded)}`;
    }

    if (srcUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)(?:\?.*)?$/i) ||
        srcUrl.includes('images.unsplash.com/') ||
        srcUrl.includes('imgur.com/') ||
        srcUrl.includes('media.giphy.com/') ||
        srcUrl.includes('upload.wikimedia.org/')) {
      _renderImageCard(a, srcUrl, href);
      return;
    }
  });

  // 3. Group all visual media cards into grid
  groupPreviewCardsIntoGrid(container);
}
