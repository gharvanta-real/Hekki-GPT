/**
 * stream_thought.js — Chain of Thought reasoning parsing, thought cards, and thinking orb indicators.
 */

import { enhanceMarkdownContent, escapeHtml } from '../chat.js';
import { sanitizeHtml, stripPlannerMetadata } from './stream_utils.js';

let _streamThoughtCard  = null;
let _streamThoughtBody  = null;
let _streamThoughtText  = "";
let _streamThoughtStartTime = 0;

export function parseThinking(raw) {
  if (!raw) return { thought: '', content: '' };
  const tagMatch = raw.match(/<(think|thinking|thought|planning|analysis)>([\s\S]*?)(?:<\/\1>|$)/i);
  if (tagMatch) {
    return {
      thought: tagMatch[2].trim(),
      content: raw.replace(/<(think|thinking|thought|planning|analysis)>[\s\S]*?(?:<\/\1>|$)/gi, '').trim()
    };
  }

  if (/^(?:\d+\.\s*\*\*(?:Analyze|Safety|Policy|Persona|Constraint|Formulate).*?\*\*)/i.test(raw.trim())) {
    const paragraphs = raw.split(/\n\s*\n/);
    const thoughtPs = [];
    const contentPs = [];
    let inThought = true;

    for (let p of paragraphs) {
      const trimmedP = p.trim();
      if (inThought && (/^(?:\d+\.\s*\*|\*\*(?:Analyze|Safety|Policy|Persona|Constraint|Formulate).*?\*\*)/i.test(trimmedP) || trimmedP.startsWith('* **') || trimmedP.startsWith('- **'))) {
        thoughtPs.push(p);
      } else {
        inThought = false;
        contentPs.push(p);
      }
    }

    if (thoughtPs.length > 0 && contentPs.length > 0) {
      const c = contentPs.join('\n\n').replace(/\[ASK_USER\][\s\S]*?(?:\[\/ASK_USER\]|$)/gi, '').trim();
      return {
        thought: thoughtPs.join('\n\n').trim(),
        content: c
      };
    }
  }

  const clean = raw.replace(/\[ASK_USER\][\s\S]*?(?:\[\/ASK_USER\]|$)/gi, '').trim();
  return { thought: '', content: clean };
}

export function renderParsedMessage(containerEl, rawText) {
  if (!containerEl || !rawText) return;

  const { thought: thoughtContent, content: finalText } = parseThinking(rawText);

  if (thoughtContent) {
    let thoughtCard = containerEl.querySelector('.ai-reasoning-card');
    if (!thoughtCard) {
      thoughtCard = document.createElement('div');
      thoughtCard.className = 'ai-reasoning-card';
      thoughtCard.style.cssText = 'margin:4px 0 10px 0;padding:6px 0 6px 14px;background:transparent;font-size:13.5px;font-family:var(--font);color:var(--text-3);line-height:1.5;opacity:0.9;border-left:2px solid var(--border-subtle, rgba(255,255,255,0.12));';
      containerEl.prepend(thoughtCard);
    }
    thoughtCard.innerHTML = `<div style="font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;opacity:0.7;">Thinking Process</div><div style="white-space:pre-wrap;word-break:break-word;"><span>${escapeHtml(thoughtContent)}</span></div>`;
  }

  // ── De-dup Guard: remove any .chat-tip-footer / callout elements that moveTipsToBottom
  // previously hoisted out of bodyContainer into the parent .msg on an earlier chunk.
  // Without this, every re-render chunk appends a new copy of the same tip element to .msg.
  const msgParent = containerEl.closest('.msg') || containerEl.parentElement;
  if (msgParent) {
    Array.from(msgParent.querySelectorAll(':scope > .chat-tip-footer, :scope > .chat-callout'))
      .forEach(el => el.remove());
  }

  let bodyContainer = containerEl.querySelector('.ai-msg-body');
  if (!bodyContainer) {
    bodyContainer = document.createElement('div');
    bodyContainer.className = 'ai-msg-body';
    containerEl.appendChild(bodyContainer);
  }

  const cleanText = stripPlannerMetadata(finalText);
  bodyContainer.innerHTML = window.marked 
    ? sanitizeHtml(window.marked.parse(cleanText)) 
    : escapeHtml(cleanText);
    
  enhanceMarkdownContent(bodyContainer);
}

export function ensureThoughtCard(col, enterConversationCallback) {
  if (_streamThoughtCard) return;
  enterConversationCallback();

  _streamThoughtStartTime = Date.now();
  _streamThoughtCard = document.createElement('div');
  _streamThoughtCard.className = 'ai-reasoning-card thought-container';
  _streamThoughtCard.style.cssText = 'margin:6px 0;padding:6px 0 6px 14px;background:transparent;font-size:13.5px;font-family:var(--font);color:var(--text-3);line-height:1.5;opacity:0.9;border-left:2px solid var(--border-subtle, rgba(255,255,255,0.12));';
  _streamThoughtCard.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
      <span style="font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:0.5px;opacity:0.7;">Thinking Process</span>
      <span class="thought-timer" style="font-size:11px;opacity:0.6;">0s</span>
    </div>
    <div class="thought-body" style="white-space:pre-wrap;word-break:break-word;"></div>
  `;

  col.appendChild(_streamThoughtCard);
  _streamThoughtBody = _streamThoughtCard.querySelector('.thought-body');

  _streamThoughtCard._timer = setInterval(() => {
    if (!_streamThoughtCard) return;
    const elapsed = Math.max(1, Math.round((Date.now() - _streamThoughtStartTime) / 1000));
    const timerEl = _streamThoughtCard.querySelector('.thought-timer');
    if (timerEl) timerEl.textContent = `${elapsed}s`;
  }, 1000);
}

export function appendThoughtChunk(chunk, col, enterConversationCallback) {
  ensureThoughtCard(col, enterConversationCallback);
  _streamThoughtText += chunk;
  if (_streamThoughtBody) {
    _streamThoughtBody.textContent = _streamThoughtText;
  }
}

export function finalizeStreamThought() {
  if (_streamThoughtCard && _streamThoughtCard._timer) {
    clearInterval(_streamThoughtCard._timer);
    _streamThoughtCard._timer = null;
  }
  _streamThoughtCard = null;
  _streamThoughtBody = null;
  _streamThoughtText = "";
  _streamThoughtStartTime = 0;
}
