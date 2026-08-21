/* === chat/dialogs.js — Custom Modal Dialogs === */

/**
 * Reusable Custom Modal Confirmation Dialog
 * Returns a Promise resolving to true (confirm) or false (cancel)
 */
export function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-dialog-modal');
    const titleEl = document.getElementById('custom-dialog-title');
    const msgEl = document.getElementById('custom-dialog-message');
    const inputContainer = document.getElementById('custom-dialog-input-container');
    const btnCancel = document.getElementById('custom-dialog-cancel');
    const btnConfirm = document.getElementById('custom-dialog-confirm');
    const btnClose = document.getElementById('custom-dialog-close');

    if (!modal) { resolve(confirm(message)); return; }

    titleEl.textContent = title;
    msgEl.textContent = message;
    inputContainer.classList.add('hidden');

    const cleanUp = (result) => {
      modal.classList.add('hidden');
      btnConfirm.replaceWith(btnConfirm.cloneNode(true));
      btnCancel.replaceWith(btnCancel.cloneNode(true));
      if (btnClose) btnClose.replaceWith(btnClose.cloneNode(true));
      resolve(result);
    };

    const newConfirmBtn = document.getElementById('custom-dialog-confirm');
    const newCancelBtn = document.getElementById('custom-dialog-cancel');
    const newCloseBtn = document.getElementById('custom-dialog-close');

    newConfirmBtn.addEventListener('click', () => cleanUp(true));
    newCancelBtn.addEventListener('click', () => cleanUp(false));
    if (newCloseBtn) newCloseBtn.addEventListener('click', () => cleanUp(false));

    modal.classList.remove('hidden');
  });
}

/**
 * Reusable Custom Modal Prompt Dialog
 * Returns a Promise resolving to string (input value) or null (cancelled)
 */
export function showCustomPrompt(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-dialog-modal');
    const titleEl = document.getElementById('custom-dialog-title');
    const msgEl = document.getElementById('custom-dialog-message');
    const inputContainer = document.getElementById('custom-dialog-input-container');
    const inputEl = document.getElementById('custom-dialog-input');
    const btnCancel = document.getElementById('custom-dialog-cancel');
    const btnConfirm = document.getElementById('custom-dialog-confirm');
    const btnClose = document.getElementById('custom-dialog-close');

    if (!modal) { resolve(prompt(message, defaultValue)); return; }

    titleEl.textContent = title;
    msgEl.textContent = message;
    inputContainer.classList.remove('hidden');
    inputEl.value = defaultValue;

    setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);

    const cleanUp = (confirmed) => {
      const val = confirmed ? inputEl.value : null;
      modal.classList.add('hidden');
      btnConfirm.replaceWith(btnConfirm.cloneNode(true));
      btnCancel.replaceWith(btnCancel.cloneNode(true));
      if (btnClose) btnClose.replaceWith(btnClose.cloneNode(true));
      resolve(val);
    };

    const newConfirmBtn = document.getElementById('custom-dialog-confirm');
    const newCancelBtn = document.getElementById('custom-dialog-cancel');
    const newCloseBtn = document.getElementById('custom-dialog-close');

    newConfirmBtn.addEventListener('click', () => cleanUp(true));
    newCancelBtn.addEventListener('click', () => cleanUp(false));
    if (newCloseBtn) newCloseBtn.addEventListener('click', () => cleanUp(false));

    inputEl.onkeydown = (event) => {
      if (event.key === 'Enter') { cleanUp(true); }
      else if (event.key === 'Escape') { cleanUp(false); }
    };

    modal.classList.remove('hidden');
  });
}

/**
 * Reusable Custom Modal Alert / Warning Dialog (e.g. for Upload Limit Exceeded)
 * Returns a Promise resolving when user clicks 'Got it' or closes dialog.
 */
