/* === chat/translation_card.js — Interactive Translation Card Component === */

export function escapeHtmlLocal(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const LANG_CODE_MAP = {
  english: 'en-US',
  hindi: 'hi-IN',
  spanish: 'es-ES',
  french: 'fr-FR',
  german: 'de-DE',
  japanese: 'ja-JP',
  chinese: 'zh-CN',
  mandarin: 'zh-CN',
  russian: 'ru-RU',
  arabic: 'ar-SA',
  portuguese: 'pt-PT',
  italian: 'it-IT',
  korean: 'ko-KR',
  dutch: 'nl-NL',
  bengali: 'bn-IN',
  sanskrit: 'sa-IN',
  marathi: 'mr-IN',
  tamil: 'ta-IN',
  telugu: 'te-IN',
  gujarati: 'gu-IN',
  punjabi: 'pa-IN',
  urdu: 'ur-PK'
};

export function getLangCode(lang) {
  const clean = (lang || '').toLowerCase().trim();
  return LANG_CODE_MAP[clean] || 'en-US';
}

export function createTranslationCard(langName, textContent) {
  const cleanText = (textContent || '').trim();
  const cleanLang = (langName || 'English').trim();
  const bcpLang = getLangCode(cleanLang);

  const card = document.createElement('div');
  card.className = 'translation-card';
  card.innerHTML = `
    <div class="translation-card-header">
      <div class="translation-lang-badge">
        <svg class="translation-lang-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m5 8 6 6"></path>
          <path d="m4 14 6-6 2-3"></path>
          <path d="M2 5h12"></path>
          <path d="M7 2h1"></path>
          <path d="m22 22-5-10-5 10"></path>
          <path d="M14 18h6"></path>
        </svg>
        <span class="translation-lang-name">${escapeHtmlLocal(cleanLang)}</span>
      </div>
      <div class="translation-card-actions">
        <button class="translation-action-btn btn-translation-listen" title="Listen to pronunciation" aria-label="Listen">
          <svg class="listen-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
        <button class="translation-action-btn btn-translation-copy" title="Copy translation" aria-label="Copy">
          <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
          </svg>
          <span class="copy-label">Copy</span>
        </button>
      </div>
    </div>
    <div class="translation-card-body">
      <div class="translation-text">${escapeHtmlLocal(cleanText)}</div>
    </div>
  `;

  // 1. Copy Action
  const copyBtn = card.querySelector('.btn-translation-copy');
  const copyLabel = card.querySelector('.copy-label');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(cleanText).then(() => {
        copyBtn.classList.add('is-copied');
        if (copyLabel) copyLabel.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          if (copyLabel) copyLabel.textContent = 'Copy';
        }, 2200);
      }).catch(err => console.warn('Copy failed:', err));
    });
  }

  // 2. Listen / SpeechSynthesis Action
  const listenBtn = card.querySelector('.btn-translation-listen');
  if (listenBtn) {
    listenBtn.addEventListener('click', () => {
      if (!('speechSynthesis' in window)) {
        alert('Speech synthesis is not supported in this browser.');
        return;
      }

      if (window.speechSynthesis.speaking && listenBtn.classList.contains('is-speaking')) {
        window.speechSynthesis.cancel();
        listenBtn.classList.remove('is-speaking');
        return;
      }

      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.lang = bcpLang;
      utter.rate = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(bcpLang.toLowerCase().slice(0, 2)));
      if (matchingVoice) utter.voice = matchingVoice;

      listenBtn.classList.add('is-speaking');
      utter.onend = () => listenBtn.classList.remove('is-speaking');
      utter.onerror = () => listenBtn.classList.remove('is-speaking');

      window.speechSynthesis.speak(utter);
    });
  }

  return card;
}

