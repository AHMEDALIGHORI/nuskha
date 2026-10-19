import type { AnalysisResult } from "./types";

// Builds an .ics calendar file so the phone reminds the person at each dose time.
// Times are "floating" local times, so 8 in the morning stays 8 in the morning
// wherever the phone is set.

const SLOTS = [
  { name: "Morning", hour: 8 },
  { name: "Afternoon", hour: 14 },
  { name: "Night", hour: 21 },
] as const;

// Reads a course length from what was written next to the medicine.
// Handles "x 5 days", "for 2 weeks", "7 din", and the clinical shorthand
// "5/7" (days), "2/52" (weeks) and "1/12" (months).
export function courseDays(instructions?: string): number | null {
  if (!instructions) return null;
  const t = instructions.toLowerCase();
  const fraction = t.match(/(\d{1,2})\s*\/\s*(7|52|12)\b/);
  if (fraction) {
    const n = Number(fraction[1]);
    const days = fraction[2] === "7" ? n : fraction[2] === "52" ? n * 7 : n * 30;
    return clampDays(days);
  }
  const words = t.match(/(\d{1,3})\s*(days?|din|weeks?|wks?|months?)\b/);
  if (words) {
    const n = Number(words[1]);
    const unit = words[2];
    const days = unit.startsWith("w") ? n * 7 : unit.startsWith("m") ? n * 30 : n;
    return clampDays(days);
  }
  return null;
}

function clampDays(days: number): number | null {
  return days >= 1 && days <= 365 ? days : null;
}

export interface CalendarFile {
  ics: string;
  events: number;
  withEnd: number;
}

export function buildCalendar(result: AnalysisResult, now: Date = new Date()): CalendarFile {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nuskha//Prescription reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  const stamp = utcStamp(now);
  let events = 0;
  let withEnd = 0;

  result.medicines.forEach((card, index) => {
    const label = card.raw.strength ? `${card.raw.name} ${card.raw.strength}` : card.raw.name;
    const days = courseDays(card.raw.instructions);
    const units = card.raw.unitsPerDose && card.raw.unitsPerDose !== 1 ? ` (${card.raw.unitsPerDose} at a time)` : "";
    card.raw.schedule.forEach((on, slotIndex) => {
      if (!on) return;
      const slot = SLOTS[slotIndex];
      const start = new Date(now);
      start.setHours(slot.hour, 0, 0, 0);
      // A dose time already gone today starts tomorrow.
      if (start.getTime() <= now.getTime()) start.setDate(start.getDate() + 1);
      const description = [
        "Reminder from Nuskha.",
        card.raw.instructions ? `Written on the paper: ${card.raw.instructions}.` : "",
        result.sample ? "This came from a sample prescription." : "",
        "Your doctor and pharmacist make the decisions.",
      ]
        .filter(Boolean)
        .join(" ");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${stamp}-${index}-${slotIndex}@nuskha`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${localStamp(start)}`,
        "DURATION:PT15M",
        days ? `RRULE:FREQ=DAILY;COUNT=${days}` : "RRULE:FREQ=DAILY",
        `SUMMARY:${escapeText(`${result.sample ? "Sample: " : ""}${slot.name}: take ${label}${units}`)}`,
        `DESCRIPTION:${escapeText(description)}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:PT0M",
        `DESCRIPTION:${escapeText(`Take ${label}`)}`,
        "END:VALARM",
        "END:VEVENT"
      );
      events += 1;
      if (days) withEnd += 1;
    });
  });

  lines.push("END:VCALENDAR");
  return { ics: lines.map(fold).join("\r\n") + "\r\n", events, withEnd };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function localStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Calendar lines must stay under 75 bytes; longer ones continue on the next line after a space.
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const len = encoder.encode(ch).length;
    const max = parts.length === 0 ? 75 : 74;
    if (size + len > max) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += len;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
