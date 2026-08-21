/**
 * coder_modals.js — Workspace setup dialogs, folder picker, and project initialization
 */
import { setCoderStreamContext } from './coder_stream_core.js';
import { setActiveProject } from './coder_sidebar.js';

export function openCoderWorkspacePopup() {
  document.getElementById('coder-workspace-popup')?.classList.remove('hidden');
  document.getElementById('coder-popup-step-choose')?.classList.remove('hidden');
  document.getElementById('coder-popup-step-new')?.classList.add('hidden');
  document.getElementById('coder-popup-step-existing')?.classList.add('hidden');
}

export function closeCoderWorkspacePopup() {
  document.getElementById('coder-workspace-popup')?.classList.add('hidden');
}

export function showPopupStep(step) {
  ['choose', 'new', 'existing'].forEach(s => {
    document.getElementById(`coder-popup-step-${s}`)?.classList.toggle('hidden', s !== step);
  });
}

export function activateProject(name, path, type, onCreateSessionCallback) {
  const activeProj = { name, path, type };
  setActiveProject(activeProj);
  closeCoderWorkspacePopup();

  const sidebarProjName = document.getElementById('coder-active-project-name');
  if (sidebarProjName) sidebarProjName.textContent = name;

  localStorage.setItem('hekki_coder_active_project', JSON.stringify(activeProj));
  localStorage.setItem('mariano_active_project', name);
  localStorage.setItem('mariano_active_project_path', path);

  document.getElementById('coder-welcome-screen')?.classList.add('hidden');
  document.getElementById('coder-chat-area')?.classList.remove('hidden');

  if (typeof onCreateSessionCallback === 'function') {
    onCreateSessionCallback('Session 1');
  }

  fetch('/api/workspace/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: name, project_path: path }),
  })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      if (data && data.project_path) {
        activeProj.path = data.project_path;
        setActiveProject(activeProj);
        localStorage.setItem('hekki_coder_active_project', JSON.stringify(activeProj));
        localStorage.setItem('mariano_active_project_path', data.project_path);
        setCoderStreamContext(name, data.project_path, localStorage.getItem('hekki_coder_active_conv_id'));
      }
    })
    .catch((err) => {
      console.error("[CoderPage] Failed to sync workspace with backend:", err);
    });
}

export function bindModalListeners(onCreateSession) {
  document.querySelectorAll('.coder-popup-back').forEach(btn =>
    btn.addEventListener('click', () => showPopupStep('choose'))
  );
  document.getElementById('coder-popup-close')?.addEventListener('click', closeCoderWorkspacePopup);
  document.getElementById('coder-workspace-popup')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCoderWorkspacePopup();
  });

  document.getElementById('coder-btn-create-project')?.addEventListener('click', () => {
    const name = document.getElementById('coder-new-project-name')?.value.trim();
    if (!name) return;
    activateProject(name, '', 'new', onCreateSession);
  });

  document.getElementById('coder-btn-browse-existing')?.addEventListener('click', async () => {
    try {
      const resp = await fetch('/api/workspace/browse', { method: 'POST' });
      if (!resp.ok) throw new Error('Browse failed');
      const data = await resp.json();
      if (data.path) {
        document.getElementById('coder-exist-path').value = data.path;
        const preview = document.getElementById('coder-exist-path-preview');
        if (preview) preview.textContent = data.path;
      }
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Browse Error', 'Could not open folder picker.', 3000);
    }
  });

  document.getElementById('coder-btn-load-existing')?.addEventListener('click', () => {
    const path = document.getElementById('coder-exist-path')?.value.trim();
    if (!path) {
      if (window.showToast) window.showToast('Select Folder', 'Please click Select Folder first.', 3000);
      return;
    }
    const name = path.split(/[\\/]/).filter(Boolean).pop() || 'project';
    activateProject(name, path, 'existing', onCreateSession);
  });

  document.getElementById('coder-exist-path')?.addEventListener('input', e => {
    const path = e.target.value;
    const preview = document.getElementById('coder-exist-path-preview');
    if (preview) preview.textContent = path || '—';
  });

  document.getElementById('coder-welcome-card-new')?.addEventListener('click', () => {
    openCoderWorkspacePopup();
    showPopupStep('new');
  });

  document.getElementById('coder-welcome-card-existing')?.addEventListener('click', async () => {
    try {
      const resp = await fetch('/api/workspace/browse', { method: 'POST' });
      if (!resp.ok) throw new Error('Browse failed');
      const data = await resp.json();
      if (data.path) {
        document.getElementById('coder-exist-path').value = data.path;
        const preview = document.getElementById('coder-exist-path-preview');
        if (preview) preview.textContent = data.path;
        openCoderWorkspacePopup();
        showPopupStep('existing');
      }
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Browse Error', 'Could not open folder picker.', 3000);
    }
  });
}
