"""
Hardware Signal Multi-Decks Coordinator — Physical Sound Stream Matrix.
Completely refactored execution layers, threading locks, and cross-channel sync mechanisms.
"""

from __future__ import annotations
import threading
from typing import Any, Callable
import numpy as np
import sounddevice as sd

from app.audio.deck import Deck
from app.audio.mixer import Mixer
from app.audio.routing import AudioRouter


class AudioPlaybackCoordinator:
    FIXED_SAMPLING_RATE = 44100
    HARDWARE_BLOCK_SIZE = 1024
    MATRIX_CHANNELS = 2

    def __init__(self) -> None:
        self._global_resource_mutex = threading.RLock()
        self.deck_a = Deck("A", self.FIXED_SAMPLING_RATE)
        self.deck_b = Deck("B", self.FIXED_SAMPLING_RATE)
        self.mixer = Mixer()
        self.router = AudioRouter()
        
        self._primary_out_node: sd.OutputStream | None = None
        self._monitor_cue_node: sd.OutputStream | None = None
        self._is_active = False
        
        self._session_capture_stack: list[np.ndarray] = []
        self._is_capture_active = False
        self._event_subscribers: list[Callable[[], None]] = []
        
        self._cue_buffer_mutex = threading.Lock()
        self._staged_monitor_data: np.ndarray | None = None

    def register_state_observer(self, observation_callback: Callable[[], None]) -> None:
        """Appends notification targets to respond to real-time parameters alteration."""
        self._event_subscribers.append(observation_callback)

    def _broadcast_state_event(self) -> None:
        """Dispatches event alerts across registered interface callbacks."""
        for active_subscriber in self._event_subscribers:
            try:
                active_subscriber()
            except Exception:
                pass

    def engage_engine(self) -> None:
        """Initializes low-latency multi-output drivers and hardware streaming pipes."""
        with self._global_resource_mutex:
            if self._is_active:
                return
            self._construct_audio_streams()
            self._is_active = True

    def terminate_engine(self) -> None:
        """Halts running streams and safely closes low-latency hardware handles."""
        with self._global_resource_mutex:
            self._is_active = False
            for target_stream in (self._primary_out_node, self._monitor_cue_node):
                if target_stream:
                    target_stream.stop()
                    target_stream.close()
            self._primary_out_node = self._monitor_cue_node = None

    def recycle_audio_streams(self) -> None:
        """Re-initializes physical interface configurations on target output alterations."""
        with self._global_resource_mutex:
            was_active = self._is_active
            if was_active:
                for target_stream in (self._primary_out_node, self._monitor_cue_node):
                    if target_stream:
                        target_stream.stop()
                        target_stream.close()
                self._primary_out_node = self._monitor_cue_node = None
                self._construct_audio_streams()

    def _construct_audio_streams(self) -> None:
        """Prepares physical context parameters for structural stream mounting."""
        primary_endpoint = self.router.get_master_device()
        stream_configuration: dict[str, Any] = {
            "samplerate": self.FIXED_SAMPLING_RATE,
            "channels": self.MATRIX_CHANNELS,
            "blocksize": self.HARDWARE_BLOCK_SIZE,
            "dtype": "float32",
            "callback": self._process_primary_mixing_bus,
        }
        if primary_endpoint is not None:
            stream_configuration["device"] = primary_endpoint
            
        self._primary_out_node = sd.OutputStream(**stream_configuration)
        self._primary_out_node.start()

        monitor_endpoint = self.router.get_cue_device()
        if monitor_endpoint is not None and monitor_endpoint != primary_endpoint:
            self._monitor_cue_node = sd.OutputStream(
                samplerate=self.FIXED_SAMPLING_RATE,
                channels=self.MATRIX_CHANNELS,
                blocksize=self.HARDWARE_BLOCK_SIZE,
                dtype="float32",
                device=monitor_endpoint,
                callback=self._process_headphone_cue_bus,
            )
            self._monitor_cue_node.start()

    def _process_primary_mixing_bus(self, target_buffer: np.ndarray, frame_stride: int, _time_delta, status_flags) -> None:
        """Hardware callback thread managing frame extraction, real-time mixing, and recording capture."""
        frame_chunk_a = self.deck_a.read_frames(frame_stride)
        frame_chunk_b = self.deck_b.read_frames(frame_stride)
        
        summed_master_mix = self.mixer.mix(frame_chunk_a, frame_chunk_b)
        
        if self._is_capture_active:
            self._session_capture_stack.append(summed_master_mix.copy())
            
        target_buffer[:] = summed_master_mix
        
        with self._cue_buffer_mutex:
            self._staged_monitor_data = self.mixer.cue_mix(
                frame_chunk_a, 
                frame_chunk_b, 
                self.deck_a.state.cue_enabled, 
                self.deck_b.state.cue_enabled
            )

    def _process_headphone_cue_bus(self, target_buffer: np.ndarray, frame_stride: int, _time_delta, status_flags) -> None:
        """Hardware callback thread managing isolated preview processing mapping."""
        with self._cue_buffer_mutex:
            active_preview_buffer = self._staged_monitor_data
            
        if active_preview_buffer is not None and len(active_preview_buffer) >= frame_stride:
            target_buffer[:] = active_preview_buffer[:frame_stride]
        else:
            target_buffer.fill(0)

    def match_audio_tempos(self, lead_identifier: str, follower_identifier: str) -> dict:
        """Adjusts sample-warping coefficients to align playback tempos between channels."""
        lead_deck = self.deck_a if lead_identifier.upper() == "A" else self.deck_b
        follower_deck = self.deck_b if follower_identifier.upper() == "B" else self.deck_a
        
        if not lead_deck.state.bpm or not follower_deck.state.bpm:
            return {"success": False, "message": "Both decks require initialized tempo analysis benchmarks"}
            
        scaling_ratio = lead_deck.state.bpm / follower_deck.state.bpm
        follower_deck.modify_rate(scaling_ratio)
        
        return {
            "success": True, 
            "resample_coefficient": scaling_ratio, 
            "source_bpm": lead_deck.state.bpm, 
            "target_bpm": follower_deck.state.bpm
        }

    def engage_session_recording(self) -> None:
        """Spawns an empty virtual vector stack and triggers live stream intercepting."""
        with self._global_resource_mutex:
            self._session_capture_stack = []
            self._is_capture_active = True

    def terminate_session_recording(self) -> np.ndarray | None:
        """Disables live stream intercepts and flushes data array vectors into single matrix stack."""
        with self._global_resource_mutex:
            self._is_capture_active = False
            if not self._session_capture_stack:
                return None
            return np.vstack(self._session_capture_stack)

    def extract_telemetry_state(self) -> dict:
        """Provides snapshot compilation containing current operating matrices configurations."""
        return {
            "deck_a": self.deck_a.to_dict(),
            "deck_b": self.deck_b.to_dict(),
            "mixer": self.mixer.serialize_mixer(),
            "routing": self.router.serialize_node_tree(),
            "engine_running": self._is_active,
            "recording": self._is_capture_active,
        }


# Instantiate the structural singleton endpoint mapping
master_playback_hub = AudioPlaybackCoordinator()