export let resetVoiceUIInstance = null;

let audioCtx = null;
let analyser = null;
let animFrameId = null;
let currentCapsule = null;

let waveformHistory = Array(56).fill(0.04);
let lastSampleTime = 0;

function startAudioLevelTracking(stream, capsule) {
  stopAudioLevelTracking();
  if (!stream) return;
  currentCapsule = capsule;
  waveformHistory = Array(56).fill(0.04);
  lastSampleTime = performance.now();

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function loop(now) {
      if (!analyser) return;

      // Sample mic volume every 28ms for 60fps smooth right-to-left scrolling full-width waveform flow
      if (now - lastSampleTime >= 28) {
        lastSampleTime = now;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / (dataArray.length || 1);
        const level = Math.min(1, Math.max(0.04, (avg - 6) / 100));

        // Push new sound sample to right end (index 55), shift oldest out from left (index 0)
        waveformHistory.shift();
        waveformHistory.push(level);

        // Update DOM bars for both home and conv bars
        ['v-bars-home', 'v-bars-conv'].forEach(id => {
          const wrapper = document.getElementById(id);
          if (wrapper) {
            const bars = wrapper.querySelectorAll('.v-bar');
            bars.forEach((bar, idx) => {
              const lvl = waveformHistory[idx] !== undefined ? waveformHistory[idx] : 0.04;
              const h = Math.max(3, Math.round(lvl * 26));
              bar.style.height = `${h}px`;
              if (lvl > 0.14) {
                bar.classList.add('active');
              } else {
                bar.classList.remove('active');
              }
            });
          }
        });
      }

      animFrameId = requestAnimationFrame(loop);
    }
    loop(performance.now());
  } catch (err) {
    console.warn('[MIC] Audio level tracking error:', err);
  }
}

function stopAudioLevelTracking() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  analyser = null;
  currentCapsule = null;
}

export function bindVoice(voice, socket, inConversationState, log) {
  const $ = (id) => document.getElementById(id);

  const showVoiceBar = () => {
    if (inConversationState.val) {
      $('input-row-conv')?.classList.add('hidden');
      $('chat-input-conv')?.classList.add('hidden');
      $('preview-area-conv')?.classList.add('hidden');
      $('voice-bar-conv')?.classList.remove('hidden');
    } else {
      $('input-row-home')?.classList.add('hidden');
      $('chat-input')?.classList.add('hidden');
      $('preview-area-home')?.classList.add('hidden');
      $('voice-bar-home')?.classList.remove('hidden');
    }
  };

  const hideVoiceBar = () => {
    $('input-row-home')?.classList.remove('hidden');
    $('chat-input')?.classList.remove('hidden');
    $('voice-bar-home')?.classList.add('hidden');

    $('input-row-conv')?.classList.remove('hidden');
    $('chat-input-conv')?.classList.remove('hidden');
    $('voice-bar-conv')?.classList.add('hidden');
  };

  const getActiveMicAndCapsule = () => {
    const coderPane = $('page-coder');
    const debatePane = $('debate-pane');

    if (coderPane && coderPane.style.display !== 'none') {
      return { mic: $('coder-btn-voice'), cap: $('coder-input-capsule'), input: $('coder-input') };
    }
    if (debatePane && debatePane.style.display !== 'none') {
      return { mic: $('btn-input-voice'), cap: $('debate-input-capsule'), input: $('debate-input') };
    }
    if (inConversationState.val) {
      return { mic: $('btn-voice-conv'), cap: $('input-capsule-conv'), input: $('chat-input-conv') };
    }
    return { mic: $('btn-voice'), cap: $('input-capsule'), input: $('chat-input') };
  };

  const toggleVoice = async (e) => {
    const { mic, cap, input } = getActiveMicAndCapsule();
    if (!mic) {
      resetVoiceUI();
      return;
    }
    await voice.toggleVoice(socket, log, mic);

    if (voice.isRecording) {
      showVoiceBar();
      startAudioLevelTracking(voice.stream, cap);
    } else {
      resetVoiceUI();
    }
  };

  const resetVoiceUI = () => {
    stopAudioLevelTracking();
    hideVoiceBar();

    const { input } = getActiveMicAndCapsule();
    if (input) {
      input.placeholder = inConversationState.val ? 'Write a message...' : 'How can I help you today?';
      input.disabled = false;
    }

    $('btn-stop')?.classList.add('hidden');

    const allMics = [$('btn-voice'), $('btn-voice-conv'), $('coder-btn-voice'), $('btn-input-voice')].filter(Boolean);
    allMics.forEach(m => m.classList.remove('voice-recording-active'));

    const allCaps = [$('input-capsule'), $('input-capsule-conv'), $('coder-input-capsule'), $('debate-input-capsule')].filter(Boolean);
    allCaps.forEach(c => {
      c.classList.remove('capsule-listening-active');
      c.style.removeProperty('--voice-level');
    });
  };

  resetVoiceUIInstance = resetVoiceUI;
  resetVoiceUI(); // Clean up on init

  // Bind main mic buttons
  ['btn-voice', 'btn-voice-conv', 'coder-btn-voice', 'btn-input-voice', 'btn-stop'].forEach(id => {
    const btn = $(id);
    if (btn && !btn._voiceBound) {
      btn._voiceBound = true;
      btn.addEventListener('click', toggleVoice);
    }
  });

  // Bind waveform bar action buttons
  ['btn-cancel-voice-home', 'btn-cancel-voice-conv'].forEach(id => {
    const btn = $(id);
    if (btn && !btn._cancelBound) {
      btn._cancelBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        voice.cancelRecording(log);
        resetVoiceUI();
      });
    }
  });

  ['btn-stop-voice-home', 'btn-stop-voice-conv'].forEach(id => {
    const btn = $(id);
    if (btn && !btn._stopBound) {
      btn._stopBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        voice.stopRecording(log);
        resetVoiceUI();
      });
    }
  });

  ['btn-send-voice-home', 'btn-send-voice-conv'].forEach(id => {
    const btn = $(id);
    if (btn && !btn._sendBound) {
      btn._sendBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        voice.stopRecording(log);
        resetVoiceUI();
      });
    }
  });

  // Delegate click for dynamically rendered agent voice button
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-agent-voice');
    if (btn) {
      toggleVoice(e);
    }
  });
}
