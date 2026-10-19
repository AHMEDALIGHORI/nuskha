import { useMemo, useSyncExternalStore } from "react";
import { EMPTY_PROFILE } from "./review";
import type { SafetyProfile } from "./types";

// The "About you" answers stay on this device only (localStorage).

const KEY = "nuskha-profile";
const CHANGE_EVENT = "nuskha-profile-change";

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function parse(raw: string): SafetyProfile {
  try {
    const data = JSON.parse(raw) as Partial<Record<keyof SafetyProfile, unknown>>;
    const out = { ...EMPTY_PROFILE };
    for (const key of Object.keys(EMPTY_PROFILE) as (keyof SafetyProfile)[]) {
      out[key] = data[key] === true;
    }
    return out;
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useProfile(): SafetyProfile {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "{}");
  return useMemo(() => parse(raw), [raw]);
}

export function setProfileField(key: keyof SafetyProfile, value: boolean): void {
  const next = { ...parse(readRaw()), [key]: value };
  try {
    if (Object.values(next).some(Boolean)) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the profile simply will not be remembered.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const PROFILE_FIELDS: { key: keyof SafetyProfile; en: string; ur: string }[] = [
  { key: "over60", en: "I am over 60", ur: "عمر ساٹھ سال سے زیادہ" },
  { key: "pregnant", en: "I am pregnant", ur: "میں حاملہ ہوں" },
  { key: "kidney", en: "I have kidney problems", ur: "گردوں کا مسئلہ ہے" },
  { key: "penicillinAllergy", en: "Allergic to penicillin", ur: "پینسلین سے الرجی" },
  { key: "aspirinAllergy", en: "Aspirin does not suit me", ur: "ایسپرین موافق نہیں" },
];
