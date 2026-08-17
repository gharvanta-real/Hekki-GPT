/**
 * audio_player.js — Spotify-Style Global Persistent Audio Engine (<500 lines)
 * Uninterrupted audio playback across all pages with dual synchronization:
 * 1. Global Viewport Floating Bar (#global-audio-player-bar)
 * 2. Top Nav Right Player Button & Spotify-Style Hover Flyout (#topnav-audio-wrapper)
 */

export class GlobalAudioPlayer {
  constructor() {
    this._audio = new Audio();
    this._currentUrl = null;
    this._currentTitle = '';
    this._playbackRate = 1;
    this._listeners = new Set();
    this._barEl = null;
    this._titleEl = null;
    this._timeEl = null;
    this._scrubberEl = null;
    this._toggleIconEl = null;
    this._speedBtnEl = null;

    this._topnavWrapperEl = null;
    this._topnavBtnEl = null;
    this._topnavLabelEl = null;
    this._topnavDropdownEl = null;
    this._hoverTimer = null;

    this._sidebarCardEl = null;
    this._sidebarTitleEl = null;
    this._sidebarSubtitleEl = null;
    this._sidebarCurTimeEl = null;
    this._sidebarDurTimeEl = null;
    this._sidebarToggleIconEl = null;
    this._sidebarCoverInner = null;
    this._sidebarScrubberEl = null;
    this._sidebarSpeedBtnEl = null;
    this._isScrubbing = false;

    this._initAudioEvents();
  }

