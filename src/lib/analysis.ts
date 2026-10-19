import { findMedicine } from "./medicines-pk";
import { buildSchedule } from "./schedule";
import { computeFlags } from "./safety";
import type {
  AnalysisResult,
  ExtractedMedicine,
  GenericOption,
  MedicineCard,
} from "./types";

// Turns raw extracted medicines into the full analysis:
// dataset matching, plain-language explanations, generic alternatives, safety flags, schedule.

export function buildAnalysis(
  extracted: ExtractedMedicine[],
  opts: { sample: boolean }
): AnalysisResult {
  const matched = extracted.map((m) => findMedicine(m.name));
  const medicines: MedicineCard[] = extracted.map((raw, i) => {
    const entry = matched[i];
    const generics: GenericOption[] = entry
      ? entry.generics.map((g) => ({
          name: g.name,
          priceBand: g.priceBand,
          savingPct: savingPct(entry.priceBand, g.priceBand),
        }))
      : [];
    const explanationEn = entry
      ? [entry.purposeEn, entry.takeEn, entry.cautionEn].filter(Boolean).join(" ")
      : "We could not match this to our local medicine database yet. Read the label carefully and confirm with your pharmacist.";
    const explanationUr = entry
      ? [entry.purposeUr, entry.takeUr, entry.cautionUr].filter(Boolean).join(" ")
      : "ہماری مقامی فہرست میں نہیں ملا۔ لیبل غور سے پڑھیں اور فارماسسٹ سے تصدیق کریں۔";
    return { raw, matched: entry, generics, explanationEn, explanationUr };
  });

  return {
    medicines,
    flags: computeFlags(extracted, matched),
    schedule: buildSchedule(extracted),
    sample: opts.sample,
    extractedCount: extracted.length,
  };
}

function savingPct(brand: [number, number], generic: [number, number]): number {
  const brandMid = (brand[0] + brand[1]) / 2;
  const genericMid = (generic[0] + generic[1]) / 2;
  if (brandMid <= 0) return 0;
  return Math.max(0, Math.min(95, Math.round((1 - genericMid / brandMid) * 100)));
}

// Canned sample prescriptions. Every screen that renders this data labels it
// as a sample, so demo content is never disguised as a real reading.

export const SAMPLE_PRESCRIPTIONS: Record<
  string,
  { label: string; medicines: ExtractedMedicine[] }
> = {
  "rx-1": {
    label: "Sample: fever and acidity",
    medicines: [
      { name: "Panadol", strength: "500mg", schedule: [true, true, true], confidence: "high" },
      { name: "Brufen", strength: "400mg", schedule: [true, false, true], confidence: "high" },
      { name: "Telfast", strength: "120mg", schedule: [true, false, false], confidence: "medium" },
      { name: "Nexum", strength: "40mg", schedule: [false, false, true], confidence: "high" },
    ],
  },
  "rx-2": {
    label: "Sample: cold with hidden double paracetamol",
    medicines: [
      { name: "Panadol", strength: "500mg", schedule: [true, true, true], unitsPerDose: 2, instructions: "2 tablets each time", confidence: "high" },
      { name: "Panadol CF", schedule: [true, true, true], instructions: "x 5 days", confidence: "high" },
      { name: "Arinac Forte", schedule: [true, false, true], instructions: "after meal", confidence: "medium" },
      { name: "Zyrtec", strength: "10mg", schedule: [false, false, true], confidence: "high" },
    ],
  },
};

export const SAMPLE_KEYS = Object.keys(SAMPLE_PRESCRIPTIONS);
