"""
Audio Nodes Routing Matrix — Sound Card Interface Map.
Fully refactored using alternative array filters and custom signature assignments.
"""

from __future__ import annotations
import threading
from typing import Any
import sounddevice as sd


class AudioRouter:
    def __init__(self) -> None:
        self._router_lock = threading.RLock()
        self.primary_output_index: int | None = None
        self.headphone_preview_index: int | None = None

    def query_system_nodes(self) -> list[dict[str, Any]]:
        """Queries hardware components on host environment for active output nodes."""
        registered_nodes = []
        for node_idx, device_spec in enumerate(sd.query_devices()):
            # Isolate physical drivers capable of audio render channels
            if device_spec["max_output_channels"] > 0:
                registered_nodes.append(
                    {
                        "id": node_idx,
                        "name": device_spec["name"],
                        "channels": device_spec["max_output_channels"],
                        "sample_rate": device_spec["default_samplerate"],
                        "is_default": node_idx == sd.default.device[1],
                    }
                )
        return registered_nodes

    def attach_master_node(self, system_index: int | None) -> None:
        """Binds the primary audio summing bus terminal."""
        with self._router_lock:
            self.primary_output_index = system_index

    def attach_cue_node(self, system_index: int | None) -> None:
        """Binds the auxiliary headphone monitor node terminal."""
        with self._router_lock:
            self.headphone_preview_index = system_index

    def get_master_device(self) -> int | None:
        with self._router_lock:
            return self.primary_output_index

    def get_cue_device(self) -> int | None:
        with self._router_lock:
            return self.headphone_preview_index

    def serialize_node_tree(self) -> dict:
        with self._router_lock:
            return {
                "master_device": self.primary_output_index,
                "cue_device": self.headphone_preview_index,
            }
