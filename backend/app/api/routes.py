"""
Transitions API Layer - Controller Endpoints for Device Matrix Infrastructure.
Completely restructured validation schema models and action mappings with dual-routing layout compatibility.
"""

from __future__ import annotations

import asyncio
import io
from pathlib import Path
import numpy as np
import soundfile as sf
from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from pydub import AudioSegment

from app.audio.engine import master_playback_hub
from app.library.manager import audio_vault

console_router = APIRouter()
_active_websocket_pool: list[WebSocket] = []


# --- Structural Pydantic Validation Schemas ---

class BaseChannelSignal(BaseModel):
    channel_key: str = Field(..., alias="deck", pattern="^[ABab]$")

class LevelCoefficients(BaseChannelSignal):
    amplitude_value: float = Field(..., alias="volume", ge=0, le=1.5)

class TrimCoefficients(BaseChannelSignal):
    attenuation_ratio: float = Field(..., alias="gain", ge=0, le=2)

class RateCoefficients(BaseChannelSignal):
    warp_rate: float = Field(..., alias="pitch", ge=0.5, le=2)

class HeadseekCoefficients(BaseChannelSignal):
    target_frame: float = Field(..., alias="position", ge=0)

class EqualizerCoefficients(BaseChannelSignal):
    attenuate_low: float = Field(0, alias="low", ge=-24, le=12)
    attenuate_mid: float = Field(0, alias="mid", ge=-24, le=12)
    attenuate_high: float = Field(0, alias="high", ge=-24, le=12)

class CrossfaderBlending(BaseModel):
    mix_ratio: float = Field(..., alias="value", ge=0, le=1)

class MasterGainBoundaries(BaseModel):
    gain_limit: float = Field(..., alias="volume", ge=0, le=1.5)

class DeckStagingRequest(BaseModel):
    channel_key: str = Field(..., alias="deck", pattern="^[ABab]$")
    track_uuid: str = Field(..., alias="track_id")

class MonitorGateSignal(BaseChannelSignal):
    cue_active: bool = Field(..., alias="enabled")

class PlaybackLoopBoundaries(BaseChannelSignal):
    loop_active: bool = Field(..., alias="enabled")
    marker_start: float = Field(0, alias="start")
    marker_end: float = Field(4, alias="end")

class MarkerPointRegistration(BaseChannelSignal):
    offset_seconds: float = Field(..., alias="position", ge=0)
    tag_description: str = Field("", alias="label")

class TargetMarkerJump(BaseChannelSignal):
    marker_index: int = Field(..., alias="cue_id")

class IsolatorFilterProfile(BaseChannelSignal):
    filter_type: str | None = Field(None, alias="mode")
    cutoff_frequency: float = Field(1000, alias="cutoff")

class DevicePortConfig(BaseModel):
    hardware_index: int | None = Field(None, alias="device_id")

class TempoSyncRequest(BaseModel):
    lead_source: str = Field("A", alias="source")
    follower_target: str = Field("B", alias="target")

class VirtualFolderRequest(BaseModel):
    folder_title: str = Field(..., alias="name")

class TrackBindingRequest(BaseModel):
    folder_title: str = Field(..., alias="playlist")
    track_uuid: str = Field(..., alias="track_id")


# --- Helper Engine Router Binding ---

def extract_target_channel(identifier: str):
    """Maps custom string tokens to the real physical hardware channels."""
    return master_playback_hub.deck_a if identifier.upper() == "A" else master_playback_hub.deck_b


# --- Asynchronous Network Broadcasting Engine ---

async def execute_telemetry_loop() -> None:
    """Dispatches core engine runtime telemetries to active telemetry sockets."""
    while True:
        if _active_websocket_pool:
            runtime_telemetry = master_playback_hub.extract_telemetry_state()
            
            faulty_connections = []
            for connection in _active_websocket_pool:
                try:
                    await connection.send_json({"type": "state", "data": runtime_telemetry})
                except Exception:
                    faulty_connections.append(connection)
                    
            for broken_socket in faulty_connections:
                if broken_socket in _active_websocket_pool:
                    _active_websocket_pool.remove(broken_socket)
        await asyncio.sleep(0.05)


