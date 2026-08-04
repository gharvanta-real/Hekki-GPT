export let resetVoiceUIInstance = null;

let audioCtx = null;
let analyser = null;
let animFrameId = null;
let currentCapsule = null;

function startAudioLevelTracking(stream, capsule) {
  stopAudioLevelTracking();
  if (!stream || !capsule) return;
  currentCapsule = capsule;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let smoothedLevel = 0.2;

    function loop() {
      if (!analyser || !currentCapsule) return;
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / (dataArray.length || 1);
      const targetLevel = Math.min(1, Math.max(0.15, avg / 32));

      // LERP exponential smoothing for buttery smooth audio beat transitions
      smoothedLevel += (targetLevel - smoothedLevel) * 0.12;

      currentCapsule.style.setProperty('--voice-level', smoothedLevel.toFixed(3));
      animFrameId = requestAnimationFrame(loop);
    }
    loop();
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
  if (currentCapsule) {
    currentCapsule.style.removeProperty('--voice-level');
    currentCapsule = null;
  }
}

export function bindVoice(voice, socket, inConversationState, log) {
  const $ = (id) => document.getElementById(id);
  
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
    // Only toggle voice if explicitly triggered by a user action when mic button exists
    const { mic, cap, input } = getActiveMicAndCapsule();
    if (!mic) {
      resetVoiceUI();
      return;
    }
    await voice.toggleVoice(socket, log, mic);

    if (voice.isRecording) {
      if (input) { input.placeholder = 'Listening...'; input.disabled = true; }

      $('btn-stop')?.classList.remove('hidden');
      
      // Highlight all mics & active capsule
      const allMics = [$('btn-voice'), $('btn-voice-conv'), $('coder-btn-voice'), $('btn-input-voice')].filter(Boolean);
      allMics.forEach(m => m.classList.add('voice-recording-active'));

      if (cap) cap.classList.add('capsule-listening-active');

      startAudioLevelTracking(voice.stream, cap);
    } else {
      resetVoiceUI();
    }
  };

  const resetVoiceUI = () => {
    stopAudioLevelTracking();

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

  ['btn-voice', 'btn-voice-conv', 'coder-btn-voice', 'btn-input-voice', 'btn-stop'].forEach(id => {
    const btn = $(id);
    if (btn && !btn._voiceBound) {
      btn._voiceBound = true;
      btn.addEventListener('click', toggleVoice);
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
