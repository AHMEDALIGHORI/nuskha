export type ScheduleTriplet = [boolean, boolean, boolean]; // morning, afternoon, night

export type Confidence = "high" | "medium" | "low";

export interface ExtractedMedicine {
  name: string; // brand or generic name, as written on the prescription
  strength?: string; // "500mg"
  schedule: ScheduleTriplet;
  instructions?: string;
  confidence?: Confidence;
  unitsPerDose?: number; // tablets or units each time, 2 for "2+0+2"; missing means 1
  box?: [number, number, number, number]; // where the line sits on the photo: [ymin, xmin, ymax, xmax], 0 to 1000
}

export type FlagSeverity = "danger" | "caution" | "info";

export type FlagKind =
  | "duplicate-ingredient"
  | "interaction"
  | "match-note"
  | "dose-total"
  | "profile";

export interface SafetyFlag {
  severity: FlagSeverity;
  kind: FlagKind;
  titleEn: string;
  titleUr: string;
  detailEn: string;
  detailUr: string;
  medicineIndices: number[];
}

export interface GenericOption {
  name: string;
  priceBand: [number, number];
  savingPct: number;
}

export interface DatasetGeneric {
  name: string;
  priceBand: [number, number];
}

export interface DatasetEntry {
  brand: string; // common brand name in Pakistan
  aliases?: string[]; // other names doctors write for the same product
  molecule: string; // generic name
  ingredients: string[]; // normalized ingredient keys for duplicate detection
  // mg of each ingredient in one tablet or sachet. Needed for combination products,
  // and used for single-ingredient ones when the paper shows no strength.
  unitMg?: Record<string, number>;
  form: string; // "tablet", "sachet", "inhaler"
  priceBand: [number, number]; // typical PKR range per strip/unit
  generics: DatasetGeneric[]; // registered cheaper alternatives
  purposeEn: string;
  purposeUr: string;
  takeEn: string;
  takeUr: string;
  cautionEn?: string;
  cautionUr?: string;
}

export interface MedicineCard {
  raw: ExtractedMedicine;
  matched: DatasetEntry | null;
  generics: GenericOption[];
  explanationEn: string;
  explanationUr: string;
}

export interface DaySchedule {
  morning: string[];
  afternoon: string[];
  night: string[];
}

export interface AnalysisResult {
  medicines: MedicineCard[];
  flags: SafetyFlag[];
  schedule: DaySchedule;
  sample: boolean;
  extractedCount: number;
}

// What the person told Nuskha about themselves. Kept on the device only.
export interface SafetyProfile {
  over60: boolean;
  pregnant: boolean;
  kidney: boolean;
  penicillinAllergy: boolean;
  aspirinAllergy: boolean;
}

export interface DoseTotal {
  ingredient: string;
  labelEn: string;
  labelUr: string;
  mgPerDay: number;
  limitMg: number;
  over: boolean;
  // Every medicine that adds to this total, with how much it adds per day.
  parts: { index: number; name: string; mgPerDay: number }[];
}
