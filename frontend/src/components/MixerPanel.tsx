import { Link2, Disc3, Square } from "lucide-react";
import type { MixerState } from "../types";
import { useEngine } from "../context/EngineContext";
import { PeakMeter } from "./PeakMeter";
import { Slider } from "./Slider";
import { cn } from "../lib/utils";

interface Props {
  mixer: MixerState;
  onSync: () => void;
  recording: boolean;
  onRecordToggle: () => void;
}

export function MixerPanel({ mixer, onSync, recording, onRecordToggle }: Props) {
  const { actions } = useEngine();
  const xfaderPct = mixer.crossfader * 100;

  return (
    <div className="glass-panel flex flex-col items-center gap-5 p-5 w-[220px] rounded-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-2xl pointer-events-none" />
      
      <div className="label-xs text-white/40 tracking-[0.2em] relative z-10">Master Mixer</div>

      {/* Real-time Amplitude Signal Monitoring */}
      <div className="w-full relative z-10 bg-black/20 p-3 rounded-xl border border-white/5">
        <PeakMeter left={mixer.master_peak_l} right={mixer.master_peak_r} label="Master" />
      </div>

      {/* Master Attenuation/Volume Pipeline Fader */}
      <div className="w-full relative z-10 bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col items-center">
        <Slider
          label="Master Volume"
          value={mixer.master_volume}
          min={0}
          max={1.5}
          step={0.01}
          variant="neutral"
          onChange={(v) => actions.setMasterVolume(v)}
          className="w-full"
        />
      </div>

      {/* Crossfader Audio Stream Blending Control */}
      <div className="w-full flex flex-col gap-3 relative z-10 bg-black/20 p-4 rounded-xl border border-white/5">
        <div className="label-xs text-center text-white/40">Crossfader</div>
        <div className="relative mt-2">
          <div className="flex justify-between text-[11px] font-bold mb-2 px-1">
            <span className="text-dj-accent text-glow-accent">A</span>
            <span className="text-dj-blue text-glow-blue">B</span>
          </div>
          <div className="relative h-2 rounded-full bg-black/40 border border-white/10 overflow-hidden shadow-inner">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-dj-accent/60 to-transparent transition-all duration-75"
              style={{ width: `${100 - xfaderPct}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-dj-blue/60 to-transparent transition-all duration-75"
              style={{ width: `${xfaderPct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={mixer.crossfader}
            onChange={(e) => actions.setCrossfader(Number(e.target.value))}
            className="w-full slider-neutral absolute top-4 left-0 h-4"
          />
        </div>
      </div>

      {/* Playback Control Actions Block */}
      <div className="w-full flex flex-col gap-2 mt-auto relative z-10">
        <button
          onClick={onSync}
          className="w-full py-3 text-xs font-bold rounded-xl glass-button text-dj-blue border-dj-blue/30
                     hover:bg-dj-blue/10 active:scale-[0.98] flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,212,255,0.1)]"
        >
          <Link2 size={16} />
          SYNC BEATS
        </button>

        <button
          onClick={onRecordToggle}
          className={cn(
            "w-full py-3 text-xs font-bold rounded-xl transition-all duration-300 active:scale-[0.98]",
            "flex items-center justify-center gap-2",
            recording
              ? "bg-dj-accent/20 text-dj-accent border border-dj-accent/40 shadow-[0_0_20px_rgba(255,51,102,0.3)] animate-pulse-slow"
              : "glass-button text-white/60 hover:text-white"
          )}
        >
          <Disc3 size={16} className={recording ? "animate-spin" : ""} style={{ animationDuration: "3s" }} />
          {recording ? "RECORDING..." : "REC MIX"}
        </button>

        <button
          onClick={() => actions.stopAll()}
          className="w-full py-2.5 text-xs font-bold rounded-xl bg-black/40 text-white/40 border border-white/5
                     hover:text-dj-accent hover:border-dj-accent/30 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
        >
          <Square size={12} />
          STOP ALL
        </button>
      </div>
    </div>
  );
}