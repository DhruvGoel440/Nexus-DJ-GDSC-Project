/**
 * Global Alert/Toast Notification System Component.
 * Implements an animated visual status queuing overlay wrapper.
 */

import { createContext, useCallback, useState, type ReactNode } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "../lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextProps {
  toast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextProps | null>(null);

let activeToastIndexId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>([]);

  const dispatchToastAlert = useCallback((message: string, type: ToastType = "info") => {
    const uniqueId = ++activeToastIndexId;
    setActiveToasts((currentQueue) => [...currentQueue, { id: uniqueId, message, type }]);
    
    setTimeout(() => {
      setActiveToasts((currentQueue) => currentQueue.filter((item) => item.id !== uniqueId));
    }, 4000);
  }, []);

  const manuallyDismissToast = (targetId: number) => {
    setActiveToasts((currentQueue) => currentQueue.filter((item) => item.id !== targetId));
  };

  const statusIconsMap = {
    success: <CheckCircle size={16} className="text-emerald-500 shrink-0" />,
    error: <AlertCircle size={16} className="text-rose-500 shrink-0" />,
    info: <Info size={16} className="text-blue-500 shrink-0" />,
  };

  return (
    <ToastContext.Provider value={{ toast: dispatchToastAlert }}>
      {children}
      
      {/* Toast Render Node Overlay Portal */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {activeToasts.map((toastItem) => (
          <div
            key={toastItem.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl",
              "bg-zinc-900 border border-zinc-800 shadow-xl transition-all duration-300",
              "text-sm text-zinc-200 min-w-[240px] max-w-sm"
            )}
          >
            {statusIconsMap[toastItem.type]}
            <span className="flex-1 font-medium">{toastItem.message}</span>
            <button 
              onClick={() => manuallyDismissToast(toastItem.id)} 
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}