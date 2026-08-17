/**
 * model_selector.js — Dynamic Live Model Selector
 * Shows active model in pill (Gemini or Local).
 * When local gateway active: fetches live model list from /api/local_models
 * and shows a scrollable dropdown to switch models instantly.
 */
import { router } from '../router.js';

const googleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; display:inline-block; vertical-align:middle;"><path d="M12 3c0 4.97-4.03 9-9 9 4.97 0 9 4.03 9 9 0-4.97 4.03-9 9-9-4.97 0-9-4.03-9-9z"/></svg>`;

const localIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; display:inline-block; vertical-align:middle;"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

const cloudIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; display:inline-block; vertical-align:middle;"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>`;

const chevronIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px; opacity:0.6;"><polyline points="6 9 12 15 18 9"/></svg>`;

export const modelDroplistSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;display:block;"><path d="M16,21a5,5,0,1,1,5-5A5.0057,5.0057,0,0,1,16,21Zm0-8a3,3,0,1,0,3,3A3.0033,3.0033,0,0,0,16,13Z"/><path d="M26.86,12.4805h0a12.9277,12.9277,0,0,0-4.8575-4.9991q.2044-.213.4424-.4589h0c.82-.8482,1.93-1.9825,3.2622-3.3155A1,1,0,0,0,25,2c-.354,0-8.7363.0488-14.269,4.3018h0A12.15,12.15,0,0,0,7.481,9.998c-.1416-.1367-.295-.2841-.4585-.4423C6.1743,8.7349,5.04,7.6255,3.707,6.293A1,1,0,0,0,2,7c0,.3594.05,8.874,4.4058,14.4023a12.1023,12.1023,0,0,0,3.5918,3.1163c-.21.2177-.4346.4516-.6563.68h0c-.7954.8208-1.8286,1.8745-3.0483,3.0943A1,1,0,0,0,7,30c.2856,0,7.061-.0352,12.459-3.1055a12.9618,12.9618,0,0,0,5.06-4.8925q.3062.2937.68.6567c.82.7954,1.8745,1.8286,3.0943,3.0483A1,1,0,0,0,30,25C30,24.7119,29.9644,17.8877,26.86,12.4805Zm-3.03,6.1074-.5469,1.3672A10.5415,10.5415,0,0,1,18.47,25.1562,24.3514,24.3514,0,0,1,9.584,27.8135c.4409-.4492,3.8281-3.9824,3.8281-3.9824l-1.3682-.5474a9.8021,9.8021,0,0,1-4.0668-3.1191c-2.5406-3.2242-3.4585-7.7623-3.79-10.58.5435.5337,3.9815,3.8266,3.9815,3.8266l.5468-1.3672A9.8569,9.8569,0,0,1,11.95,7.8877h0C15.1665,5.415,19.6309,4.5146,22.4155,4.187c-.5332.5435-3.8276,3.9819-3.8276,3.9819l1.3677.5469a10.52,10.52,0,0,1,5.17,4.7608v0a24.29,24.29,0,0,1,2.688,8.94C27.3643,21.9751,23.83,18.5879,23.83,18.5879Z"/></svg>`;

const CLOUD_MODELS = [
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' }
];

/**
 * Shortens a model name for display in the pill:
 * - Strips author prefix e.g. "huihui_ai/qwen2.5-coder-abliterate:3b" → "qwen2.5-coder:3b"
 * - Caps total display length at 22 chars with ellipsis
 */
function formatModelTitle(name) {
  if (!name) return '';
  if (name.toLowerCase().includes('gemini-3.1-flash-lite') || name.toLowerCase() === 'gemini-3.1-flash-lite') {
    return 'Gemini 3.1 Flash Lite';
  }
  return name.replace(/[-_]/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

function truncateModelName(name) {
  if (!name) return name;
  const slashIdx = name.indexOf('/');
  let short = slashIdx !== -1 ? name.slice(slashIdx + 1) : name;
  const tagIdx = short.lastIndexOf(':');
  const tag = tagIdx !== -1 ? short.slice(tagIdx) : '';
  let base = tagIdx !== -1 ? short.slice(0, tagIdx) : short;
  base = base.replace(/-(abliterate|uncensored|instruct|chat|v\d+\.\d+)$/i, '');
  short = base + tag;
  if (short.length > 22) short = short.slice(0, 20) + '…';
  return formatModelTitle(short);
}

// Cached state
let _isLocal = false;
let _activeModel = 'Gemini 3.1 Flash Lite';
let _localModels = [];
let _dropdownOpen = false;
let _dropdownEl = null;
let _dropdownCloseHandler = null;

async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const data = await res.json();
    _isLocal = !!(data.use_local_gateway || data.use_ollama);
    _activeModel = _isLocal
      ? (data.local_model || data.ollama_model || 'Local Model')
      : (data.hekki_model || 'gemini-3.1-flash-lite');
  } catch (_) {}
}

