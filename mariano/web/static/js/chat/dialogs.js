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