@console_router.websocket("/ws")
async def register_telemetry_stream(ws: WebSocket) -> None:
    """Registers real-time state listeners into the application event loop pool."""
    await ws.accept()
    _active_websocket_pool.append(ws)
    try:
        await ws.send_json({"type": "state", "data": master_playback_hub.extract_telemetry_state()})
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        if ws in _active_websocket_pool:
            _active_websocket_pool.remove(ws)


# --- Hardware Routing Configuration Endpoints ---

@console_router.get("/system/hardware-ports")
@console_router.get("/routing/devices")
def fetch_sound_cards() -> list:
    """Resolves physical input/output hardware items installed in host device."""
    return master_playback_hub.router.query_system_nodes()

@console_router.post("/routing/assign")  # <--- Added Frontend Alias
@console_router.post("/system/bind-master-port")
def assign_main_out(payload: DevicePortConfig) -> dict:
    master_playback_hub.router.attach_master_node(payload.hardware_index)
    master_playback_hub.recycle_audio_streams()
    return master_playback_hub.router.serialize_node_tree()

@console_router.post("/system/bind-cue-port")
def assign_headphones_out(payload: DevicePortConfig) -> dict:
    master_playback_hub.router.attach_cue_node(payload.hardware_index)
    master_playback_hub.recycle_audio_streams()
    return master_playback_hub.router.serialize_node_tree()


# --- Real-Time Performance State Checks ---

@console_router.get("/state")
def fetch_engine_state() -> dict:
    """Provides snapshot payload mapping backend to frontend context."""
    return master_playback_hub.extract_telemetry_state()


# --- Real-Time Channel Performance Controls ---

@console_router.post("/deck/{deck_id}/playback")  # <--- Added Frontend Alias
@console_router.post("/channel/start-playback")
def trigger_channel_play(payload: BaseChannelSignal, deck_id: str | None = None) -> dict:
    target_deck = deck_id if deck_id else payload.channel_key
    extract_target_channel(target_deck).engage_play()
    return extract_target_channel(target_deck).to_dict()

@console_router.post("/channel/halt-playback")
def trigger_channel_pause(payload: BaseChannelSignal) -> dict:
    extract_target_channel(payload.channel_key).engage_pause()
    return extract_target_channel(payload.channel_key).to_dict()

@console_router.post("/deck/{deck_id}/eject")
@console_router.post("/channel/eject-track")
def trigger_channel_eject(payload: BaseChannelSignal, deck_id: str | None = None) -> dict:
    target_deck = deck_id if deck_id else payload.channel_key
    extract_target_channel(target_deck).unload_audio_resource()
    return extract_target_channel(target_deck).to_dict()

@console_router.post("/deck/{deck_id}/seek")  # <--- Added Frontend Alias
@console_router.post("/channel/displace-position")
def trigger_channel_seek(payload: HeadseekCoefficients, deck_id: str | None = None) -> dict:
    target_deck = deck_id if deck_id else payload.channel_key
    extract_target_channel(target_deck).displace_head(payload.target_frame)
    return extract_target_channel(target_deck).to_dict()

@console_router.post("/deck/{deck_id}/volume")  # <--- Added Frontend Alias
@console_router.post("/channel/adjust-volume")
def trigger_channel_volume(payload: LevelCoefficients, deck_id: str | None = None) -> dict:
    target_deck = deck_id if deck_id else payload.channel_key
    extract_target_channel(target_deck).modify_level(payload.amplitude_value)
    return extract_target_channel(target_deck).to_dict()

@console_router.post("/channel/adjust-gain")
def trigger_channel_gain(payload: TrimCoefficients) -> dict:
    extract_target_channel(payload.channel_key).modify_trim(payload.attenuation_ratio)
    return extract_target_channel(payload.channel_key).to_dict()

