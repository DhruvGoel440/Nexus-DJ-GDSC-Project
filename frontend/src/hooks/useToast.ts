/**
 * Toast Notification Hook Wrapper.
 * Exposes the global context state consumer block for cross-component action broadcast alerts.
 */

import { useContext } from "react";
import { ToastContext } from "../components/Toast";

export function useToast() {
  const contextInstance = useContext(ToastContext);
  
  if (!contextInstance) {
    throw new Error("useToast must be executed explicitly within a valid ToastProvider block");
  }
  
  return contextInstance;
}