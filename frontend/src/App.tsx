import { useState } from "react";
import { Disc3, AlertTriangle, Settings, LayoutGrid } from "lucide-react";
import { useEngine } from "./context/EngineContext";
import { useToast } from "./hooks/useToast";
import { DeckPanel } from "./components/DeckPanel";
import { MixerPanel } from "./components/MixerPanel";
import { Waveform } from "./components/Waveform";
import { LibraryPanel } from "./components/LibraryPanel";
import { DevicePanel } from "./components/DevicePanel";
import { cn } from "./lib/utils";

export default function App() {
  const { state, connected, backendOnline, actions, devices } = useEngine();
  const { toast } = useToast();
  const [activeDeck, setActiveDeck] = useState<"A" | "B">("A");

  const handleSync = async () => {
    try {
      const result = await actions.syncBPM("A", "B");
      if (result.success) {
        toast("BPM synced — Deck B matched to Deck A", "success");
      } else {
        toast(result.message || "Sync failed — load tracks on both decks", "error");
      }
    } catch {
      toast("Sync failed — check backend connection", "error");
    }
  };

  const handleRecord = async () => {
    try {
      if (state.recording) {
        const result = await actions.stopRecording();
        if (result.success) {
          toast(`Mix saved (${result.duration?.toFixed(1)}s)`, "success");
        }
      } else {
        await actions.startRecording();
        toast("Recording started", "info");
      }
    } catch {
      toast("Recording failed", "error");
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      {/* Background ambient light effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-dj-accent/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-dj-blue/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Universal Application Control Header Bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-black/40 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-dj-accent to-purple-600 shadow-glow">
              <Disc3 size={20} className="text-white animate-spin-slow" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-white">Nexus</span>
              <span className="text-white/60 font-medium ml-1">DJ</span>
            </h1>
          </div>
          {/* Real-time Connection Lifecycle Badging */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-md",
            connected
              ? "bg-dj-green/10 text-dj-green border border-dj-green/20 shadow-[0_0_15px_rgba(0,230,118,0.15)]"
              : backendOnline
                ? "bg-dj-yellow/10 text-dj-yellow border border-dj-yellow/20"
                : "bg-dj-accent/10 text-dj-accent border border-dj-accent/20"
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full",
              connected ? "bg-dj-green animate-pulse" : backendOnline ? "bg-dj-yellow" : "bg-dj-accent"
            )} />
            {connected ? "Live" : backendOnline ? "Polling" : "Offline"}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DevicePanel devices={devices} routing={state.routing} />
          <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-colors border border-white/5">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Connection Failure Exception Notification Ribbon */}
      {!backendOnline && (
        <div className="flex items-center justify-center gap-2 px-5 py-2.5 bg-dj-accent/20 border-b border-dj-accent/40 text-sm font-medium text-white backdrop-blur-md z-10 animate-fade-in">
          <AlertTriangle size={16} className="text-dj-accent" />
          Backend not reachable — start it with: <code className="font-mono bg-black/50 px-2 py-0.5 rounded ml-1 text-dj-accent">cd backend && uvicorn app.main:app --reload</code>
        </div>
      )}

      {/* Main Performance Control Area Grid Layout */}
      <div className="flex-1 overflow-auto z-10 custom-scrollbar">
        <div className="flex flex-col gap-4 p-4 min-h-min">
          {/* Dual Deck Waveform Visualizer Area Strip */}
          <div className="grid grid-cols-2 gap-4 shrink-0">
            <div className="glass-panel rounded-xl overflow-hidden p-1 border-dj-accent/20">
              <Waveform
                trackId={state.deck_a.track_id}
                position={state.deck_a.position}
                duration={state.deck_a.duration}
                deck="A"
                color="#ff3366"
                onSeek={(p) => actions.seek("A", p)}
              />
            </div>
            <div className="glass-panel rounded-xl overflow-hidden p-1 border-dj-blue/20">
              <Waveform
                trackId={state.deck_b.track_id}
                position={state.deck_b.position}
                duration={state.deck_b.duration}
                deck="B"
                color="#00d4ff"
                onSeek={(p) => actions.seek("B", p)}
              />
            </div>
          </div>

          {/* Central Deck Fader Hardware Controls Split Grid Section */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 shrink-0">
            <DeckPanel deck={state.deck_a} side="left" />
            <MixerPanel
              mixer={state.mixer}
              onSync={handleSync}
              recording={state.recording}
              onRecordToggle={handleRecord}
            />
            <DeckPanel deck={state.deck_b} side="right" />
          </div>

          {/* Audio Database Library Ingestion Table Area */}
          <div className="min-h-[400px] flex gap-4 shrink-0">
            <div className="w-16 shrink-0 flex flex-col gap-2">
              <button className="aspect-square rounded-xl glass-button flex items-center justify-center text-white/70 hover:text-white group">
                <LayoutGrid size={20} className="group-hover:scale-110 transition-transform" />
              </button>
              <button className="aspect-square rounded-xl glass-button flex items-center justify-center text-dj-accent group">
                <Disc3 size={20} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
            <div className="flex-1 glass-panel rounded-xl overflow-hidden flex flex-col">
              <LibraryPanel
                activeDeck={activeDeck}
                onDeckChange={setActiveDeck}
                onToast={toast}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}