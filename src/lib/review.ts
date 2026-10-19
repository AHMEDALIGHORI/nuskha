import type {
  AnalysisResult,
  DoseTotal,
  MedicineCard,
  SafetyFlag,
  SafetyProfile,
} from "./types";

// Second pass over a reading, run on the device every time the result page opens.
// It adds up daily doses and applies the person's own profile. Both are plain
// rules, so the same reading and profile always give the same warnings, and
// readings saved before this pass existed get checked too.

export const EMPTY_PROFILE: SafetyProfile = {
  over60: false,
  pregnant: false,
  kidney: false,
  penicillinAllergy: false,
  aspirinAllergy: false,
};

// Usual adult maximum per day. Doctors sometimes go higher on purpose, so most
// of these ask the person to confirm. Paracetamol is the exception: going over
// is a common, silent cause of liver damage.
interface DailyLimit {
  mg: number;
  labelEn: string;
  labelUr: string;
}

const DAILY_LIMITS: Record<string, DailyLimit> = {
  paracetamol: { mg: 4000, labelEn: "paracetamol", labelUr: "پیراسیٹامول" },
  ibuprofen: { mg: 2400, labelEn: "ibuprofen", labelUr: "آئبوپروفین" },
  "mefenamic acid": { mg: 1500, labelEn: "mefenamic acid", labelUr: "میفینامک ایسڈ" },
  aspirin: { mg: 4000, labelEn: "aspirin", labelUr: "ایسپرین" },
  domperidone: { mg: 30, labelEn: "domperidone", labelUr: "ڈومپیریڈون" },
  metoclopramide: { mg: 30, labelEn: "metoclopramide", labelUr: "میٹوکلوپرامائیڈ" },
  cetirizine: { mg: 10, labelEn: "cetirizine", labelUr: "سٹیریزین" },
  fexofenadine: { mg: 180, labelEn: "fexofenadine", labelUr: "فیکسوفینیڈین" },
  pseudoephedrine: { mg: 240, labelEn: "pseudoephedrine", labelUr: "سوڈوایفیڈرین" },
};

const PARACETAMOL_LIMIT_OVER_60 = 3000;
const COUNTABLE_FORMS = new Set(["tablet", "capsule", "sachet"]);

// "500mg", "500 mg", "1g", "1 gm", "250mcg" and a bare "500" all work.
// Concentrations such as "120mg/5ml" and combination strengths such as "500/65"
// return null, because one number cannot describe them.
export function parseStrengthMg(strength?: string): number | null {
  if (!strength) return null;
  const t = strength.toLowerCase().replace(/,/g, "").trim();
  if (t.includes("/") || /\bml\b|\bper\b/.test(t)) return null;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|gm|g)\b/);
  let mg: number | null = null;
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    mg = unit === "mg" ? n : unit === "g" || unit === "gm" ? n * 1000 : n / 1000;
  } else {
    const bare = t.match(/^(\d+(?:\.\d+)?)$/);
    if (bare) mg = Number(bare[1]);
  }
  if (mg === null || !Number.isFinite(mg) || mg <= 0 || mg > 5000) return null;
  return mg;
}

function mgPerUnit(card: MedicineCard, ingredient: string): number | null {
  const entry = card.matched;
  if (!entry || !COUNTABLE_FORMS.has(entry.form)) return null;
  if (entry.ingredients.length === 1) {
    return parseStrengthMg(card.raw.strength) ?? entry.unitMg?.[ingredient] ?? null;
  }
  // A combination: the number on the paper is not per ingredient, so use the dataset.
  return entry.unitMg?.[ingredient] ?? null;
}

function dosesPerDay(card: MedicineCard): number {
  return card.raw.schedule.filter(Boolean).length;
}

function unitsEachTime(card: MedicineCard): number {
  const u = card.raw.unitsPerDose;
  return typeof u === "number" && u > 0 && u <= 4 ? u : 1;
}

export function dailyTotals(result: AnalysisResult, profile: SafetyProfile): DoseTotal[] {
  const totals = new Map<string, DoseTotal>();
  result.medicines.forEach((card, index) => {
    if (!card.matched) return;
    const doses = dosesPerDay(card);
    if (doses === 0) return;
    for (const ingredient of card.matched.ingredients) {
      const limit = DAILY_LIMITS[ingredient];
      if (!limit) continue;
      const perUnit = mgPerUnit(card, ingredient);
      if (perUnit === null) continue;
      const mgPerDay = perUnit * unitsEachTime(card) * doses;
      const total =
        totals.get(ingredient) ??
        {
          ingredient,
          labelEn: limit.labelEn,
          labelUr: limit.labelUr,
          mgPerDay: 0,
          limitMg: limitFor(ingredient, profile),
          over: false,
          parts: [],
        };
      total.mgPerDay += mgPerDay;
      total.parts.push({ index, name: card.raw.name, mgPerDay });
      totals.set(ingredient, total);
    }
  });
  return [...totals.values()].map((t) => ({ ...t, over: t.mgPerDay > t.limitMg }));
}