@console_router.post("/deck/{deck_id}/pitch")  # <--- Added Frontend Alias
@console_router.post("/channel/adjust-pitch")
def trigger_channel_pitch(payload: RateCoefficients, deck_id: str | None = None) -> dict:
    target_deck = deck_id if deck_id else payload.channel_key
    extract_target_channel(target_deck).modify_rate(payload.warp_rate)
    return extract_target_channel(target_deck).to_dict()

@console_router.post("/channel/adjust-equalizer")
def trigger_channel_eq(payload: EqualizerCoefficients) -> dict:
    extract_target_channel(payload.channel_key).modify_eq_bands(payload.attenuate_low, payload.attenuate_mid, payload.attenuate_high)
    return extract_target_channel(payload.channel_key).to_dict()

@console_router.post("/channel/toggle-cue-monitor")
def trigger_channel_cue_bus(payload: MonitorGateSignal) -> dict:
    extract_target_channel(payload.channel_key).modify_cue_bus(payload.cue_active)
    return extract_target_channel(payload.channel_key).to_dict()

@console_router.post("/deck/{deck_id}/loop")  # <--- Added Frontend Alias
@console_router.post("/channel/configure-loop")
def trigger_channel_loop(payload: PlaybackLoopBoundaries, deck_id: str | None = None) -> dict:
    target_deck = deck_id if deck_id else payload.channel_key
    extract_target_channel(target_deck).modify_loop_circuit(payload.loop_active, payload.marker_start, payload.marker_end)
    return extract_target_channel(target_deck).to_dict()

@console_router.post("/channel/register-marker")
def trigger_add_hotcue(payload: MarkerPointRegistration) -> dict:
    marker = extract_target_channel(payload.channel_key).append_marker_node(payload.offset_seconds, payload.tag_description)
    return {"registered_node": {"uid": marker.uid, "offset": marker.offset, "tag": marker.tag}}

@console_router.post("/deck/{deck_id}/cue-point")  # <--- Added Frontend Alias
@console_router.post("/channel/trigger-marker")
def trigger_jump_hotcue(payload: TargetMarkerJump, deck_id: str | None = None) -> dict:
    target_deck = deck_id if deck_id else payload.channel_key
    extract_target_channel(target_deck).reposition_to_marker(payload.marker_index)
    return extract_target_channel(target_deck).to_dict()

@console_router.post("/deck/{deck_id}/filter")  # <--- Added Frontend Alias
@console_router.post("/channel/apply-frequency-filter")
def trigger_channel_filter(payload: IsolatorFilterProfile, deck_id: str | None = None) -> dict:
    target_deck = deck_id if deck_id else payload.channel_key
    extract_target_channel(target_deck).modify_filter_coefficients(payload.filter_type, payload.cutoff_frequency)
    return extract_target_channel(target_deck).to_dict()


# --- Central Mixing Utilities ---

@console_router.post("/summing-bus/crossfader")
def trigger_crossfader_blend(payload: CrossfaderBlending) -> dict:
    master_playback_hub.mixer.modify_crossfade_ratio(payload.mix_ratio)
    return master_playback_hub.mixer.serialize_mixer()

@console_router.post("/mixer/master_volume")  # <--- Added Frontend Alias
@console_router.post("/summing-bus/master-level")
def trigger_master_level(payload: MasterGainBoundaries) -> dict:
    master_playback_hub.mixer.modify_master_level(payload.gain_limit)
    return master_playback_hub.mixer.serialize_mixer()

@console_router.post("/summing-bus/synchronize-tempo")
def trigger_tempo_alignment(payload: TempoSyncRequest) -> dict:
    return master_playback_hub.match_audio_tempos(payload.lead_source, payload.follower_target)


# --- Track Asset Management Archive ---

@console_router.get("/vault/inventory")
@console_router.get("/library/tracks")
def fetch_vault_tracks() -> list:
    return audio_vault.list_tracks()

