/**
 * question_card.js — AI Clarification Question Card Controller
 *
 * Replaces the input bar in-place with an interactive clarification card.
 *  - Vertical list option rows (Single select / Multi select)
 *  - Auto-included "Other (type your own answer)..." custom row
 *  - Free-text write input
 *  - Multi-slide (1→2→3 questions) with Prev/Next/Skip navigation
 *  - Strictly unbold typography (font-weight: 400)
 *  - Real-time answer transmission via WebSocket as "question_answer"
 */

const SVG_QUESTION = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><path d="M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2zm0 26a12 12 0 1 1 12-12 12 12 0 0 1-12 12zm-.5-6.5h1v-2h-1zM16 8a5 5 0 0 0-5 5h2a3 3 0 0 1 6 0c0 2-3 2.5-3 5h2c0-1.5 3-2.5 3-5a5 5 0 0 0-5-5z"/></svg>`;
const SVG_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><polygon points="13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24"/></svg>`;
const SVG_CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><path d="M12 8l10 8-10 8z"/></svg>`;
const SVG_CHEVRON_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor"><path d="M20 8l-10 8 10 8z"/></svg>`;

let _ws = null;
let _qid = null;
let _slides = [];
let _slideIdx = 0;
let _answers = [];
let _wrapEl = null;
let _cardEl = null;

// ─── Public API ──────────────────────────────────────────────────────────────

export function initQuestionCard(wsInstance) {
  _ws = wsInstance;
}

export function showQuestionCard(payload) {
  _qid = payload.id || ('q_' + Date.now());
  _slides = Array.isArray(payload.slides) ? payload.slides : [];
  if (!_slides.length) return;

  _slideIdx = 0;
  _answers = _slides.map(() => null);

  _hideInputBar(true);
  _ensureWrap();
  _render();
  _scrollToBottom();

  requestAnimationFrame(() => {
    if (_cardEl) _cardEl.classList.add('visible');
    _scrollToBottom();
  });
  setTimeout(_scrollToBottom, 60);
}

