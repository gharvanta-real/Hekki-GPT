import { showToast } from './toast.js';
import { router } from '../router.js';
import { attachmentManager } from './attachment_manager.js';
import { updateModelPills } from './model_selector.js';

let webSearchEnabled = true;

const ARENA_MODELS = [
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M28.1,18.9L13.1,3.9c-2.5-2.6-6.6-2.6-9.2-0.1S1.3,10.5,3.9,13c0,0,0.1,0.1,0.1,0.1L6.8,16l1.4-1.4l-2.9-2.9C3.6,10,3.6,7.1,5.3,5.4s4.6-1.8,6.3-0.1c0,0,0,0,0.1,0.1l14.9,14.9c1.8,1.7,1.8,4.6,0.1,6.3c-1.7,1.8-4.6,1.8-6.3,0.1c0,0,0,0-0.1-0.1l-7.4-7.4c-1-1-0.9-2.6,0-3.5c1-0.9,2.5-0.9,3.5,0l4.1,4.1l1.4-1.4c0,0-4.2-4.2-4.2-4.2c-1.8-1.7-4.6-1.6-6.3,0.2c-1.6,1.7-1.6,4.4,0,6.2l7.5,7.5c2.5,2.6,6.6,2.6,9.2,0.1S30.7,21.5,28.1,18.9C28.1,19,28.1,18.9,28.1,18.9L28.1,18.9z"/></svg>
          <span>Add files or photos</span>
          <span class="shortcut-hint">Ctrl+U</span>
        </button>

        <button class="attach-dropdown-item btn-playground-menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M25.3943,24a7.8772,7.8772,0,0,0-1.6707-8.5684,3.918,3.918,0,0,0-1.0844-4.414l2.7759-2.7759a2.0025,2.0025,0,0,0,0-2.8286L22.5869,2.5849a2.0021,2.0021,0,0,0-2.8286,0L6.5859,15.7573a2.0027,2.0027,0,0,0,0,2.8286l2.8282,2.8282a2.0024,2.0024,0,0,0,2.8286,0l4.7749-4.7754a3.9329,3.9329,0,0,0,5.5139.4326A5.9442,5.9442,0,0,1,23.1775,24H16v4H4v2H28V24ZM10.8281,20,8,17.1714,9.8787,15.293l2.8283,2.8281ZM16,14a3.9811,3.9811,0,0,0,.0762.7524L14.1211,16.707l-2.8284-2.8281,9.88-9.88L24.001,6.8271l-3.2488,3.2491A3.9771,3.9771,0,0,0,16,14Zm4,2a2,2,0,1,1,2-2A2.0023,2.0023,0,0,1,20,16Zm6,12H18V26h8Z"/></svg>
          <span>Playground mode</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>

        <button class="attach-dropdown-item btn-skills-menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><circle cx="4" cy="22" r="2"/><path d="m13.5,30c-3.0586,0-5.9485-1.4867-7.7305-3.9771l1.6265-1.1638c1.4075,1.9667,3.6892,3.1409,6.104,3.1409,3.969,0,7.2578-3.1002,7.4873-7.0579l1.9966.1157c-.2908,5.0143-4.4565,8.9421-9.4839,8.9421Z"/><circle cx="28" cy="23" r="2"/><path d="m30.6411,19.0948l-1.9243-.5449c.188-.6638.2832-1.3535.2832-2.0499,0-4.1355-3.3645-7.5-7.5-7.5-1.0769,0-2.1157.223-3.0876.6628l-.8247-1.822c1.2329-.558,2.5491-.8408,3.9124-.8408,5.2383,0,9.5,4.2617,9.5,9.5,0,.8807-.1208,1.7537-.3589,2.5948Z"/><path d="m20.4141,14.5859l-3-3c-.3774-.3779-.8799-.5859-1.4141-.5859s-1.0366.208-1.4143.5859l-2.9998,3c-.3899.3896-.5859.9019-.5859,1.4141s.196,1.0244.5859,1.4141l2.9998,3c.3777.3779.8801.5859,1.4143.5859s1.0366-.208,1.4141-.5859l3-3c.3899-.3896.5859-.9019.5859-1.4141s-.196-1.0244-.5859-1.4141Zm-4.4141,4.4141l-3-3,3-3,2.9998,3-2.9998,3Z"/><circle cx="16" cy="3" r="2"/><path d="m8.0254,19.8821c-3.0999-1.6578-5.0254-4.8696-5.0254-8.3821C3,6.4729,6.9277,2.307,11.9421,2.0161l.1157,1.9966c-3.9578.2297-7.0579,3.5186-7.0579,7.4873,0,2.7732,1.5208,5.3092,3.9688,6.6184l-.9434,1.7637Z"/></svg>
          <span>Skills</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>

        <div class="attach-dropdown-sep"></div>

        <button class="attach-dropdown-item btn-permission-menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M26,4H6A2,2,0,0,0,4,6V18c0,7,5.5,10.8,11.3,11.9a1.9,1.9,0,0,0,.7,0C21.8,28.8,28,25,28,18V6A2,2,0,0,0,26,4ZM26,18c0,5.8-5,9-10,10-5-1-10-4.2-10-10V6H26Z"/><polygon points="14 16.2 11.4 13.6 10 15 14 19 22 11 20.6 9.6 14 16.2"/></svg>
          <span>Permission mode</span>
          <i data-lucide="chevron-right" class="submenu-arrow"></i>
        </button>

        <button class="attach-dropdown-item btn-web-search">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;margin-right:8px;display:inline-block;vertical-align:middle;flex-shrink:0;"><path d="M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2ZM28,15H22A24.26,24.26,0,0,0,19.21,4.45,12,12,0,0,1,28,15ZM16,28a5,5,0,0,1-.67,0A21.85,21.85,0,0,1,12,17H20a21.85,21.85,0,0,1-3.3,11A5,5,0,0,1,16,28ZM12,15a21.85,21.85,0,0,1,3.3-11,6,6,0,0,1,1.34,0A21.85,21.85,0,0,1,20,15Zm.76-10.55A24.26,24.26,0,0,0,10,15h-6A12,12,0,0,1,12.79,4.45ZM4.05,17h6a24.26,24.26,0,0,0,2.75,10.55A12,12,0,0,1,4.05,17ZM19.21,27.55A24.26,24.26,0,0,0,22,17h6A12,12,0,0,1,19.21,27.55Z"/></svg>
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
          const currentRounds = parseInt(localStorage.getItem('mariano_debate_rounds') || '3', 10);
          window._debateRounds = currentRounds;

          sub.innerHTML = `
            <div class="attach-dropdown-item" style="cursor:default; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:10px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="#16a34a" style="width:13px;height:13px;display:inline-block;flex-shrink:0;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>
                <span>${singleModel.name}</span>
              </div>
              <span class="sub-item-badge">Both Agents</span>
            </div>
            <div class="attach-dropdown-sep"></div>
            <div class="attach-dropdown-item" style="cursor:default; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:10px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><polygon points="23.59 19.41 26 22 21 22 21 24 26 24 23.59 26.59 25 28 30 23 25 18 23.59 19.41"/><path d="M13,6A9,9,0,0,0,5.52,20l1.66-1.11A7,7,0,1,1,13,22H2v2H13A9,9,0,0,0,13,6Z"/></svg>
                <span>Debate Rounds</span>
              </div>
              <select id="attach-debate-rounds-select" class="attach-rounds-select">
                <option value="1" ${currentRounds === 1 ? 'selected' : ''}>1 Round</option>
                <option value="2" ${currentRounds === 2 ? 'selected' : ''}>2 Rounds</option>
                <option value="3" ${currentRounds === 3 ? 'selected' : ''}>3 Rounds</option>
                <option value="4" ${currentRounds === 4 ? 'selected' : ''}>4 Rounds</option>
                <option value="5" ${currentRounds === 5 ? 'selected' : ''}>5 Rounds</option>
              </select>
            </div>
            <div class="attach-dropdown-sep"></div>
            <div id="btn-toggle-arena-switch" class="attach-dropdown-item" style="justify-content:space-between; cursor:pointer;">
              <div style="display:flex; align-items:center; gap:10px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="#f59e0b" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><path d="M25.3943,24a7.8772,7.8772,0,0,0-1.6707-8.5684,3.918,3.918,0,0,0-1.0844-4.414l2.7759-2.7759a2.0025,2.0025,0,0,0,0-2.8286L22.5869,2.5849a2.0021,2.0021,0,0,0-2.8286,0L6.5859,15.7573a2.0027,2.0027,0,0,0,0,2.8286l2.8282,2.8282a2.0024,2.0024,0,0,0,2.8286,0l4.7749-4.7754a3.9329,3.9329,0,0,0,5.5139.4326A5.9442,5.9442,0,0,1,23.1775,24H16v4H4v2H28V24ZM10.8281,20,8,17.1714,9.8787,15.293l2.8283,2.8281ZM16,14a3.9811,3.9811,0,0,0,.0762.7524L14.1211,16.707l-2.8284-2.8281,9.88-9.88L24.001,6.8271l-3.2488,3.2491A3.9771,3.9771,0,0,0,16,14Zm4,2a2,2,0,1,1,2-2A2.0023,2.0023,0,0,1,20,16Zm6,12H18V26h8Z"/></svg>
                <span>Playground Mode</span>
              </div>
              <div class="toggle-switch debate-toggle-switch ${isDebateOn ? 'on' : ''}">
                <div class="toggle-switch-handle"></div>
              </div>
            </div>
          `;

          document.body.appendChild(sub);
          positionSubDropdown(sub, playgroundBtn);
          if (window.lucide) lucide.createIcons({ parent: sub });

          sub.querySelector('#attach-debate-rounds-select')?.addEventListener('change', (e) => {
            e.stopPropagation();
            const val = parseInt(e.target.value, 10);
            localStorage.setItem('mariano_debate_rounds', val);
            window._debateRounds = val;
            showToast('Debate Rounds Updated', `Set to ${val} round(s)`, 2000);
          });

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
          const currentRounds = parseInt(localStorage.getItem('mariano_debate_rounds') || '3', 10);
          window._debateRounds = currentRounds;

          const itemsHtml = ARENA_MODELS.map(m => {
            const isChecked = selectedModels.includes(m.id);
            return `
              <button class="attach-dropdown-item arena-model-item" data-id="${m.id}" style="justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <i data-lucide="${isChecked ? 'check' : 'minus'}" style="opacity:${isChecked ? '1' : '0.3'};"></i>
                  <span>${m.name}</span>
                </div>
              </button>
            `;
          }).join('');

          sub.innerHTML = `
            ${itemsHtml}
            <div class="attach-dropdown-sep"></div>
            <div class="attach-dropdown-item" style="cursor:default; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:10px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><polygon points="23.59 19.41 26 22 21 22 21 24 26 24 23.59 26.59 25 28 30 23 25 18 23.59 19.41"/><path d="M13,6A9,9,0,0,0,5.52,20l1.66-1.11A7,7,0,1,1,13,22H2v2H13A9,9,0,0,0,13,6Z"/></svg>
                <span>Debate Rounds</span>
              </div>
              <select id="attach-debate-rounds-select" class="attach-rounds-select">
                <option value="1" ${currentRounds === 1 ? 'selected' : ''}>1 Round</option>
                <option value="2" ${currentRounds === 2 ? 'selected' : ''}>2 Rounds</option>
                <option value="3" ${currentRounds === 3 ? 'selected' : ''}>3 Rounds</option>
                <option value="4" ${currentRounds === 4 ? 'selected' : ''}>4 Rounds</option>
                <option value="5" ${currentRounds === 5 ? 'selected' : ''}>5 Rounds</option>
              </select>
            </div>
            <div class="attach-dropdown-sep"></div>
            <button id="btn-activate-arena-plus" class="attach-dropdown-item" style="justify-content:center;">
              <span>Activate Playground Mode</span>
            </button>
          `;

          document.body.appendChild(sub);
          positionSubDropdown(sub, playgroundBtn);
          if (window.lucide) lucide.createIcons({ parent: sub });

          sub.querySelector('#attach-debate-rounds-select')?.addEventListener('change', (e) => {
            e.stopPropagation();
            const val = parseInt(e.target.value, 10);
            localStorage.setItem('mariano_debate_rounds', val);
            window._debateRounds = val;
            showToast('Debate Rounds Updated', `Set to ${val} round(s)`, 2000);
          });

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
          <button class="attach-dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><path d="M29.5081,22.2549l-2.0781-3.7402-1.7485,.9707,2.0781,3.7412c.3247,.584,.3162,1.2769-.0229,1.8535-.3391,.5762-.9407,.9199-1.6091,.9199h-7.2974l2.5801-2.5898-1.4102-1.4102-5,5,5,5,1.4102-1.4102-2.5801-2.5898h7.2974c1.3848,0,2.6306-.7124,3.3328-1.9058,.7024-1.1938,.7202-2.6284,.0479-3.8394Z"/><path d="M5.8726,26c-.6685,0-1.27-.3438-1.6091-.9199-.3391-.5767-.3477-1.2695-.0229-1.8535l4.1111-7.4004,1.0479,3.52,1.9121-.5664-2.0083-6.7798-6.7798,2.0083,.5664,1.9121,3.4934-1.0298-4.0913,7.3643c-.6724,1.2109-.6545,2.6455,.0479,3.8394,.7021,1.1934,1.948,1.9058,3.3328,1.9058h6.1274v-2H5.8726Z"/><path d="M25.51,9.6538l-1.0476,3.519L19.3503,3.9712c-.6858-1.2344-1.9382-1.9712-3.3503-1.9712s-2.6646,.7368-3.3503,1.9712l-3.0796,5.5435,1.7485,.9707,3.0796-5.543c.3276-.5898,.9265-.9424,1.6018-.9424s1.2742,.3525,1.6018,.9424l5.0925,9.167-3.4939-1.0298-.5664,1.9121,6.78,2.0083,2.0083-6.7798-1.9124-.5664Z"/></svg><span>Safe Recycler &amp; Delete</span></button>
          <button class="attach-dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><path d="M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2ZM28,15H22A24.26,24.26,0,0,0,19.21,4.45,12,12,0,0,1,28,15ZM16,28a5,5,0,0,1-.67,0A21.85,21.85,0,0,1,12,17H20a21.85,21.85,0,0,1-3.3,11A5,5,0,0,1,16,28ZM12,15a21.85,21.85,0,0,1,3.3-11,6,6,0,0,1,1.34,0A21.85,21.85,0,0,1,20,15Zm.76-10.55A24.26,24.26,0,0,0,10,15h-6A12,12,0,0,1,12.79,4.45ZM4.05,17h6a24.26,24.26,0,0,0,2.75,10.55A12,12,0,0,1,4.05,17ZM19.21,27.55A24.26,24.26,0,0,0,22,17h6A12,12,0,0,1,19.21,27.55Z"/></svg><span>Web Search</span></button>
          <button class="attach-dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><path d="M25.7,9.3l-7-7C18.5,2.1,18.3,2,18,2H8C6.9,2,6,2.9,6,4v24c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V10C26,9.7,25.9,9.5,25.7,9.3z M18,4.4l5.6,5.6H18V4.4z M24,28H8V4h8v6c0,1.1,0.9,2,2,2h6V28z"/><rect x="10" y="22" width="12" height="2"/><rect x="10" y="16" width="12" height="2"/></svg><span>File Manager</span></button>
          <button class="attach-dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><path d="M26,4H6A2.002,2.002,0,0,0,4,6V26a2.002,2.002,0,0,0,2,2H26a2.002,2.002,0,0,0,2-2V6A2.002,2.002,0,0,0,26,4Zm0,22H6V6H26Z"/><polygon points="9.41 19.59 13.59 15.41 9.41 11.24 10.83 9.83 16.41 15.41 10.83 21 9.41 19.59"/><rect x="16" y="19" width="6" height="2"/></svg><span>Terminal CMD</span></button>
          <button class="attach-dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><rect x="8" y="10" width="8" height="2"/><rect x="8" y="6" width="12" height="2"/><rect x="8" y="2" width="12" height="2"/><path d="M4.7111,28l5.6312-9.9961,7.4341,6.49A2,2,0,0,0,20.86,23.96l6.9707-10.4034-1.6622-1.1132-7,10.4472-.07.1035-7.4345-6.4907a2.0032,2.0032,0,0,0-3.0806.5308L4,25.1826V2H2V28a2.0023,2.0023,0,0,0,2,2H30V28Z"/></svg><span>Data Analyzer</span></button>
          <button class="attach-dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><path d="M26,6V8.17L5.64,11.87a2,2,0,0,0-1.64,2v4.34a2,2,0,0,0,1.64,2L8,20.56V24a2,2,0,0,0,2,2h8a2,2,0,0,0,2-2V22.74l6,1.09V26h2V6ZM18,24H10V20.93l8,1.45ZM6,18.17V13.83L26,10.2V21.8Z"/></svg><span>Weather &amp; News</span></button>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><path d="M16.479,29.8779l5.7856-3.1562c3.5381-1.9297,5.7354-5.6543,5.7354-9.7217V4c0-1.103-.8975-2-2-2H6c-1.103,0-2,.897-2,2v13c0,4.0674,2.1978,7.792,5.7349,9.7217l5.7861,3.1562c.1494.0811.314.1221.479.1221s.3296-.041.479-.1221ZM26,4v13c0,3.335-1.7979,6.3867-4.6924,7.9658l-5.3076,2.8955-5.3071-2.8955c-2.8945-1.5791-4.6929-4.6309-4.6929-7.9658V4h20Z"/></svg>
            <span>Ask First (Safe)</span>
            ${policy === 'ask' ? '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="#16a34a" style="margin-left:auto;width:13px;height:13px;display:inline-block;flex-shrink:0;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>' : ''}
          </button>
          <button class="attach-dropdown-item btn-opt-auto ${policy === 'auto' ? 'active' : ''}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><path d="M25,30l-2.1-1c-1.7-0.8-2.9-2.6-2.9-4.5V18h10v6.5c0,1.9-1.1,3.7-2.9,4.5L25,30z M22,20v4.5c0,1.2,0.7,2.2,1.7,2.7l1.3,0.6l1.3-0.6c1-0.5,1.7-1.6,1.7-2.7V20H22z"/><circle cx="22" cy="10" r="2"/><path d="M21,2c-5,0-9,4-9,9c0,0.9,0.1,1.8,0.4,2.6L2,24v6h6l10-10l-1.4-1.4l-2.8,2.8L12.4,20L11,21.4l1.4,1.4l-1.6,1.6L9.4,23L8,24.4l1.4,1.4L7.2,28H4v-3.2l9.8-9.8l0.8-0.8L14.3,13c-0.2-0.7-0.3-1.3-0.3-2c0-3.9,3.1-7,7-7s7,3.1,7,7c0,1.5-0.5,2.9-1.3,4h2.3c0.6-1.2,0.9-2.6,0.9-4C30,6,26,2,21,2z"/></svg>
            <span>Auto-Approve (Fast)</span>
            ${policy === 'auto' ? '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="#16a34a" style="margin-left:auto;width:13px;height:13px;display:inline-block;flex-shrink:0;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>' : ''}
          </button>
          <button class="attach-dropdown-item btn-opt-super ${policy === 'super' ? 'active' : ''}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style="width:14px;height:14px;display:inline-block;flex-shrink:0;"><path d="M20,18v6.5c0,1.9,1.1,3.7,2.9,4.5l2.1,1l2.1-1c1.7-0.8,2.9-2.6,2.9-4.5V18H20z M28,24.5c0,1.2-0.7,2.2-1.7,2.7L25,27.8l-1.3-0.6c-1-0.5-1.7-1.6-1.7-2.7V20h6V24.5z"/><path d="M16,20c-2.2,0-4-1.8-4-4s1.8-4,4-4s4,1.8,4,4h-2c0-1.1-0.9-2-2-2s-2,0.9-2,2s0.9,2,2,2V20z"/><path d="M16,25c-5,0-9-4-9-9s4-9,9-9s9,4,9,9h-2c0-3.9-3.1-7-7-7s-7,3.1-7,7s3.1,7,7,7V25z"/><path d="M16,30C8.3,30,2,23.7,2,16S8.3,2,16,2s14,6.3,14,14h-2c0-6.6-5.4-12-12-12S4,9.4,4,16s5.4,12,12,12V30z"/></svg>
            <span>Super Permission (Full Access)</span>
            ${policy === 'super' ? '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 32 32" fill="#16a34a" style="margin-left:auto;width:13px;height:13px;display:inline-block;flex-shrink:0;"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>' : ''}
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
