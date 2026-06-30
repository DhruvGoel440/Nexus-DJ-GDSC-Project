import { useRef, useState } from "react";
import { Upload, Music, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { Track } from "../types";
import { formatTime, cn } from "../lib/utils";
import { useEngine } from "../context/EngineContext";

interface Props {
  activeDeck: "A" | "B";
  onDeckChange: (d: "A" | "B") => void;
  onToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export function LibraryPanel({ activeDeck, onDeckChange, onToast }: Props) {
  const { tracks, actions, refreshTracks, state } = useEngine();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const track = await actions.importTrack(file);
      onToast?.(`Imported "${track.title || file.name}"`, "success");
    } catch (err) {
      onToast?.(`Import failed: ${err instanceof Error ? err.message : "Is the backend running?"}`, "error");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const loadTrack = async (track: Track) => {
    setLoadingId(track.id);
    try {
      await actions.loadDeck(activeDeck, track.id);
      onToast?.(`Loaded "${track.title}" → Deck ${activeDeck}`, "info");
    } catch (err) {
      onToast?.(`Load failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setLoadingId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshTracks();
    } finally {
      setRefreshing(false);
    }
  };

  const isLoaded = (trackId: string) =>
    state.deck_a.track_id === trackId || state.deck_b.track_id === trackId;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black/40">
      {/* Panel Control Header Strip */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-dj-accent/80 to-purple-600/80 shadow-glow">
            <Music size={18} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-white/90 tracking-tight">Audio Library</span>
            <span className="text-sm text-white/50 ml-3 font-medium">{tracks.length} tracks</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Deck Assignment State Toggles */}
          <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs shadow-inner bg-black/40">
            {(["A", "B"] as const).map((d) => (
              <button
                key={d}
                onClick={() => onDeckChange(d)}
                className={cn(
                  "px-4 py-2 font-bold transition-all",
                  activeDeck === d
                    ? d === "A"
                      ? "bg-dj-accent text-white shadow-[0_0_15px_rgba(255,51,102,0.3)]"
                      : "bg-dj-blue text-white shadow-[0_0_15px_rgba(0,212,255,0.3)]"
                    : "text-white/40 hover:text-white/80 hover:bg-white/5"
                )}
              >
                TARGET {d}
              </button>
            ))}
          </div>

          {/* Database Refresh Action Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg glass-button text-white/70 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh library"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin text-dj-accent" : ""} />
          </button>

          {/* Local Audio Ingestion File System Trigger */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg
                       bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10
                       disabled:opacity-50 shadow-lg"
          >
            {importing ? <Loader2 size={16} className="animate-spin text-dj-accent" /> : <Upload size={16} />}
            {importing ? "IMPORTING..." : "IMPORT"}
          </button>
          <input ref={fileRef} type="file" accept=".wav,.mp3,.flac,audio/*" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* Structured File Track Layout Table */}
      <div className="flex-1 overflow-auto relative custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/60 backdrop-blur-md z-10">
            <tr className="text-white/40 uppercase tracking-widest text-xs border-b border-white/10">
              <th className="px-6 py-4 text-left w-12 font-bold">#</th>
              <th className="px-6 py-4 text-left font-bold">Track</th>
              <th className="px-6 py-4 text-left w-24 font-bold">Time</th>
              <th className="px-6 py-4 text-left w-24 font-bold">BPM</th>
              <th className="px-6 py-4 text-left w-20 font-bold">Key</th>
              <th className="px-6 py-4 text-left w-32 font-bold">Genre</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t, i) => (
              <tr
                key={t.id}
                onClick={() => loadTrack(t)}
                className={cn(
                  "border-b border-white/5 cursor-pointer transition-all duration-200 group relative",
                  loadingId === t.id ? "bg-white/10" : "hover:bg-white/10 hover:shadow-glow",
                  isLoaded(t.id) && "bg-white/5"
                )}
                title={`Click to load to Deck ${activeDeck}`}
              >
                {/* Active indicator line */}
                {isLoaded(t.id) && (
                  <td className="absolute left-0 top-0 bottom-0 w-1 bg-dj-accent" />
                )}
                <td className="px-6 py-4 text-white/40 font-mono tabular-nums font-medium relative">
                  <div className="group-hover:opacity-0 transition-opacity">
                    {loadingId === t.id ? (
                      <Loader2 size={14} className="animate-spin text-dj-accent" />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center px-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-sm border",
                      activeDeck === "A" ? "text-dj-accent border-dj-accent bg-dj-accent/20" : "text-dj-blue border-dj-blue bg-dj-blue/20"
                    )}>
                      LOAD
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="font-bold truncate max-w-[300px] text-white/90 group-hover:text-white transition-colors">
                      {t.title}
                    </div>
                    {state.deck_a.track_id === t.id && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-dj-accent/20 text-dj-accent border border-dj-accent/30 shadow-[0_0_10px_rgba(255,51,102,0.2)]">DECK A</span>
                    )}
                    {state.deck_b.track_id === t.id && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-dj-blue/20 text-dj-blue border border-dj-blue/30 shadow-[0_0_10px_rgba(0,212,255,0.2)]">DECK B</span>
                    )}
                  </div>
                  <div className="text-white/50 text-xs truncate max-w-[300px] mt-1 font-medium">{t.artist}</div>
                </td>
                <td className="px-6 py-4 text-white/60 font-mono tabular-nums">{formatTime(t.duration)}</td>
                <td className="px-6 py-4 font-mono tabular-nums font-bold text-dj-accent text-glow-accent">{t.bpm?.toFixed(1) ?? "—"}</td>
                <td className="px-6 py-4 font-bold text-dj-blue">{t.key ?? "—"}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-between text-white/40 max-w-[120px] font-medium group/btn">
                    <span className="truncate mr-2">{t.genre || "—"}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.deleteTrack(t.id).catch(err => onToast?.("Failed to delete track", "error"));
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded text-white/50 hover:text-red-400 transition-all flex-shrink-0"
                      title="Delete track"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            
            {/* Database Empty Placeholder View */}
            {tracks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center gap-4 text-white/30">
                    <div className="p-6 rounded-full bg-white/5 border border-white/10">
                      <Music size={48} className="opacity-50" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white/60">Your crate is empty</p>
                      <p className="text-sm mt-2 font-medium">Import audio files (FLAC, MP3, WAV) to start mixing.</p>
                    </div>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="mt-4 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all border border-white/10"
                    >
                      Import First Track
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}