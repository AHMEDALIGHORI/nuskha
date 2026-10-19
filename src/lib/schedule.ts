import type { AnalysisResult, DaySchedule, ExtractedMedicine, SafetyFlag } from "./types";

const SLOT_LABELS = ["morning", "afternoon", "night"] as const;

export function buildSchedule(medicines: ExtractedMedicine[]): DaySchedule {
  const schedule: DaySchedule = { morning: [], afternoon: [], night: [] };
  for (const med of medicines) {
    const label = med.strength ? `${med.name} ${med.strength}` : med.name;
    med.schedule.forEach((on, i) => {
      if (on && SLOT_LABELS[i]) schedule[SLOT_LABELS[i]].push(label);
    });
  }
  return schedule;
}

// flags: the full list for this person (reading flags plus dose and profile checks).
export function whatsappText(result: AnalysisResult, flags: SafetyFlag[] = result.flags): string {
  const lines: string[] = [];
  lines.push("Nuskha: my prescription plan");
  if (result.sample) lines.push("(Sample prescription)");
  const s = result.schedule;
  lines.push(`Morning: ${s.morning.join(", ") || "nothing listed"}`);
  lines.push(`Afternoon: ${s.afternoon.join(", ") || "nothing listed"}`);
  lines.push(`Night: ${s.night.join(", ") || "nothing listed"}`);
  const serious = flags.filter((f) => f.severity === "danger" || f.severity === "caution");
  if (serious.length > 0) {
    lines.push("Warnings to confirm with the pharmacist:");
    for (const f of serious) lines.push(`- ${f.titleEn}: ${f.detailEn}`);
  }
  lines.push("Nuskha explains. My doctor and pharmacist make the decisions.");
  return lines.join("\n");
}
