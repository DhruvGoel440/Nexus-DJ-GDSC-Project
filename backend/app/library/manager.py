"""
Track Library Indexer — Audio File Importer & Playlist Registry.
Completely refactored data caching layers, file replication hooks, and deck staging workflows.
"""

from __future__ import annotations
import json
import shutil
import uuid
from pathlib import Path
from typing import Any

import librosa
import numpy as np

from app.analysis.bpm import estimate_tempo_coefficient, generate_quantized_time_markers
from app.analysis.key import evaluate_harmonic_key
from app.analysis.waveform import compute_amplitude_envelope_peaks
from app.audio.engine import AudioPlaybackCoordinator, master_playback_hub
from app.library.metadata import extract_metadata

BASE_DATA_PATH = Path(__file__).resolve().parents[2] / "data"
STORAGE_VAULT_DIR = BASE_DATA_PATH / "tracks"
METADATA_MANIFEST_FILE = BASE_DATA_PATH / "library.json"


class LibraryManager:
    def __init__(self, playback_coordinator: AudioPlaybackCoordinator) -> None:
        self.engine = playback_coordinator
        self._media_catalog: dict[str, dict[str, Any]] = {}
        self._playlist_collections: dict[str, list[str]] = {"default": []}
        self._ram_signal_cache: dict[str, np.ndarray] = {}
        
        STORAGE_VAULT_DIR.mkdir(parents=True, exist_ok=True)
        self._initialize_local_cache()

    def _initialize_local_cache(self) -> None:
        """Parses manifest JSON files to build runtime database reference pointers."""
        if METADATA_MANIFEST_FILE.exists():
            parsed_data = json.loads(METADATA_MANIFEST_FILE.read_text())
            self._media_catalog = parsed_data.get("tracks", {})
            self._playlist_collections = parsed_data.get("playlists", {"default": []})

    def _flush_catalog_changes(self) -> None:
        """Commits memory catalog registries persistently back to storage matrices."""
        BASE_DATA_PATH.mkdir(parents=True, exist_ok=True)
        serializable_payload = {
            "tracks": self._media_catalog, 
            "playlists": self._playlist_collections
        }
        METADATA_MANIFEST_FILE.write_text(json.dumps(serializable_payload, indent=2))

    def import_track(self, local_source_string: str, run_analysis_pipeline: bool = True) -> dict[str, Any]:
        """Duplicates hardware track resources into project spaces and extracts analysis footprints."""
        unique_hash_id = str(uuid.uuid4())[:8]
        target_destination = STORAGE_VAULT_DIR / f"{unique_hash_id}_{Path(local_source_string).name}"
        shutil.copy2(local_source_string, target_destination)

        metadata_packet = extract_metadata(str(target_destination))
        raw_waveform, sampling_freq = librosa.load(
            str(target_destination), 
            sr=AudioPlaybackCoordinator.FIXED_SAMPLING_RATE, 
            mono=False
        )
        
        if raw_waveform.ndim == 1:
            raw_waveform = np.stack([raw_waveform, raw_waveform])
        else:
            raw_waveform = raw_waveform.T

        self._ram_signal_cache[unique_hash_id] = raw_waveform.astype(np.float32)
        visual_peaks_vector = compute_amplitude_envelope_peaks(raw_waveform)

        calculated_bpm = None
        calculated_key = None
        beat_grid_stamps: list[float] = []
        
        if run_analysis_pipeline:
            monaural_downmix = np.average(raw_waveform, axis=1) if raw_waveform.ndim > 1 else raw_waveform
            calculated_bpm = estimate_tempo_coefficient(monaural_downmix, sampling_freq)
            calculated_key = evaluate_harmonic_key(monaural_downmix, sampling_freq)
            beat_grid_stamps = generate_quantized_time_markers(monaural_downmix, sampling_freq, calculated_bpm)

        track_record = {
            "id": unique_hash_id,
            "path": str(target_destination),
            "title": metadata_packet["title"],
            "artist": metadata_packet["artist"],
            "genre": metadata_packet["genre"],
            "duration": metadata_packet["duration"] or len(raw_waveform) / sampling_freq,
            "bpm": calculated_bpm,
            "key": calculated_key,
            "beat_grid": beat_grid_stamps,
            "waveform_peaks": visual_peaks_vector,
        }
        
        self._media_catalog[unique_hash_id] = track_record
        self._playlist_collections.setdefault("default", []).append(unique_hash_id)
        self._flush_catalog_changes()
        return track_record

    def list_tracks(self) -> list[dict[str, Any]]:
        return list(self._media_catalog.values())

    def get_track(self, track_id: str) -> dict[str, Any] | None:
        return self._media_catalog.get(track_id)

    def get_waveform(self, track_id: str) -> list[float]:
        target_record = self._media_catalog.get(track_id)
        return target_record["waveform_peaks"] if target_record else []

    def load_to_deck(self, target_deck_label: str, target_track_uuid: str) -> dict:
        """Retrieves targeted raw audio vectors from cache or disk and routes them to low-latency players."""
        selected_record = self._media_catalog.get(target_track_uuid)
        if not selected_record:
            return {"success": False, "message": "Target audio item missing from catalog registers"}

        cached_pcm_array = self._ram_signal_cache.get(target_track_uuid)
        if cached_pcm_array is None:
            raw_waveform, _ = librosa.load(
                selected_record["path"], 
                sr=AudioPlaybackCoordinator.FIXED_SAMPLING_RATE, 
                mono=False
            )
            if raw_waveform.ndim == 1:
                raw_waveform = np.stack([raw_waveform, raw_waveform])
            else:
                raw_waveform = raw_waveform.T
            self._ram_signal_cache[target_track_uuid] = raw_waveform.astype(np.float32)
            cached_pcm_array = self._ram_signal_cache[target_track_uuid]

        hardware_deck_node = self.engine.deck_a if target_deck_label.upper() == "A" else self.engine.deck_b
        hardware_deck_node.load_audio_resource(cached_pcm_array, selected_record)
        
        # ALIGNED WITH DECK.PY REFACTOR (.to_dict)
        return {"success": True, "deck": hardware_deck_node.to_dict()}

    def create_playlist(self, arbitrary_name: str) -> dict:
        if arbitrary_name not in self._playlist_collections:
            self._playlist_collections[arbitrary_name] = []
            self._flush_catalog_changes()
        return {"name": arbitrary_name, "tracks": self._playlist_collections[arbitrary_name]}

    def list_playlists(self) -> dict[str, list[str]]:
        return self._playlist_collections

    def add_to_playlist(self, target_playlist_name: str, target_track_uuid: str) -> dict:
        self._playlist_collections.setdefault(target_playlist_name, [])
        if target_track_uuid not in self._playlist_collections[target_playlist_name]:
            self._playlist_collections[target_playlist_name].append(target_track_uuid)
            # FIXED TYPO HERE
            self._flush_catalog_changes()
        return {"playlist": target_playlist_name, "tracks": self._playlist_collections[target_playlist_name]}

    def delete_track(self, target_track_uuid: str) -> bool:
        purged_record = self._media_catalog.pop(target_track_uuid, None)
        if not purged_record:
            return False
            
        self._ram_signal_cache.pop(target_track_uuid, None)
        Path(purged_record["path"]).unlink(missing_ok=True)
        
        for sequence_list in self._playlist_collections.values():
            if target_track_uuid in sequence_list:
                sequence_list.remove(target_track_uuid)
                
        self._flush_catalog_changes()
        return True


# ==========================================
# EXPORTED RUNTIME INSTANCE COUPLING
# ==========================================
audio_vault = LibraryManager(master_playback_hub)