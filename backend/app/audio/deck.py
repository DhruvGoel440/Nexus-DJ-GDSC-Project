"""
Virtual Channel Playback Controller — Memory Ring Buffers & DSP Filters Interceptors.
Fully refactored using customized record containers and explicit mathematical transforms.
"""

from __future__ import annotations
import threading
from dataclasses import dataclass, field
from typing import Any
import numpy as np

from app.audio.effects import BiquadFilter, ThreeBandEQ


@dataclass
class CueMarkerNode:
    uid: int
    offset: float
    tag: str = ""


@dataclass
class ChannelRuntimeParameters:
    track_uuid: str | None = None
    track_title: str = ""
    artist_name: str = ""
    span_duration: float = 0.0
    playback_offset: float = 0.0
    is_active: bool = False
    fader_level: float = 1.0
    trim_gain: float = 1.0
    time_coefficient: float = 1.0
    bpm: float | None = None
    harmonic_key: str | None = None
    cue_enabled: bool = False
    loop_enabled: bool = False
    loop_start: float = 0.0
    loop_end: float = 0.0
    filter_type: str | None = None
    filter_cutoff: float = 1000.0
    low_band_gain: float = 0.0
    mid_band_gain: float = 0.0
    high_band_gain: float = 0.0
    markers_registry: list[CueMarkerNode] = field(default_factory=list)
    left_channel_peak: float = 0.0
    right_channel_peak: float = 0.0