function limitFor(ingredient: string, profile: SafetyProfile): number {
  if (ingredient === "paracetamol" && profile.over60) return PARACETAMOL_LIMIT_OVER_60;
  return DAILY_LIMITS[ingredient].mg;
}

export function formatMg(mg: number): string {
  return `${Math.round(mg).toLocaleString("en-US")} mg`;
}

function formatMgUr(mg: number): string {
  return `${Math.round(mg).toLocaleString("en-US")} ملی گرام`;
}

function doseFlags(totals: DoseTotal[]): SafetyFlag[] {
  return totals
    .filter((t) => t.over)
    .map((t) => {
      const parts = t.parts.map((p) => `${p.name} ${formatMg(p.mgPerDay)}`).join(", ");
      const partsUr = t.parts.map((p) => `${p.name} ${formatMgUr(p.mgPerDay)}`).join("، ");
      const isParacetamol = t.ingredient === "paracetamol";
      const olderLimit = isParacetamol && t.limitMg === PARACETAMOL_LIMIT_OVER_60;
      const limitEn = olderLimit
        ? `After 60, doctors usually keep paracetamol to ${formatMg(t.limitMg)} a day.`
        : `The usual adult limit is ${formatMg(t.limitMg)}.`;
      const limitUr = olderLimit
        ? `ساٹھ سال کے بعد ڈاکٹر عموماً روزانہ ${formatMgUr(t.limitMg)} تک رکھتے ہیں۔`
        : `عام بالغ حد ${formatMgUr(t.limitMg)} ہے۔`;
      const severity = isParacetamol && t.mgPerDay > DAILY_LIMITS.paracetamol.mg ? "danger" : "caution";
      return {
        severity,
        kind: "dose-total",
        titleEn: isParacetamol
          ? "Too much paracetamol in one day"
          : `More ${t.labelEn} than the usual daily limit`,
        titleUr: isParacetamol
          ? "ایک دن میں پیراسیٹامول حد سے زیادہ"
          : `${t.labelUr} روزانہ حد سے زیادہ`,
        detailEn: isParacetamol
          ? `Taken as written, this adds up to ${formatMg(t.mgPerDay)} of paracetamol a day (${parts}). ${limitEn} More than that can damage the liver. Ask your pharmacist before taking all of them.`
          : `Taken as written, this adds up to ${formatMg(t.mgPerDay)} of ${t.labelEn} a day (${parts}). The usual adult maximum is ${formatMg(t.limitMg)}. Confirm with your doctor that this dose is intended.`,
        detailUr: isParacetamol
          ? `لکھے ہوئے طریقے سے دن بھر میں ${formatMgUr(t.mgPerDay)} پیراسیٹامول بنتی ہے (${partsUr})۔ ${limitUr} اس سے زیادہ جگر کو نقصان پہنچا سکتی ہے۔ سب لینے سے پہلے فارماسسٹ سے پوچھیں۔`
          : `لکھے ہوئے طریقے سے دن بھر میں ${formatMgUr(t.mgPerDay)} ${t.labelUr} بنتی ہے (${partsUr})۔ عام حد ${formatMgUr(t.limitMg)} ہے۔ ڈاکٹر سے تصدیق کریں کہ یہی مقدار مقصود ہے۔`,
        medicineIndices: t.parts.map((p) => p.index),
      } satisfies SafetyFlag;
    });
}

interface ProfileRule {
  when: keyof SafetyProfile;
  ingredients: string[];
  severity: "danger" | "caution";
  titleEn: string;
  titleUr: string;
  detailEn: string;
  detailUr: string;
}

