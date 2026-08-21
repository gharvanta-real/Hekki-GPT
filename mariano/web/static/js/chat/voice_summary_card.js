/* === chat/voice_summary_card.js — Dedicated Interactive Voice Summary Component ===
 * Features:
 * - Live Generation Progress Card with Spin Loader & Rotating Feedback
 * - Finalized Interactive Voice Summary Card (18px Rounded, 0-Shadows)
 * - Built-in Audio Player with Waveform, Play/Pause, Seek & Speed Toggle
 * - One-Click High-Contrast Summary Copy & Audio Download
 */

export function escapeHtmlLocal(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const WAVE_BARS_DEFAULT = [8, 14, 22, 12, 26, 30, 18, 28, 34, 22, 16, 30, 34, 20, 32, 24, 14, 28, 32, 18, 26, 30, 20, 16, 22, 30, 18, 26, 20, 16, 20, 28, 18, 12, 6];

/**
 * Creates an interactive Live Voice Summary Generator / Spinner card during tool execution
 */
export function createVoiceSummaryGenCard(initialStatus = 'Extracting document text...') {
  const card = document.createElement('div');
  card.className = 'voice-summary-gen-card';
  card.innerHTML = `
    <div class="voice-summary-gen-header">
      <div class="voice-summary-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
        <span>Generating Voice Summary</span>
      </div>
      <span class="voice-summary-neural-pill">Neural Studio Voice</span>
    </div>
    
    <div class="voice-summary-gen-body">
      <div class="voice-summary-spinner-ring"></div>
      <div class="voice-summary-live-info">
        <div class="voice-summary-status-text">${escapeHtmlLocal(initialStatus)}</div>
        <div class="voice-summary-bars-anim">
          <span class="vs-anim-bar"></span>
          <span class="vs-anim-bar"></span>
          <span class="vs-anim-bar"></span>
          <span class="vs-anim-bar"></span>
          <span class="vs-anim-bar"></span>
        </div>
      </div>
    </div>
  `;

  const phrases = [
    'Scanning & extracting document context...',
    'Analyzing key takeaways & structure...',
    'Synthesizing Hindi voice with MadhurNeural...',
    'Generating studio-grade waveform audio...',
    'Finalizing lossless voice summary...'
  ];
  let phraseIdx = 0;
  card._phraseInterval = setInterval(() => {
    const txtEl = card.querySelector('.voice-summary-status-text');
    if (txtEl) {
      phraseIdx = (phraseIdx + 1) % phrases.length;
      txtEl.textContent = phrases[phraseIdx];
    }
  }, 2400);

  return card;
}

/**
 * Creates a finalized interactive Voice Summary Card with embedded audio playback & copy controls
 */
export function createVoiceSummaryCard({ title, voiceName, audioUrl, summaryText, duration }) {
  const cleanTitle = (title || 'Voice Summary Overview').trim();
  const cleanVoice = (voiceName || 'Madhur • Hindi Neural').trim();
  const cleanSummary = (summaryText || '').trim();
  const cleanAudioUrl = (audioUrl || '').trim();

  const card = document.createElement('div');
  card.className = 'voice-summary-card';

  const barsHtml = WAVE_BARS_DEFAULT.map((h, i) => `<span class="vs-wave-bar" data-i="${i}" style="height:${Math.round(h * 0.75)}px;"></span>`).join('');
  const playSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';
  const pauseSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

  card.innerHTML = `
    <div class="voice-summary-card-header">
      <div class="voice-summary-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
        <span class="voice-summary-badge-title">${escapeHtmlLocal(cleanTitle)}</span>
        <span class="voice-summary-voice-pill">${escapeHtmlLocal(cleanVoice)}</span>
      </div>

      <div class="voice-summary-header-actions">
        ${cleanAudioUrl ? `
          <a href="${cleanAudioUrl}" download class="voice-summary-btn-dl" title="Download Audio File" aria-label="Download Audio">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </a>
        ` : ''}
        <button class="voice-summary-btn-copy" title="Copy summary text" aria-label="Copy Summary">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
          </svg>
          <span class="vs-copy-label">Copy</span>
        </button>
      </div>
    </div>

    ${cleanAudioUrl ? `
      <div class="voice-summary-player-strip">
        <button class="voice-summary-play-btn" aria-label="Play Voice Summary">
          ${playSvg}
        </button>
        <div class="voice-summary-waveform-wrap">
          <div class="voice-summary-waveform-bars">
            ${barsHtml}
          </div>
        </div>
        <span class="voice-summary-time-display">${duration || '0:00'}</span>
      </div>
    ` : ''}

    ${cleanSummary ? `
      <div class="voice-summary-card-body">
        <div class="voice-summary-text">${escapeHtmlLocal(cleanSummary)}</div>
      </div>
    ` : ''}
  `;

  // 1. Copy Summary Text
  const copyBtn = card.querySelector('.voice-summary-btn-copy');
  const copyLabel = card.querySelector('.vs-copy-label');
  if (copyBtn && cleanSummary) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(cleanSummary).then(() => {
        copyBtn.classList.add('is-copied');
        if (copyLabel) copyLabel.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          if (copyLabel) copyLabel.textContent = 'Copy';
        }, 2200);
      }).catch(err => console.warn('Copy summary failed:', err));
    });
  }

  // 2. Waveform & Audio Player Binding
  if (cleanAudioUrl) {
    const playBtn = card.querySelector('.voice-summary-play-btn');
    const waveformWrap = card.querySelector('.voice-summary-waveform-wrap');
    const bars = card.querySelectorAll('.vs-wave-bar');
    const timeDisplay = card.querySelector('.voice-summary-time-display');
    const player = window.globalAudioPlayer;

    const formatTime = (secs) => {
      if (isNaN(secs) || secs < 0) return '0:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const updateWaveform = (pct) => {
      const activeIdx = Math.floor((pct / 100) * bars.length);
      bars.forEach((b, idx) => {
        if (idx <= activeIdx && pct > 0) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    };

    const probe = new Audio(cleanAudioUrl);
    probe.addEventListener('loadedmetadata', () => {
      if (!player || player.getCurrentUrl() !== cleanAudioUrl) {
        timeDisplay.innerText = formatTime(probe.duration);
      }
    });

    if (player && player.getCurrentUrl() === cleanAudioUrl) {
      const isPlaying = player.isPlaying();
      playBtn.innerHTML = isPlaying ? pauseSvg : playSvg;
      if (player._audio && player._audio.duration) {
        const cur = player._audio.currentTime;
        const dur = player._audio.duration;
        updateWaveform((cur / dur) * 100);
        timeDisplay.innerText = formatTime(cur);
      }
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (player) {
          if (player.getCurrentUrl() === cleanAudioUrl) {
            player.togglePlayPause();
          } else {
            player.play(cleanAudioUrl, { title: cleanTitle });
          }
        }
      });
    }

    if (waveformWrap) {
      waveformWrap.addEventListener('click', (e) => {
        const rect = waveformWrap.getBoundingClientRect();
        const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const pct = (clickX / rect.width);
        
        if (player) {
          if (player.getCurrentUrl() !== cleanAudioUrl) {
            player.play(cleanAudioUrl, { title: cleanTitle });
          }
          if (player._audio && player._audio.duration) {
            player._audio.currentTime = pct * player._audio.duration;
            updateWaveform(pct * 100);
            timeDisplay.innerText = formatTime(player._audio.currentTime);
          }
        }
      });
    }

    if (player) {
      player.on('*', ({ event, currentUrl, isPlaying, data }) => {
        if (!document.body.contains(card)) return;

        if (currentUrl === cleanAudioUrl) {
          if (event === 'play') {
            if (playBtn) playBtn.innerHTML = pauseSvg;
          } else if (event === 'pause') {
            if (playBtn) playBtn.innerHTML = playSvg;
          } else if (event === 'ended') {
            if (playBtn) playBtn.innerHTML = playSvg;
            updateWaveform(0);
            if (player._audio && player._audio.duration) {
              timeDisplay.innerText = formatTime(player._audio.duration);
            }
          } else if (event === 'timeupdate' && data) {
            if (playBtn) playBtn.innerHTML = isPlaying ? pauseSvg : playSvg;
            if (data.duration) {
              const pct = (data.currentTime / data.duration) * 100;
              updateWaveform(pct);
              timeDisplay.innerText = formatTime(data.currentTime);
            }
          }
        } else {
          if (playBtn) playBtn.innerHTML = playSvg;
          updateWaveform(0);
        }
      });
    }
  }

  return card;
}