/** Transforms translation code blocks, tags, and conversational output into interactive cards */
export function enhanceTranslationCards(container) {
  if (!container) return;

  // Pattern 1: Code blocks like ```translation:English or ```translate:Hindi
  const codeBlocks = container.querySelectorAll('pre code');
  codeBlocks.forEach(code => {
    const className = code.className || '';
    const match = className.match(/language-(?:translation|translate)(?::([a-zA-Z0-9_-]+))?/i);
    if (match) {
      const lang = match[1] || 'English';
      const text = code.innerText || code.textContent || '';
      const targetWrapper = code.closest('.code-block-wrapper') || code.closest('pre');
      if (targetWrapper && targetWrapper.parentNode) {
        const card = createTranslationCard(lang, text);
        targetWrapper.parentNode.replaceChild(card, targetWrapper);
      }
    }
  });

  // Pattern 2: Explicit tags [TRANSLATION:Language]...[/TRANSLATION]
  const walkers = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let node;
  while ((node = walkers.nextNode())) {
    if (node.nodeValue && (node.nodeValue.includes('[TRANSLATION:') || node.nodeValue.includes(':::translation'))) {
      textNodes.push(node);
    }
  }

  textNodes.forEach(textNode => {
    const parent = textNode.parentNode;
    if (!parent) return;
    const regex = /\[TRANSLATION:\s*([^\]]+)\]([\s\S]+?)\[\/TRANSLATION\]/gi;
    const text = textNode.nodeValue;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
      }
      const lang = match[1].trim();
      const content = match[2].trim();
      const card = createTranslationCard(lang, content);
      frag.appendChild(card);
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    parent.replaceChild(frag, textNode);
  });

  // Pattern 3: Auto-detect natural language translation headers & quotes (e.g. "The translation of the text... is:\n\"...\"")
  const pElements = Array.from(container.querySelectorAll('p, blockquote'));
  for (let i = 0; i < pElements.length; i++) {
    const p = pElements[i];
    if (!p.parentNode || p.closest('.translation-card')) continue;

    const text = p.innerText.trim();

    // Match "The English translation is:", "The translation of the text ... is:", "Here is the translation:"
    const introMatch = text.match(/^(?:Here is the\s+)?(?:The\s+)?([A-Za-z]+)?\s*translation(?:\s+of\s+[^:]+)?(?:\s+is|\s+in\s+[A-Za-z]+|\s+to\s+[A-Za-z]+)?:\s*$/i)
                    || text.match(/^\*\*([A-Za-z]+)?\s*Translation(?:\s+of\s+[^:]+)?:\*\*\s*$/i);

    if (introMatch) {
      let lang = introMatch[1] || '';
      if (!lang) {
        // Detect if text mentions a language like "into English", "in Hindi", etc.
        const langMatch = text.match(/(?:into|in|to)\s+([A-Za-z]+)/i);
        lang = langMatch ? langMatch[1] : 'English';
      }

      const nextEl = p.nextElementSibling;
      if (nextEl && (nextEl.tagName === 'P' || nextEl.tagName === 'BLOCKQUOTE')) {
        let content = nextEl.innerText.trim();
        content = content.replace(/^["“]([\s\S]+)["”]$/, '$1').trim();
        if (content.length > 5) {
          const card = createTranslationCard(lang, content);
          p.parentNode.insertBefore(card, p);
          p.remove();
          nextEl.remove();
          continue;
        }
      }
    }

    // Match inline "The translation of the text is: \"O God, grant us...\""
    const inlineMatch = text.match(/^(?:Here is the\s+)?(?:The\s+)?([A-Za-z]+)?\s*translation(?:\s+of\s+[^:]+)?(?:\s+is|\s+in\s+[A-Za-z]+|\s+to\s+[A-Za-z]+)?:\s*["“]([\s\S]+?)["”]$/i);
    if (inlineMatch) {
      let lang = inlineMatch[1] || '';
      if (!lang) {
        const langMatch = text.match(/(?:into|in|to)\s+([A-Za-z]+)/i);
        lang = langMatch ? langMatch[1] : 'English';
      }
      const content = inlineMatch[2].trim();
      if (content.length > 5) {
        const card = createTranslationCard(lang, content);
        p.parentNode.replaceChild(card, p);
      }
    }
  }
}
