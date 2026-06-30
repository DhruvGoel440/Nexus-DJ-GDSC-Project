"""
Digital Signal Processing (DSP) Module — Multi-Band Parametric Equalizers.
Refactored using clean SOS coefficient matrix arrays and distinct linear multiplier scalers.
"""

from __future__ import annotations
import numpy as np
from scipy import signal


class ThreeBandEQ:
    """Stateful Infinite Impulse Response (IIR) filtering matrix division array."""

    def __init__(self, sampling_frequency: int) -> None:
        self.sample_rate = sampling_frequency
        self.attenuation_low = 0.0
        self.attenuation_mid = 0.0
        self.attenuation_high = 0.0
        
        self._delay_vectors_low: np.ndarray | None = None
        self._delay_vectors_mid: np.ndarray | None = None
        self._delay_vectors_high: np.ndarray | None = None
        
        self._sos_matrix_low = None
        self._sos_matrix_mid = None
        self._sos_matrix_high = None
        self._recalculate_coefficients()

    def set_gains(self, low_db: float, mid_db: float, high_db: float) -> None:
        """Clips and sets individual frequency bounds for equalizing bands."""
        self.attenuation_low = float(np.clip(low_db, -24.0, 12.0))
        self.attenuation_mid = float(np.clip(mid_db, -24.0, 12.0))
        self.attenuation_high = float(np.clip(high_db, -24.0, 12.0))
        self._recalculate_coefficients()

    def _recalculate_coefficients(self) -> None:
        """Rebuilds Second-Order Sections (SOS) matrix configurations."""
        fs_rate = self.sample_rate
        
        self._sos_matrix_low = signal.iirfilter(
            2, 200, btype="low", fs=fs_rate, output="sos", ftype="butter"
        )
        self._sos_matrix_mid = signal.iirfilter(
            2, [400, 4000], btype="band", fs=fs_rate, output="sos", ftype="butter"
        )
        self._sos_matrix_high = signal.iirfilter(
            2, 4000, btype="high", fs=fs_rate, output="sos", ftype="butter"
        )
        self._delay_vectors_low = self._delay_vectors_mid = self._delay_vectors_high = None

    def process(self, input_pcm_stream: np.ndarray) -> np.ndarray:
        """Applies isolated parallel frequency filters over structural channel matrix blocks."""
        if input_pcm_stream.size == 0:
            return input_pcm_stream
            
        is_monaural_field = input_pcm_stream.ndim == 1
        if is_monaural_field:
            input_pcm_stream = input_pcm_stream[:, np.newaxis]
            
        filtered_output_matrix = np.zeros_like(input_pcm_stream, dtype=np.float32)
        
        # Logarithmic decibel to linear voltage transformation ratios
        scalar_low = 10.0 ** (self.attenuation_low / 20.0)
        scalar_mid = 10.0 ** (self.attenuation_mid / 20.0)
        scalar_high = 10.0 ** (self.attenuation_high / 20.0)
        
        for active_channel in range(input_pcm_stream.shape[1]):
            raw_channel_samples = input_pcm_stream[:, active_channel].astype(np.float64)
            
            # Compute isolated frequency spectrum matrices
            low_band_array, self._delay_vectors_low = signal.sosfilt(
                self._sos_matrix_low, 
                raw_channel_samples, 
                zi=self._delay_vectors_low if self._delay_vectors_low is not None else signal.sosfilt_zi(self._sos_matrix_low)
            )
            mid_band_array, self._delay_vectors_mid = signal.sosfilt(
                self._sos_matrix_mid, 
                raw_channel_samples, 
                zi=self._delay_vectors_mid if self._delay_vectors_mid is not None else signal.sosfilt_zi(self._sos_matrix_mid)
            )
            high_band_array, self._delay_vectors_high = signal.sosfilt(
                self._sos_matrix_high, 
                raw_channel_samples, 
                zi=self._delay_vectors_high if self._delay_vectors_high is not None else signal.sosfilt_zi(self._sos_matrix_high)
            )
            
            recombined_signal = (low_band_array * scalar_low) + (mid_band_array * scalar_mid) + (high_band_array * scalar_high)
            filtered_output_matrix[:, active_channel] = np.clip(recombined_signal, -1.0, 1.0).astype(np.float32)
            
        return filtered_output_matrix[:, 0] if is_monaural_field else filtered_output_matrix


class BiquadFilter:
    """Configurable isolated High-Pass/Low-Pass dynamic performance filter."""

    def __init__(self, sampling_frequency: int, operational_mode: str = "lowpass", cutoff_frequency_hz: float = 1000.0) -> None:
        self.sample_rate = sampling_frequency
        self.filter_mode = operational_mode
        self.cutoff_hz = cutoff_frequency_hz
        self._state_delay_vectors: np.ndarray | None = None
        self._sos_coefficients_matrix = self._compile_sos_filter()

    def _compile_sos_filter(self) -> np.ndarray:
        calculated_type = "low" if self.filter_mode == "lowpass" else "high"
        return signal.iirfilter(2, self.cutoff_hz, btype=calculated_type, fs=self.sample_rate, output="sos")

    def set_cutoff(self, target_cutoff_hz: float) -> None:
        """Sets active filter cutoff frequency limits."""
        self.cutoff_hz = float(np.clip(target_cutoff_hz, 80.0, 16000.0))
        self._sos_coefficients_matrix = self._compile_sos_filter()
        self._state_delay_vectors = None

    def process(self, single_channel_block: np.ndarray) -> np.ndarray:
        """Processes linear signal lines through the mapped filtering topology matrix."""
        if single_channel_block.size == 0:
            return single_channel_block
            
        rendered_block, self._state_delay_vectors = signal.sosfilt(
            self._sos_coefficients_matrix, 
            single_channel_block.astype(np.float64), 
            zi=self._state_delay_vectors if self._state_delay_vectors is not None else signal.sosfilt_zi(self._sos_coefficients_matrix)
        )
        return np.clip(rendered_block, -1.0, 1.0).astype(np.float32)
