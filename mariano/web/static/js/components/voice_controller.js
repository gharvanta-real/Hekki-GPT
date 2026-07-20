import { initWaveCanvas } from '/static/wave_canvas.js';

let stopWave = null;

export let resetVoiceUIInstance = null;

export function bindVoice(voice, socket, inConversationState, log) {
  const $ = (id) => document.getElementById(id);
  
  const toggleVoice = async () => {
    const activeMic = inConversationState.val ? $('btn-voice-conv') : $('btn-voice');
    await voice.toggleVoice(socket, log, activeMic);

    if (voice.isRecording) {
      const input = inConversationState.val ? $('chat-input-conv') : $('chat-input');
      if (input) { input.placeholder = 'Listening...'; input.disabled = true; }

      $('btn-stop')?.classList.remove('hidden');
      if (activeMic) activeMic.classList.add('voice-recording-active');
    } else {
      resetVoiceUI();
    }
  };

  const resetVoiceUI = () => {
    const input = inConversationState.val ? $('chat-input-conv') : $('chat-input');
    if (input) {
      input.placeholder = inConversationState.val ? 'Reply...' : 'How can I help you today?';
      input.disabled = false;
    }
    $('btn-stop')?.classList.add('hidden');
    $('btn-voice')?.classList.remove('voice-recording-active');
    $('btn-voice-conv')?.classList.remove('voice-recording-active');
  };
  
  resetVoiceUIInstance = resetVoiceUI;

  $('btn-voice')?.addEventListener('click', toggleVoice);
  $('btn-voice-conv')?.addEventListener('click', toggleVoice);
  $('btn-stop')?.addEventListener('click', toggleVoice);

  // Delegate click for dynamically rendered agent voice button
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-agent-voice');
    if (btn) {
      toggleVoice();
    }
  });

  // Space bar outside input = toggle voice
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      const active = document.activeElement;
      if (active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.hasAttribute('contenteditable')
      )) {
        return;
      }
      e.preventDefault();
      toggleVoice();
    }
  });
}
