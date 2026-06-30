import { cn } from "../lib/utils";

interface Props {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  variant?: "accent" | "blue" | "neutral";
  vertical?: boolean;
  className?: string;
  format?: (v: number) => string;
}

export function Slider({ label, value, min, max, step = 0.01, onChange, variant = "neutral", vertical, className, format }: Props) {
  return (
    <div className={cn("flex flex-col gap-2 w-full", vertical && "items-center", className)}>
      {label && (
        <label className="flex items-center justify-between w-full">
          <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">{label}</span>
          {format && <span className="text-[10px] font-mono font-bold text-white/70">{format(value)}</span>}
        </label>
      )}
      <div className="relative w-full flex items-center">
        {/* Track Background */}
        <div className="absolute inset-0 top-1/2 -translate-y-1/2 h-2 bg-black/60 rounded-full border border-white/5 shadow-inner pointer-events-none" />
        
        {/* Active Fill */}
        <div 
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full pointer-events-none transition-all duration-75",
            variant === "accent" && "bg-dj-accent shadow-[0_0_10px_rgba(255,51,102,0.4)]",
            variant === "blue" && "bg-dj-blue shadow-[0_0_10px_rgba(0,212,255,0.4)]",
            variant === "neutral" && "bg-white/40 shadow-[0_0_10px_rgba(255,255,255,0.2)]"
          )}
          style={{ width: `${((value - min) / (max - min)) * 100}%` }}
        />
        
        {/* Actual Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "w-full h-4 opacity-0 cursor-pointer relative z-10",
            vertical && "slider-vertical" // keep vertical logic if needed
          )}
        />
        
        {/* Custom Thumb - visual only */}
        <div 
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white/80 pointer-events-none bg-black/80 shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-all",
            "group-hover:border-white group-active:scale-110",
            variant === "accent" && "shadow-[0_0_15px_rgba(255,51,102,0.5)]",
            variant === "blue" && "shadow-[0_0_15px_rgba(0,212,255,0.5)]"
          )}
          style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 8px)` }}
        />
      </div>
    </div>
  );
}