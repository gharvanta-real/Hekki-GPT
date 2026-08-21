/**
 * debate_research_modal.js — Research Directory & Document persistence for Debate
 */
import { showToast } from '../components/toast.js';

export function loadSavedDocuments() {
  try {
    const raw = localStorage.getItem('hekki_debate_documents');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDocumentToDisk(doc) {
  const docs = loadSavedDocuments();
  const existingIdx = docs.findIndex(d => d.id === doc.id);
  if (existingIdx >= 0) {
    docs[existingIdx] = doc;
  } else {
    docs.unshift(doc);
  }
  localStorage.setItem('hekki_debate_documents', JSON.stringify(docs.slice(0, 50)));
  renderDocsList();
}

export function deleteSavedDocument(id) {
  let docs = loadSavedDocuments();
  docs = docs.filter(d => d.id !== id);
  localStorage.setItem('hekki_debate_documents', JSON.stringify(docs));
  renderDocsList();
}

export function renderDocsList() {
  const container = document.getElementById('debate-docs-list');
  if (!container) return;

  const docs = loadSavedDocuments();
  if (!docs.length) {
    container.innerHTML = `<div class="debate-doc-empty">No saved documents yet.</div>`;
    return;
  }

  container.innerHTML = docs.map(d => `
    <div class="debate-doc-item" data-id="${d.id}" style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-radius:4px; font-size:12px; cursor:pointer;">
      <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
        <i data-lucide="file-text" style="width:13px; height:13px; color:var(--text-3); flex-shrink:0;"></i>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${d.title || 'Untitled'}</span>
      </div>
      <button class="btn-delete-doc" data-id="${d.id}" style="background:transparent; border:none; color:var(--text-3); cursor:pointer; padding:2px;">
        <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.debate-doc-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-doc')) return;
      const id = el.dataset.id;
      const targetDoc = docs.find(d => d.id === id);
      if (targetDoc && window.openReaderModeWithDoc) {
        window.openReaderModeWithDoc(targetDoc);
      }
    });
  });

  container.querySelectorAll('.btn-delete-doc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSavedDocument(btn.dataset.id);
    });
  });

  if (window.lucide) lucide.createIcons();
}

export function openResearchDirectory() {
  const viewer = document.getElementById('debate-directory-viewer');
  if (viewer) viewer.style.display = 'flex';
  renderDirectoryTopics();
}

export function closeResearchDirectory() {
  const viewer = document.getElementById('debate-directory-viewer');
  if (viewer) viewer.style.display = 'none';
}

export function renderDirectoryTopics() {
  const listEl = document.getElementById('directory-topics-list');
  if (!listEl) return;

  const docs = loadSavedDocuments();
  if (!docs.length) {
    listEl.innerHTML = `<div style="font-size:11px; color:var(--text-3); padding:8px 4px;">No topics recorded yet. Run a debate or upload specs.</div>`;
    return;
  }

  listEl.innerHTML = docs.map(d => `
    <div class="directory-topic-item" data-id="${d.id}" style="padding:6px 8px; border-radius:6px; font-size:12px; cursor:pointer; background:var(--card); color:var(--text);">
      <div style="font-weight:500; margin-bottom:2px;">${d.title || 'Untitled Spec'}</div>
      <div style="font-size:10px; color:var(--text-3);">${d.date || new Date().toLocaleDateString()} · ${d.rounds || 3} rounds</div>
    </div>
  `).join('');

  listEl.querySelectorAll('.directory-topic-item').forEach(item => {
    item.addEventListener('click', () => {
      listEl.querySelectorAll('.directory-topic-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const docId = item.dataset.id;
      const doc = docs.find(d => d.id === docId);
      if (doc) renderDirectoryTopic(doc);
    });
  });
}

export function renderDirectoryTopic(doc) {
  const area = document.getElementById('directory-content-area');
  if (!area) return;

  area.innerHTML = `
    <div style="padding:24px; max-width:800px; margin:0 auto; font-family:var(--font); color:var(--text);">
      <h1 style="font-size:19px; font-weight:600; margin-bottom:8px;">${doc.title || 'Research Spec'}</h1>
      <div style="font-size:11px; color:var(--text-3); margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:12px;">
        Generated on ${doc.date || new Date().toLocaleString()} · Evaluated with TCMM & Scientific Rigor
      </div>
      <div class="markdown-body" style="font-size:13.5px; line-height:1.6;">
        ${doc.contentHtml || doc.content || '<p>No content recorded.</p>'}
      </div>
    </div>
  `;
}
