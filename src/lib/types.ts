export type ScheduleTriplet = [boolean, boolean, boolean]; // morning, afternoon, night

export type Confidence = "high" | "medium" | "low";

export interface ExtractedMedicine {
  name: string; // brand or generic name, as written on the prescription
  strength?: string; // "500mg"
  schedule: ScheduleTriplet;
  instructions?: string;
  confidence?: Confidence;
}

export type FlagSeverity = "danger" | "caution" | "info";

export type FlagKind = "duplicate-ingredient" | "interaction" | "match-note";

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
  molecule: string; // generic name
  ingredients: string[]; // normalized ingredient keys for duplicate detection
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
