/**
 * model_selector.js — Advanced Responsive Model Selector Dropdown & Quota Submenu
 * Supports Gemini 3.5/3.1 Flash Lite models,
 * reasoning levels, and live rate-limit quotas with adaptive positioning.
 */

import { router } from '../router.js';
import {
  modelDroplistSvg,
  checkIcon,
  chevronRight,
  infoIcon,
  OFFICIAL_MODELS,
  ALL_UI_MODELS,
  THINKING_LEVELS,
  formatLevelLabel,
  getDisplayTitle
} from './model_selector_data.js';

import { openUsageSubmenu } from './model_selector_usage.js';

// Cached state
let _isLocal = false;
let _activeModel = 'gemini-3.5-flash-lite';
let _activeReasoning = 'fast';
let _dropdownEl = null;
let _submenuEl = null;
let _activeSubmenuRow = null;
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
  if (_activeSubmenuRow) {
    _activeSubmenuRow.classList.remove('is-submenu-open');
    _activeSubmenuRow = null;
  }
  if (_submenuEl) {
    if (typeof _submenuEl.remove === 'function') {
      _submenuEl.remove();
    }
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

/**
 * Adaptive smart positioning for dropdown and submenus
 */
function positionPopup(el, anchorRect, preferredWidth, isSubmenu = false, parentDropdownRect = null) {
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const elWidth = Math.min(preferredWidth, vw - (pad * 2));

  el.style.maxWidth = `${vw - (pad * 2)}px`;
  el.style.boxSizing = 'border-box';

  if (!isSubmenu) {
    let left = anchorRect.left;
    if (left + elWidth > vw - pad) {
      left = vw - elWidth - pad;
    }
    left = Math.max(pad, left);
    el.style.left = `${left}px`;

    if (anchorRect.top > 260) {
      el.style.bottom = `${vh - anchorRect.top + 8}px`;
      el.style.top = 'auto';
      el.style.maxHeight = `${anchorRect.top - 20}px`;
    } else {
      el.style.top = `${anchorRect.bottom + 8}px`;
      el.style.bottom = 'auto';
      el.style.maxHeight = `${vh - anchorRect.bottom - 20}px`;
    }
    el.style.overflowY = 'auto';
  } else {
    const dropRect = parentDropdownRect || anchorRect;
    const flyoutGap = 6;
    const canFitRight = (dropRect.right + elWidth + flyoutGap + pad <= vw);
    const canFitLeft = (dropRect.left - elWidth - flyoutGap >= pad);

    if (vw >= 640 && (canFitRight || canFitLeft)) {
      if (canFitRight) {
        el.style.left = `${dropRect.right + flyoutGap}px`;
      } else {
        el.style.left = `${dropRect.left - elWidth - flyoutGap}px`;
      }

      const bottomSpace = vh - anchorRect.bottom;
      if (anchorRect.top + 180 > vh - pad) {
        el.style.bottom = `${Math.max(pad, bottomSpace)}px`;
        el.style.top = 'auto';
      } else {
        el.style.top = `${Math.max(pad, anchorRect.top)}px`;
        el.style.bottom = 'auto';
      }
    } else {
      let left = Math.max(pad, Math.min(dropRect.left, vw - elWidth - pad));
      el.style.left = `${left}px`;
      el.style.width = `${Math.min(elWidth, Math.max(dropRect.width, 240))}px`;

      if (dropRect.top > 220) {
        el.style.bottom = `${vh - dropRect.top + flyoutGap}px`;
        el.style.top = 'auto';
      } else {
        el.style.top = `${dropRect.bottom + flyoutGap}px`;
        el.style.bottom = 'auto';
      }
    }
  }
}

function createModelRow(m) {
  const item = document.createElement('div');
  const isCurrentModel = _activeModel === m.id;
  const currentLevelLabel = formatLevelLabel(_activeReasoning);

  item.className = `model-menu-row ${isCurrentModel ? 'is-active-model' : ''}`;
  item.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-radius: var(--radius-sm, 7px);
    color: var(--text-primary, #FFF);
    font-size: 12.5px;
    font-weight: 400;
    cursor: ${m.disabled ? 'not-allowed' : 'pointer'};
    opacity: ${m.disabled ? '0.5' : '1'};
    user-select: none;
    position: relative;
  `;

  // Badge text: active model displays active level, inactive displays Think or badge
  const badgeText = isCurrentModel
    ? (m.hasThinking ? currentLevelLabel : 'Active')
    : (m.hasThinking ? 'Reasoning' : m.badge);

  item.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; flex:1; overflow:hidden;">
      <span style="white-space:nowrap; font-weight:400; font-size:12.5px; text-overflow:ellipsis; overflow:hidden;">${m.name}</span>
      <span style="font-size:9.5px; font-weight:500; color:var(--text-3); background:var(--input-bg); padding:1.5px 6px; border-radius:9999px;">${badgeText}</span>
      <span class="model-info-hover" title="${m.name} Limits:\n• Rate: ${m.rpm}\n• Tokens/Context: ${m.tpm}\n• Daily Quota: ${m.rpd}" style="display:inline-flex; align-items:center; cursor:help;">
        ${infoIcon}
      </span>
    </div>
    <div class="row-right-action" style="display:flex; align-items:center; gap:4px;">
      ${m.hasThinking ? chevronRight : (isCurrentModel ? checkIcon : '')}
    </div>
  `;

  if (!m.disabled) {
    item.addEventListener('mouseenter', () => {
      if (m.hasThinking) {
        openThinkingSubmenu(item, m.id);
      } else {
        closeSubmenu();
      }
    });

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      selectModel(m.id);
    });
  }

  return item;
}

