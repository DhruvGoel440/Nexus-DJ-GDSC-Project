/**
 * UI Styling Utilities and Time Formatters.
 * Packages atomic class mergers and audio timeline formatting transformations.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines variant class names safely into organized Tailwind-merge sequences.
 */
export function cn(...classInputMatrix: ClassValue[]): string {
  return twMerge(clsx(classInputMatrix));
}

/**
 * Transforms running audio sample lengths into standard string displays (MM:SS).
 */
export function formatTime(totalSecondsCount: number): string {
  const compositeMinutes = Math.floor(totalSecondsCount / 60);
  const remainingSeconds = Math.floor(totalSecondsCount % 60);
  return `${compositeMinutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}