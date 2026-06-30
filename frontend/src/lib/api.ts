/**
 * Frontend API Gateway Client — Central HTTP Controller.
 * Refactored to align directly with the structural FastAPI v2 endpoint parameters.
 */

import { EngineState, Track, AudioDevice } from "../types";

const BASE_URL = "http://localhost:8000/api/v2";

async function postRequest<T>(endpoint: string, dataBody?: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: dataBody ? JSON.stringify(dataBody) : undefined,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function getRequest<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function deleteRequest<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export const api = {
  // System Health and Master Engine Loops
  getState: () => getRequest<EngineState>("/state"),
  getDevices: () => getRequest<AudioDevice[]>("/routing/devices"),
  getTracks: () => getRequest<Track[]>("/library/tracks"),
  getWaveform: (trackId: string) => getRequest<{ peaks: number[] }>(`/vault/inventory/${trackId}/waveform-map`),

  // Sound Card Routing Assignments
  setMasterDevice: (masterId: number | null) => postRequest("/routing/assign", { device_id: masterId }),
  setCueDevice: (cueId: number | null) => postRequest("/system/bind-cue-port", { device_id: cueId }),

  // Virtual Hardware Deck Controllers
  play: (deckLabel: string) => postRequest(`/deck/${deckLabel.toUpperCase()}/playback`, { deck: deckLabel }),
  pause: (deckLabel: string) => postRequest(`/channel/halt-playback`, { deck: deckLabel }),
  seek: (deckLabel: string, targetSeconds: number) => postRequest(`/deck/${deckLabel.toUpperCase()}/seek`, { deck: deckLabel, position: targetSeconds }),
  setVolume: (deckLabel: string, linearVolume: number) => postRequest(`/deck/${deckLabel.toUpperCase()}/volume`, { deck: deckLabel, volume: linearVolume }),
  setGain: (deckLabel: string, linearGain: number) => postRequest(`/channel/adjust-gain`, { deck: deckLabel, gain: linearGain }),
  setPitch: (deckLabel: string, playbackPitch: number) => postRequest(`/deck/${deckLabel.toUpperCase()}/pitch`, { deck: deckLabel, pitch: playbackPitch }),
  setEQ: (deckLabel: string, lowDb: number, midDb: number, highDb: number) => postRequest(`/channel/adjust-equalizer`, { deck: deckLabel, low: lowDb, mid: midDb, high: highDb }),
  setCue: (deckLabel: string, active: boolean) => postRequest(`/channel/toggle-cue-monitor`, { deck: deckLabel, enabled: active }),
  setLoop: (deckLabel: string, active: boolean, startMarker = 0, endMarker = 4) => postRequest(`/deck/${deckLabel.toUpperCase()}/loop`, { deck: deckLabel, enabled: active, start: startMarker, end: endMarker }),
  addCuePoint: (deckLabel: string, targetSeconds: number, descriptiveLabel = "") => postRequest(`/channel/register-marker`, { deck: deckLabel, position: targetSeconds, label: descriptiveLabel }),
  jumpCue: (deckLabel: string, cuePointId: number) => postRequest(`/deck/${deckLabel.toUpperCase()}/cue-point`, { deck: deckLabel, cue_id: cuePointId }),
  setFilter: (deckLabel: string, activeMode: string | null, cutoffFrequency = 1000) => postRequest(`/deck/${deckLabel.toUpperCase()}/filter`, { deck: deckLabel, mode: activeMode, cutoff: cutoffFrequency }),

  // Central Audio Summing Mixer
  setCrossfader: (faderValue: number) => postRequest("/summing-bus/crossfader", { value: faderValue }),
  setMasterVolume: (masterVolume: number) => postRequest("/mixer/master_volume", { volume: masterVolume }),

  // Performance Features & Synchronization
  syncBPM: (sourceDeck: string, targetDeck: string) => postRequest("/summing-bus/synchronize-tempo", { source: sourceDeck, target: targetDeck }),

  // Track Resource Library Management
  loadDeck: (deckLabel: string, trackUuid: string) => postRequest("/vault/mount-to-channel", { deck: deckLabel.toUpperCase(), track_id: trackUuid }),
  ejectDeck: (deckLabel: string) => postRequest(`/deck/${deckLabel.toUpperCase()}/eject`, { deck: deckLabel }),
  importTrack: async (rawFileObject: File) => {
    const multiPartForm = new FormData();
    multiPartForm.append("file", rawFileObject);
    const response = await fetch(`${BASE_URL}/library/import`, { method: "POST", body: multiPartForm });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  },
  deleteTrack: (trackId: string) => deleteRequest<{ evicted_id: string }>(`/vault/inventory/${trackId}`),

  // Telemetry Session Recording
  startRecording: () => postRequest("/archiver/start-capture", {}),
  stopRecording: () => postRequest<{ success: boolean; path?: string; duration?: number }>("/archiver/stop-capture", {}),
};