"""
Harmonic Core Analysis Module — Chroma Frequency Evaluator.
Completely restructured vector profiles, matrix correlation loops, and key mapping logic.
"""

from __future__ import annotations
import numpy as np
import librosa

CHROMATIC_SCALE_INDEX = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Refactored harmonic distribution profiles for tonal template matching
DIATONIC_IONIAN_MODEL = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
DIATONIC_AEOLIAN_MODEL = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def evaluate_harmonic_key(audio_stream: np.ndarray, tracking_sample_rate: int) -> str:
    """Computes the root musical key via cross-correlation coefficient vector matrices."""
    # Structural down-mixing of stereo fields to monaural data
    if audio_stream.ndim > 1:
        audio_stream = np.average(audio_stream, axis=1)
        
    # Generate constant-Q chromagram spectral distribution mappings
    chromagram_matrix = librosa.feature.chroma_cqt(
        y=audio_stream.astype(np.float32), 
        sr=tracking_sample_rate
    )
    chromatic_energy_distribution = np.average(chromagram_matrix, axis=1)
    
    computed_key_signature = "C"
    highest_correlation_coefficient = -1.0
    
    # Iterate through all 12 pitch-class transposition intervals
    for pitch_shift in range(12):
        transposed_energy_vector = np.roll(chromatic_energy_distribution, -pitch_shift)
        
        for template_profile, tonality_tag in [(DIATONIC_IONIAN_MODEL, "major"), (DIATONIC_AEOLIAN_MODEL, "minor")]:
            # Calculate correlation matrix cross-coefficients
            correlation_matrix = np.corrcoef(transposed_energy_vector, template_profile)
            extracted_coefficient = float(correlation_matrix[0, 1])
            
            if extracted_coefficient > highest_correlation_coefficient:
                highest_correlation_coefficient = extracted_coefficient
                tonality_extension = "m" if tonality_tag == "minor" else ""
                computed_key_signature = f"{CHROMATIC_SCALE_INDEX[pitch_shift]}{tonality_extension}"
                
    return computed_key_signature