class Deck:
    def __init__(self, identifier: str, hardware_sample_rate: int = 44100) -> None:
        self.deck_id = identifier
        self.sample_rate = hardware_sample_rate
        self._execution_mutex = threading.RLock()
        self.pcm_buffer: np.ndarray | None = None
        self.playhead_cursor = 0
        self.state = ChannelRuntimeParameters()
        self.equalizer_unit = ThreeBandEQ(hardware_sample_rate)
        self.filter_unit: BiquadFilter | None = None
        self._incremental_marker_id = 1

    def load_audio_resource(self, signal_vector: np.ndarray, file_metadata: dict[str, Any]) -> None:
        """Stages and formats digital vectors into standard stereo float processing blocks."""
        with self._execution_mutex:
            if signal_vector.ndim == 1:
                signal_vector = np.stack([signal_vector, signal_vector], axis=-1)
            elif signal_vector.shape[1] == 1:
                signal_vector = np.repeat(signal_vector, 2, axis=1)
                
            self.pcm_buffer = signal_vector.astype(np.float32)
            self.playhead_cursor = 0
            self.state = ChannelRuntimeParameters(
                track_uuid=file_metadata.get("id"),
                track_title=file_metadata.get("title", "Unknown Track"),
                artist_name=file_metadata.get("artist", "Unknown Artist"),
                span_duration=float(len(signal_vector) / self.sample_rate),
                bpm=file_metadata.get("bpm"),
                harmonic_key=file_metadata.get("key"),
            )

    def unload_audio_resource(self) -> None:
        """Purges stored frame memory vectors and resets positional pointer channels."""
        with self._execution_mutex:
            self.pcm_buffer = None
            self.playhead_cursor = 0
            self.state = ChannelRuntimeParameters()

    def engage_play(self) -> None:
        with self._execution_mutex:
            if self.pcm_buffer is not None:
                self.state.is_active = True

    def engage_pause(self) -> None:
        with self._execution_mutex:
            self.state.is_active = False

    def displace_head(self, target_seconds: float) -> None:
        with self._execution_mutex:
            if self.pcm_buffer is None:
                return
            self.playhead_cursor = int(np.clip(target_seconds, 0.0, self.state.span_duration) * self.sample_rate)
            self.state.playback_offset = self.playhead_cursor / self.sample_rate

    def modify_level(self, amplitude: float) -> None:
        with self._execution_mutex:
            self.state.fader_level = float(np.clip(amplitude, 0.0, 1.5))

    def modify_trim(self, gain: float) -> None:
        with self._execution_mutex:
            self.state.trim_gain = float(np.clip(gain, 0.0, 2.0))

    def modify_rate(self, pitch_ratio: float) -> None:
        with self._execution_mutex:
            self.state.time_coefficient = float(np.clip(pitch_ratio, 0.5, 2.0))

    def modify_eq_bands(self, low: float, mid: float, high: float) -> None:
        with self._execution_mutex:
            self.state.low_band_gain, self.state.mid_band_gain, self.state.high_band_gain = low, mid, high
            self.equalizer_unit.set_gains(low, mid, high)

    def modify_cue_bus(self, is_monitored: bool) -> None:
        with self._execution_mutex:
            self.state.cue_enabled = is_monitored

    def modify_loop_circuit(self, loop_active: bool, lower_bound: float = 0.0, upper_bound: float = 0.0) -> None:
        with self._execution_mutex:
            self.state.loop_enabled = loop_active
            self.state.loop_start = lower_bound
            self.state.loop_end = upper_bound if upper_bound > lower_bound else lower_bound + 4.0

    def append_marker_node(self, timestamp: float, tag_description: str = "") -> CueMarkerNode:
        with self._execution_mutex:
            marker = CueMarkerNode(uid=self._incremental_marker_id, offset=timestamp, tag=tag_description)
            self._incremental_marker_id += 1
            self.state.markers_registry.append(marker)
            return marker

    def reposition_to_marker(self, marker_uid: int) -> None:
        with self._execution_mutex:
            for marker in self.state.markers_registry:
                if marker.uid == marker_uid:
                    self.displace_head(marker.offset)
                    break

    def modify_filter_coefficients(self, target_type: str | None, cutoff_hz: float = 1000.0) -> None:
        with self._execution_mutex:
            self.state.filter_type = target_type
            self.state.filter_cutoff = cutoff_hz
            if target_type in ("lowpass", "highpass"):
                self.filter_unit = BiquadFilter(self.sample_rate, target_type, cutoff_hz)
            else:
                self.filter_unit = None

    def read_frames(self, requested_length: int) -> np.ndarray:
        """Retrieves, pitch-stretches, and filters frame blocks via the live hardware loop thread."""
        with self._execution_mutex:
            if self.pcm_buffer is None or not self.state.is_active:
                self.state.left_channel_peak = self.state.right_channel_peak = 0.0
                return np.zeros((requested_length, 2), dtype=np.float32)

            speed_factor = self.state.time_coefficient
            strided_frame_size = int(requested_length * speed_factor)
            lower_index = self.playhead_cursor
            upper_index = lower_index + strided_frame_size

            if upper_index >= len(self.pcm_buffer):
                extracted_chunk = self.pcm_buffer[lower_index:]
                padding_zeros = np.zeros((strided_frame_size - len(extracted_chunk), 2), dtype=np.float32)
                raw_frames = np.vstack([extracted_chunk, padding_zeros]) if len(extracted_chunk) else padding_zeros
                self.playhead_cursor = len(self.pcm_buffer)
                self.state.is_active = False
            else:
                raw_frames = self.pcm_buffer[lower_index:upper_index]
                self.playhead_cursor = upper_index

            if self.state.loop_enabled and self.state.loop_end > self.state.loop_start:
                timeline_position = self.playhead_cursor / self.sample_rate
                if timeline_position >= self.state.loop_end:
                    self.displace_head(self.state.loop_start)

            self.state.playback_offset = self.playhead_cursor / self.sample_rate

            # FIXED INTERPOLATION PATHWAY
            if speed_factor != 1.0 and len(raw_frames) > 1:
                remapping_grid = np.linspace(0, len(raw_frames) - 1, requested_length)
                resampled_matrix = np.zeros((requested_length, 2), dtype=np.float32)
                for channel_idx in range(2):
                    resampled_matrix[:, channel_idx] = np.interp(
                        remapping_grid, 
                        np.arange(len(raw_frames)), 
                        raw_frames[:, channel_idx]
                    )
                raw_frames = resampled_matrix

            # STAGE DSP PROCESSING PIPELINE (EQ + BIQUAD)
            processed_matrix = np.zeros_like(raw_frames)
            for channel_idx in range(2):
                channel_data = self.equalizer_unit.process(raw_frames[:, channel_idx])
                if self.filter_unit:
                    channel_data = self.filter_unit.process(channel_data)
                processed_matrix[:, channel_idx] = channel_data

            # APPLY LEVEL MATRIX GAINS & METERING METRICS
            total_gain = self.state.fader_level * self.state.trim_gain
            rendered_output = (processed_matrix * total_gain).astype(np.float32)
            
            self.state.left_channel_peak = float(np.max(np.abs(rendered_output[:, 0]))) if len(rendered_output) else 0.0
            self.state.right_channel_peak = float(np.max(np.abs(rendered_output[:, 1]))) if len(rendered_output) else 0.0
            
            return rendered_output

    def to_dict(self) -> dict[str, Any]:
        """Serializes current channel operational runtime properties into a standardized schema mapping."""
        with self._execution_mutex:
            current_state = self.state
            return {
                "deck_id": self.deck_id,
                "track_id": current_state.track_uuid,
                "title": current_state.track_title,
                "artist": current_state.artist_name,
                "duration": current_state.span_duration,
                "position": current_state.playback_offset,
                "playing": current_state.is_active,
                "volume": current_state.fader_level,
                "gain": current_state.trim_gain,
                "pitch": current_state.time_coefficient,
                "bpm": current_state.bpm,
                "key": current_state.harmonic_key,
                "cue_enabled": current_state.cue_enabled,
                "loop_enabled": current_state.loop_enabled,
                "loop_start": current_state.loop_start,
                "loop_end": current_state.loop_end,
                "filter_mode": current_state.filter_type,
                "filter_cutoff": current_state.filter_cutoff,
                "eq_low": current_state.low_band_gain,
                "eq_mid": current_state.mid_band_gain,
                "eq_high": current_state.high_band_gain,
                "cue_points": [
                    {"id": node.uid, "position": node.offset, "label": node.tag} 
                    for node in current_state.markers_registry
                ],
                "peak_l": current_state.left_channel_peak,
                "peak_r": current_state.right_channel_peak,
            }