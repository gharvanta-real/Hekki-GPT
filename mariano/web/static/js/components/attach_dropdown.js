import { showToast } from './toast.js';
import { router } from '../router.js';
import { attachmentManager } from './attachment_manager.js';
import { updateModelPills } from './model_selector.js';

let webSearchEnabled = true;

const ARENA_MODELS = [
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' }
];

export function initAttachDropdowns(inConversationState) {
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
      
      // Remove existing dropdowns
      document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
      
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
      
      // Add files
      dropdown.querySelector('.btn-add-files')?.addEventListener('click', () => {
        fileInput?.click();
        document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
      });
      
      const removeSubmenus = () => dropdown.querySelectorAll('.attach-sub-dropdown').forEach(s => s.remove());

      // ── Sub-menu: Playground Mode > ─────────────────────────────
      // ── Sub-menu: Playground Mode > ─────────────────────────────
      const playgroundBtn = dropdown.querySelector('.btn-playground-menu');
      playgroundBtn?.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        removeSubmenus();

        const sub = document.createElement('div');
        sub.className = 'attach-sub-dropdown';
        sub.style.minWidth = '220px';
        sub.style.padding = '6px';
        sub.style.display = 'flex';
        sub.style.flexDirection = 'column';
        sub.style.gap = '4px';

        if (ARENA_MODELS.length <= 1) {
          // Single model configured for both agents (Clean, simple, flat, non-colorful)
          const singleModel = ARENA_MODELS[0] || { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' };

          sub.innerHTML = `
            <div class="sub-dropdown-header" style="font-size:10px; color:var(--text-3); font-weight:600; padding:4px 8px 2px;">Playground Mode</div>
            <div class="attach-dropdown-item" style="opacity:0.75; cursor:default; justify-content:space-between; padding:6px 8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <i data-lucide="check" style="width:13px; height:13px; color:var(--text-3);"></i>
                <span style="font-size:12px; color:var(--text); font-weight:500;">${singleModel.name}</span>
              </div>
              <span style="font-size:10px; color:var(--text-3); background:var(--sidebar-bg); padding:2px 6px; border-radius:4px; font-weight:500;">Both Agents</span>
            </div>
            <div class="attach-dropdown-sep" style="margin:2px 0;"></div>
            <button id="btn-activate-arena-plus" class="attach-dropdown-item" style="font-weight:500; color:var(--text); justify-content:center; padding:6px 8px; cursor:pointer; width:100%; border:none; background:transparent; border-radius:6px;">
              <span>Activate Playground Mode</span>
            </button>
          `;

          playgroundBtn.appendChild(sub);
          if (window.lucide) lucide.createIcons({ parent: sub });

          const actBtn = sub.querySelector('#btn-activate-arena-plus');
          actBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const updatePayload = {
              reasoning_mode: 'playground',
              debate_model_alpha: singleModel.id,
              debate_model_beta: singleModel.id
            };

            const upRes = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatePayload)
            });

            if (upRes.ok) {
              await updateModelPills();
              showToast('Playground Mode Active', `${singleModel.name} (Both Agents)`, 3000);
            }
            document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
          });
        } else {
          // Multiple models available: simple clean list with max 2 ticks
          let selectedModels = [ARENA_MODELS[0].id, ARENA_MODELS[1].id];

          const itemsHtml = ARENA_MODELS.map(m => {
            const isChecked = selectedModels.includes(m.id);
            return `
              <button class="attach-dropdown-item arena-model-item" data-id="${m.id}" style="justify-content:space-between; padding:6px 8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <i data-lucide="${isChecked ? 'check' : 'minus'}" style="width:13px; height:13px; opacity:${isChecked ? '1' : '0.3'};"></i>
                  <span style="font-size:12px;">${m.name}</span>
                </div>
              </button>
            `;
          }).join('');

          sub.innerHTML = `
            <div class="sub-dropdown-header" style="font-size:10px; color:var(--text-3); font-weight:600; padding:4px 8px 2px;">Playground Models</div>
            ${itemsHtml}
            <div class="attach-dropdown-sep" style="margin:2px 0;"></div>
            <button id="btn-activate-arena-plus" class="attach-dropdown-item" style="font-weight:500; color:var(--text); justify-content:center; padding:6px 8px; cursor:pointer; width:100%; border:none; background:transparent; border-radius:6px;">
              <span>Activate Playground Mode</span>
            </button>
          `;

          playgroundBtn.appendChild(sub);
          if (window.lucide) lucide.createIcons({ parent: sub });

          sub.querySelectorAll('.arena-model-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const id = btn.dataset.id;
              if (selectedModels.includes(id)) {
                if (selectedModels.length > 1) {
                  selectedModels = selectedModels.filter(x => x !== id);
                }
              } else {
                if (selectedModels.length >= 2) {
                  selectedModels.shift();
                }
                selectedModels.push(id);
              }
              // re-render ticks
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

          const actBtn = sub.querySelector('#btn-activate-arena-plus');
          actBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const alphaId = selectedModels[0] || ARENA_MODELS[0].id;
            const betaId = selectedModels[1] || selectedModels[0] || ARENA_MODELS[0].id;

            const updatePayload = {
              reasoning_mode: 'playground',
              debate_model_alpha: alphaId,
              debate_model_beta: betaId
            };

            const upRes = await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatePayload)
            });

            if (upRes.ok) {
              await updateModelPills();
              showToast('Playground Mode Active', `Playground mode enabled`, 3000);
            }
            document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
          });
        }
      });

      // ── Sub-menu 1: Skills > ──────────────────────────────────────────
      const skillsBtn = dropdown.querySelector('.btn-skills-menu');
      skillsBtn?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeSubmenus();

        const sub = document.createElement('div');
        sub.className = 'attach-sub-dropdown';
        sub.innerHTML = `
          <div class="sub-dropdown-header" style="font-size:10px; color:var(--text-3); padding:4px 10px 4px; font-weight:600; letter-spacing:0.04em;">REGISTERED SKILLS</div>
          <div class="attach-dropdown-item"><i data-lucide="trash-2"></i><span>Safe Recycler & Delete</span></div>
          <div class="attach-dropdown-item"><i data-lucide="globe"></i><span>Web Search</span></div>
          <div class="attach-dropdown-item"><i data-lucide="file-text"></i><span>File Manager</span></div>
          <div class="attach-dropdown-item"><i data-lucide="terminal"></i><span>Terminal CMD</span></div>
          <div class="attach-dropdown-item"><i data-lucide="bar-chart-3"></i><span>Data Analyzer</span></div>
          <div class="attach-dropdown-item"><i data-lucide="cloud"></i><span>Weather & News</span></div>
        `;
        skillsBtn.appendChild(sub);
        if (window.lucide) lucide.createIcons({ parent: sub });
      });

      // ── Sub-menu 2: Permission mode > ─────────────────────────────────
      const permBtn = dropdown.querySelector('.btn-permission-menu');
      permBtn?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeSubmenus();

        const policy = localStorage.getItem('mariano_permission_policy') || 'ask';
        const sub = document.createElement('div');
        sub.className = 'attach-sub-dropdown permission-sub-menu';
        sub.innerHTML = `
          <div class="sub-dropdown-header" style="font-size:10px; color:var(--text-3); padding:4px 10px 4px; font-weight:600; letter-spacing:0.04em;">PERMISSION POLICY</div>
          <button class="attach-dropdown-item btn-opt-ask ${policy === 'ask' ? 'active' : ''}">
            <i data-lucide="shield-check"></i>
            <span>Ask First (Safe)</span>
            ${policy === 'ask' ? '<i data-lucide="check" class="lucide-check-icon"></i>' : ''}
          </button>
          <button class="attach-dropdown-item btn-opt-auto ${policy === 'auto' ? 'active' : ''}">
            <i data-lucide="zap"></i>
            <span>Auto-Approve (Fast)</span>
            ${policy === 'auto' ? '<i data-lucide="check" class="lucide-check-icon"></i>' : ''}
          </button>
          <button class="attach-dropdown-item btn-opt-super ${policy === 'super' ? 'active' : ''}">
            <i data-lucide="sparkles"></i>
            <span>Super Permission (100% + Recycle Bin)</span>
            ${policy === 'super' ? '<i data-lucide="check" class="lucide-check-icon"></i>' : ''}
          </button>
        `;

        permBtn.appendChild(sub);
        if (window.lucide) lucide.createIcons({ parent: sub });

        sub.querySelector('.btn-opt-ask')?.addEventListener('click', (e) => {
          e.stopPropagation();
          localStorage.setItem('mariano_permission_policy', 'ask');
          showToast('Policy Updated', 'Set to Ask First (Safe mode).', 2000);
          document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
        });

        sub.querySelector('.btn-opt-auto')?.addEventListener('click', (e) => {
          e.stopPropagation();
          localStorage.setItem('mariano_permission_policy', 'auto');
          showToast('Policy Updated', 'Set to Auto-Approve (Unrestricted mode).', 2000);
          document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
        });

        sub.querySelector('.btn-opt-super')?.addEventListener('click', (e) => {
          e.stopPropagation();
          localStorage.setItem('mariano_permission_policy', 'super');
          showToast('Super Permission Active', '100% Full Access Enabled (Deletes sent to Recycle Bin)', 3000);
          document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
        });
      });

      // Toggle Web Search
      const searchBtn = dropdown.querySelector('.btn-web-search');
      if (searchBtn) {
        searchBtn.style.opacity = webSearchEnabled ? '1' : '0.6';
        searchBtn.addEventListener('click', () => {
          webSearchEnabled = !webSearchEnabled;
          showToast('Web Search', webSearchEnabled ? 'Web Search Enabled' : 'Web Search Disabled', 2000);
          document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
        });
      }

      btn.appendChild(dropdown);
      if (window.lucide) lucide.createIcons({ parent: dropdown });
    });
  };

  bindBtn('btn-attach-home');
  bindBtn('btn-attach-conv');

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.attach-dropdown') && !e.target.closest('.cap-icon-btn')) {
      document.querySelectorAll('.attach-dropdown, .attach-sub-dropdown').forEach(d => d.remove());
    }
  });
}
