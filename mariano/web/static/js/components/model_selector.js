/**
 * model_selector.js — Advanced Multi-Level Model Selector Dropdown with Flyouts
 * Supports Gemini 3.7/3.6/3.5 Flash, 3.1 Flash Lite, 3.1 Pro, and thinking depth flyout.
 */
import { router } from '../router.js';

export const modelDroplistSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;display:block;"><path d="M16,21a5,5,0,1,1,5-5A5.0057,5.0057,0,0,1,16,21Zm0-8a3,3,0,1,0,3,3A3.0033,3.0033,0,0,0,16,13Z"/><path d="M26.86,12.4805h0a12.9277,12.9277,0,0,0-4.8575-4.9991q.2044-.213.4424-.4589h0c.82-.8482,1.93-1.9825,3.2622-3.3155A1,1,0,0,0,25,2c-.354,0-8.7363.0488-14.269,4.3018h0A12.15,12.15,0,0,0,7.481,9.998c-.1416-.1367-.295-.2841-.4585-.4423C6.1743,8.7349,5.04,7.6255,3.707,6.293A1,1,0,0,0,2,7c0,.3594.05,8.874,4.4058,14.4023a12.1023,12.1023,0,0,0,3.5918,3.1163c-.21.2177-.4346.4516-.6563.68h0c-.7954.8208-1.8286,1.8745-3.0483,3.0943A1,1,0,0,0,7,30c.2856,0,7.061-.0352,12.459-3.1055a12.9618,12.9618,0,0,0,5.06-4.8925q.3062.2937.68.6567c.82.7954,1.8745,1.8286,3.0943,3.0483A1,1,0,0,0,30,25C30,24.7119,29.9644,17.8877,26.86,12.4805Zm-3.03,6.1074-.5469,1.3672A10.5415,10.5415,0,0,1,18.47,25.1562,24.3514,24.3514,0,0,1,9.584,27.8135c.4409-.4492,3.8281-3.9824,3.8281-3.9824l-1.3682-.5474a9.8021,9.8021,0,0,1-4.0668-3.1191c-2.5406-3.2242-3.4585-7.7623-3.79-10.58.5435.5337,3.9815,3.8266,3.9815,3.8266l.5468-1.3672A9.8569,9.8569,0,0,1,11.95,7.8877h0C15.1665,5.415,19.6309,4.5146,22.4155,4.187c-.5332.5435-3.8276,3.9819-3.8276,3.9819l1.3677.5469a10.52,10.52,0,0,1,5.17,4.7608v0a24.29,24.29,0,0,1,2.688,8.94C27.3643,21.9751,23.83,18.5879,23.83,18.5879Z"/></svg>`;