export function hideQuestionCard() {
  if (_cardEl) {
    _cardEl.classList.remove('visible');
    setTimeout(() => {
      if (_wrapEl) _wrapEl.remove();
      _wrapEl = null;
      _cardEl = null;
      _hideInputBar(false);
      _restoreScrollBtn();
    }, 180);
  } else {
    if (_wrapEl) _wrapEl.remove();
    _wrapEl = null;
    _hideInputBar(false);
    _restoreScrollBtn();
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _ensureWrap() {
  const bottomBar = document.getElementById('bottom-input-bar');
  const homeScreen = document.getElementById('home-screen');
  const isHomeActive = homeScreen && !homeScreen.classList.contains('hidden') && homeScreen.offsetParent !== null;

  let targetParent = null;
  if (!isHomeActive && bottomBar) {
    bottomBar.classList.remove('hidden');
    targetParent = bottomBar.querySelector('.bottom-col') || bottomBar;
  } else if (homeScreen) {
    targetParent = homeScreen;
  } else if (bottomBar) {
    bottomBar.classList.remove('hidden');
    targetParent = bottomBar.querySelector('.bottom-col') || bottomBar;
  }

  if (!targetParent) {
    targetParent = document.querySelector('.bottom-col') || document.body;
  }

  _wrapEl = targetParent.querySelector('#ai-question-card-wrap');
  if (!_wrapEl) {
    _wrapEl = document.createElement('div');
    _wrapEl.id = 'ai-question-card-wrap';
    targetParent.appendChild(_wrapEl);
  }
  _wrapEl.innerHTML = '';
}

function _render() {
  if (!_wrapEl) return;
  _wrapEl.innerHTML = '';

  const slide = _slides[_slideIdx];
  const total = _slides.length;
  const current = _slideIdx + 1;

  const card = document.createElement('div');
  card.className = 'ai-qcard';
  _cardEl = card;

  // ── Dots ──
  const dotsHtml = total > 1
    ? `<div class="qcard-dots">
        ${_slides.map((_, i) => `<span class="qcard-dot${i === _slideIdx ? ' active' : ''}"></span>`).join('')}
       </div>`
    : '';

  // ── Counter text ──
  const counterHtml = total > 1
    ? `<span class="qcard-slide-counter">${current} / ${total}</span>`
    : '';

  // ── Body: Vertical list options with "Other" write row vs textarea ──
  let bodyHtml = '';

  if (slide.type === 'select' || slide.type === 'multi') {
    const opts = (slide.options || []);
    const isMulti = slide.type === 'multi';

    bodyHtml = `<div class="qcard-options-list">
      ${opts.map((opt, i) => `
        <button class="qcard-option-row" data-idx="${i}" type="button">
          ${isMulti
            ? `<span class="qcard-checkbox-box">${SVG_CHECK}</span>`
            : `<span class="qcard-radio-circle"><span class="qcard-radio-dot"></span></span>`
          }
          <span class="qcard-option-text">${_esc(opt)}</span>
        </button>`).join('')}
        
      <div class="qcard-option-row qcard-other-row" data-idx="other">
        ${isMulti
          ? `<span class="qcard-checkbox-box">${SVG_CHECK}</span>`
          : `<span class="qcard-radio-circle"><span class="qcard-radio-dot"></span></span>`
        }
        <input type="text" class="qcard-other-input" placeholder="Other (type your own answer)..." autocomplete="off" />
      </div>
    </div>`;
  } else {
    bodyHtml = `<div class="qcard-write-wrap">
      <textarea class="qcard-write-input" rows="2"
        placeholder="${_esc(slide.placeholder || 'Type your answer…')}"></textarea>
    </div>`;
  }

  // ── Action Row ──
  const prevBtn = _slideIdx > 0
    ? `<button class="qcard-btn qcard-btn-ghost" id="qcard-prev" type="button">
        ${SVG_CHEVRON_LEFT} Prev
       </button>`
    : '';

  const nextLabel = _slideIdx < total - 1 ? 'Next' : 'Done';
  const nextIcon  = _slideIdx < total - 1 ? SVG_CHEVRON_RIGHT : SVG_CHECK;

  card.innerHTML = `
    <div class="qcard-header">
      <div class="qcard-meta">
        <span class="qcard-icon">${SVG_QUESTION}</span>
        <span class="qcard-label">Clarification Question</span>
      </div>
      ${dotsHtml}
      <div style="display:flex;align-items:center;gap:10px;">
        ${counterHtml}
        <button class="qcard-btn qcard-btn-skip" id="qcard-skip" type="button">Skip</button>
      </div>
    </div>
    <div class="qcard-slide-body">
      <p class="qcard-question">${_esc(slide.question)}</p>
      ${bodyHtml}
    </div>
    <div class="qcard-actions">
      <div class="qcard-actions-left">
        ${prevBtn}
      </div>
      <button class="qcard-btn qcard-btn-primary" id="qcard-next" type="button">
        <span>${nextLabel}</span>
        <span style="width:13px;height:13px;display:inline-flex;align-items:center;">${nextIcon}</span>
      </button>
    </div>
  `;

  _wrapEl.appendChild(card);

  // ── Restore saved state for this slide ──
  const saved = _answers[_slideIdx];
  if (saved !== null && saved !== undefined) {
    if (slide.type === 'text') {
      const ta = card.querySelector('.qcard-write-input');
      if (ta) ta.value = saved;
    } else {
      const savedArr = Array.isArray(saved) ? saved : [saved];
      savedArr.forEach(v => {
        if (typeof v === 'string' && !slide.options.includes(v)) {
          const otherRow = card.querySelector('.qcard-other-row');
          const otherInp = card.querySelector('.qcard-other-input');
          if (otherRow) otherRow.classList.add('selected');
          if (otherInp) otherInp.value = v;
        } else {
          const idx = slide.options.indexOf(v);
          const btn = card.querySelector(`.qcard-option-row[data-idx="${idx}"]`);
          if (btn) btn.classList.add('selected');
        }
      });
    }
  }

  // ── Event Listeners ──
  card.querySelectorAll('.qcard-option-row:not(.qcard-other-row)').forEach(btn => {
    btn.addEventListener('click', () => _handleOptionClick(btn, slide));
  });

  const otherRow = card.querySelector('.qcard-other-row');
  const otherInput = card.querySelector('.qcard-other-input');
  if (otherRow && otherInput) {
    otherRow.addEventListener('click', (e) => {
      if (e.target !== otherInput) otherInput.focus();
      _handleOtherClick(otherRow, slide);
    });

    otherInput.addEventListener('focus', () => {
      _handleOtherClick(otherRow, slide);
    });

    otherInput.addEventListener('input', () => {
      if (!otherRow.classList.contains('selected')) {
        _handleOtherClick(otherRow, slide);
      }
    });

    otherInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _handleNext(slide);
      }
    });
  }

  card.querySelector('#qcard-next')?.addEventListener('click', () => _handleNext(slide));
  card.querySelector('#qcard-prev')?.addEventListener('click', () => _handlePrev());
  card.querySelector('#qcard-skip')?.addEventListener('click', () => _handleSkip());

  const ta = card.querySelector('.qcard-write-input');
  if (ta) {
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _handleNext(slide);
      }
    });
    setTimeout(() => ta.focus(), 60);
  }
}

