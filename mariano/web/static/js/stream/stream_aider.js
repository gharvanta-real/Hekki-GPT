/**
 * stream_aider.js — Aider terminal console card, live activity step feed, and diff counter.
 */

import { escapeHtml, enhanceMarkdownContent } from '../chat.js';
import { sanitizeHtml } from './stream_utils.js';

let _aiderConsoleCard    = null;
let _aiderConsoleLogArea = null;
let _aiderActive         = false;
let _aiderConsoleRawText = "";

export function isAiderActive() {
  return _aiderActive;
}

export function setAiderActive(val) {
  _aiderActive = !!val;
}

export function ensureAiderConsoleCard(col, enterConversationCallback) {
  if (_aiderConsoleCard) return _aiderConsoleCard;
  enterConversationCallback();

  _aiderConsoleCard = document.createElement('div');
  _aiderConsoleCard.className = 'aider-console-card';
  _aiderConsoleCard.style.background = 'transparent';
  _aiderConsoleCard.style.margin = '14px 0';
  _aiderConsoleCard.style.overflow = 'hidden';

  _aiderConsoleCard.innerHTML = `
    <div class="console-header" style="padding:10px 0; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border); cursor:pointer; user-select:none;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="console-spinner" style="display:inline-block; width:12px; height:12px; border:1.5px solid var(--text-3); border-top-color:var(--text-primary); border-radius:50%; animation:spin 1s linear infinite;"></span>
        <span class="console-title" style="font-weight:600; font-size:14px; color:var(--text-primary); font-family:var(--font);">Aider Agent</span>
        <span id="aider-status-badge" style="font-size:11px; background:var(--hover); color:var(--text-2); padding:1px 6px; border-radius:4px; font-family:var(--font-mono); font-weight:500;">[running]</span>
      </div>
      <div style="display:flex; align-items:center; gap:12px; font-size:12px; font-family:var(--font-mono); color:var(--text-3);">
        <span id="aider-files-count" style="display:none;">0 files</span>
        <span id="aider-additions-count" style="color:#16a34a; font-weight:500;">+0</span>
        <span id="aider-deletions-count" style="color:#dc2626; font-weight:500;">-0</span>
        <span id="aider-commits-count" style="display:none;">0 commits</span>
      </div>
    </div>
    <div id="aider-activity-steps" style="padding:6px 0; display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--text-3); font-family:var(--font);"></div>
    <div class="aider-console-body" style="background:var(--card); border:1px solid var(--border); border-radius:8px; padding:10px; margin-top:8px; max-height:260px; overflow-y:auto; font-family:var(--font-mono); font-size:12px; line-height:1.5; color:var(--text-primary);"></div>
  `;

  col.appendChild(_aiderConsoleCard);
  _aiderConsoleLogArea = _aiderConsoleCard.querySelector('.aider-console-body');
  return _aiderConsoleCard;
}

export function handleAiderChunk(chunk, col, enterConversationCallback) {
  ensureAiderConsoleCard(col, enterConversationCallback);
  if (!_aiderConsoleLogArea) return;

  _aiderConsoleRawText += chunk;
  _aiderConsoleLogArea.innerHTML = window.marked 
    ? sanitizeHtml(window.marked.parse(_aiderConsoleRawText)) 
    : escapeHtml(_aiderConsoleRawText);
  enhanceMarkdownContent(_aiderConsoleLogArea);
  _aiderConsoleLogArea.scrollTop = _aiderConsoleLogArea.scrollHeight;
}

export function finalizeAiderConsole(isSuccess = true) {
  if (_aiderConsoleCard) {
    if (_aiderConsoleCard._diffInterval) {
      clearInterval(_aiderConsoleCard._diffInterval);
      _aiderConsoleCard._diffInterval = null;
    }
    const spinner = _aiderConsoleCard.querySelector('.console-spinner');
    const badge = _aiderConsoleCard.querySelector('#aider-status-badge');
    if (spinner) {
      spinner.outerHTML = isSuccess 
        ? '<span style="color:#16a34a; font-size:12px; margin-right:4px;">&#10003;</span>'
        : '<span style="color:#dc2626; font-size:12px; margin-right:4px;">&#10005;</span>';
    }
    if (badge) {
      badge.textContent = isSuccess ? '[done]' : '[failed]';
    }
  }
  _aiderConsoleCard    = null;
  _aiderConsoleLogArea = null;
  _aiderActive         = false;
  _aiderConsoleRawText = "";
}