/**
 * Scans a container to enhance voice summary markdown blocks and audio overview calls
 */
export function enhanceVoiceSummaryCards(container) {
  if (!container) return;

  // Enhance explicit voice_summary / audio_summary code blocks
  const codeBlocks = container.querySelectorAll('pre code, .code-block-wrapper pre code');
  codeBlocks.forEach(code => {
    const classList = Array.from(code.classList);
    const langClass = classList.find(c => c.startsWith('language-')) || '';
    const rawLang = langClass.replace('language-', '').toLowerCase().trim();

    if (rawLang.startsWith('voice_summary') || rawLang.startsWith('audio_summary') || rawLang === 'voice') {
      const parts = rawLang.split(':');
      const voiceParam = parts[1] ? parts[1].replace(/[-_]/g, ' ').trim() : 'Madhur (Hindi)';
      const text = code.innerText.trim();

      const card = createVoiceSummaryCard({
        title: 'Voice Summary Overview',
        voiceName: voiceParam,
        summaryText: text
      });

      const wrapper = code.closest('.code-block-wrapper') || code.closest('pre');
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.replaceChild(card, wrapper);
      }
    }
  });

  // Enhance [AUDIO_PLAYER: /api/audio-summary/file/...|Title] tags
  const textNodes = [];
  const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while (n = walk.nextNode()) {
    if (n.nodeValue && n.nodeValue.includes('[AUDIO_PLAYER:')) {
      textNodes.push(n);
    }
  }

  textNodes.forEach(node => {
    const text = node.nodeValue;
    const match = text.match(/\[AUDIO_PLAYER:\s*([^\]|]+)(?:\|([^\]]+))?\]/i);
    if (match) {
      const audioUrl = match[1].trim();
      const title = match[2] ? match[2].trim() : 'Voice Audio Summary';
      const card = createVoiceSummaryCard({
        title: title,
        voiceName: 'Neural Voice',
        audioUrl: audioUrl
      });
      const parent = node.parentNode;
      if (parent) {
        parent.insertBefore(card, node);
        node.nodeValue = text.replace(match[0], '');
      }
    }
  });
}
