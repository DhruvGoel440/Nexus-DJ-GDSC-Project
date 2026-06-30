import { Pause, Play, RotateCcw, Headphones, Repeat, Square } from "lucide-react";
import type { DeckState } from "../types";
import { formatTime, cn } from "../lib/utils";
import { useEngine } from "../context/EngineContext";
import { EQKnobs } from "./EQKnobs";
import { PeakMeter } from "./PeakMeter";
import { Slider } from "./Slider";

interface Props {
  deck: DeckState;
  side: "left" | "right";
}

const DECK_THEME = {
  A: { accent: "#ff3366", variant: "accent" as const, glowClass: "text-glow-accent" },
  B: { accent: "#00d4ff", variant: "blue" as const, glowClass: "text-glow-blue" },
};

export function DeckPanel({ deck, side }: Props) {
  const { actions } = useEngine();
  const id = deck.deck_id as "A" | "B";
  const theme = DECK_THEME[id];

  return (
    <div className={cn(
      "glass-panel flex flex-col gap-4 p-5 min-w-0 rounded-2xl relative overflow-hidden",
      id === "A" ? "border-t-dj-accent/30" : "border-t-dj-blue/30"
    )}>
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-8 opacity-20 blur-2xl rounded-full" style={{ backgroundColor: theme.accent }} />

      {/* Deck Header & Metadata Tracking Section */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "inline-flex items-center gap-2 text-[10px] font-bold tracking-widest mb-1.5",
              id === "A" ? "text-dj-accent" : "text-dj-blue"
            )}
          >
            <span
              className={cn("w-2 h-2 rounded-full", deck.playing ? "animate-pulse" : "opacity-40", deck.playing ? `shadow-[0_0_8px_${theme.accent}]` : "")}
              style={{ background: theme.accent }}
            />
            {deck.playing ? "PLAYING" : "DECK"} {id}
          </div>
          <div className="font-bold text-lg truncate leading-tight text-white/90 drop-shadow-md">{deck.title || "No track loaded"}</div>
          <div className="text-sm text-white/50 truncate mt-0.5">{deck.artist || "—"}</div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end">
          {deck.bpm != null && (
            <div className={cn("text-2xl font-black font-mono tabular-nums", theme.glowClass)} style={{ color: theme.accent }}>
              {deck.bpm.toFixed(1)}
            </div>
          )}
          {deck.key && <div className="text-xs font-bold text-white/60 mt-1 uppercase tracking-wider">{deck.key}</div>}
          {deck.track_id && (
            <button
              onClick={() => actions.ejectDeck(id)}
              className="mt-2 text-xs font-bold text-white/40 hover:text-red-400 flex items-center gap-1 transition-colors"
              title="Eject track"
            >
              <span className="uppercase">Eject</span>
            </button>
          )}
        </div>
      </div>

      {/* Time Elapsed / Duration Indicator */}
      <div className="flex items-center justify-between px-4 py-2 font-mono text-sm tabular-nums bg-black/40 rounded-xl border border-white/5 relative z-10">
        <span className="text-white/90 font-bold">{formatTime(deck.position)}</span>
        <div className="flex-1 mx-4 h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-200" 
            style={{ width: `${(deck.position / (deck.duration || 1)) * 100}%`, backgroundColor: theme.accent }} 
          />
        </div>
        <span className="text-white/50">{formatTime(deck.duration)}</span>
      </div>

      {/* Amplitude Signal Levels Meter */}
      <div className="relative z-10 px-2 py-3 bg-black/20 rounded-xl border border-white/5">
        <PeakMeter left={deck.peak_l} right={deck.peak_r} />
      </div>

      {/* Feature 1: Three-Band Frequency Equalizer Control Blocks */}
      <div className="relative z-10 px-2 py-4 bg-black/20 rounded-xl border border-white/5">
        <EQKnobs
          low={deck.eq_low}
          mid={deck.eq_mid}
          high={deck.eq_high}
          onChange={(l, m, h) => actions.setEQ(id, l, m, h)}
        />
      </div>

      {/* Performance Deck Mixing Pipeline Channel Faders */}
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex flex-col items-center">
          <Slider
            label="Volume"
            value={deck.volume}
            min={0}
            max={1.5}
            step={0.01}
            variant={theme.variant}
            onChange={(v) => actions.setVolume(id, v)}
          />
        </div>
        <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex flex-col items-center">
          <Slider
            label="Pitch"
            value={deck.pitch}
            min={0.5}
            max={2}
            step={0.001}
            variant={theme.variant}
            format={(v) => `${((v - 1) * 100).toFixed(1)}%`}
            onChange={(v) => actions.setPitch(id, v)}
          />
        </div>
      </div>

      {/* Transport Controls Pipeline APIS */}
      <div className="flex items-center justify-between gap-3 relative z-10 mt-2">
        <button
          onClick={() => actions.seek(id, 0)}
          className="btn-icon glass-button text-white/70 hover:text-white flex-1"
          title="Rewind to start"
        >
          <RotateCcw size={18} className="mx-auto" />
        </button>
        <button
          onClick={() => actions.stop(id)}
          className="btn-icon glass-button text-white/70 hover:text-white flex-1"
          title="Stop and rewind"
        >
          <Square size={16} fill="currentColor" className="mx-auto" />
        </button>
        
        <button
          onClick={() => deck.playing ? actions.pause(id) : actions.play(id)}
          className="btn-icon text-white w-16 h-16 shrink-0 transition-transform hover:scale-105 active:scale-95"
          style={{ 
            background: deck.playing ? theme.accent : 'rgba(255,255,255,0.1)',
            boxShadow: deck.playing ? `0 0 20px ${theme.accent}66` : `inset 0 0 0 1px ${theme.accent}` 
          }}
          title={deck.playing ? "Pause" : "Play"}
        >
          {deck.playing ? <Pause size={28} fill="currentColor" className="mx-auto" /> : <Play size={28} fill="currentColor" className="mx-auto ml-[18px]" />}
        </button>

        <button
          onClick={() => actions.setCue(id, !deck.cue_enabled)}
          className={cn(
            "btn-icon glass-button flex-1",
            deck.cue_enabled ? "bg-dj-yellow/20 text-dj-yellow border-dj-yellow/50 shadow-[0_0_10px_rgba(255,202,40,0.3)]" : "text-white/70"
          )}
          title="Headphone cue"
        >
          <Headphones size={18} className="mx-auto" />
        </button>
      </div>

      {/* Feature 2: Advanced Performance Hot Cues Strip */}
      <div className="flex gap-2 mt-2 relative z-10">
        {[1, 2, 3, 4].map((n) => {
          const cp = deck.cue_points[n - 1];
          return (
            <button
              key={n}
              onClick={() => cp ? actions.jumpCue(id, cp.id) : actions.addCuePoint(id, deck.position, `Cue ${n}`)}
              className={cn(
                "btn-deck border py-2.5",
                cp
                  ? `border-${theme.variant}/50 text-${theme.variant} bg-${theme.variant}/10 shadow-[0_0_10px_var(--tw-shadow-color)] shadow-${theme.variant}/20`
                  : "border-white/10 text-white/30 bg-black/40 hover:bg-white/5 hover:text-white/50"
              )}
              style={cp ? { borderColor: theme.accent, color: theme.accent, backgroundColor: `${theme.accent}1a` } : {}}
              title={cp ? `Jump to ${formatTime(cp.position)}` : "Set cue point"}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Playback Looping Control & Feature 3: Creative Audio DSP Filters */}
      <div className="flex gap-3 relative z-10 mt-1">
        <button
          onClick={() => actions.setLoop(id, !deck.loop_enabled, deck.position, deck.position + 4)}
          className={cn(
            "btn-deck flex items-center justify-center gap-2 py-2.5 w-1/3 shrink-0 transition-all",
            deck.loop_enabled
              ? "bg-dj-green/20 text-dj-green border-dj-green/50 shadow-[0_0_15px_rgba(0,230,118,0.2)]"
              : "glass-button text-white/50"
          )}
        >
          <Repeat size={14} />
          LOOP
        </button>
        <select
          value={deck.filter_mode || ""}
          onChange={(e) => actions.setFilter(id, e.target.value || null)}
          className="dj-select flex-1 h-full"
        >
          <option value="">No Filter Effect</option>
          <option value="lowpass">Low Pass Filter</option>
          <option value="highpass">High Pass Filter</option>
        </select>
      </div>
    </div>
  );
}