/**
 * audio_overview.js — PDF Chapter-Wise Lossless Hindi Audio Overview & Research Voice Summary
 * Flat Modern UI, 0-Shadows, Centralized CSS Tokens.
 */

class AudioOverviewManager {
  constructor() {
    this.currentAudio = null;
    this.currentPlayBtn = null;
    this.playbackRates = [1.0, 1.25, 1.5, 2.0];
    this.currentRateIdx = 0;
  }

  /**
   * Render PDF Chapter-Wise Overview Card inside chat or target container.
   */
  renderPDFOverviewCard(pdfData, container = null) {
    if (!container) {
      container = document.querySelector('#messages') || document.querySelector('.chat-messages');
    }
    if (!container || !pdfData) return;

    const card = document.createElement('div');
    card.className = 'pdf-audio-overview-card';
    card.id = `overview-${pdfData.pdf_id}`;

    const chaptersHtml = (pdfData.chapters || []).map((ch, idx) => `
      <button class="chapter-chip ${idx === 0 ? 'active' : ''}" 
              data-pdf-id="${pdfData.pdf_id}" 
              data-ch-id="${ch.chapter_id}"
              data-ch-title="${escapeHtml(ch.title)}"
              data-pages="P.${ch.start_page}-${ch.end_page}">
        <span>${escapeHtml(ch.title.length > 25 ? ch.title.substring(0, 25) + '...' : ch.title)}</span>
        <span style="opacity:0.6; font-size:10px;">(${ch.page_count}p)</span>
      </button>
    `).join('');

    card.innerHTML = `
      <div class="pdf-overview-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="pdf-meta-pill">PDF Audio Overview</span>
          <h4 class="pdf-overview-title">${escapeHtml(pdfData.filename)}</h4>
        </div>
        <span style="font-size:var(--fs-xs); color:var(--text-3); font-weight:500;">
          ${pdfData.total_pages} Pages • ${pdfData.total_chapters} Chapters
        </span>
      </div>

      <div class="pdf-chapters-scroll" id="chips-${pdfData.pdf_id}">
        ${chaptersHtml}
      </div>

      <div class="chapter-active-content" id="active-content-${pdfData.pdf_id}">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h5 class="chapter-active-title" id="active-title-${pdfData.pdf_id}">
            ${escapeHtml(pdfData.chapters[0]?.title || 'Chapter 1')}
          </h5>
          <span style="font-size:10px; color:var(--text-3);" id="active-pages-${pdfData.pdf_id}">
            Pages ${pdfData.chapters[0]?.start_page || 1} - ${pdfData.chapters[0]?.end_page || 1}
          </span>
        </div>
        <div class="chapter-hindi-script" id="active-script-${pdfData.pdf_id}">
          <em>Click 'Generate Audio' to synthesize full lossless Hindi explanation...</em>
        </div>
        <div id="player-container-${pdfData.pdf_id}">
          <button class="btn-audio-play" style="width:auto; padding:6px 14px; border-radius:var(--radius-pill); font-size:var(--fs-xs); gap:6px; display:inline-flex;" id="btn-gen-${pdfData.pdf_id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            Generate Hindi Audio
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
    container.scrollTop = container.scrollHeight;

    // Attach click events to chips
    const chipBtns = card.querySelectorAll('.chapter-chip');
    chipBtns.forEach(chip => {
      chip.addEventListener('click', () => {
        chipBtns.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const chId = chip.dataset.chId;
        const chTitle = chip.dataset.chTitle;
        const pages = chip.dataset.pages;
        
        document.getElementById(`active-title-${pdfData.pdf_id}`).innerText = chTitle;
        document.getElementById(`active-pages-${pdfData.pdf_id}`).innerText = pages;
        this.loadOrGenerateChapter(pdfData.pdf_id, chId, chTitle);
      });
    });

    // Auto load first chapter
    const firstCh = pdfData.chapters[0];
    if (firstCh) {
      const genBtn = card.querySelector(`#btn-gen-${pdfData.pdf_id}`);
      if (genBtn) {
        genBtn.addEventListener('click', () => {
          this.loadOrGenerateChapter(pdfData.pdf_id, firstCh.chapter_id, firstCh.title);
        });
      }
    }
  }

  /**
   * Request backend to generate/load chapter audio & script
   */
  async loadOrGenerateChapter(pdfId, chapterId, chapterTitle) {
    const scriptEl = document.getElementById(`active-script-${pdfId}`);
    const playerContainer = document.getElementById(`player-container-${pdfId}`);
    if (scriptEl) scriptEl.innerHTML = '<em>Generating faithful Hindi script & high-fidelity voice via Gemini 3.1 Flash-Lite...</em>';
    if (playerContainer) playerContainer.innerHTML = '<span style="font-size:11px; color:var(--text-3);">Synthesizing Studio Audio...</span>';

    try {
      const res = await fetch('/api/audio-summary/generate-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_id: pdfId,
          chapter_id: chapterId,
          fidelity_mode: 'lossless_full',
          voice: 'hi-IN-SwaraNeural'
        })
      });
      const data = await res.json();
      if (data.status === 'ok' && data.data) {
        const item = data.data;
        if (scriptEl) scriptEl.innerText = item.hindi_script;
        if (playerContainer) {
          playerContainer.innerHTML = '';
          this.mountAudioPlayer(playerContainer, item.audio_url, chapterTitle);
        }
      } else {
        if (scriptEl) scriptEl.innerText = 'Error: ' + (data.detail || 'Failed to synthesize chapter.');
      }
    } catch (err) {
      if (scriptEl) scriptEl.innerText = 'Network error: ' + err.message;
    }
  }

  /**
   * Render Standalone Research Audio Overview Card
   */
  renderResearchVoiceCard(researchData, container = null) {
    if (!container) {
      container = document.querySelector('#messages') || document.querySelector('.chat-messages');
    }
    if (!container || !researchData) return;

    const card = document.createElement('div');
    card.className = 'research-voice-card';

    card.innerHTML = `
      <div class="research-voice-header">
        <span class="pdf-meta-pill">Research Voice Summary</span>
        <span>${escapeHtml(researchData.topic || 'Last Research')}</span>
      </div>
      <div class="chapter-hindi-script" style="max-height:120px; font-size:var(--fs-sm);">
        ${escapeHtml(researchData.hindi_script)}
      </div>
      <div id="research-player-${Date.now()}"></div>
    `;

    container.appendChild(card);
    const pContainer = card.querySelector('div[id^="research-player-"]');
    this.mountAudioPlayer(pContainer, researchData.audio_url, researchData.topic || 'Research Audio Summary');
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Mounts an interactive flat voice waveform audio player widget into container
   */
  mountAudioPlayer(container, audioUrl, title = 'Audio Track') {
    const player = window.globalAudioPlayer;
    const WAVE_BARS = [6, 10, 16, 8, 20, 24, 14, 22, 28, 18, 12, 24, 28, 16, 26, 20, 10, 22, 26, 14, 20, 24, 16, 12, 18, 24, 14, 20, 16, 12, 16, 22, 14, 8, 5];
    
    const playerWrapper = document.createElement('div');
    playerWrapper.className = 'voice-player-container-wrap';

    const barsHtml = WAVE_BARS.map((h, i) => `<span class="vw-bar" data-i="${i}" style="height:${h}px;"></span>`).join('');
    const playSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="margin-left: 1px;"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';
    const pauseSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

    playerWrapper.innerHTML = `
      <div class="voice-player-divider voice-divider-top"></div>
      <div class="voice-pill-player">
        <button class="voice-pill-play-btn" aria-label="Play audio">
          ${playSvg}
        </button>
        
        <div class="voice-waveform-wrap">
          <div class="voice-waveform-bars">
            ${barsHtml}
          </div>
          <div class="voice-waveform-thumb" style="left: 0%;"></div>
        </div>

        <span class="voice-pill-time">0:00</span>

        <a href="${audioUrl}" download class="voice-pill-dl-btn" aria-label="Download audio">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </a>
      </div>
      <div class="voice-player-divider voice-divider-bottom"></div>
    `;

    container.appendChild(playerWrapper);

    const playBtn = playerWrapper.querySelector('.voice-pill-play-btn');
    const waveformWrap = playerWrapper.querySelector('.voice-waveform-wrap');
    const bars = playerWrapper.querySelectorAll('.vw-bar');
    const thumb = playerWrapper.querySelector('.voice-waveform-thumb');
    const timeLabel = playerWrapper.querySelector('.voice-pill-time');

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
      if (thumb) thumb.style.left = `${pct}%`;
    };

    // Preload metadata to display duration immediately if not playing
    const probe = new Audio(audioUrl);
    probe.addEventListener('loadedmetadata', () => {
      if (!player || player.getCurrentUrl() !== audioUrl) {
        timeLabel.innerText = formatTime(probe.duration);
      }
    });

    // Check if this track is currently active on GlobalAudioPlayer
    if (player && player.getCurrentUrl() === audioUrl) {
      const isPlaying = player.isPlaying();
      playBtn.innerHTML = isPlaying ? pauseSvg : playSvg;
      if (player._audio && player._audio.duration) {
        const cur = player._audio.currentTime;
        const dur = player._audio.duration;
        updateWaveform((cur / dur) * 100);
        timeLabel.innerText = formatTime(cur);
      }
    }

    // Play/Pause Click Handler
    playBtn.addEventListener('click', () => {
      if (player) {
        if (player.getCurrentUrl() === audioUrl) {
          player.togglePlayPause();
        } else {
          player.play(audioUrl, { title });
        }
      }
    });

    // Waveform click to seek
    waveformWrap.addEventListener('click', (e) => {
      const rect = waveformWrap.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const pct = (clickX / rect.width);
      
      if (player) {
        if (player.getCurrentUrl() !== audioUrl) {
          player.play(audioUrl, { title });
        }
        if (player._audio && player._audio.duration) {
          player._audio.currentTime = pct * player._audio.duration;
          updateWaveform(pct * 100);
          timeLabel.innerText = formatTime(player._audio.currentTime);
        }
      }
    });

    // Subscribe to GlobalAudioPlayer events for seamless state sync
    if (player) {
      player.on('*', ({ event, currentUrl, isPlaying, data }) => {
        if (!document.body.contains(playerWrapper)) return;

        if (currentUrl === audioUrl) {
          if (event === 'play') {
            playBtn.innerHTML = pauseSvg;
          } else if (event === 'pause') {
            playBtn.innerHTML = playSvg;
          } else if (event === 'ended') {
            playBtn.innerHTML = playSvg;
            updateWaveform(0);
            if (player._audio && player._audio.duration) {
              timeLabel.innerText = formatTime(player._audio.duration);
            }
          } else if (event === 'timeupdate' && data) {
            playBtn.innerHTML = isPlaying ? pauseSvg : playSvg;
            if (data.duration) {
              const pct = (data.currentTime / data.duration) * 100;
              updateWaveform(pct);
              timeLabel.innerText = formatTime(data.currentTime);
            }
          }
        } else {
          playBtn.innerHTML = playSvg;
          updateWaveform(0);
        }
      });
    }
  }

  /**
   * Request an audio summary of the recent chat research
   */
  async requestResearchAudio(lastContext = '', topic = 'Research Overview') {
    try {
      const res = await fetch('/api/audio-summary/research-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: lastContext, topic: topic, voice: 'hi-IN-SwaraNeural' })
      });
      const data = await res.json();
      if (data.status === 'ok' && data.data) {
        this.renderResearchVoiceCard(data.data);
      }
    } catch (err) {
      console.error('[AudioOverview] Failed to generate research audio:', err);
    }
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

export const audioOverviewManager = new AudioOverviewManager();
window.audioOverviewManager = audioOverviewManager;
