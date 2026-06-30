"""
Track Metadata Harvester — Audio Container Tags Reader.
Refactored using clean dictionary fallback parsing loops and distinct variable names.
"""

from __future__ import annotations
from pathlib import Path
from typing import Any

import librosa
from mutagen import File as MutagenFile


def extract_metadata(absolute_file_string: str) -> dict[str, Any]:
    """Inspects audio headers to pull title tags, artist records, and physical run durations."""
    target_path = Path(absolute_file_string)
    
    parsed_title = target_path.stem
    parsed_artist = "Unknown Artist"
    parsed_genre = "Unknown Genre"
    track_duration_seconds = 0.0

    try:
        # Load audio container layout tags safely via mutagen helper maps
        header_tags_map = MutagenFile(absolute_file_string, easy=True)
        if header_tags_map:
            if header_tags_map.get("title"):
                parsed_title = str(header_tags_map["title"][0])
            if header_tags_map.get("artist"):
                parsed_artist = str(header_tags_map["artist"][0])
            if header_tags_map.get("genre"):
                parsed_genre = str(header_tags_map["genre"][0])
    except Exception:
        pass

    try:
        # Evaluate timeline span parameters via librosa frame checks
        track_duration_seconds = float(librosa.get_duration(path=absolute_file_string))
    except Exception:
        pass

    return {
        "title": parsed_title,
        "artist": parsed_artist,
        "genre": parsed_genre,
        "duration": track_duration_seconds,
        "filename": target_path.name,
    }
