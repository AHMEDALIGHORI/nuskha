import type { DatasetEntry, ExtractedMedicine, SafetyFlag } from "./types";

// Evidence-based interaction pairs at molecule level.
// Sources: openFDA drug labels (interaction fields), standard pharmacology references.
// Severity is advisory: danger means "confirm with your doctor or pharmacist before taking together".

interface KnownInteraction {
  a: string; // ingredient key
  b: string; // ingredient key
  severity: "danger" | "caution";
  titleEn: string;
  titleUr: string;
  detailEn: string;
  detailUr: string;
}

export const KNOWN_INTERACTIONS: KnownInteraction[] = [
  {
    a: "aspirin",
    b: "warfarin",
    severity: "danger",
    titleEn: "Aspirin plus warfarin",
    titleUr: "ایسپرین اور وارفیرن اکٹھے",
    detailEn: "Both thin the blood. Together they raise bleeding risk sharply. This combination needs explicit doctor approval.",
    detailUr: "دونوں خون پتلا کرتے ہیں۔ اکٹھے خطرہ بڑھا دیتے ہیں۔ یہ امتزاج صرف ڈاکٹر کی اجازت سے۔",
  },
  {
    a: "metronidazole",
    b: "warfarin",
    severity: "danger",
    titleEn: "Metronidazole plus warfarin",
    titleUr: "میٹرونڈیازول اور وارفیرن اکٹھے",
    detailEn: "Metronidazole can double warfarin's effect and cause bleeding. Your INR must be rechecked.",
    detailUr: "میٹرونڈیاژول وارفیرن کا اثر دگنا کر سکتا ہے۔ آئی این آر ٹیسٹ دوبارہ کروائیں۔",
  },
  {
    a: "azithromycin",
    b: "warfarin",
    severity: "caution",
    titleEn: "Azithromycin plus warfarin",
    titleUr: "ازائتھرومائسین اور وارفیرن",
    detailEn: "Antibiotics can shift warfarin's effect during the course. Watch for unusual bruising.",
    detailUr: "اینٹی بائیوٹک کورس کے دوران وارفیرن کا اثر بدل سکتا ہے۔ نیل کے نشانات پر نظر رکھیں۔",
  },
  {
    a: "aspirin",
    b: "ibuprofen",
    severity: "caution",
    titleEn: "Aspirin plus ibuprofen",
    titleUr: "ایسپرین اور آئبوپروفین اکٹھے",
    detailEn: "Ibuprofen can block aspirin's heart protection and add stomach bleeding risk. Ask your doctor.",
    detailUr: "آئبوپروفین ایسپرین کے دل والے فائدے کو روک سکتا ہے اور معدے کا خطرہ بڑھاتا ہے۔ ڈاکٹر سے پوچھیں۔",
  },
  {
    a: "ibuprofen",
    b: "amlodipine",
    severity: "caution",
    titleEn: "Ibuprofen with blood pressure pills",
    titleUr: "آئبوپروفین اور بلڈ پریشر کی گولیاں",
    detailEn: "Ibuprofen can weaken blood pressure control and strain the kidneys with prolonged use.",
    detailUr: "آئبوپروفین بلڈ پریشر کا کنٹرول کمزور اور گردوں پر بوجھ ڈال سکتا ہے۔",
  },
  {
    a: "ibuprofen",
    b: "perindopril",
    severity: "caution",
    titleEn: "Ibuprofen with blood pressure pills",
    titleUr: "آئبوپروفین اور بلڈ پریشر کی گولیاں",
    detailEn: "The combination can reduce the pressure pill's effect and stress the kidneys.",
    detailUr: "یہ امتزاج پریشر گولی کا اثر کم اور گردوں پر دباؤ بڑھا سکتا ہے۔",
  },
  {
    a: "spironolactone",
    b: "perindopril",
    severity: "caution",
    titleEn: "Spironolactone plus blood pressure pills",
    titleUr: "اسپائرونولیکٹون اور پریشر گولی اکٹھے",
    detailEn: "Both raise potassium. Together they can push it too high, which affects the heart rhythm.",
    detailUr: "دونوں پوٹاشیم بڑھاتے ہیں۔ اکٹھے دل کی دھڑکن پر اثر ڈال سکتے ہیں۔",
  },
  {
    a: "cetirizine",
    b: "promethazine",
    severity: "caution",
    titleEn: "Two sleepy allergy pills",
    titleUr: "نیند والی دو الرجی گولیاں",
    detailEn: "Cetirizine and promethazine both cause drowsiness. Together the sedation multiplies.",
    detailUr: "سٹیریزین اور فینرگن دونوں نیند لاتی ہیں۔ اکٹھے اثر کئی گنا بڑھ جاتا ہے۔",
  },
  {
    a: "promethazine",
    b: "clonazepam",
    severity: "caution",
    titleEn: "Promethazine plus clonazepam",
    titleUr: "فینرگن اور کلونازیپام اکٹھے",
    detailEn: "Strong sedation combined can slow breathing. Only together if your doctor planned it.",
    detailUr: "شدید نیند سانس سست کر سکتی ہے۔ صرف ڈاکٹر کے مشورے سے ہی اکٹھے لیں۔",
  },
  {
    a: "ciprofloxacin",
    b: "warfarin",
    severity: "caution",
    titleEn: "Ciprofloxacin plus warfarin",
    titleUr: "سپروفلوکساسین اور وارفیرن",
    detailEn: "This antibiotic can increase warfarin's effect. INR monitoring is advised.",
    detailUr: "یہ اینٹی بائیوٹک وارفیرن کا اثر بڑھا سکتی ہے۔ آئی این آر ٹیسٹ مشورہ ہے۔",
  },
];

