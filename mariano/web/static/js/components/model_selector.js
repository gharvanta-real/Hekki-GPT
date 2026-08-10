/**
 * model_selector.js — Dynamic Live Model Selector
 * Shows active model in pill (Gemini or Local).
 * When local gateway active: fetches live model list from /api/local_models
 * and shows a scrollable dropdown to switch models instantly.
 */
import { router } from '../router.js';

const googleIcon = `<svg class="brand-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" style="margin-right:4px; display:inline-block; vertical-align:middle;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.57-1.04-1.34-1.19-2.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;

const localIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; display:inline-block; vertical-align:middle;"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

const chevronIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px; opacity:0.5;"><polyline points="6 9 12 15 18 9"/></svg>`;

/**
 * Shortens a model name for display in the pill:
 * - Strips author prefix e.g. "huihui_ai/qwen2.5-coder-abliterate:3b" → "qwen2.5-coder:3b"
 * - Caps total display length at 22 chars with ellipsis
 */
function truncateModelName(name) {
  if (!name) return name;
  // Strip author namespace prefix (e.g. "huihui_ai/")
  const slashIdx = name.indexOf('/');
  let short = slashIdx !== -1 ? name.slice(slashIdx + 1) : name;
  // Strip long descriptors like "-abliterate", "-instruct", "-uncensored" etc. before the tag
  const tagIdx = short.lastIndexOf(':');
  const tag = tagIdx !== -1 ? short.slice(tagIdx) : '';
  let base = tagIdx !== -1 ? short.slice(0, tagIdx) : short;
  // Remove common long suffixes
  base = base.replace(/-(abliterate|uncensored|instruct|chat|v\d+\.\d+)$/i, '');
  short = base + tag;
  // Cap at 22 chars
  if (short.length > 22) short = short.slice(0, 20) + '…';
  return short;
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
      : (data.hekki_model || 'Gemini 3.1 Flash Lite');
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

async function switchLocalModel(modelName) {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local_model: modelName, ollama_model: modelName })
    });
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
    'background: var(--card, #fff)',
    'border-radius: 10px',
    'padding: 6px',
    'min-width: 220px',
    'max-height: 260px',
    'overflow-y: auto',
    'display: flex',
    'flex-direction: column',
    'gap: 2px',
  ].join(';');

  const rect = anchorBtn.getBoundingClientRect();
  dropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`;
  dropdown.style.left = `${Math.max(12, rect.left)}px`;

  const header = document.createElement('div');
  header.style.cssText = 'font-size:10px; font-weight:600; color:var(--text-3,#888); padding:4px 8px 6px; letter-spacing:0.04em; text-transform:uppercase;';
  header.textContent = 'Local Models';
  dropdown.appendChild(header);

  if (_localModels.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12px; color:var(--text-3,#888); padding:8px 10px;';
    empty.textContent = 'No models found. Is Ollama running?';
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
        'background: ' + (isActive ? 'var(--hover, #f1f5f9)' : 'transparent'),
        'color: var(--text, #111)',
        'font-size: 12px',
        'font-weight: ' + (isActive ? '600' : '400'),
        'font-family: var(--font, inherit)',
        'cursor: pointer',
        'text-align: left',
      ].join(';');
      btn.innerHTML = `${localIcon}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${modelName}</span>${isActive ? '<span style="font-size:10px;color:var(--text-3,#888);">Active</span>' : ''}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        switchLocalModel(modelName);
      });
      btn.addEventListener('mouseover', () => { if (!isActive) btn.style.background = 'var(--hover, #f1f5f9)'; });
      btn.addEventListener('mouseout', () => { if (!isActive) btn.style.background = 'transparent'; });
      dropdown.appendChild(btn);
    });
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
  if (_isLocal) {
    await fetchLocalModels();
  }

  const icon = _isLocal ? localIcon : googleIcon;
  const label = _isLocal ? truncateModelName(_activeModel) : _activeModel;
  const showChevron = _isLocal && _localModels.length > 0;

  document.querySelectorAll('.model-pill').forEach(btn => {
    btn.innerHTML = `${icon}<span>${label}</span>${showChevron ? chevronIcon : ''}`;
    btn.style.cursor = _isLocal ? 'pointer' : 'default';
    btn.title = _isLocal ? 'Click to switch local model' : label;
  });
}

export function bindModelPills() {
  document.querySelectorAll('.model-pill').forEach(btn => {
    // Remove existing listeners by replacing the node
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!_isLocal) return;
      // Refresh model list before opening
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
