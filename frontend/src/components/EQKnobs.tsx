import { cn } from "../lib/utils";

interface Props {
  low: number;
  mid: number;
  high: number;
  onChange: (low: number, mid: number, high: number) => void;
}

const BANDS = [
  { key: "low" as const, label: "LOW", color: "#ff3366", glow: "rgba(255,51,102,0.4)" },
  { key: "mid" as const, label: "MID", color: "#fbbf24", glow: "rgba(251,191,36,0.4)" },
  { key: "high" as const, label: "HIGH", color: "#00d4ff", glow: "rgba(0,212,255,0.4)" },
];

function EQBand({
  label,
  value,
  color,
  glow,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  glow: string;
  onChange: (v: number) => void;
}) {
  const normalized = (value + 24) / 36;
  const isActive = value !== 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[9px] font-bold tracking-widest uppercase text-white/50">
        {label}
      </span>
      <div className="relative w-8 h-[80px] rounded-full bg-black/50 border border-white/10 flex items-end justify-center overflow-hidden shadow-inner">
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-full transition-all duration-100 ease-out"
          style={{
            height: `${Math.max(4, normalized * 100)}%`,
            background: `linear-gradient(to top, ${color}66, ${color})`,
            boxShadow: isActive ? `0 0 15px ${glow}` : undefined,
          }}
        />
        {/* Zero point indicator */}
        <div className="absolute top-[33.3%] left-1 right-1 h-px bg-white/20 pointer-events-none" />
        
        <input
          type="range"
          min={-24}
          max={12}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize"
          style={{ writingMode: "vertical-lr", direction: "rtl" }}
        />
      </div>
      <span className={cn(
        "text-[10px] font-mono tabular-nums font-bold",
        isActive ? "text-white" : "text-white/30"
      )}
      style={{ color: isActive ? color : undefined, textShadow: isActive ? `0 0 10px ${glow}` : undefined }}
      >
        {value > 0 ? "+" : ""}{value}
      </span>
    </div>
  );
}

export function EQKnobs({ low, mid, high, onChange }: Props) {
  const values = { low, mid, high };

  return (
    <div className="flex gap-6 justify-center py-2">
      {BANDS.map(({ key, label, color, glow }) => (
        <EQBand
          key={key}
          label={label}
          value={values[key]}
          color={color}
          glow={glow}
          onChange={(v) => {
            if (key === "low") onChange(v, mid, high);
            else if (key === "mid") onChange(low, v, high);
            else onChange(low, mid, v);
          }}
        />
      ))}
    </div>
  );
}