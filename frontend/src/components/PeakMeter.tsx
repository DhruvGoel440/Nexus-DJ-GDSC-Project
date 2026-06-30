import { cn } from "../lib/utils";

interface Props {
  left: number;
  right: number;
  label?: string;
  vertical?: boolean;
}

export function PeakMeter({ left, right, label, vertical }: Props) {
  const segments = 16;

  const SegmentBar = ({ peak }: { peak: number }) => {
    const active = Math.round(Math.min(1, peak) * segments);
    return (
      <div className={cn("flex gap-[2px]", vertical ? "flex-col-reverse h-full" : "flex-row w-full")}>
        {Array.from({ length: segments }, (_, i) => {
          const lit = i < active;
          const ratio = i / segments;
          
          // Modernized color tokens matching original visual break ratios
          const color = ratio > 0.85 ? "#ff3366" : ratio > 0.65 ? "#fbbf24" : "#00d4ff";
          
          return (
            <div
              key={i}
              className={cn(
                "rounded-[1px] transition-all duration-75",
                vertical ? "flex-1 w-full min-h-[3px]" : "flex-1 h-2 min-w-[3px]"
              )}
              style={{
                background: lit ? color : "rgba(255,255,255,0.05)",
                opacity: lit ? 1 : 1,
                boxShadow: lit ? `0 0 8px ${color}66` : undefined,
              }}
            />
          );
        })}
      </div>
    );
  };

  if (vertical) {
    return (
      <div className="flex flex-col items-center gap-2 h-full">
        {label && <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">{label}</span>}
        <div className="flex gap-1.5 flex-1 min-h-[80px] bg-black/60 p-1.5 rounded-lg border border-white/5 shadow-inner">
          <SegmentBar peak={left} />
          <SegmentBar peak={right} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full bg-black/60 p-2 rounded-xl border border-white/5 shadow-inner">
      {label && <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase text-center mb-0.5">{label}</span>}
      <SegmentBar peak={left} />
      <SegmentBar peak={right} />
    </div>
  );
}