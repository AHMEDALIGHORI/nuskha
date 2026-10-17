import { NextRequest, NextResponse } from "next/server";
import { ApiError, GoogleGenAI, Type } from "@google/genai";
import { buildAnalysis, SAMPLE_PRESCRIPTIONS } from "@/lib/analysis";
import type { ExtractedMedicine } from "@/lib/types";

export const maxDuration = 60;

// Primary model first; the lighter one takes over when the primary is busy or rate limited.
const MODELS = [
  process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite",
];
const MAX_MEDICINES = 15;

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    medicines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Brand or generic name as written" },
          strength: { type: Type.STRING, description: "e.g. 500mg" },
          schedule: {
            type: Type.ARRAY,
            items: { type: Type.BOOLEAN },
            description: "[morning, afternoon, night]",
          },
          instructions: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
        },
        required: ["name", "schedule"],
      },
    },
  },
  required: ["medicines"],
};

const EXTRACTION_PROMPT = `You are reading a handwritten medical prescription from Pakistan.
Extract every medicine on it. For each one return:
- name: the brand or generic name exactly as written, without dosage-form prefixes like Tab, Cap, Syp, Inj or T.
- strength: the dose, like 500mg, if shown.
- schedule: three booleans [morning, afternoon, night]. Pakistani doctors write this as 1+0+1 or 1-0-1, or as marks over three columns. A 1 or a mark means a dose at that time; 0 means none.
- instructions: anything written about food, duration, or use of that medicine, such as "after meal" or "x 5 days". Leave it empty if nothing is written for that medicine. Never put lab tests or follow-up notes here, such as "INR check after 3 days", "repeat CBC" or "review after a week", even when they share a line with the medicine.
- confidence: how sure you are that you read the name correctly.
Rules: return only medicines. Skip patient names, dates, clinic details, advice lines and signatures. If a word is unclear, make your best guess and lower the confidence. Never invent a medicine that is not on the paper. If the photo is not a prescription, return an empty list.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.sample) {
      const sample = SAMPLE_PRESCRIPTIONS[body.sample as string];
      if (!sample) {
        return NextResponse.json({ ok: false, error: "Unknown sample." }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        result: buildAnalysis(sample.medicines, { sample: true }),
      });
    }

    const image = body?.image as string | undefined;
    if (!image) {
      return NextResponse.json({ ok: false, error: "No photo received." }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        {
          ok: false,
          error: "The photo reader is not switched on yet. Try a labeled sample for now.",
          code: "missing-key",
        },
        { status: 503 }
      );
    }

    const match = image.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ ok: false, error: "That file is not a photo." }, { status: 400 });
    }
    const [, mimeType, data] = match;

    const ai = new GoogleGenAI({ apiKey: key });
    let text: string | undefined;
    let lastError: unknown;
    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [{ inlineData: { mimeType, data } }, { text: EXTRACTION_PROMPT }],
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: EXTRACTION_SCHEMA,
            temperature: 0.1,
          },
        });
        text = response.text ?? "{}";
        break;
      } catch (err) {
        lastError = err;
        const status = err instanceof ApiError ? err.status : 0;
        // Only busy, rate-limited or unavailable models are worth retrying on the fallback.
        if (![404, 429, 500, 503].includes(status)) break;
      }
    }

    if (text === undefined) {
      const status = lastError instanceof ApiError ? lastError.status : 0;
      console.error("Gemini request failed", status, lastError);
      if (status === 429) {
        return NextResponse.json(
          {
            ok: false,
            error: "The reader is busy right now. Wait a minute and try again, or try a labeled sample.",
          },
          { status: 429 }
        );
      }
      if (status === 400) {
        return NextResponse.json(
          { ok: false, error: "The reader could not open that photo. Try a JPEG or PNG." },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "The reading service is not responding. Please try again shortly." },
        { status: 502 }
      );
    }

    let parsed: { medicines?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "The reader could not make sense of that photo. Try a clearer shot." },
        { status: 422 }
      );
    }

    const medicines = sanitize(parsed.medicines);
    if (medicines.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No medicines found in that photo. Hold the phone steady, use daylight, and keep the whole page in frame.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, result: buildAnalysis(medicines, { sample: false }) });
  } catch (err) {
    console.error("analyze failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Something went wrong while reading the photo. Please try again.",
      },
      { status: 500 }
    );
  }
}

// The model output is untrusted: keep only well-formed medicines with a 3-slot schedule.
function sanitize(raw: unknown): ExtractedMedicine[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtractedMedicine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const name = typeof m.name === "string" ? m.name.trim().slice(0, 60) : "";
    if (!name) continue;
    const sched = Array.isArray(m.schedule) ? m.schedule : [];
    const confidence =
      m.confidence === "high" || m.confidence === "medium" || m.confidence === "low"
        ? m.confidence
        : "medium";
    out.push({
      name,
      strength:
        typeof m.strength === "string" && m.strength.trim()
          ? m.strength.trim().slice(0, 30)
          : undefined,
      schedule: [Boolean(sched[0]), Boolean(sched[1]), Boolean(sched[2])],
      instructions:
        typeof m.instructions === "string" && m.instructions.trim()
          ? m.instructions.trim().slice(0, 120)
          : undefined,
      confidence,
    });
    if (out.length >= MAX_MEDICINES) break;
  }
  return out;
}