const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-primary, #2563EB);"><polyline points="20 6 9 17 4 12"/></svg>`;
const chevronRight = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><polyline points="9 18 15 12 9 6"/></svg>`;
const infoIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5; margin-left:3px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

export const OFFICIAL_MODELS = [
  { id: 'gemini-3.5-flash',      name: 'Gemini 3.5 Flash',      rpm: '5 RPM',  tpm: '250K TPM', rpd: '20 RPD',  hasThinking: true },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', rpm: '15 RPM', tpm: '250K TPM', rpd: '500 RPD', hasThinking: true },
  { id: 'gemini-3.6-flash',      name: 'Gemini 3.6 Flash',      rpm: '5 RPM',  tpm: '250K TPM', rpd: '20 RPD',  hasThinking: true },
  { id: 'gemini-3.7-flash',      name: 'Gemini 3.7 Flash',      rpm: '5 RPM',  tpm: '250K TPM', rpd: '20 RPD',  hasThinking: true }
];

export const THINKING_LEVELS = [
  { key: 'fast',     label: 'Low',    desc: 'Fast / Low Thinking Budget' },
  { key: 'pro',      label: 'Medium', desc: 'Balanced Thinking' },
  { key: 'thinking', label: 'High',   desc: 'Deep Step-by-Step Reasoning' }
];

// Cached state
let _isLocal = false;
let _activeModel = 'gemini-3.5-flash-lite';
let _activeReasoning = 'fast';
let _localModels = [];
let _dropdownEl = null;
let _submenuEl = null;
let _closeHandler = null;

async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const data = await res.json();
    _isLocal = !!(data.use_local_gateway || data.use_ollama);
    _activeModel = _isLocal
      ? (data.local_model || data.ollama_model || 'Local Model')
      : (data.hekki_model || 'gemini-3.5-flash-lite');
    _activeReasoning = data.reasoning_mode || 'fast';
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

export async function selectModel(modelId, reasoningMode = null) {
  try {
    const payload = {
      use_local_gateway: false,
      use_ollama: false,
      hekki_model: modelId
    };
    if (reasoningMode) {
      payload.reasoning_mode = reasoningMode;
      _activeReasoning = reasoningMode;
    }
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    _isLocal = false;
    _activeModel = modelId;
    await updateModelPills();
    closeAllDropdowns();
  } catch (err) {
    console.error('[ModelSelector] Error saving model:', err);
  }
}

function closeSubmenu() {
  if (_submenuEl) {
    _submenuEl.remove();
    _submenuEl = null;
  }
}

export function closeAllDropdowns() {
  closeSubmenu();
  if (_dropdownEl) {
    _dropdownEl.remove();
    _dropdownEl = null;
  }
  if (_closeHandler) {
    document.removeEventListener('click', _closeHandler);
    _closeHandler = null;
  }
}

function formatLevelLabel(key) {
  if (key === 'fast') return 'Low';
  if (key === 'thinking') return 'High';
  return 'Medium';
}

function getDisplayTitle(modelId) {
  const found = OFFICIAL_MODELS.find(m => m.id === modelId);
  return found ? found.name : modelId;
}

export function openModelDropdown(anchorBtn) {
  if (_dropdownEl) {
    closeAllDropdowns();
    return;
  }

  const dropdown = document.createElement('div');
  dropdown.id = 'model-nested-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    z-index: 999999;
    background: var(--bg-card, #1c1c1e);
    border: none !important;
    border-radius: var(--radius-md, 12px);
    padding: 10px 8px;
    min-width: 255px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: none !important;
    font-family: var(--font, sans-serif);
  `;

  // Position relative to anchor pill
  const rect = anchorBtn.getBoundingClientRect();
  dropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  dropdown.style.left = `${Math.max(12, rect.left)}px`;

  // Header Title
  const header = document.createElement('div');
  header.style.cssText = 'font-size:10.5px; color:var(--text-3, #888); padding:2px 8px 6px; font-weight:400; text-transform:none;';
  header.innerText = 'Model';
  dropdown.appendChild(header);

  // Model Items
  OFFICIAL_MODELS.forEach(m => {
    const item = document.createElement('div');
    const isCurrentModel = _activeModel === m.id;
    const currentLevelLabel = formatLevelLabel(_activeReasoning);

    item.className = 'model-menu-row';
    item.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 10px;
      border-radius: var(--radius-sm, 7px);
      background: ${isCurrentModel ? 'var(--hover, rgba(255,255,255,0.06))' : 'transparent'};
      color: var(--text-primary, #FFF);
      font-size: 12px;
      font-weight: 400;
      cursor: ${m.disabled ? 'not-allowed' : 'pointer'};
      opacity: ${m.disabled ? '0.5' : '1'};
      transition: background 0.12s ease;
      user-select: none;
      position: relative;
    `;

    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; flex:1; overflow:hidden;">
        <span style="white-space:nowrap; font-weight:400; font-size:12px; text-overflow:ellipsis; overflow:hidden;">${m.name}</span>
        ${m.hasThinking ? `<span style="font-size:9.5px; font-weight:400; color:var(--text-3); background:var(--input-bg); padding:1.5px 6px; border-radius:9999px;">${isCurrentModel ? currentLevelLabel : 'Medium'}</span>` : ''}
        <span class="model-info-hover" title="${m.name} Limits:\n• Rate: ${m.rpm}\n• Tokens: ${m.tpm}\n• Daily Quota: ${m.rpd}" style="display:inline-flex; align-items:center; cursor:help;">
          ${infoIcon}
        </span>
      </div>
      <div class="row-right-action" style="display:flex; align-items:center; gap:4px;">
        ${m.hasThinking ? chevronRight : (isCurrentModel ? checkIcon : '')}
      </div>
    `;

    if (!m.disabled) {
      item.addEventListener('mouseenter', () => {
        item.style.background = 'var(--hover, rgba(255,255,255,0.08))';
        if (m.hasThinking) {
          openThinkingSubmenu(item, m.id);
        } else {
          closeSubmenu();
        }
      });

      item.addEventListener('mouseleave', (e) => {
        if (!_submenuEl || !_submenuEl.contains(e.relatedTarget)) {
          if (!isCurrentModel) item.style.background = 'transparent';
        }
      });

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectModel(m.id);
      });
    }

    dropdown.appendChild(item);
  });

  // Divider
  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px; background:var(--hover, rgba(255,255,255,0.08)); margin:6px 0 4px;';
  dropdown.appendChild(divider);

  // View Usage Row
  const usageRow = document.createElement('div');
  usageRow.className = 'model-menu-row model-usage-row';
  usageRow.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 10px;
    border-radius: var(--radius-sm, 7px);
    background: transparent;
    color: var(--text-primary, #FFF);
    font-size: 12px;
    font-weight: 400;
    cursor: pointer;
    transition: background 0.12s ease;
    user-select: none;
  `;
  usageRow.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span style="font-weight:400; font-size:12px;">View Usage</span>
    </div>
    <div style="display:flex; align-items:center;">
      ${chevronRight}
    </div>
  `;

  usageRow.addEventListener('mouseenter', () => {
    usageRow.style.background = 'var(--hover, rgba(255,255,255,0.08))';
    openUsageSubmenu(usageRow);
  });

  usageRow.addEventListener('mouseleave', (e) => {
    if (!_submenuEl || !_submenuEl.contains(e.relatedTarget)) {
      usageRow.style.background = 'transparent';
    }
  });

  usageRow.addEventListener('click', (e) => {
    e.stopPropagation();
    openUsageSubmenu(usageRow);
  });

  dropdown.appendChild(usageRow);

  document.body.appendChild(dropdown);
  _dropdownEl = dropdown;

  setTimeout(() => {
    _closeHandler = (e) => {
      if ((!_dropdownEl || !_dropdownEl.contains(e.target)) && (!_submenuEl || !_submenuEl.contains(e.target))) {
        closeAllDropdowns();
      }
    };
    document.addEventListener('click', _closeHandler);
  }, 0);
}

