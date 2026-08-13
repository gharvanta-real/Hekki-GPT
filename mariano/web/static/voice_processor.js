export class VoiceProcessor {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isCancelled = false;
        this.stream = null;
    }

    async toggleVoice(socket, addLog, btnElement) {
        if (!this.isRecording) {
            await this.startRecording(socket, addLog, btnElement);
        } else {
            this.stopRecording(addLog, btnElement, false);
        }
    }

    async startRecording(socket, addLog, btnElement) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.stream = stream;
            this.audioChunks = [];
            this.isCancelled = false;
            this.mediaRecorder = new MediaRecorder(stream);
            
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => {
                if (this.stream) {
                    this.stream.getTracks().forEach(t => t.stop());
                    this.stream = null;
                }
                if (this.isCancelled) {
                    this.audioChunks = [];
                    if (addLog) addLog('[MIC] Recording cancelled.', 'info');
                    return;
                }
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: 'voice',
                            audio: reader.result.split(',')[1]
                        }));
                    }
                };
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            if (btnElement) btnElement.classList.add('recording');
            if (addLog) addLog('[MIC] Recording started. Speak now.', 'ok');
        } catch (err) {
            if (addLog) addLog(`[MIC] Access failed: ${err.message}`, 'err');
        }
    }

    stopRecording(addLog = null, btnElement = null, cancelled = false) {
        this.isCancelled = cancelled;
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            if (btnElement) btnElement.classList.remove('recording');
            if (addLog && !cancelled) addLog('[MIC] Processing audio...', 'ok');
        } else if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
            this.isRecording = false;
        }
    }

    cancelRecording(addLog = null, btnElement = null) {
        this.stopRecording(addLog, btnElement, true);
    }
}
