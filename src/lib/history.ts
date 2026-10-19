import { useMemo, useSyncExternalStore } from "react";
import type { AnalysisResult } from "./types";

// Past readings stay on this device only (localStorage). Nothing is sent to a server.

const KEY = "nuskha-history";
const CHANGE_EVENT = "nuskha-history-change";
const MAX_ENTRIES = 10;

export type HistoryEntry = {
  id: string;
  savedAt: number;
  result: AnalysisResult;
};

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): HistoryEntry[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]) {
  try {
    if (entries.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked (private mode): history is optional, the reading still works.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useHistory(): HistoryEntry[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  return useMemo(() => parse(raw), [raw]);
}

export function saveToHistory(result: AnalysisResult): void {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: Date.now(),
    result,
  };
  // Saving a reading that is already in the list (for example, tapping a sample
  // again) moves it to the top instead of stacking duplicates.
  const same = JSON.stringify(result);
  const rest = parse(readRaw()).filter((e) => JSON.stringify(e.result) !== same);
  write([entry, ...rest].slice(0, MAX_ENTRIES));
}

export function removeFromHistory(id: string): void {
  write(parse(readRaw()).filter((e) => e.id !== id));
}

export function clearHistory(): void {
  write([]);
}

// The photo is kept only for this tab (sessionStorage), never in the saved history,
// so the result page can show where each medicine was read. Opening a past reading
// or a sample clears it, so a stale photo never sits next to the wrong reading.
export function openReading(result: AnalysisResult, photo?: string): void {
  sessionStorage.setItem("nuskha-result", JSON.stringify(result));
  try {
    if (photo) sessionStorage.setItem("nuskha-photo", photo);
    else sessionStorage.removeItem("nuskha-photo");
  } catch {
    sessionStorage.removeItem("nuskha-photo");
  }
}

export function historyTitle(result: AnalysisResult): string {
  const names = result.medicines.map((m) => m.raw.name);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}
