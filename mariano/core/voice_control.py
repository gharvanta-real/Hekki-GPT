"""MARIANO Core — Dynamic Voice Recorder and Audio Transcriber using Gemini API."""
from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path
from typing import Callable, Optional

import numpy as np
import sounddevice as sd
import soundfile as sf
import structlog
from google import genai

from mariano.config import get_settings

log = structlog.get_logger(__name__)


class VoiceController:
    """Manages audio recording streams and leverages Gemini Multimodal API to transcribe commands."""

    _instance: Optional[VoiceController] = None

    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = genai.Client(api_key=self.settings.gemini_api_key)
        
        self.sample_rate = 16000  # Standard rate for speech recognition
        self.channels = 1
        
        self._recording = False
        self._audio_data: list[np.ndarray] = []
        self._stream: Optional[sd.InputStream] = None

    @classmethod
    def get_instance(cls) -> VoiceController:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def is_recording(self) -> bool:
        return self._recording

    def start_recording(self) -> None:
        """Starts capturing audio stream into memory."""
        if self._recording:
            return
        
        self._recording = True
        self._audio_data.clear()
        
        def callback(indata, frames, time_info, status):
            if status:
                log.warning("audio.stream_status", status=str(status))
            self._audio_data.append(indata.copy())

        try:
            self._stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                callback=callback,
                dtype="float32"
            )
            self._stream.start()
            log.info("audio.recording_started")
        except Exception as e:
            self._recording = False
            log.error("audio.start_failed", error=str(e))

    def stop_recording(self) -> Optional[Path]:
        """Stops capturing audio and writes the buffer into a temporary WAV file."""
        if not self._recording:
            return None
        
        self._recording = False
        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None

        if not self._audio_data:
            return None

        # Concatenate and save to temporary file
        try:
            audio_np = np.concatenate(self._audio_data, axis=0)
            temp_dir = Path(tempfile.gettempdir())
            temp_wav = temp_dir / f"mariano_voice_{int(asyncio.get_event_loop().time())}.wav"
            sf.write(str(temp_wav), audio_np, self.sample_rate)
            log.info("audio.saved_temp", path=str(temp_wav), duration_secs=len(audio_np)/self.sample_rate)
            return temp_wav
        except Exception as e:
            log.error("audio.save_failed", error=str(e))
            return None

    async def transcribe_audio(self, wav_path: Path) -> str:
        """Uploads temporary WAV to Gemini, transcribes speech, and cleans up the remote/local file."""
        if not wav_path.exists():
            return ""

        try:
            log.info("audio.transcribe_start", path=str(wav_path))
            
            # Upload WAV using google.genai file API
            loop = asyncio.get_event_loop()
            audio_file = await loop.run_in_executor(
                None,
                lambda: self.client.files.upload(file=wav_path)
            )

            # Generate transcript from multimodal context
            prompt = (
                "Transcribe this audio recording accurately. The speech is spoken in Indian English, Hinglish, or Hindi. "
                "Output ONLY the transcribed text in Roman script or Devanagari as spoken. "
                "Do not add introductions, explanations, punctuation, or formatting. "
                "If no clear words are spoken, reply with an empty string."
            )
            
            from mariano.core.rate_limiter import GeminiRateLimiter
            await GeminiRateLimiter.get_instance().acquire(token_count=1000)

            response = await loop.run_in_executor(
                None,
                lambda: self.client.models.generate_content(
                    model=self.settings.mariano_model,
                    contents=[audio_file, prompt]
                )
            )
            
            # Cleanup remote file
            await loop.run_in_executor(
                None,
                lambda: self.client.files.delete(name=audio_file.name)
            )
            
            # Cleanup local temporary file
            wav_path.unlink(missing_ok=True)
            
            transcript = response.text.strip() if response.text else ""
            log.info("audio.transcribed", result=transcript)
            return transcript

        except Exception as e:
            log.error("audio.transcription_failed", error=str(e))
            wav_path.unlink(missing_ok=True)
            return ""