// Sources: product labels and widely used prescribing references
// (pregnancy and kidney warnings on the labels, AGS Beers Criteria for over 60).
export const PROFILE_RULES: ProfileRule[] = [
  {
    when: "penicillinAllergy",
    ingredients: ["amoxicillin"],
    severity: "danger",
    titleEn: "Penicillin allergy: this medicine is a penicillin",
    titleUr: "پینسلین الرجی: یہ دوا پینسلین ہے",
    detailEn: "You said you are allergic to penicillin. Amoxicillin belongs to the penicillin family and can cause a serious reaction. Tell the doctor or pharmacist before taking it.",
    detailUr: "آپ نے بتایا کہ آپ کو پینسلین سے الرجی ہے۔ اموکسیسلین پینسلین خاندان کی دوا ہے اور شدید ردعمل ہو سکتا ہے۔ لینے سے پہلے ڈاکٹر یا فارماسسٹ کو بتائیں۔",
  },
  {
    when: "aspirinAllergy",
    ingredients: ["aspirin"],
    severity: "danger",
    titleEn: "Aspirin allergy: this medicine is aspirin",
    titleUr: "ایسپرین الرجی: یہ دوا ایسپرین ہے",
    detailEn: "You said aspirin does not suit you. Do not take this until the doctor confirms it.",
    detailUr: "آپ نے بتایا کہ ایسپرین آپ کو موافق نہیں۔ ڈاکٹر کی تصدیق کے بغیر یہ نہ لیں۔",
  },
  {
    when: "aspirinAllergy",
    ingredients: ["ibuprofen", "mefenamic acid"],
    severity: "caution",
    titleEn: "Aspirin allergy: related painkiller",
    titleUr: "ایسپرین الرجی: ملتی جلتی درد کی دوا",
    detailEn: "People who react to aspirin often react to painkillers like this one too. Ask the doctor before taking it.",
    detailUr: "جنہیں ایسپرین سے ردعمل ہو، انہیں اکثر ایسی درد کی دواؤں سے بھی ہوتا ہے۔ لینے سے پہلے ڈاکٹر سے پوچھیں۔",
  },
  {
    when: "pregnant",
    ingredients: ["warfarin"],
    severity: "danger",
    titleEn: "Pregnancy: warfarin",
    titleUr: "حمل: وارفیرن",
    detailEn: "Warfarin can harm an unborn baby. Tell your doctor straight away that you are pregnant.",
    detailUr: "وارفیرن پیٹ میں بچے کو نقصان پہنچا سکتی ہے۔ ڈاکٹر کو فوراً بتائیں کہ آپ حاملہ ہیں۔",
  },
  {
    when: "pregnant",
    ingredients: ["perindopril"],
    severity: "danger",
    titleEn: "Pregnancy: this blood pressure pill",
    titleUr: "حمل: یہ بلڈ پریشر کی گولی",
    detailEn: "This type of blood pressure pill can harm an unborn baby. Tell your doctor that you are pregnant so they can switch it.",
    detailUr: "اس قسم کی بلڈ پریشر گولی پیٹ میں بچے کو نقصان پہنچا سکتی ہے۔ ڈاکٹر کو بتائیں کہ آپ حاملہ ہیں تاکہ وہ دوا بدل سکیں۔",
  },
  {
    when: "pregnant",
    ingredients: ["ibuprofen", "mefenamic acid"],
    severity: "caution",
    titleEn: "Pregnancy: painkillers like ibuprofen",
    titleUr: "حمل: آئبوپروفین جیسی درد کی دوائیں",
    detailEn: "These painkillers are usually avoided in pregnancy, especially from 20 weeks on. Paracetamol is often preferred. Ask your doctor.",
    detailUr: "حمل میں، خاص طور پر بیس ہفتوں کے بعد، یہ درد کی دوائیں عموماً نہیں دی جاتیں۔ اکثر پیراسیٹامول بہتر سمجھی جاتی ہے۔ ڈاکٹر سے پوچھیں۔",
  },
  {
    when: "pregnant",
    ingredients: ["atorvastatin"],
    severity: "caution",
    titleEn: "Pregnancy: cholesterol pill",
    titleUr: "حمل: کولیسٹرول کی گولی",
    detailEn: "Cholesterol pills are usually paused during pregnancy. Ask your doctor.",
    detailUr: "حمل کے دوران کولیسٹرول کی گولی عموماً روک دی جاتی ہے۔ ڈاکٹر سے پوچھیں۔",
  },
  {
    when: "pregnant",
    ingredients: ["ciprofloxacin"],
    severity: "caution",
    titleEn: "Pregnancy: ciprofloxacin",
    titleUr: "حمل: سپروفلوکساسین",
    detailEn: "This antibiotic is usually avoided in pregnancy when another option exists. Make sure your doctor knows you are pregnant.",
    detailUr: "دوسرا راستہ ہو تو حمل میں یہ اینٹی بائیوٹک عموماً نہیں دی جاتی۔ یقینی بنائیں کہ ڈاکٹر کو آپ کے حمل کا علم ہے۔",
  },
  {
    when: "kidney",
    ingredients: ["ibuprofen", "mefenamic acid"],
    severity: "caution",
    titleEn: "Kidney problems: painkillers like ibuprofen",
    titleUr: "گردوں کا مسئلہ: آئبوپروفین جیسی درد کی دوائیں",
    detailEn: "These painkillers can make kidney problems worse. Ask your doctor whether paracetamol would be safer for you.",
    detailUr: "یہ درد کی دوائیں گردوں کا مسئلہ بڑھا سکتی ہیں۔ ڈاکٹر سے پوچھیں کہ کیا پیراسیٹامول آپ کے لیے بہتر رہے گی۔",
  },
  {
    when: "kidney",
    ingredients: ["metformin"],
    severity: "caution",
    titleEn: "Kidney problems: metformin",
    titleUr: "گردوں کا مسئلہ: میٹفارمن",
    detailEn: "The safe dose of metformin depends on how well your kidneys work. Make sure your doctor knows about your kidney problem.",
    detailUr: "میٹفارمن کی محفوظ مقدار گردوں کی کارکردگی پر منحصر ہے۔ یقینی بنائیں کہ ڈاکٹر کو گردوں کے مسئلے کا علم ہے۔",
  },
  {
    when: "kidney",
    ingredients: ["spironolactone"],
    severity: "caution",
    titleEn: "Kidney problems: spironolactone",
    titleUr: "گردوں کا مسئلہ: اسپائرونولیکٹون",
    detailEn: "With weak kidneys, spironolactone can push potassium too high. Regular blood tests are usually needed.",
    detailUr: "کمزور گردوں کے ساتھ اسپائرونولیکٹون پوٹاشیم بہت بڑھا سکتی ہے۔ عموماً باقاعدہ خون کے ٹیسٹ ضروری ہوتے ہیں۔",
  },
  {
    when: "over60",
    ingredients: ["promethazine", "clonazepam", "chlorpheniramine"],
    severity: "caution",
    titleEn: "Over 60: medicine that makes you sleepy",
    titleUr: "ساٹھ سال سے زیادہ: نیند لانے والی دوا",
    detailEn: "After 60, sleepy medicines raise the risk of falls and confusion. Ask whether a lower dose or another option suits you.",
    detailUr: "ساٹھ سال کے بعد نیند والی دوائیں گرنے اور الجھن کا خطرہ بڑھاتی ہیں۔ پوچھیں کہ کم مقدار یا کوئی اور دوا بہتر ہے یا نہیں۔",
  },
  {
    when: "over60",
    ingredients: ["glimepiride"],
    severity: "caution",
    titleEn: "Over 60: glimepiride and low sugar",
    titleUr: "ساٹھ سال سے زیادہ: گلیمیپرائیڈ اور کم شوگر",
    detailEn: "Glimepiride can drop blood sugar too low in older adults. Know the signs: sweating, shaking, confusion. Eat on time.",
    detailUr: "بڑی عمر میں گلیمیپرائیڈ شوگر بہت کم کر سکتی ہے۔ علامات پہچانیں: پسینہ، کپکپی، الجھن۔ کھانا وقت پر کھائیں۔",
  },
  {
    when: "over60",
    ingredients: ["metoclopramide"],
    severity: "caution",
    titleEn: "Over 60: metoclopramide",
    titleUr: "ساٹھ سال سے زیادہ: میٹوکلوپرامائیڈ",
    detailEn: "In older adults this can cause shaking or stiff movements, especially with long use. Ask how many days to take it.",
    detailUr: "بڑی عمر میں یہ کپکپی یا اکڑاؤ پیدا کر سکتی ہے، خاص طور پر لمبے عرصے تک۔ پوچھیں کتنے دن لینی ہے۔",
  },
];

