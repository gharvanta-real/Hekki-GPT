"""MARIANO Core — Gemini 2.5 Flash Native Audio Dialog Real-Time Voice Engine.

Provides zero-latency bi-directional audio streaming (PCM 16kHz) between 
client interfaces (WebSocket / WebAudio) and Gemini Live API.
Includes GeminiRateLimiter session locks, system context parity, and session tracking.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import AsyncGenerator, Dict, Any, Optional

import structlog
from google import genai
from google.genai import types

from mariano.config import get_settings, SYSTEM_PROMPT
from mariano.core.rate_limiter import GeminiRateLimiter

log = structlog.get_logger(__name__)

# Primary Live API model for Native Audio Dialog
LIVE_AUDIO_MODEL = "gemini-2.5-flash-native-audio-latest"
FALLBACK_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"


class LiveAudioSession:
    """Represents an active bi-directional audio/text streaming session with Gemini Live API."""

    def __init__(self, session_id: str, client: genai.Client, model_name: str) -> None:
        self.session_id = session_id
        self._client = client
        self.model_name = model_name
        self.is_active = False
        self._live_session = None
        self._start_time = time.time()
        self.chunks_sent = 0
        self.chunks_received = 0

    async def start(self) -> None:
        """Establishes the Live API WebSocket connection with Gemini."""
        settings = get_settings()
        
        system_instruction = (
            f"{SYSTEM_PROMPT}\n\n"
            "You are Hekki, a warm, concise, intelligent voice AI assistant responding in real-time dialog. "
            "Respond naturally and conversationally in 1-2 sentences unless asked for details. "
            "Speak fluently in English or Hindi/Hinglish as spoken by the user."
        )

        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            system_instruction=types.Content(
                parts=[types.Part.from_text(text=system_instruction)]
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Aoede"  # Warm conversational voice
                    )
                )
            )
        )

        try:
            # Acquire rate limit lock for establishing a Live session
            await GeminiRateLimiter.get_instance().acquire(token_count=1000)
            
            # Connect using google.genai SDK aio live client
            self._cm = self._client.aio.live.connect(
                model=self.model_name,
                config=config
            )
            self._live_session = await self._cm.__aenter__()
            self.is_active = True
            log.info("live_audio.session_started", session_id=self.session_id, model=self.model_name)
        except Exception as e:
            log.warning("live_audio.primary_model_failed_trying_fallback", error=str(e), model=self.model_name)
            # Try fallback model if primary model fails
            if self.model_name != FALLBACK_LIVE_MODEL:
                self.model_name = FALLBACK_LIVE_MODEL
                self._cm = self._client.aio.live.connect(
                    model=FALLBACK_LIVE_MODEL,
                    config=config
                )
                self._live_session = await self._cm.__aenter__()
                self.is_active = True
                log.info("live_audio.session_started_fallback", session_id=self.session_id, model=FALLBACK_LIVE_MODEL)
            else:
                raise

    async def send_audio_chunk(self, pcm_data: bytes, mime_type: str = "audio/pcm;rate=16000") -> None:
        """Streams a PCM audio chunk to Gemini Live API."""
        if not self.is_active or not self._live_session:
            raise RuntimeError("Live audio session is not active")
        
        await self._live_session.send(
            input={"data": pcm_data, "mime_type": mime_type},
            end_of_turn=False
        )
        self.chunks_sent += 1

    async def send_text(self, text_str: str) -> None:
        """Sends a text message into the live session."""
        if not self.is_active or not self._live_session:
            raise RuntimeError("Live audio session is not active")
        
        await self._live_session.send(
            input=text_str,
            end_of_turn=True
        )

    async def receive_stream(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Yields incoming streaming responses (audio PCM bytes & text transcripts) from Gemini."""
        if not self.is_active or not self._live_session:
            return

        try:
            async for response in self._live_session.receive():
                server_content = getattr(response, "server_content", None)
                if not server_content:
                    continue

                model_turn = getattr(server_content, "model_turn", None)
                if model_turn:
                    for part in getattr(model_turn, "parts", []):
                        # Audio PCM data
                        inline_data = getattr(part, "inline_data", None)
                        if inline_data and getattr(inline_data, "data", None):
                            self.chunks_received += 1
                            yield {
                                "type": "audio",
                                "data": inline_data.data,  # Raw PCM audio bytes
                                "mime_type": getattr(inline_data, "mime_type", "audio/pcm")
                            }
                        
                        # Text transcript
                        text_content = getattr(part, "text", None)
                        if text_content:
                            yield {
                                "type": "text",
                                "text": text_content
                            }

                # Check turn completion
                turn_complete = getattr(server_content, "turn_complete", False)
                if turn_complete:
                    yield {"type": "turn_complete"}
        except Exception as e:
            err_str = str(e)
            if "1000" in err_str or "OK" in err_str or "closed" in err_str.lower():
                log.info("live_audio.session_turn_closed_normally", session_id=self.session_id)
                yield {"type": "turn_complete"}
            else:
                log.error("live_audio.receive_error", session_id=self.session_id, error=err_str)
                yield {"type": "error", "message": err_str}

    async def close(self) -> None:
        """Gracefully closes the Live API session."""
        if self.is_active and hasattr(self, '_cm') and self._cm:
            try:
                await self._cm.__aexit__(None, None, None)
            except Exception as e:
                log.warning("live_audio.session_close_warning", session_id=self.session_id, error=str(e))
            finally:
                self.is_active = False
                log.info(
                    "live_audio.session_closed",
                    session_id=self.session_id,
                    duration_s=round(time.time() - self._start_time, 2),
                    chunks_sent=self.chunks_sent,
                    chunks_received=self.chunks_received
                )


class LiveAudioEngine:
    """Singleton manager for real-time Gemini Live Audio sessions and request throttling."""

    _instance: Optional[LiveAudioEngine] = None

    def __init__(self) -> None:
        self._settings = get_settings()
        self._active_sessions: Dict[str, LiveAudioSession] = {}
        self._total_session_count = 0
        self._max_simultaneous_sessions = 20  # High concurrent sessions backed by 1M TPM quota

    @classmethod
    def get_instance(cls) -> LiveAudioEngine:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_genai_client(self) -> genai.Client:
        return genai.Client(api_key=self._settings.active_gemini_api_key)

    async def create_session(self, session_id: str) -> LiveAudioSession:
        """Creates and starts a new LiveAudioSession, enforcing session limits."""
        # Cleanup inactive sessions
        inactive = [sid for sid, sess in self._active_sessions.items() if not sess.is_active]
        for sid in inactive:
            self._active_sessions.pop(sid, None)

        if len(self._active_sessions) >= self._max_simultaneous_sessions:
            raise RuntimeError(f"Max active Live Audio sessions reached ({self._max_simultaneous_sessions}). Please wait.")

        client = self._get_genai_client()
        session = LiveAudioSession(session_id=session_id, client=client, model_name=LIVE_AUDIO_MODEL)
        await session.start()
        
        self._active_sessions[session_id] = session
        self._total_session_count += 1
        return session

    def get_session(self, session_id: str) -> Optional[LiveAudioSession]:
        return self._active_sessions.get(session_id)

    async def close_session(self, session_id: str) -> None:
        session = self._active_sessions.pop(session_id, None)
        if session:
            await session.close()

    def get_stats(self) -> Dict[str, Any]:
        return {
            "active_sessions": len(self._active_sessions),
            "total_sessions_created": self._total_session_count,
            "max_allowed_simultaneous": self._max_simultaneous_sessions,
            "primary_model": LIVE_AUDIO_MODEL,
        }