export function showCustomAlert(title, message, items = []) {
  return new Promise((resolve) => {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const modal = document.getElementById('custom-dialog-modal');
    if (!modal) {
      alert(message + (items.length ? '\n\n• ' + items.join('\n• ') : ''));
      resolve();
      return;
    }

    const titleEl = document.getElementById('custom-dialog-title');
    const msgEl = document.getElementById('custom-dialog-message');
    const inputContainer = document.getElementById('custom-dialog-input-container');
    const btnCancel = document.getElementById('custom-dialog-cancel');
    const btnConfirm = document.getElementById('custom-dialog-confirm');
    const btnClose = document.getElementById('custom-dialog-close');

    let itemsHtml = '';
    if (Array.isArray(items) && items.length > 0) {
      itemsHtml = `
        <div style="margin-top: 10px; padding: 8px 12px; border-radius: 8px; background: var(--input-bg); font-family: var(--font); font-size: 12.5px; color: var(--text-2); display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto;">
          ${items.map(it => `<div style="display:flex; align-items:center; gap:6px; word-break:break-all;"><span style="color:#ef4444; font-weight:600;">•</span> <span>${esc(it)}</span></div>`).join('')}
        </div>
      `;
    }

    titleEl.textContent = title || 'Notice';
    msgEl.innerHTML = `<div>${esc(message)}</div>${itemsHtml}`;
    inputContainer.classList.add('hidden');
    if (btnCancel) btnCancel.style.display = 'none';
    if (btnConfirm) btnConfirm.textContent = 'Got it';

    const cleanUp = () => {
      modal.classList.add('hidden');
      msgEl.innerHTML = '';
      if (btnCancel) btnCancel.style.display = 'inline-flex';
      if (btnConfirm) btnConfirm.textContent = 'Confirm';
      btnConfirm.replaceWith(btnConfirm.cloneNode(true));
      if (btnCancel) btnCancel.replaceWith(btnCancel.cloneNode(true));
      if (btnClose) btnClose.replaceWith(btnClose.cloneNode(true));
      resolve();
    };

    const newConfirmBtn = document.getElementById('custom-dialog-confirm');
    const newCloseBtn = document.getElementById('custom-dialog-close');

    if (newConfirmBtn) newConfirmBtn.addEventListener('click', cleanUp);
    if (newCloseBtn) newCloseBtn.addEventListener('click', cleanUp);

    modal.classList.remove('hidden');
  });
}

/**
 * Full-Screen Image Lightbox Popup Modal
 * Displays image in clean dark backdrop overlay with floating action tools ON the image:
 * [Download] [Copy Link] [Open External] [Toggle Zoom] [Close]
 */
export function openImageLightbox(src, redirectUrl = '') {
  const modal = document.getElementById('image-lightbox-modal');
  const imgEl = document.getElementById('lightbox-img');
  const btnDownload = document.getElementById('lightbox-btn-download');
  const btnCopy = document.getElementById('lightbox-btn-copy');
  const btnExternal = document.getElementById('lightbox-btn-external');
  const btnZoom = document.getElementById('lightbox-btn-zoom');
  const btnClose = document.getElementById('lightbox-btn-close');

  if (!modal || !imgEl) {
    window.open(redirectUrl || src, '_blank');
    return;
  }

  const finalRedirect = redirectUrl || src;
  imgEl.src = src;
  imgEl.style.transform = 'scale(1)';
  imgEl.style.cursor = 'zoom-in';
  if (btnExternal) btnExternal.href = finalRedirect;

  let isZoomed = false;

  const closeLightbox = () => {
    modal.classList.add('hidden');
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeLightbox();
  };

  document.addEventListener('keydown', onKeyDown);

  modal.onclick = (e) => {
    if (e.target === modal || e.target.classList.contains('lightbox-container') || e.target.classList.contains('lightbox-img-wrapper')) {
      closeLightbox();
    }
  };

  if (btnClose) btnClose.onclick = (e) => { e.stopPropagation(); closeLightbox(); };

  if (btnZoom) {
    btnZoom.onclick = (e) => {
      e.stopPropagation();
      isZoomed = !isZoomed;
      imgEl.style.transform = isZoomed ? 'scale(1.75)' : 'scale(1)';
      imgEl.style.cursor = isZoomed ? 'zoom-out' : 'zoom-in';
      btnZoom.title = isZoomed ? 'Zoom Out' : 'Zoom In';
    };
  }

  imgEl.onclick = (e) => {
    e.stopPropagation();
    isZoomed = !isZoomed;
    imgEl.style.transform = isZoomed ? 'scale(1.75)' : 'scale(1)';
    imgEl.style.cursor = isZoomed ? 'zoom-out' : 'zoom-in';
  };

  if (btnCopy) {
    btnCopy.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(finalRedirect).then(() => {
        const icon = btnCopy.querySelector('i');
        if (icon) {
          icon.setAttribute('data-lucide', 'check');
          if (window.lucide) lucide.createIcons({ parent: btnCopy });
          setTimeout(() => {
            icon.setAttribute('data-lucide', 'copy');
            if (window.lucide) lucide.createIcons({ parent: btnCopy });
          }, 3000);
        }
      }).catch(err => console.warn('Clipboard write failed:', err));
    };
  }

  if (btnDownload) {
    btnDownload.onclick = (e) => {
      e.stopPropagation();
      const filename = finalRedirect.split('/').pop().split('?')[0] || 'image.jpg';
      fetch(src)
        .then(res => res.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(blobUrl);
        })
        .catch(() => {
          window.open(src, '_blank');
        });
    };
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons({ parent: modal });
}

