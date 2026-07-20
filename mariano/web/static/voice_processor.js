export class VoiceProcessor {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
    }

    async toggleVoice(socket, addLog, btnElement) {
        if (!this.isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.audioChunks = [];
                this.mediaRecorder = new MediaRecorder(stream);
                
                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this.audioChunks.push(e.data);
                };

                this.mediaRecorder.onstop = () => {
                    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                        socket.send(JSON.stringify({
                            type: 'voice',
                            audio: reader.result.split(',')[1]
                        }));
                    };
                    stream.getTracks().forEach(t => t.stop());
                };

                this.mediaRecorder.start();
                this.isRecording = true;
                btnElement.classList.add('recording');
                addLog('[MIC] Recording started. Speak now.', 'ok');
            } catch (err) {
                addLog(`[MIC] Access failed: ${err.message}`, 'err');
            }
        } else {
            this.mediaRecorder?.stop();
            this.isRecording = false;
            btnElement.classList.remove('recording');
            addLog('[MIC] Processing audio...', 'ok');
        }
    }
}