export function openModelDropdown(anchorBtn) {
  if (_dropdownEl) {
    closeAllDropdowns();
    return;
  }

  // Inject scoped styles for clean CSS-driven hover without sticky JS background bugs
  if (!document.getElementById('model-selector-scoped-style')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'model-selector-scoped-style';
    styleTag.textContent = `
      #model-nested-dropdown .model-menu-row {
        background: transparent;
        transition: background 0.1s ease;
      }
      #model-nested-dropdown .model-menu-row.is-active-model {
        background: var(--hover, rgba(255, 255, 255, 0.05));
      }
      #model-nested-dropdown .model-menu-row:hover,
      #model-nested-dropdown .model-menu-row.is-submenu-open {
        background: var(--hover, rgba(255, 255, 255, 0.09)) !important;
      }
      #model-thinking-submenu .thinking-level-btn:hover {
        background: var(--hover, rgba(255, 255, 255, 0.09)) !important;
      }
    `;
    document.head.appendChild(styleTag);
  }

  const dropdown = document.createElement('div');
  dropdown.id = 'model-nested-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    z-index: 999999;
    background: var(--bg-card, #1c1c1e);
    border: none !important;
    border-radius: var(--radius-md, 12px);
    padding: 8px;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    box-shadow: none !important;
    font-family: var(--font, sans-serif);
  `;

  const rect = anchorBtn.getBoundingClientRect();
  positionPopup(dropdown, rect, 270, false);

  // 1. Gemini Section
  const geminiHeader = document.createElement('div');
  geminiHeader.style.cssText = 'font-size:11px; color:var(--text-3, #888); padding:2px 8px 3px; font-weight:500; text-transform:none;';
  geminiHeader.innerText = 'Gemini (Official)';
  dropdown.appendChild(geminiHeader);

  OFFICIAL_MODELS.forEach(m => {
    dropdown.appendChild(createModelRow(m));
  });


  // 3. Usage & Quotas Footer
  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px; background:var(--hover, rgba(255,255,255,0.08)); margin:4px 0 3px;';
  dropdown.appendChild(divider);

  const usageRow = document.createElement('div');
  usageRow.className = 'model-menu-row model-usage-row';
  usageRow.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-radius: var(--radius-sm, 7px);
    color: var(--text-primary, #FFF);
    font-size: 12.5px;
    font-weight: 400;
    cursor: pointer;
    user-select: none;
  `;
  usageRow.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span style="font-weight:400; font-size:12.5px;">View Usage</span>
    </div>
    <div style="display:flex; align-items:center;">
      ${chevronRight}
    </div>
  `;

  usageRow.addEventListener('mouseenter', () => {
    closeSubmenu();
    usageRow.classList.add('is-submenu-open');
    _activeSubmenuRow = usageRow;
    _submenuEl = openUsageSubmenu(usageRow, _dropdownEl, closeSubmenu, positionPopup);
  });

  usageRow.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSubmenu();
    usageRow.classList.add('is-submenu-open');
    _activeSubmenuRow = usageRow;
    _submenuEl = openUsageSubmenu(usageRow, _dropdownEl, closeSubmenu, positionPopup);
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

function openThinkingSubmenu(parentRow, modelId) {
  closeSubmenu();

  parentRow.classList.add('is-submenu-open');
  _activeSubmenuRow = parentRow;

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
  positionPopup(submenu, parentRect, 135, true, dropdownRect);

  THINKING_LEVELS.forEach(lvl => {
    const btn = document.createElement('div');
    const isLevelActive = (_activeModel === modelId && _activeReasoning === lvl.key);

    btn.className = 'thinking-level-btn';
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
      transition: background 0.1s ease;
    `;

    btn.innerHTML = `
      <span style="font-weight:400; font-size:12px;">${lvl.label}</span>
      ${isLevelActive ? checkIcon : ''}
    `;

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