const DUPLICATE_DANGER_INGREDIENTS = new Set(["paracetamol"]);

export function computeFlags(
  extracted: ExtractedMedicine[],
  matched: (DatasetEntry | null)[]
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  // Duplicate-ingredient detection across matched medicines.
  const byIngredient = new Map<string, number[]>();
  matched.forEach((entry, idx) => {
    if (!entry) return;
    for (const ing of entry.ingredients) {
      const list = byIngredient.get(ing) ?? [];
      list.push(idx);
      byIngredient.set(ing, list);
    }
  });

  byIngredient.forEach((indices, ingredient) => {
    if (indices.length < 2) return;
    const isDanger = DUPLICATE_DANGER_INGREDIENTS.has(ingredient);
    const label = matched[indices[0]]?.ingredients.includes(ingredient)
      ? ingredient
      : "an ingredient";
    const brandList = indices.map((i) => matched[i]?.brand ?? extracted[i].name);
    const names =
      brandList.length === 2
        ? `${brandList[0]} and ${brandList[1]}`
        : `${brandList.slice(0, -1).join(", ")} and ${brandList[brandList.length - 1]}`;
    const namesUr = brandList.join("، ");
    const all = brandList.length === 2 ? "both" : "all";
    const labelUr = ingredient === "paracetamol" ? "پیراسیٹامول" : label;
    flags.push({
      severity: isDanger ? "danger" : "caution",
      kind: "duplicate-ingredient",
      titleEn: `${capitalize(label)} appears more than once`,
      titleUr: isDanger ? "پیراسیٹامول بار بار آرہا ہے" : "ایک جزو دوبارہ آرہا ہے",
      detailEn: isDanger
        ? `${names} ${all} contain ${label}. Taking them together can push the daily dose past the safe limit and hurt the liver. Confirm with your pharmacist which one to keep.`
        : `${names} share ${label}. Ask your pharmacist whether ${all} are needed together.`,
      detailUr: isDanger
        ? `${namesUr} سب میں ${labelUr} ہے۔ اکٹھے لینے سے روزانہ کی مقدار حد سے بڑھ کر جگر کو نقصان پہنچا سکتی ہے۔ کون سی رکھنی ہے، فارماسسٹ سے پوچھیں۔`
        : `${namesUr} میں ${labelUr} مشترک ہے۔ سب اکٹھے ضروری ہیں یا نہیں، فارماسسٹ سے پوچھیں۔`,
      medicineIndices: indices,
    });
  });

  // Known molecule-level interactions.
  const present = new Map<string, number[]>();
  matched.forEach((entry, idx) => {
    if (!entry) return;
    for (const ing of entry.ingredients) {
      const list = present.get(ing) ?? [];
      list.push(idx);
      present.set(ing, list);
    }
  });

  const seenPairs = new Set<string>();
  for (const inter of KNOWN_INTERACTIONS) {
    const aIdx = present.get(inter.a);
    const bIdx = present.get(inter.b);
    if (!aIdx || !bIdx) continue;
    const key = [inter.a, inter.b].sort().join("+");
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    const involved = [...new Set([...aIdx, ...bIdx])];
    const names = involved.map((i) => matched[i]?.brand ?? extracted[i].name).join(" and ");
    flags.push({
      severity: inter.severity,
      kind: "interaction",
      titleEn: inter.titleEn,
      titleUr: inter.titleUr,
      detailEn: `${inter.detailEn} On your paper: ${names}.`,
      detailUr: `${inter.detailUr} آپ کے نسخے میں: ${names}۔`,
      medicineIndices: involved,
    });
  }

  // Unmatched notes, low priority, so nothing silently disappears.
  matched.forEach((entry, idx) => {
    if (entry) return;
    flags.push({
      severity: "info",
      kind: "match-note",
      titleEn: `Not in our local database yet: ${extracted[idx].name}`,
      titleUr: "ہماری مقامی فہرست میں ابھی نہیں ملا",
      detailEn:
        "We could not match this one to our Pakistani medicine list. Read its label carefully and confirm with your pharmacist.",
      detailUr: "اسے ہماری مقامی فہرست سے نہیں جوڑ سکے۔ لیبل غور سے پڑھیں اور فارماسسٹ سے تصدیق کریں۔",
      medicineIndices: [idx],
    });
  });

  const order = { danger: 0, caution: 1, info: 2 };
  return flags.sort((x, y) => order[x.severity] - order[y.severity]);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
