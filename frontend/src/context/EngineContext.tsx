/**
 * Core Application Audio State Context Engine Provider.
 * Orchestrates local state caching, WebSocket streams, and API gateway routing actions.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { AudioDevice, DeckState, EngineState, MixerState, RoutingState, Track } from "../types";

const defaultEngineState: EngineState = {
  deck_a: {
    deck_id: "A", track_id: null, title: "", artist: "", duration: 0, position: 0,
    playing: false, volume: 1, gain: 1, pitch: 1, bpm: null, key: null,
    cue_enabled: false, loop_enabled: false, loop_start: 0, loop_end: 4,
    filter_mode: null, filter_cutoff: 1000, eq_low: 0, eq_mid: 0, eq_high: 0,
    cue_points: [], peak_l: 0, peak_r: 0,
  },
  deck_b: {
    deck_id: "B", track_id: null, title: "", artist: "", duration: 0, position: 0,
    playing: false, volume: 1, gain: 1, pitch: 1, bpm: null, key: null,
    cue_enabled: false, loop_enabled: false, loop_start: 0, loop_end: 4,
    filter_mode: null, filter_cutoff: 1000, eq_low: 0, eq_mid: 0, eq_high: 0,
    cue_points: [], peak_l: 0, peak_r: 0,
  },
  mixer: { crossfader: 0.5, master_volume: 1, master_peak_l: 0, master_peak_r: 0 },
  routing: { master_device: null, cue_device: null },
  engine_running: false,
  recording: false,
};

type DeckId = "A" | "B";

function resolveDeckObjectKey(id: string): "deck_a" | "deck_b" {
  return id.toUpperCase() === "A" ? "deck_a" : "deck_b";
}

interface EngineActions {
  play: (deck: DeckId) => Promise<void>;
  pause: (deck: DeckId) => Promise<void>;
  stop: (deck: DeckId) => Promise<void>;
  stopAll: () => Promise<void>;
  seek: (deck: DeckId, position: number) => Promise<void>;
  setVolume: (deck: DeckId, volume: number) => Promise<void>;
  setPitch: (deck: DeckId, pitch: number) => Promise<void>;
  setEQ: (deck: DeckId, low: number, mid: number, high: number) => Promise<void>;
  setCue: (deck: DeckId, enabled: boolean) => Promise<void>;
  setLoop: (deck: DeckId, enabled: boolean, start?: number, end?: number) => Promise<void>;
  addCuePoint: (deck: DeckId, position: number, label?: string) => Promise<void>;
  jumpCue: (deck: DeckId, cueId: number) => Promise<void>;
  setFilter: (deck: DeckId, mode: string | null) => Promise<void>;
  setCrossfader: (value: number) => Promise<void>;
  setMasterVolume: (volume: number) => Promise<void>;
  setMasterDevice: (deviceId: number | null) => Promise<void>;
  setCueDevice: (deviceId: number | null) => Promise<void>;
  loadDeck: (deck: DeckId, trackId: string) => Promise<void>;
  ejectDeck: (deck: DeckId) => Promise<void>;
  importTrack: (file: File) => Promise<Track>;
  deleteTrack: (trackId: string) => Promise<void>;
  syncBPM: (source: DeckId, target: DeckId) => Promise<{ success: boolean; message?: string }>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ success: boolean; duration?: number }>;
}

interface EngineContextValue {
  state: EngineState;
  tracks: Track[];
  devices: AudioDevice[];
  connected: boolean;
  backendOnline: boolean;
  actions: EngineActions;
  refreshTracks: () => Promise<void>;
}

const EngineContext = createContext<EngineContextValue | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EngineState>(defaultEngineState);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [connected, setConnected] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const connectedRef = useRef<boolean>(false);

  const patchDeck = useCallback((deck: DeckId, patch: Partial<DeckState>) => {
    setState((prev) => ({
      ...prev,
      [resolveDeckObjectKey(deck)]: { ...prev[resolveDeckObjectKey(deck)], ...patch },
    }));
  }, []);

  const mergeDeck = useCallback((deck: DeckId, data: Partial<DeckState>) => {
    setState((prev) => ({
      ...prev,
      [resolveDeckObjectKey(deck)]: { ...prev[resolveDeckObjectKey(deck)], ...data },
    }));
  }, []);

  const patchMixer = useCallback((patch: Partial<MixerState>) => {
    setState((prev) => ({ ...prev, mixer: { ...prev.mixer, ...patch } }));
  }, []);

  const patchRouting = useCallback((patch: Partial<RoutingState>) => {
    setState((prev) => ({ ...prev, routing: { ...prev.routing, ...patch } }));
  }, []);

  const refreshTracks = useCallback(async () => {
    try {
      const list = await api.getTracks();
      setTracks(list);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      setDevices(await api.getDevices());
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  const pullState = useCallback(async () => {
    try {
      const fetchedState = await api.getState();
      setState(fetchedState);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  // Sync WebSocket streaming connection loop
  useEffect(() => {
    refreshTracks();
    refreshDevices();
    pullState();

    let connectionRetriesCount = 0;
    let socketPingInterval: ReturnType<typeof setInterval> | undefined = undefined;
    let fallBackPollInterval: ReturnType<typeof setInterval> | undefined = undefined;

    const connectWebSocket = () => {
      const activeProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const targetHost = window.location.host || "http://127.0.0.1:8000";
      const ws = new WebSocket(`${activeProtocol}//${targetHost}/api/v2/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        connectedRef.current = true;
        setConnected(true);
        connectionRetriesCount = 0;
        refreshTracks();
        pullState();
        socketPingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 5000);
      };

      ws.onclose = () => {
        connectedRef.current = false;
        setConnected(false);
        if (socketPingInterval) clearInterval(socketPingInterval);
        const exponentialDelay = Math.min(1000 * 2 ** connectionRetriesCount, 10000);
        connectionRetriesCount++;
        reconnectRef.current = setTimeout(connectWebSocket, exponentialDelay);
      };

      ws.onmessage = (event) => {
        try {
          const framePayload = JSON.parse(event.data);
          if (framePayload.type === "state") {
            setState(framePayload.data);
            setBackendOnline(true);
          }
        } catch { /* Suppress data processing loops */ }
      };
    };

    connectWebSocket();

    // Secondary Polling backup interface triggers if socket thread drops
    fallBackPollInterval = setInterval(() => {
      if (!connectedRef.current) pullState();
    }, 500);

    return () => {
      if (socketPingInterval) clearInterval(socketPingInterval);
      if (fallBackPollInterval) clearInterval(fallBackPollInterval);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [refreshTracks, refreshDevices, pullState]);

  const actions = useMemo<EngineActions>(() => {
    return {
      play: async (deck) => {
        patchDeck(deck, { playing: true });
        try {
          const data = await api.play(deck) as DeckState;
          mergeDeck(deck, data);
        } catch { patchDeck(deck, { playing: false }); }
      },

      pause: async (deck) => {
        patchDeck(deck, { playing: false });
        try {
          const data = await api.pause(deck) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Retain fallback flags */ }
      },

      stop: async (deck) => {
        patchDeck(deck, { playing: false, position: 0 });
        try {
          await api.pause(deck);
          const data = await api.seek(deck, 0) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Retain fallback flags */ }
      },

      stopAll: async () => {
        patchDeck("A", { playing: false });
        patchDeck("B", { playing: false });
        try {
          await Promise.all([api.pause("A"), api.pause("B")]);
          await pullState();
        } catch { /* Retain fallback flags */ }
      },

      seek: async (deck, position) => {
        patchDeck(deck, { position });
        try {
          const data = await api.seek(deck, position) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Retain fallback flags */ }
      },

      setVolume: async (deck, volume) => {
        patchDeck(deck, { volume });
        try {
          const data = await api.setVolume(deck, volume) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Retain fallback flags */ }
      },

      setPitch: async (deck, pitch) => {
        patchDeck(deck, { pitch });
        try {
          const data = await api.setPitch(deck, pitch) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Retain fallback flags */ }
      },

      setEQ: async (deck, low, mid, high) => {
        patchDeck(deck, { eq_low: low, eq_mid: mid, eq_high: high });
        try {
          const data = await api.setEQ(deck, low, mid, high) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Retain fallback flags */ }
      },

      setCue: async (deck, enabled) => {
        patchDeck(deck, { cue_enabled: enabled });
        try {
          const data = await api.setCue(deck, enabled) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Retain fallback flags */ }
      },

      setLoop: async (deck, enabled, start = 0, end = 4) => {
        patchDeck(deck, { loop_enabled: enabled, loop_start: start, loop_end: end });
        try {
          const data = await api.setLoop(deck, enabled, start, end) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Retain fallback flags */ }
      },

      addCuePoint: async (deck, position, label = "") => {
        try {
          const res = await api.addCuePoint(deck, position, label) as { cue_point: { id: number; position: number; label: string } };
          setState((prev) => {
            const key = resolveDeckObjectKey(deck);
            return {
              ...prev,
              [key]: {
                ...prev[key],
                cue_points: [...prev[key].cue_points, res.cue_point],
              },
            };
          });
        } catch { /* Fallback */ }
      },

      jumpCue: async (deck, cueId) => {
        try {
          const data = await api.jumpCue(deck, cueId) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Fallback */ }
      },

      setFilter: async (deck, mode) => {
        patchDeck(deck, { filter_mode: mode });
        try {
          const data = await api.setFilter(deck, mode) as DeckState;
          mergeDeck(deck, data);
        } catch { /* Retain fallback flags */ }
      },

      setCrossfader: async (value) => {
        patchMixer({ crossfader: value });
        try {
          const data = await api.setCrossfader(value) as MixerState;
          patchMixer(data);
        } catch { /* Retain fallback flags */ }
      },

      setMasterVolume: async (volume) => {
        patchMixer({ master_volume: volume });
        try {
          const data = await api.setMasterVolume(volume) as MixerState;
          patchMixer(data);
        } catch { /* Retain fallback flags */ }
      },

      setMasterDevice: async (deviceId) => {
        patchRouting({ master_device: deviceId });
        try {
          const data = await api.setMasterDevice(deviceId) as RoutingState;
          patchRouting(data);
        } catch { /* Retain fallback flags */ }
      },

      setCueDevice: async (deviceId) => {
        patchRouting({ cue_device: deviceId });
        try {
          const data = await api.setCueDevice(deviceId) as RoutingState;
          patchRouting(data);
        } catch { /* Retain fallback flags */ }
      },

      loadDeck: async (deck, trackId) => {
        try {
          const res = await api.loadDeck(deck, trackId) as { success: boolean; deck?: DeckState; message?: string };
          if (res.success && res.deck) {
            mergeDeck(deck, res.deck);
          }
        } catch { /* Fallback */ }
      },

      ejectDeck: async (deck) => {
        try {
          await api.ejectDeck(deck);
          await pullState();
        } catch { /* Fallback */ }
      },

      importTrack: async (file) => {
        const track = await api.importTrack(file) as Track;
        setTracks((prev) => {
          const exists = prev.some((t) => t.id === track.id);
          return exists ? prev : [...prev, track];
        });
        await refreshTracks();
        return track;
      },

      deleteTrack: async (trackId) => {
        try {
          await api.deleteTrack(trackId);
          await refreshTracks();
        } catch { /* Fallback */ }
      },

      syncBPM: async (source, target) => {
        const result = await api.syncBPM(source, target) as { success: boolean; message?: string; pitch?: number };
        if (result.success) await pullState();
        return result;
      },

      startRecording: async () => {
        setState((prev) => ({ ...prev, recording: true }));
        try {
          await api.startRecording();
        } catch {
          setState((prev) => ({ ...prev, recording: false }));
        }
      },

      stopRecording: async () => {
        setState((prev) => ({ ...prev, recording: false }));
        try {
          return await api.stopRecording();
        } catch {
          return { success: false };
        }
      },
    };
  }, [patchDeck, mergeDeck, patchMixer, patchRouting, refreshTracks, pullState]);

  const aggregateValuePayload = useMemo(
    () => ({ state, tracks, devices, connected, backendOnline, actions, refreshTracks }),
    [state, tracks, devices, connected, backendOnline, actions, refreshTracks]
  );

  return <EngineContext.Provider value={aggregateValuePayload}>{children}</EngineContext.Provider>;
}

export function useEngine() {
  const coreContextInstance = useContext(EngineContext);
  if (!coreContextInstance) throw new Error("useEngine must be used explicitly within an EngineProvider block");
  return coreContextInstance;
}