  init() {
    this._barEl = document.getElementById('global-audio-player-bar');
    this._titleEl = document.getElementById('global-player-title');
    this._timeEl = document.getElementById('global-player-time');
    this._scrubberEl = document.getElementById('global-player-scrubber');
    this._toggleIconEl = document.getElementById('global-player-toggle-icon');
    this._speedBtnEl = document.getElementById('global-player-speed');

    this._topnavWrapperEl = document.getElementById('topnav-audio-wrapper');
    this._topnavBtnEl = document.getElementById('topnav-audio-btn');
    this._topnavLabelEl = document.getElementById('topnav-audio-label');
    this._topnavDropdownEl = document.getElementById('topnav-audio-dropdown');

    this._sidebarCardEl = document.getElementById('sidebar-audio-card') || this._topnavDropdownEl;
    this._sidebarTitleEl = document.getElementById('sidebar-audio-title');
    this._sidebarSubtitleEl = document.getElementById('sidebar-audio-subtitle');
    this._sidebarCurTimeEl = document.getElementById('sidebar-audio-cur-time');
    this._sidebarDurTimeEl = document.getElementById('sidebar-audio-dur-time');
    this._sidebarToggleIconEl = document.getElementById('sidebar-audio-toggle-icon');
    this._sidebarCoverInner = document.getElementById('sidebar-audio-cover-inner');
    this._sidebarScrubberEl = document.getElementById('sidebar-audio-scrubber');
    this._sidebarSpeedBtnEl = document.getElementById('sidebar-audio-speed');

    document.getElementById('global-player-toggle')?.addEventListener('click', () => this.togglePlayPause());
    document.getElementById('global-player-close')?.addEventListener('click', () => this.stop());

    document.getElementById('sidebar-audio-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePlayPause();
    });
    document.getElementById('sidebar-audio-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._topnavDropdownEl) this._topnavDropdownEl.classList.add('hidden');
      this.stop();
    });

    document.getElementById('sidebar-audio-rewind')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.seekBy(-10);
    });

    document.getElementById('sidebar-audio-forward')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.seekBy(10);
    });

    // Top Nav Hover & Click Flyout Handlers
    if (this._topnavWrapperEl) {
      this._topnavWrapperEl.addEventListener('mouseenter', () => {
        if (this._hoverTimer) clearTimeout(this._hoverTimer);
        if (this._currentUrl && this._topnavDropdownEl) {
          this._topnavDropdownEl.classList.remove('hidden');
        }
      });

      this._topnavWrapperEl.addEventListener('mouseleave', () => {
        if (this._hoverTimer) clearTimeout(this._hoverTimer);
        this._hoverTimer = setTimeout(() => {
          if (this._topnavDropdownEl) this._topnavDropdownEl.classList.add('hidden');
        }, 300);
      });
    }

    if (this._topnavBtnEl) {
      this._topnavBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._topnavDropdownEl) {
          this._topnavDropdownEl.classList.toggle('hidden');
        }
      });
    }

    // Close flyout on outside click
    document.addEventListener('click', (e) => {
      if (this._topnavWrapperEl && !this._topnavWrapperEl.contains(e.target)) {
        if (this._topnavDropdownEl) this._topnavDropdownEl.classList.add('hidden');
      }
    });

    const bindScrub = (el) => {
      if (!el) return;
      el.addEventListener('mousedown', () => { this._isScrubbing = true; });
      el.addEventListener('touchstart', () => { this._isScrubbing = true; });
      el.addEventListener('change', (e) => {
        this._isScrubbing = false;
        if (this._audio.duration) {
          this._audio.currentTime = (parseFloat(e.target.value) / 100) * this._audio.duration;
        }
      });
    };

    bindScrub(this._scrubberEl);
    bindScrub(this._sidebarScrubberEl);

    const cycleSpeed = () => {
      const speeds = [1, 1.25, 1.5, 2];
      const nextIdx = (speeds.indexOf(this._playbackRate) + 1) % speeds.length;
      this.setSpeed(speeds[nextIdx]);
    };

    this._speedBtnEl?.addEventListener('click', cycleSpeed);
    this._sidebarSpeedBtnEl?.addEventListener('click', cycleSpeed);
  }

  _initAudioEvents() {
    this._audio.addEventListener('play', () => {
      this._updateUI(true);
      this._notify('play');
    });

    this._audio.addEventListener('pause', () => {
      this._updateUI(false);
      this._notify('pause');
    });

    this._audio.addEventListener('ended', () => {
      this._updateUI(false);
      this._notify('ended');
      if (this._barEl) this._barEl.classList.add('hidden');
      if (this._topnavBtnEl) this._topnavBtnEl.classList.add('hidden');
      if (this._topnavDropdownEl) this._topnavDropdownEl.classList.add('hidden');
      if (this._sidebarCardEl) this._sidebarCardEl.classList.add('hidden');
    });

    this._audio.addEventListener('timeupdate', () => {
      if (this._isScrubbing) return;
      const cur = this._fmtTime(this._audio.currentTime);
      const dur = this._fmtTime(this._audio.duration);
      if (this._timeEl) this._timeEl.textContent = `${cur} / ${dur}`;
      if (this._sidebarCurTimeEl) this._sidebarCurTimeEl.textContent = cur;
      if (this._sidebarDurTimeEl) this._sidebarDurTimeEl.textContent = dur;

      const pct = this._audio.duration ? (this._audio.currentTime / this._audio.duration) * 100 : 0;
      if (this._scrubberEl && this._audio.duration) this._scrubberEl.value = pct;
      if (this._sidebarScrubberEl && this._audio.duration) this._sidebarScrubberEl.value = pct;
      this._notify('timeupdate', { currentTime: this._audio.currentTime, duration: this._audio.duration });
    });

    this._audio.addEventListener('error', (e) => {
      console.warn('Global Audio Player Error:', e);
      this._notify('error', e);
    });
  }

  seekBy(deltaSeconds) {
    if (!this._audio.duration) return;
    this._audio.currentTime = Math.max(0, Math.min(this._audio.duration, this._audio.currentTime + deltaSeconds));
  }

  play(url, title = 'Audio Overview', thumbUrl = null) {
    if (!url) return;
    if (this._currentUrl === url && !this._audio.paused) {
      this.pause();
      return;
    }
    if (this._currentUrl === url && this._audio.paused) {
      this._audio.play().catch(e => console.warn('Resume audio failed', e));
      return;
    }

    this._currentUrl = url;
    this._currentTitle = title;
    this._audio.src = url;
    this._audio.playbackRate = this._playbackRate;

    const displayTitle = this._cleanTitle(title);

    if (this._barEl) this._barEl.classList.remove('hidden');
    if (this._titleEl) this._titleEl.textContent = displayTitle;
    if (this._timeEl) this._timeEl.textContent = '0:00 / 0:00';
    if (this._scrubberEl) this._scrubberEl.value = 0;

    if (this._topnavBtnEl) this._topnavBtnEl.classList.remove('hidden');
    if (this._topnavLabelEl) this._topnavLabelEl.textContent = displayTitle;

    if (this._sidebarTitleEl) this._sidebarTitleEl.textContent = displayTitle;
    if (this._sidebarCurTimeEl) this._sidebarCurTimeEl.textContent = '0:00';
    if (this._sidebarDurTimeEl) this._sidebarDurTimeEl.textContent = '0:00';
    if (this._sidebarScrubberEl) this._sidebarScrubberEl.value = 0;

    if (this._sidebarCoverInner) {
      if (thumbUrl) {
        this._sidebarCoverInner.innerHTML = `<img src="${thumbUrl}" alt="" />`;
      } else {
        this._sidebarCoverInner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 32 32" fill="currentColor"><path d="M26 4H6a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 22H6V6h20v20z"/><circle cx="16" cy="16" r="4"/></svg>`;
      }
    }

    this._audio.play().catch(e => console.warn('Play audio failed', e));
  }

  pause() {
    this._audio.pause();
  }

  resume() {
    if (this._currentUrl && this._audio.paused) {
      this._audio.play().catch(e => console.warn('Resume audio failed', e));
    }
  }

  togglePlayPause() {
    if (this._audio.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  stop() {
    this._audio.pause();
    this._audio.currentTime = 0;
    this._currentUrl = null;
    this._currentTitle = '';
    if (this._barEl) this._barEl.classList.add('hidden');
    if (this._topnavBtnEl) this._topnavBtnEl.classList.add('hidden');
    if (this._topnavDropdownEl) this._topnavDropdownEl.classList.add('hidden');
    if (this._sidebarCardEl) this._sidebarCardEl.classList.add('hidden');
    this._notify('stop');
  }

  setSpeed(speed) {
    this._playbackRate = speed;
    this._audio.playbackRate = speed;
    if (this._speedBtnEl) this._speedBtnEl.textContent = `${speed}x`;
    if (this._sidebarSpeedBtnEl) this._sidebarSpeedBtnEl.textContent = `${speed}x`;
    this._notify('speed', speed);
  }

  isPlaying(url) {
    if (!url) return !this._audio.paused && !!this._currentUrl;
    return this._currentUrl === url && !this._audio.paused;
  }

  getCurrentUrl() {
    return this._currentUrl;
  }

  on(event, callback) {
    this._listeners.add({ event, callback });
    return () => this._listeners.delete({ event, callback });
  }

  _notify(event, data) {
    for (const listener of this._listeners) {
      if (listener.event === event || listener.event === '*') {
        try { listener.callback({ event, data, currentUrl: this._currentUrl, isPlaying: !this._audio.paused }); } catch (e) {}
      }
    }
  }

  _cleanTitle(title) {
    if (!title) return 'Voice Overview';
    let clean = title.replace(/\.mp3$/i, '').replace(/\.wav$/i, '').replace(/_/g, ' ');
    if (clean.length > 22) clean = clean.substring(0, 20) + '…';
    return clean;
  }

  _updateUI(isPlaying) {
    const playSvg = `<polygon points="6 4 18 12 6 20 6 4"/>`;
    const pauseSvg = `<rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/>`;

    if (this._toggleIconEl) {
      this._toggleIconEl.innerHTML = isPlaying ? pauseSvg : playSvg;
    }
    if (this._sidebarToggleIconEl) {
      this._sidebarToggleIconEl.innerHTML = isPlaying ? pauseSvg : playSvg;
    }
    if (this._barEl) {
      const eqEl = this._barEl.querySelector('.lib-equalizer');
      if (eqEl) eqEl.style.opacity = isPlaying ? '1' : '0.4';
    }
    if (this._topnavBtnEl) {
      const eqEl = this._topnavBtnEl.querySelector('.lib-equalizer');
      if (eqEl) eqEl.style.opacity = isPlaying ? '1' : '0.4';
    }
  }

  _fmtTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
}

export const globalAudioPlayer = new GlobalAudioPlayer();
if (typeof window !== 'undefined') {
  window.globalAudioPlayer = globalAudioPlayer;
}
