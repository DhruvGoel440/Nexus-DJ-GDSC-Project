"""
Linear Level Summing Bus Mixer — Constant-Power Attenuation Trajectories.
Completely refactored gain interpolation curves and headphone cue routing configurations.
"""

from __future__ import annotations
import threading
import numpy as np


class Mixer:
    def __init__(self) -> None:
        self._bus_access_mutex = threading.RLock()
        self.crossfader_ratio = 0.5
        self.master_gain_level = 1.0
        self.summed_peak_left = 0.0
        self.summed_peak_right = 0.0

    def modify_crossfade_ratio(self, relative_position: float) -> None:
        """Clips and sets the central crossfader split between channels."""
        with self._bus_access_mutex:
            self.crossfader_ratio = float(np.clip(relative_position, 0.0, 1.0))

    def modify_master_level(self, linear_volume: float) -> None:
        """Sets the master summing bus volume boundary."""
        with self._bus_access_mutex:
            self.master_gain_level = float(np.clip(linear_volume, 0.0, 1.5))

    def _calculate_constant_power_gains(self) -> tuple[float, float]:
        """Derives clean constant-power geometric curves using sine/cosine projection mappings."""
        fader_index = self.crossfader_ratio
        
        # Alternative algebraic mapping maintaining identical power characteristics
        attenuation_a = np.cos(fader_index * (np.pi / 2.0))
        attenuation_b = np.sin(fader_index * (np.pi / 2.0))
        
        return float(attenuation_a), float(attenuation_b)

    def mix(self, channel_signal_a: np.ndarray, channel_signal_b: np.ndarray) -> np.ndarray:
        """Sums operational audio vectors with applied attenuation curves into a master array."""
        with self._bus_access_mutex:
            coefficient_a, coefficient_b = self._calculate_constant_power_gains()
            
            blended_matrix = (channel_signal_a * coefficient_a) + (channel_signal_b * coefficient_b)
            final_output = (blended_matrix * self.master_gain_level).astype(np.float32)
            
            # Extract independent peak limits for monitoring meters
            self.summed_peak_left = float(np.max(np.abs(final_output[:, 0]))) if len(final_output) else 0.0
            self.summed_peak_right = float(np.max(np.abs(final_output[:, 1]))) if len(final_output) else 0.0
            
            return final_output

    def cue_mix(self, deck_a: np.ndarray, deck_b: np.ndarray, cue_a: bool, cue_b: bool) -> np.ndarray:
        """Routes standalone pre-fader preview arrays directly to headphone monitoring channels."""
        with self._bus_access_mutex:
            monitoring_matrix = np.zeros_like(deck_a)
            
            if cue_a:
                monitoring_matrix += deck_a
            if cue_b:
                monitoring_matrix += deck_b
                
            # Default behavior when no cue buttons are selected
            if not cue_a and not cue_b:
                monitoring_matrix = (deck_a * 0.3) + (deck_b * 0.3)
                
            return np.clip(monitoring_matrix, -1.0, 1.0).astype(np.float32)

    def serialize_mixer(self) -> dict:
        with self._bus_access_mutex:
            return {
                "crossfader": self.crossfader_ratio,
                "master_volume": self.master_gain_level,
                "master_peak_l": self.summed_peak_left,
                "master_peak_r": self.summed_peak_right,
            }
