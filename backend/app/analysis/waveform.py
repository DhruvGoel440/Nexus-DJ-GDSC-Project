"""
Digital Signal Downsampler — Visual Peak Density Profiler.
Refactored using alternative array bounding calculations and vector normalizers.
"""

from __future__ import annotations
import numpy as np


def compute_amplitude_envelope_peaks(signal_data: np.ndarray, target_resolution: int = 800) -> list[float]:
    """Compresses raw PCM vectors into localized absolute peak boundaries for spatial layout renders."""
    if signal_data.ndim > 1:
        signal_data = np.average(signal_data, axis=1)
        
    total_frame_count = len(signal_data)
    if total_frame_count == 0:
        return []
        
    # Calculate variable window partitions across the track timeline
    stride_window_size = max(1, total_frame_count // target_resolution)
    extracted_peak_points = []
    
    for segment_index in range(target_resolution):
        lower_offset = segment_index * stride_window_size
        upper_offset = min(lower_offset + stride_window_size, total_frame_count)
        
        if lower_offset >= total_frame_count:
            extracted_peak_points.append(0.0)
            continue
            
        signal_partition = signal_data[lower_offset:upper_offset]
        absolute_peak_value = float(np.max(np.abs(signal_partition)))
        extracted_peak_points.append(absolute_peak_value)
        
    global_maximum_ceiling = max(extracted_peak_points) if extracted_peak_points else 1.0
    
    # Scale envelope values between 0.0 and 1.0
    return [
        (current_peak / global_maximum_ceiling) if global_maximum_ceiling > 0 else 0.0 
        for current_peak in extracted_peak_points
    ]