@console_router.get("/vault/inventory/{track_id}")
def fetch_vault_track_record(track_id: str) -> dict:
    record = audio_vault.get_track(track_id)
    if not record:
        raise HTTPException(404, "Target sound file missing from database track archive")
    return record

@console_router.get("/vault/inventory/{track_id}/waveform-map")
def fetch_track_waveform_peaks(track_id: str) -> list[float]:
    amplitudes = audio_vault.get_waveform(track_id)
    if not amplitudes:
        raise HTTPException(404, "Target sound file missing or processing matrix uninitialized")
    return amplitudes

@console_router.post("/library/import")  # <--- Added Frontend Alias
@console_router.post("/vault/ingest-file")
async def commit_file_to_vault(file: UploadFile = File(...)) -> dict:
    filename = file.filename.lower()
    
    # Generate unified workspace paths
    clean_name = file.filename.replace(".mp3", ".wav") if filename.endswith(".mp3") else file.filename
    temporary_directory = Path(f"data/tracks/.upload_{clean_name}")
    temporary_directory.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        file_bytes = await file.read()
        
        # Intercept and decode MP3 files into a WAV stream in memory
        if filename.endswith(".mp3"):
            try:
                audio_segment = AudioSegment.from_file(io.BytesIO(file_bytes), format="mp3")
                wav_buffer = io.BytesIO()
                audio_segment.export(wav_buffer, format="wav")
                file_bytes = wav_buffer.getvalue()
            except FileNotFoundError:
                raise HTTPException(status_code=400, detail="FFmpeg is required to process MP3 files on this system. Please install ffmpeg or upload a WAV file instead.")
            except Exception as mp3_e:
                raise HTTPException(status_code=400, detail=f"MP3 processing failed: {str(mp3_e)}")
            
        temporary_directory.write_bytes(file_bytes)
        return audio_vault.import_track(str(temporary_directory))
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Failed to process track asset: {str(e)}")
    finally:
        if temporary_directory.exists():
            temporary_directory.unlink()

@console_router.post("/vault/mount-to-channel")
def deploy_track_to_hardware_deck(payload: DeckStagingRequest) -> dict:
    return audio_vault.load_to_deck(payload.channel_key, payload.track_uuid)


# --- Playlist / Collection Bindings ---

@console_router.get("/vault/folders")
@console_router.get("/library/playlists")
def fetch_playlists() -> dict:
    return audio_vault.list_playlists()

@console_router.post("/vault/folders")
def append_playlist_node(payload: VirtualFolderRequest) -> dict:
    return audio_vault.create_playlist(payload.folder_title)

@console_router.post("/vault/folders/bind-track")
def append_track_to_playlist(payload: TrackBindingRequest) -> dict:
    return audio_vault.add_to_playlist(payload.folder_title, payload.track_uuid)

@console_router.delete("/vault/inventory/{track_id}")
def purge_track_record(track_id: str) -> dict:
    if not audio_vault.delete_track(track_id):
        raise HTTPException(404, "Target tracking element not registered or file inaccessible")
    return {"evicted_id": track_id}


# --- Stream Session Recording ---

@console_router.post("/archiver/start-capture")
def trigger_mix_capture_start() -> dict:
    master_playback_hub.engage_session_recording()
    return {"capture_active": True}

@console_router.post("/archiver/stop-capture")
def trigger_mix_capture_stop() -> dict:
    pcm_buffer = master_playback_hub.terminate_session_recording()
    if pcm_buffer is None or len(pcm_buffer) == 0:
        return {"success": False, "message": "PCM stream empty, no session capture data generated"}
        
    storage_path = Path(__file__).resolve().parents[2] / "data" / "mix_recording.wav"
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    
    sf.write(str(storage_path), pcm_buffer, master_playback_hub.FIXED_SAMPLING_RATE)
    return {
        "success": True, 
        "saved_location": str(storage_path), 
        "duration_seconds": len(pcm_buffer) / master_playback_hub.FIXED_SAMPLING_RATE
    }