async function fetchLocalModels() {
  try {
    const res = await fetch('/api/local_models');
    if (!res.ok) return;
    const data = await res.json();
    _localModels = Array.isArray(data.models) ? data.models : [];
  } catch (_) {
    _localModels = [];
  }
}

async function switchCloudModel(modelId) {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_local_gateway: false, use_ollama: false, hekki_model: modelId })
    });
    _isLocal = false;
    _activeModel = modelId;
    await updateModelPills();
    closeDropdown();
  } catch (_) {}
}

async function switchLocalModel(modelName) {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_local_gateway: true, use_ollama: true, local_model: modelName, ollama_model: modelName })
    });
    _isLocal = true;
    _activeModel = modelName;
    await updateModelPills();
    closeDropdown();
  } catch (_) {}
}

function closeDropdown() {
  if (_dropdownEl) {
    _dropdownEl.remove();
    _dropdownEl = null;
  }
  if (_dropdownCloseHandler) {
    document.removeEventListener('click', _dropdownCloseHandler);
    _dropdownCloseHandler = null;
  }
  _dropdownOpen = false;
}

function openLocalModelDropdown(anchorBtn) {
  if (_dropdownOpen) {
    closeDropdown();
    return;
  }

  _dropdownOpen = true;
  const dropdown = document.createElement('div');
  dropdown.id = 'local-model-dropdown';
  dropdown.style.cssText = [
    'position: fixed',
    'z-index: 999999',
    'background: var(--card, #1c1c1e)',
    'border: 1px solid var(--border, #333)',
    'border-radius: 10px',
    'padding: 6px',
    'min-width: 220px',
    'max-width: 280px',
    'max-height: 340px',
    'overflow-y: auto',
    'display: flex',
    'flex-direction: column',
    'gap: 2px',
    'box-shadow: 0 10px 25px rgba(0,0,0,0.25)',
  ].join(';');

  const rect = anchorBtn.getBoundingClientRect();
  dropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  dropdown.style.top = 'auto';
  dropdown.style.left = `${Math.max(12, rect.left)}px`;

  if (_isLocal) {
    // === LOCAL GATEWAY MODE: Show ONLY Local Models ===

    if (_localModels.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:12.5px; color:var(--text-3,#888); padding:6px 10px; font-style:italic;';
      empty.textContent = 'No local models found (Ollama offline)';
      dropdown.appendChild(empty);
    } else {
      _localModels.forEach(modelName => {
        const btn = document.createElement('button');
        const isActive = modelName === _activeModel;
        btn.style.cssText = [
          'display: flex',
          'align-items: center',
          'gap: 8px',
          'width: 100%',
          'padding: 7px 10px',
          'border: none',
          'border-radius: 7px',
          'background: ' + (isActive ? 'var(--hover, rgba(255,255,255,0.08))' : 'transparent'),
          'color: var(--text, inherit)',
          'font-size: 13px',
          'font-weight: 400',
          'font-family: var(--font, inherit)',
          'cursor: pointer',
          'text-align: left',
        ].join(';');
        btn.innerHTML = `${localIcon}<span style="flex:1;white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.3;">${modelName}</span>`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          switchLocalModel(modelName);
        });
        btn.addEventListener('mouseover', () => {
          if (!isActive) {
            btn.style.background = 'var(--hover, rgba(255,255,255,0.08))';
            btn.style.color = 'var(--text, inherit)';
          }
        });
        btn.addEventListener('mouseout', () => {
          if (!isActive) {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text, inherit)';
          }
        });
        dropdown.appendChild(btn);
      });
    }

    // Switch to Cloud Gateway Option
    const switchBtn = document.createElement('button');
    switchBtn.style.cssText = 'display:flex; align-items:center; gap:8px; width:100%; padding:7px 10px; border:none; border-top:1px solid var(--border,rgba(255,255,255,0.08)); border-radius:0 0 7px 7px; background:transparent; color:var(--text-3,#888); font-size:12px; font-weight:400; cursor:pointer; margin-top:4px; text-align:left;';
    switchBtn.innerHTML = `${cloudIcon}<span style="flex:1;">Switch to Cloud Gemini</span>`;
    switchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchCloudModel('gemini-3.1-flash-lite');
    });
    switchBtn.addEventListener('mouseover', () => { switchBtn.style.color = 'var(--text, inherit)'; });
    switchBtn.addEventListener('mouseout', () => { switchBtn.style.color = 'var(--text-3,#888)'; });
    dropdown.appendChild(switchBtn);

  } else {
    // === CLOUD GEMINI MODE: Show ONLY Real Official Gemini Cloud Models ===

    CLOUD_MODELS.forEach(m => {
      const btn = document.createElement('button');
      const isActive = _activeModel === m.id || _activeModel === m.name;
      btn.style.cssText = [
        'display: flex',
        'align-items: center',
        'gap: 8px',
        'width: 100%',
        'padding: 7px 10px',
        'border: none',
        'border-radius: 7px',
        'background: ' + (isActive ? 'var(--hover, rgba(255,255,255,0.08))' : 'transparent'),
        'color: var(--text, inherit)',
        'font-size: 13px',
        'font-weight: 400',
        'font-family: var(--font, inherit)',
        'cursor: pointer',
        'text-align: left',
      ].join(';');
      btn.innerHTML = `${googleIcon}<span style="flex:1;white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.3;">${m.name}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        switchCloudModel(m.id);
      });
      btn.addEventListener('mouseover', () => {
        if (!isActive) {
          btn.style.background = 'var(--hover, rgba(255,255,255,0.08))';
          btn.style.color = 'var(--text, inherit)';
        }
      });
      btn.addEventListener('mouseout', () => {
        if (!isActive) {
          btn.style.background = 'transparent';
          btn.style.color = 'var(--text, inherit)';
        }
      });
      dropdown.appendChild(btn);
    });

    // Switch to Local Gateway Option
    const switchBtn = document.createElement('button');
    switchBtn.style.cssText = 'display:flex; align-items:center; gap:8px; width:100%; padding:7px 10px; border:none; border-top:1px solid var(--border,rgba(255,255,255,0.08)); border-radius:0 0 7px 7px; background:transparent; color:var(--text-3,#888); font-size:12px; cursor:pointer; margin-top:4px; text-align:left;';
    switchBtn.innerHTML = `${localIcon}<span style="flex:1;">Switch to Local Gateway</span>`;
    switchBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await fetchLocalModels();
      const firstLocal = _localModels.length > 0 ? _localModels[0] : 'llama3.2';
      switchLocalModel(firstLocal);
    });
    switchBtn.addEventListener('mouseover', () => { switchBtn.style.color = 'var(--text, inherit)'; });
    switchBtn.addEventListener('mouseout', () => { switchBtn.style.color = 'var(--text-3,#888)'; });
    dropdown.appendChild(switchBtn);
  }

  document.body.appendChild(dropdown);
  _dropdownEl = dropdown;

  // Close on outside click
  setTimeout(() => {
    if (_dropdownCloseHandler) document.removeEventListener('click', _dropdownCloseHandler);
    _dropdownCloseHandler = function(e) {
      if (!dropdown.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener('click', _dropdownCloseHandler);
  }, 0);
}

export async function updateModelPills() {
  await fetchSettings();
  await fetchLocalModels();

  const rawLabel = _isLocal ? truncateModelName(_activeModel) : _activeModel;
  const label = formatModelTitle(rawLabel);

  document.querySelectorAll('.model-pill').forEach(btn => {
    btn.innerHTML = modelDroplistSvg;
    btn.style.cursor = 'pointer';
    btn.title = `Switch AI Model (Active: ${label})`;
  });
}

export function bindModelPills() {
  document.querySelectorAll('.model-pill').forEach(btn => {
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', async (e) => {
      e.stopPropagation();
      await fetchLocalModels();
      openLocalModelDropdown(fresh);
    });
  });
}

export function registerModelPillRefresh() {
  router.onRefresh(async () => {
    await updateModelPills();
    bindModelPills();
  });
  // Run immediately on boot
  updateModelPills().then(() => bindModelPills());
}
