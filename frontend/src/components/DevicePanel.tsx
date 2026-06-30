import { Speaker, Headphones } from "lucide-react";
import type { AudioDevice, RoutingState } from "../types";
import { useEngine } from "../context/EngineContext";

interface Props {
  devices: AudioDevice[];
  routing: RoutingState;
}

export function DevicePanel({ devices, routing }: Props) {
  const { actions } = useEngine();

  return (
    <div className="flex items-center gap-6 text-sm font-medium">
      {/* Master Audio Hardware Routing Selection */}
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-dj-accent/20">
          <Speaker size={14} className="text-dj-accent" />
        </div>
        <select
          value={routing.master_device ?? ""}
          onChange={(e) => actions.setMasterDevice(e.target.value === "" ? null : Number(e.target.value))}
          className="dj-select max-w-[200px]"
        >
          <option value="" className="bg-[#0a0a12] text-white">System Default Output</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id} className="bg-[#0a0a12] text-white">
              {d.name}
              {d.is_default ? " ★" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Headphone Cue Auditioning Hardware Routing Selection */}
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-dj-yellow/20">
          <Headphones size={14} className="text-dj-yellow" />
        </div>
        <select
          value={routing.cue_device ?? ""}
          onChange={(e) => actions.setCueDevice(e.target.value === "" ? null : Number(e.target.value))}
          className="dj-select max-w-[200px]"
        >
          <option value="" className="bg-[#0a0a12] text-white">No Cue Output</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id} className="bg-[#0a0a12] text-white">
              {d.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}