import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { buildAnalysis, SAMPLE_PRESCRIPTIONS } from "@/lib/analysis";
import type { ExtractedMedicine } from "@/lib/types";

export const maxDuration = 60;

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
- name: the brand or generic name exactly as written.
- strength: the dose, like 500mg, if shown.
- schedule: three booleans [morning, afternoon, night]. Pakistani doctors write this as marks over 1-0-1 columns; a mark over a column means a dose at that time.
- instructions: anything written about food, duration, or use.
- confidence: how sure you are about this line.
Rules: return only medicines, skip patient names, dates, and addresses. If a word is unclear, make your best guess and lower the confidence. Never invent a medicine that is not on the paper.`;

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
        { ok: false, error: "The reading service is not configured yet.", code: "missing-key" },
        { status: 503 }
      );
    }

    const base64 = image.replace(/^data:image\/\w+;base64,/, "");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64 } },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA,
        temperature: 0.1,
      },
    });

    const text = response.text ?? "{}";
    let parsed: { medicines?: ExtractedMedicine[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { ok: false, error: "The reader could not make sense of that photo. Try a clearer shot." },
        { status: 422 }
      );
    }

    const medicines = Array.isArray(parsed.medicines) ? parsed.medicines : [];
    if (medicines.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No medicines found in that photo. Try again with more light." },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, result: buildAnalysis(medicines, { sample: false }) });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Something went wrong while reading the photo. Please try again.",
      },
      { status: 500 }
    );
  }
}
