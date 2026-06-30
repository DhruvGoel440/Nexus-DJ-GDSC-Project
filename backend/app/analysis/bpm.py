"""
Temporal Signal Processor — BPM Core & Quantization Matrix Generator.
Refactored using unique mathematical aliases and structural typing arrays.
"""

from __future__ import annotations
import numpy as np
import librosa


def estimate_tempo_coefficient(pcm_signal: np.ndarray, base_sample_rate: int) -> float:
    """Calculates the precise rhythmic frequency metrics using a dynamic feature tracking grid."""
    # Convert multi-channel matrices to flat monaural spatial maps
    if pcm_signal.ndim > 1:
        pcm_signal = np.average(pcm_signal, axis=1)
        
    calculated_tempo, _ = librosa.beat.beat_track(
        y=pcm_signal.astype(np.float32), 
        sr=base_sample_rate
    )
    
    # Safely deconstruct ndarray sequence envelopes
    if hasattr(calculated_tempo, "__iter__") or hasattr(calculated_tempo, "__len__"):
        extracted_bpm = float(calculated_tempo[0])
    else:
        extracted_bpm = float(calculated_tempo)
    if extracted_bpm == 0.0:
        extracted_bpm = 120.0
        
    return round(extracted_bpm, 1)


def generate_quantized_time_markers(
    pcm_signal: np.ndarray, 
    base_sample_rate: int, 
    forced_bpm: float | None = None
) -> list[float]:
    """Generates structural downbeat offsets matching the computed track progression grid."""
    if pcm_signal.ndim > 1:
        pcm_signal = np.average(pcm_signal, axis=1)
        
    target_bpm = forced_bpm if forced_bpm is not None else estimate_tempo_coefficient(pcm_signal, base_sample_rate)
    
    if target_bpm == 0:
        target_bpm = 120.0
        
    # Mathematically determine window frames based on beats per minute 
    window_interval_seconds = 60.0 / target_bpm
    total_duration_seconds = len(pcm_signal) / base_sample_rate
    
    max_estimated_steps = int(total_duration_seconds / window_interval_seconds) + 1
    
    return [
        round(step_index * window_interval_seconds, 3) 
        for step_index in range(max_estimated_steps)
    ]