function _handleOptionClick(btn, slide) {
  if (slide.type === 'multi') {
    btn.classList.toggle('selected');
  } else {
    btn.closest('.qcard-options-list')
       .querySelectorAll('.qcard-option-row')
       .forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const otherInp = btn.closest('.qcard-options-list')?.querySelector('.qcard-other-input');
    if (otherInp) otherInp.value = '';
  }
}

function _handleOtherClick(otherRow, slide) {
  if (slide.type === 'multi') {
    otherRow.classList.toggle('selected');
  } else {
    otherRow.closest('.qcard-options-list')
      .querySelectorAll('.qcard-option-row')
      .forEach(b => b.classList.remove('selected'));
    otherRow.classList.add('selected');
  }
}

function _handleNext(slide) {
  const card = _cardEl;
  if (!card) return;

  if (slide.type === 'text') {
    const ta = card.querySelector('.qcard-write-input');
    _answers[_slideIdx] = ta ? ta.value.trim() : '';
  } else if (slide.type === 'multi') {
    const res = [];
    card.querySelectorAll('.qcard-option-row:not(.qcard-other-row).selected').forEach(b => {
      const opt = slide.options[parseInt(b.dataset.idx)];
      if (opt) res.push(opt);
    });
    const otherRow = card.querySelector('.qcard-other-row.selected');
    const otherInp = card.querySelector('.qcard-other-input');
    if (otherRow && otherInp && otherInp.value.trim()) {
      res.push(otherInp.value.trim());
    }
    _answers[_slideIdx] = res;
  } else {
    const otherRow = card.querySelector('.qcard-other-row.selected');
    const otherInp = card.querySelector('.qcard-other-input');
    if (otherRow && otherInp && otherInp.value.trim()) {
      _answers[_slideIdx] = otherInp.value.trim();
    } else {
      const sel = card.querySelector('.qcard-option-row:not(.qcard-other-row).selected');
      _answers[_slideIdx] = sel ? slide.options[parseInt(sel.dataset.idx)] : null;
    }
  }

  if (_slideIdx < _slides.length - 1) {
    _slideIdx++;
    _render();
    requestAnimationFrame(() => { if (_cardEl) _cardEl.classList.add('visible'); });
  } else {
    _submit();
  }
}

function _handlePrev() {
  if (_slideIdx > 0) {
    _slideIdx--;
    _render();
    requestAnimationFrame(() => { if (_cardEl) _cardEl.classList.add('visible'); });
  }
}

function _handleSkip() {
  _answers[_slideIdx] = null;
  if (_slideIdx < _slides.length - 1) {
    _slideIdx++;
    _render();
    requestAnimationFrame(() => { if (_cardEl) _cardEl.classList.add('visible'); });
  } else {
    _submit();
  }
}

function _submit() {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify({
      type: 'question_answer',
      id: _qid,
      answers: _answers,
    }));
  }
  hideQuestionCard();
}

function _hideInputBar(hide) {
  const targets = [
    '#input-capsule',
    '#input-capsule-conv',
    '.home-capsule',
    '#chat-input-area',
    '.bottom-disclaimer',
    '#voice-bar',
    '#voice-bar-conv',
    '#preview-area',
    '#preview-area-conv',
  ];

  targets.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (hide) {
        if (!el.dataset.origDisplay) {
          el.dataset.origDisplay = el.style.display || 'flex';
        }
        el.style.setProperty('display', 'none', 'important');
      } else {
        el.style.display = el.dataset.origDisplay && el.dataset.origDisplay !== 'none' ? el.dataset.origDisplay : '';
        delete el.dataset.origDisplay;
      }
    });
  });
}

function _esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _scrollToBottom() {
  const log = document.getElementById('chat-log');
  if (log) {
    log.scrollTop = log.scrollHeight;
  }
  document.querySelectorAll('.chat-center-scroll-btn').forEach(btn => {
    btn.classList.remove('visible');
    btn.style.setProperty('display', 'none', 'important');
  });
}

function _restoreScrollBtn() {
  document.querySelectorAll('.chat-center-scroll-btn').forEach(btn => {
    btn.style.display = '';
  });
}
