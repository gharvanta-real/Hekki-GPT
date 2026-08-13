import { showToast } from './toast.js';
import { router } from '../router.js';
import { attachmentManager } from './attachment_manager.js';
import { updateModelPills } from './model_selector.js';

let webSearchEnabled = true;

const ARENA_MODELS = [
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' }
];

let _attachDropdownsBound = false;

/* ─────────────────────────────────────────────────────────────────────────
   positionDropdown(el, anchorBtn)
   Positions a fixed-position dropdown above the anchor button.
   Dropdown is attached to document.body so no parent opacity bleeds in.
───────────────────────────────────────────────────────────────────────── */
function positionDropdown(el, anchorBtn) {
  const r = anchorBtn.getBoundingClientRect();
  el.style.position  = 'fixed';
  el.style.bottom    = `${window.innerHeight - r.top + 8}px`;
  el.style.left      = `${r.left}px`;
  el.style.top       = 'auto';
}

/* Position a sub-dropdown to the right of its parent item */
function positionSubDropdown(sub, parentItem) {
  const r = parentItem.getBoundingClientRect();
  sub.style.position = 'fixed';
  sub.style.left     = `${r.right + 8}px`;
  sub.style.top      = `${r.top - 6}px`;
  sub.style.bottom   = 'auto';
}

/* Remove all open attach dropdowns from body */
function closeAll() {
  document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
}