function profileFlags(result: AnalysisResult, profile: SafetyProfile): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  for (const rule of PROFILE_RULES) {
    if (!profile[rule.when]) continue;
    const involved = result.medicines
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.matched?.ingredients.some((i) => rule.ingredients.includes(i)));
    if (involved.length === 0) continue;
    const brands = involved.map(({ card }) => card.raw.name);
    flags.push({
      severity: rule.severity,
      kind: "profile",
      titleEn: rule.titleEn,
      titleUr: rule.titleUr,
      detailEn: `${rule.detailEn} On your paper: ${brands.join(" and ")}.`,
      detailUr: `${rule.detailUr} آپ کے نسخے میں: ${brands.join(" اور ")}۔`,
      medicineIndices: involved.map(({ index }) => index),
    });
  }
  return flags;
}

const ORDER = { danger: 0, caution: 1, info: 2 } as const;

// Every warning for this reading and this person, most serious first.
export function allFlags(result: AnalysisResult, profile: SafetyProfile): SafetyFlag[] {
  const totals = dailyTotals(result, profile);
  return [...result.flags, ...doseFlags(totals), ...profileFlags(result, profile)].sort(
    (x, y) => ORDER[x.severity] - ORDER[y.severity]
  );
}

export function profileActive(profile: SafetyProfile): boolean {
  return Object.values(profile).some(Boolean);
}
