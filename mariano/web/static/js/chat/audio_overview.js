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
   * Mounts an interactive flat audio player widget into container
   */
  mountAudioPlayer(container, audioUrl, title = 'Audio Track') {
    const audio = new Audio(audioUrl);
    
    const playerBar = document.createElement('div');
    playerBar.className = 'audio-player-bar';

    playerBar.innerHTML = `
      <button class="audio-play-btn" title="Play">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </button>
      <div class="audio-track-info">
        <div class="audio-track-title">${escapeHtml(title)}</div>
        <div class="audio-progress-container">
          <input type="range" class="audio-scrubber" value="0" min="0" max="100" step="0.1">
          <span class="audio-time-label">0:00 / 0:00</span>
        </div>
      </div>
      <div class="audio-controls-right">
        <button class="btn-audio-rate" title="Playback Speed">1.0x</button>
        <a href="${audioUrl}" download class="btn-audio-rate" title="Download MP3" style="text-decoration:none; display:inline-flex; align-items:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </a>
      </div>
    `;

    container.appendChild(playerBar);

    const playBtn = playerBar.querySelector('.audio-play-btn');
    const scrubber = playerBar.querySelector('.audio-scrubber');
    const timeLabel = playerBar.querySelector('.audio-time-label');
    const rateBtn = playerBar.querySelector('.btn-audio-rate');

    const formatTime = (secs) => {
      if (isNaN(secs) || secs < 0) return '0:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Play/Pause
    playBtn.addEventListener('click', () => {
      if (audio.paused) {
        if (this.currentAudio && this.currentAudio !== audio) {
          this.currentAudio.pause();
          if (this.currentPlayBtn) {
            this.currentPlayBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
          }
        }
        audio.play();
        this.currentAudio = audio;
        this.currentPlayBtn = playBtn;
        playBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
      } else {
        audio.pause();
        playBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      }
    });

    // Time update & Scrubber sync
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      const progress = (audio.currentTime / audio.duration) * 100;
      scrubber.value = progress;
      timeLabel.innerText = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    });

    audio.addEventListener('loadedmetadata', () => {
      timeLabel.innerText = `0:00 / ${formatTime(audio.duration)}`;
    });

    audio.addEventListener('ended', () => {
      playBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      scrubber.value = 0;
    });

    // Scrubber interaction
    scrubber.addEventListener('input', () => {
      if (!audio.duration) return;
      audio.currentTime = (scrubber.value / 100) * audio.duration;
    });

    // Speed toggle
    rateBtn.addEventListener('click', () => {
      this.currentRateIdx = (this.currentRateIdx + 1) % this.playbackRates.length;
      const rate = this.playbackRates[this.currentRateIdx];
      audio.playbackRate = rate;
      rateBtn.innerText = `${rate.toFixed(1)}x`;
    });
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