export function initAttachDropdowns(inConversationState) {
  if (_attachDropdownsBound) return;
  _attachDropdownsBound = true;

  const $ = (id) => document.getElementById(id);
  const fileInput = $('attach-file-input');

  fileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await attachmentManager.addFiles(files);
      showToast('File Attached', `Selected ${files.length} file(s) for upload.`, 2500);
      fileInput.value = '';
    }
  });

  const bindBtn = (btnId) => {
    const btn = $(btnId);
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Close any existing dropdowns
      closeAll();

      const dropdown = document.createElement('div');
      dropdown.className = 'attach-dropdown';

      dropdown.innerHTML = `
        <button class="attach-dropdown-item btn-add-files">
          <i data-lucide="paperclip"></i>
          <span>Add files or photos</span>
          <span class="shortcut-hint">Ctrl+U</span>
        </button>

        <button class="attach-dropdown-item btn-playground-menu">
          <i data-lucide="swords" style="color:#f59e0b;"></i>
          <span>Playground mode</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>

        <button class="attach-dropdown-item btn-skills-menu">
          <i data-lucide="book-open"></i>
          <span>Skills</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>

        <div class="attach-dropdown-sep"></div>

        <button class="attach-dropdown-item btn-permission-menu">
          <i data-lucide="shield-check"></i>
          <span>Permission mode</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>

        <button class="attach-dropdown-item btn-web-search">
          <i data-lucide="globe"></i>
          <span>Web search</span>
        </button>
      `;

      // ── Append to body (NOT inside button) to escape opacity inheritance ──
      document.body.appendChild(dropdown);
      positionDropdown(dropdown, btn);

      if (window.lucide) lucide.createIcons({ parent: dropdown });

      // Add files
      dropdown.querySelector('.btn-add-files')?.addEventListener('click', () => {
        fileInput?.click();
        closeAll();
      });

      const removeSubmenus = () =>
        document.querySelectorAll('.attach-sub-dropdown').forEach(s => s.remove());

      // ── Sub-menu: Playground Mode > ──────────────────────────────────────
      const playgroundBtn = dropdown.querySelector('.btn-playground-menu');
      playgroundBtn?.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        removeSubmenus();

        const sub = document.createElement('div');
        sub.className = 'attach-sub-dropdown';

        if (ARENA_MODELS.length <= 1) {
          const singleModel = ARENA_MODELS[0] || { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' };

          const isDebateOn = window._debateModeActive || false;
          sub.innerHTML = `
            <div class="sub-dropdown-header">Playground Mode</div>
            <div class="attach-dropdown-item" style="opacity:0.85; cursor:default; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:8px;">
                <i data-lucide="check" style="width:13px; height:13px; color:#2563eb;"></i>
                <span style="font-size:12px; color:var(--text); font-weight:500;">${singleModel.name}</span>
              </div>
              <span style="font-size:10px; color:var(--text-2); background:var(--hover); padding:2px 6px; border-radius:4px; font-weight:500;">Both Agents</span>
            </div>
            <div class="attach-dropdown-sep"></div>
            <div id="btn-toggle-arena-switch" class="toggle-switch-wrap">
              <span style="font-size:12.5px; font-weight:500; color:var(--text-primary);">Playground Mode</span>
              <div class="toggle-switch debate-toggle-switch ${isDebateOn ? 'on' : ''}">
                <div class="toggle-switch-handle"></div>
              </div>
            </div>
          `;

          document.body.appendChild(sub);
          positionSubDropdown(sub, playgroundBtn);
          if (window.lucide) lucide.createIcons({ parent: sub });

          sub.querySelector('#btn-toggle-arena-switch')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const sw = sub.querySelector('.debate-toggle-switch');
            const nowOn = !sw.classList.contains('on');
            if (nowOn) sw.classList.add('on');
            else sw.classList.remove('on');

            if (window._debateModeActive !== undefined) {
              window._debateModeActive = nowOn;
              // update UI pills and placeholders
              document.querySelectorAll('.capsule-debate-pill').forEach(pill => {
                if (nowOn) {
                  pill.classList.add('active');
                  pill.querySelector('.pill-text').textContent = 'Debate ON';
                } else {
                  pill.classList.remove('active');
                  pill.querySelector('.pill-text').textContent = 'Debate';
                }
              });
              const homeInput = document.getElementById('chat-input');
              const convInput = document.getElementById('chat-input-conv');
              if (nowOn) {
                if (homeInput) homeInput.placeholder = "Enter a topic for Debate Playground… e.g. 'Is AI replacing human creativity?'";
                if (convInput) convInput.placeholder = "Enter a topic for Debate Playground…";
              } else {
                if (homeInput) homeInput.placeholder = "How can I help you today?";
                if (convInput) convInput.placeholder = "Write a message...";
              }
              showToast(nowOn ? 'Playground Mode Active' : 'Standard Chat Active', nowOn ? 'Inline debate enabled' : 'Single model mode', 2500);
            }
            closeAll();
          });
        } else {
          let selectedModels = [ARENA_MODELS[0].id, ARENA_MODELS[1].id];

          const itemsHtml = ARENA_MODELS.map(m => {
            const isChecked = selectedModels.includes(m.id);
            return `
              <button class="attach-dropdown-item arena-model-item" data-id="${m.id}" style="justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <i data-lucide="${isChecked ? 'check' : 'minus'}" style="width:13px; height:13px; opacity:${isChecked ? '1' : '0.3'};"></i>
                  <span style="font-size:12px;">${m.name}</span>
                </div>
              </button>
            `;
          }).join('');

          sub.innerHTML = `
            <div class="sub-dropdown-header">Playground Models</div>
            ${itemsHtml}
            <div class="attach-dropdown-sep"></div>
            <button id="btn-activate-arena-plus" class="attach-dropdown-item" style="justify-content:center;">
              <span>Activate Playground Mode</span>
            </button>
          `;

          document.body.appendChild(sub);
          positionSubDropdown(sub, playgroundBtn);
          if (window.lucide) lucide.createIcons({ parent: sub });

          sub.querySelectorAll('.arena-model-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const id = btn.dataset.id;
              if (selectedModels.includes(id)) {
                if (selectedModels.length > 1) selectedModels = selectedModels.filter(x => x !== id);
              } else {
                if (selectedModels.length >= 2) selectedModels.shift();
                selectedModels.push(id);
              }
              sub.querySelectorAll('.arena-model-item').forEach(b => {
                const bId = b.dataset.id;
                const active = selectedModels.includes(bId);
                const icon = b.querySelector('[data-lucide]');
                if (icon) {
                  icon.setAttribute('data-lucide', active ? 'check' : 'minus');
                  icon.style.opacity = active ? '1' : '0.3';
                }
              });
              if (window.lucide) lucide.createIcons({ parent: sub });
            });
          });

          sub.querySelector('#btn-activate-arena-plus')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const alphaId = selectedModels[0] || ARENA_MODELS[0].id;
            const betaId  = selectedModels[1] || selectedModels[0] || ARENA_MODELS[0].id;
            const upRes = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reasoning_mode: 'playground', debate_model_alpha: alphaId, debate_model_beta: betaId })
            });
            if (upRes.ok) {
              await updateModelPills();
              showToast('Playground Mode Active', 'Playground mode enabled', 3000);
            }
            closeAll();
          });
        }
      });

      // ── Sub-menu: Skills > ───────────────────────────────────────────────
      const skillsBtn = dropdown.querySelector('.btn-skills-menu');
      skillsBtn?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeSubmenus();

        const sub = document.createElement('div');
        sub.className = 'attach-sub-dropdown';
        sub.innerHTML = `
          <div class="sub-dropdown-header">Registered Skills</div>
          <button class="attach-dropdown-item"><i data-lucide="trash-2"></i><span>Safe Recycler &amp; Delete</span></button>
          <button class="attach-dropdown-item"><i data-lucide="globe"></i><span>Web Search</span></button>
          <button class="attach-dropdown-item"><i data-lucide="file-text"></i><span>File Manager</span></button>
          <button class="attach-dropdown-item"><i data-lucide="terminal"></i><span>Terminal CMD</span></button>
          <button class="attach-dropdown-item"><i data-lucide="bar-chart-3"></i><span>Data Analyzer</span></button>
          <button class="attach-dropdown-item"><i data-lucide="cloud"></i><span>Weather &amp; News</span></button>
        `;
        document.body.appendChild(sub);
        positionSubDropdown(sub, skillsBtn);
        if (window.lucide) lucide.createIcons({ parent: sub });
      });

      // ── Sub-menu: Permission mode > ──────────────────────────────────────
      const permBtn = dropdown.querySelector('.btn-permission-menu');
      permBtn?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeSubmenus();

        const policy = localStorage.getItem('mariano_permission_policy') || 'ask';
        const sub = document.createElement('div');
        sub.className = 'attach-sub-dropdown permission-sub-menu';
        sub.innerHTML = `
          <div class="sub-dropdown-header">Permission Policy</div>
          <button class="attach-dropdown-item btn-opt-ask ${policy === 'ask' ? 'active' : ''}">
            <i data-lucide="shield-check"></i>
            <span>Ask First (Safe)</span>
            ${policy === 'ask' ? '<i data-lucide="check" class="lucide-check-icon" style="margin-left:auto;width:13px;height:13px;"></i>' : ''}
          </button>
          <button class="attach-dropdown-item btn-opt-auto ${policy === 'auto' ? 'active' : ''}">
            <i data-lucide="zap"></i>
            <span>Auto-Approve (Fast)</span>
            ${policy === 'auto' ? '<i data-lucide="check" class="lucide-check-icon" style="margin-left:auto;width:13px;height:13px;"></i>' : ''}
          </button>
          <button class="attach-dropdown-item btn-opt-super ${policy === 'super' ? 'active' : ''}">
            <i data-lucide="sparkles"></i>
            <span>Super Permission (Full Access)</span>
            ${policy === 'super' ? '<i data-lucide="check" class="lucide-check-icon" style="margin-left:auto;width:13px;height:13px;"></i>' : ''}
          </button>
        `;

        document.body.appendChild(sub);
        positionSubDropdown(sub, permBtn);
        if (window.lucide) lucide.createIcons({ parent: sub });

        sub.querySelector('.btn-opt-ask')?.addEventListener('click', (e) => {
          e.stopPropagation();
          localStorage.setItem('mariano_permission_policy', 'ask');
          showToast('Policy Updated', 'Set to Ask First (Safe mode).', 2000);
          closeAll();
        });
        sub.querySelector('.btn-opt-auto')?.addEventListener('click', (e) => {
          e.stopPropagation();
          localStorage.setItem('mariano_permission_policy', 'auto');
          showToast('Policy Updated', 'Set to Auto-Approve (Unrestricted mode).', 2000);
          closeAll();
        });
        sub.querySelector('.btn-opt-super')?.addEventListener('click', (e) => {
          e.stopPropagation();
          localStorage.setItem('mariano_permission_policy', 'super');
          showToast('Super Permission Active', '100% Full Access Enabled (Deletes sent to Recycle Bin)', 3000);
          closeAll();
        });
      });

      // ── Toggle Web Search ─────────────────────────────────────────────────
      const searchBtn = dropdown.querySelector('.btn-web-search');
      if (searchBtn) {
        searchBtn.style.opacity = webSearchEnabled ? '1' : '0.6';
        searchBtn.addEventListener('click', () => {
          webSearchEnabled = !webSearchEnabled;
          showToast('Web Search', webSearchEnabled ? 'Web Search Enabled' : 'Web Search Disabled', 2000);
          closeAll();
        });
      }
    });
  };

  bindBtn('btn-attach-home');
  bindBtn('btn-attach-conv');

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (
      !e.target.closest('.attach-dropdown') &&
      !e.target.closest('.attach-sub-dropdown') &&
      !e.target.closest('.cap-icon-btn')
    ) {
      closeAll();
    }
  });
}
