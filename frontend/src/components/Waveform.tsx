import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

interface Props {
  trackId: string | null;
  position: number;
  duration: number;
  deck: "A" | "B";
  color: string;
  onSeek: (pos: number) => void;
}

export function Waveform({ trackId, position, duration, deck, color, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(position);
  const rafRef = useRef<number>(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);

  posRef.current = position;

  useEffect(() => {
    if (!trackId) { setPeaks([]); return; }
    setLoading(true);
    api.getWaveform(trackId)
      .then((d) => setPeaks(d.peaks))
      .catch(() => setPeaks([]))
      .finally(() => setLoading(false));
  }, [trackId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, w, h);

    if (peaks.length === 0) return;

    const pos = posRef.current;
    const visiblePeaks = Math.floor(peaks.length / zoom);
    const startIdx = duration > 0
      ? Math.max(0, Math.floor((pos / duration - 0.5 / zoom) * peaks.length))
      : 0;
    const slice = peaks.slice(startIdx, startIdx + visiblePeaks);
    const barW = w / Math.max(slice.length, 1);
    const midY = h / 2;

    slice.forEach((peak, i) => {
      const barH = peak * h * 0.88;
      const x = i * barW;
      const grad = ctx.createLinearGradient(0, midY - barH / 2, 0, midY + barH / 2);
      grad.addColorStop(0, `${color}33`);
      grad.addColorStop(0.3, color);
      grad.addColorStop(0.7, color);
      grad.addColorStop(1, `${color}33`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, midY - barH / 2, Math.max(barW - 1, 1.5), barH, 2);
      ctx.fill();
    });

    const playheadX = w / 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, h);
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // add an accent color line on top of the playhead
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, h);
    ctx.stroke();

    ctx.fillStyle = `${color}20`;
    ctx.fillRect(playheadX - 15, 0, 30, h);
  }, [peaks, duration, color, zoom]);

  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const ro = new ResizeObserver(draw);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [draw]);

  const handleClick = (e: React.MouseEvent) => {
    if (!duration) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const visibleDuration = duration / zoom;
    const center = position;
    const newPos = Math.max(0, Math.min(duration, center + (ratio - 0.5) * visibleDuration));
    onSeek(newPos);
  };

  const isDeckA = deck === "A";

  return (
    <div className="flex flex-col h-full relative">
      <div className="absolute top-2 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <span
          className={cn(
            "text-[10px] font-bold tracking-widest px-2 py-1 rounded-lg backdrop-blur-sm",
            isDeckA ? "bg-dj-accent/20 text-dj-accent border border-dj-accent/30 shadow-[0_0_10px_rgba(255,51,102,0.2)]" : "bg-dj-blue/20 text-dj-blue border border-dj-blue/30 shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          )}
        >
          DECK {deck}
        </span>
        <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-lg p-1 border border-white/5 pointer-events-auto">
          <button
            onClick={() => setZoom((z) => Math.max(1, z / 1.5))}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] font-bold text-white/70 w-10 text-center">{zoom.toFixed(1)}x</span>
          <button
            onClick={() => setZoom((z) => Math.min(8, z * 1.5))}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 h-32 rounded-xl bg-black/40 border border-white/5 cursor-pointer overflow-hidden group shadow-inner"
        onClick={handleClick}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        
        {/* Playhead Guide Glow */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px pointer-events-none opacity-50 bg-gradient-to-b from-transparent via-white to-transparent shadow-[0_0_8px_rgba(255,255,255,0.8)]" />

        {!trackId && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/30 text-sm font-medium tracking-wide">Drop track or load from library</span>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
          </div>
        )}
      </div>
    </div>
  );
}