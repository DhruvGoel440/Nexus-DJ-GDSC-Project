/**
 * Global App Engine Type System Definitions.
 * Explicitly synced with the state payloads of the refactored virtual channel mixer modules.
 */

export interface CuePoint {
  id: number;
  position: number;
  label: string;
}

export interface DeckState {
  deck_id: string;
  track_id: string | null;
  title: string;
  artist: string;
  duration: number;
  position: number;
  playing: boolean;
  volume: number;
  gain: number;
  pitch: number;
  bpm: number | null;
  key: string | null;
  cue_enabled: boolean;
  loop_enabled: boolean;
  loop_start: number;
  loop_end: number;
  filter_mode: string | null;
  filter_cutoff: number;
  eq_low: number;
  eq_mid: number;
  eq_high: number;
  cue_points: CuePoint[];
  peak_l: number;
  peak_r: number;
}

export interface MixerState {
  crossfader: number;
  master_volume: number;
  master_peak_l: number;
  master_peak_r: number;
}

export interface RoutingState {
  master_device: number | null;
  cue_device: number | null;
}

export interface EngineState {
  deck_a: DeckState;
  deck_b: DeckState;
  mixer: MixerState;
  routing: RoutingState;
  engine_running: boolean;
  recording: boolean;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration: number;
  bpm: number | null;
  key: string | null;
  beat_grid: number[];
  waveform_peaks: number[];
}

export interface AudioDevice {
  id: number;
  name: string;
  channels: number;
  sample_rate: number;
  is_default: boolean;
}