async function openUsageSubmenu(parentRow) {
  closeSubmenu();

  const submenu = document.createElement('div');
  submenu.id = 'model-usage-submenu';
  submenu.style.cssText = `
    position: fixed;
    z-index: 1000000;
    background: var(--bg-card, #1c1c1e);
    border: none !important;
    border-radius: var(--radius-md, 12px);
    padding: 10px 12px;
    min-width: 220px;
    max-width: 260px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: none !important;
    font-family: var(--font, sans-serif);
  `;

  const dropdownRect = _dropdownEl ? _dropdownEl.getBoundingClientRect() : parentRow.getBoundingClientRect();
  const parentRect = parentRow.getBoundingClientRect();
  const flyoutGap = 8;
  const submenuWidth = 260;

  submenu.style.bottom = `${window.innerHeight - parentRect.bottom}px`;
  
  if (dropdownRect.right + submenuWidth + flyoutGap > window.innerWidth) {
    submenu.style.left = `${dropdownRect.left - submenuWidth - flyoutGap}px`;
  } else {
    submenu.style.left = `${dropdownRect.right + flyoutGap}px`;
  }

  submenu.innerHTML = `
    <div style="font-size:10.5px; color:var(--text-3, #888); font-weight:600; text-transform:none;">Gemini Models</div>
    <div style="font-size:11px; color:var(--text-3); font-style:italic;">Loading live usage...</div>
  `;

  document.body.appendChild(submenu);
  _submenuEl = submenu;

  submenu.addEventListener('mouseleave', (e) => {
    if (!parentRow.contains(e.relatedTarget)) {
      closeSubmenu();
    }
  });

  try {
    const res = await fetch('/api/rate-limits/usage');
    if (!res.ok) return;
    const data = await res.json();

    const ringSvg = (pct, color = '#22C55E') => {
      const radius = 8;
      const circ = 2 * Math.PI * radius;
      const strokeDashoffset = circ - (pct / 100) * circ;
      return `
        <svg width="22" height="22" viewBox="0 0 22 22" style="transform:rotate(-90deg); flex-shrink:0;">
          <circle cx="11" cy="11" r="${radius}" stroke="var(--hover, rgba(255,255,255,0.1))" stroke-width="2.5" fill="none"/>
          <circle cx="11" cy="11" r="${radius}" stroke="${color}" stroke-width="2.5" stroke-dasharray="${circ}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" fill="none"/>
        </svg>
      `;
    };

    const dColor = data.daily.remaining_pct < 20 ? '#EF4444' : '#22C55E';
    const mColor = data.minute.remaining_pct < 20 ? '#EF4444' : '#22C55E';

    submenu.innerHTML = `
      <div style="font-size:10.5px; color:var(--text-3, #888); font-weight:600; text-transform:none;">Gemini Models</div>
      
      <!-- Daily Limit -->
      <div style="display:flex; flex-direction:column; gap:2px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span style="font-size:12px; font-weight:500; color:var(--text-primary, #FFF);">Daily Limit Remaining</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${data.daily.remaining_pct}%</span>
            ${ringSvg(data.daily.remaining_pct, dColor)}
          </div>
        </div>
        <span style="font-size:10px; color:var(--text-3, #888); line-height:1.3;">${data.daily.desc}</span>
      </div>

      <div style="height:1px; background:var(--hover, rgba(255,255,255,0.06)); margin:2px 0;"></div>

      <!-- Minute Limit -->
      <div style="display:flex; flex-direction:column; gap:2px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span style="font-size:12px; font-weight:500; color:var(--text-primary, #FFF);">Minute Rate Remaining</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${data.minute.remaining_pct}%</span>
            ${ringSvg(data.minute.remaining_pct, mColor)}
          </div>
        </div>
        <span style="font-size:10px; color:var(--text-3, #888); line-height:1.3;">${data.minute.desc}</span>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load usage stats:', err);
  }
}

function openThinkingSubmenu(parentRow, modelId) {
  closeSubmenu();

  const submenu = document.createElement('div');
  submenu.id = 'model-thinking-submenu';
  submenu.style.cssText = `
    position: fixed;
    z-index: 1000000;
    background: var(--bg-card, #1c1c1e);
    border: none !important;
    border-radius: var(--radius-md, 10px);
    padding: 5px;
    min-width: 130px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-shadow: none !important;
    font-family: var(--font, sans-serif);
  `;

  const dropdownRect = _dropdownEl ? _dropdownEl.getBoundingClientRect() : parentRow.getBoundingClientRect();
  const parentRect = parentRow.getBoundingClientRect();
  const flyoutGap = 8;
  const submenuWidth = 135;

  submenu.style.top = `${parentRect.top}px`;

  if (dropdownRect.right + submenuWidth + flyoutGap > window.innerWidth) {
    submenu.style.left = `${dropdownRect.left - submenuWidth - flyoutGap}px`;
  } else {
    submenu.style.left = `${dropdownRect.right + flyoutGap}px`;
  }

  THINKING_LEVELS.forEach(lvl => {
    const btn = document.createElement('div');
    const isLevelActive = (_activeModel === modelId && _activeReasoning === lvl.key);

    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px;
      border-radius: var(--radius-sm, 5px);
      background: ${isLevelActive ? 'var(--hover, rgba(255,255,255,0.06))' : 'transparent'};
      color: var(--text-primary, #FFF);
      font-size: 12px;
      font-weight: 400;
      cursor: pointer;
      transition: background 0.12s ease;
    `;

    btn.innerHTML = `
      <span style="font-weight:400; font-size:12px;">${lvl.label}</span>
      ${isLevelActive ? checkIcon : ''}
    `;

    btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--hover, rgba(255,255,255,0.08))'; });
    btn.addEventListener('mouseleave', () => { if (!isLevelActive) btn.style.background = 'transparent'; });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectModel(modelId, lvl.key);
    });

    submenu.appendChild(btn);
  });

  submenu.addEventListener('mouseleave', (e) => {
    if (!parentRow.contains(e.relatedTarget)) {
      closeSubmenu();
    }
  });

  document.body.appendChild(submenu);
  _submenuEl = submenu;
}

export async function updateModelPills() {
  await fetchSettings();
  const label = getDisplayTitle(_activeModel);
  const level = formatLevelLabel(_activeReasoning);

  document.querySelectorAll('.model-pill').forEach(btn => {
    btn.innerHTML = modelDroplistSvg;
    btn.style.cursor = 'pointer';
    btn.title = `Switch AI Model (Active: ${label} [${level}])`;
  });
}

export function bindModelPills() {
  document.querySelectorAll('.model-pill').forEach(btn => {
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', async (e) => {
      e.stopPropagation();
      await fetchSettings();
      openModelDropdown(fresh);
    });
  });
}

export function registerModelPillRefresh() {
  router.onRefresh(async () => {
    await updateModelPills();
    bindModelPills();
  });
  updateModelPills().then(() => bindModelPills());
}
