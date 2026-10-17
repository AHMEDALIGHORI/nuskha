"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { whatsappText } from "@/lib/schedule";
import { hasUrduVoice, onVoicesReady, speakUr, stopSpeaking } from "@/lib/speech";
import type { AnalysisResult } from "@/lib/types";

type VoiceNote = null | "no-urdu-voice" | "unsupported";

const noSubscribe = () => () => {};

export default function ResultPage() {
  // undefined while rendering on the server, null when no reading is stored.
  const raw = useSyncExternalStore(
    noSubscribe,
    () => sessionStorage.getItem("nuskha-result"),
    () => undefined
  );
  const result = useMemo<AnalysisResult | null | undefined>(() => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [raw]);
  const urduReady = useSyncExternalStore(onVoicesReady, hasUrduVoice, () => true);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState<VoiceNote>(null);

  useEffect(() => () => stopSpeaking(), []);

  function toggleSpeech(text: string) {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const outcome = speakUr(text, () => setSpeaking(false));
    if (outcome === "unsupported") {
      setVoiceNote("unsupported");
      return;
    }
    setVoiceNote(outcome === "no-urdu-voice" ? "no-urdu-voice" : null);
    setSpeaking(true);
  }

  if (result === undefined) {
    return (
      <Shell>
        <p className="text-ink-soft">Opening your reading…</p>
      </Shell>
    );
  }

  if (result === null) {
    return (
      <Shell>
        <div className="rx-pad max-w-md border border-paper-deep p-8">
          <h1 className="text-2xl font-bold text-brand">Nothing to show yet</h1>
          <p className="mt-3 text-ink-soft">
            There is no reading waiting here. Scan a prescription first, then
            your explanation will appear on this page.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-14 items-center rounded-lg bg-accent px-8 text-lg font-semibold text-white transition-colors hover:bg-accent-deep"
          >
            Scan a prescription
          </Link>
        </div>
      </Shell>
    );
  }

  const seriousFlags = result.flags.filter((f) => f.severity !== "info");
  const speakingText = buildSpeechText(result);

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-brand sm:text-3xl">Your reading</h1>
        {result.sample && (
          <span className="rounded-md border border-caution/50 bg-white px-3 py-1 text-sm font-semibold text-caution">
            Sample prescription
          </span>
        )}
      </div>
      <p className="mt-2 text-ink-soft">
        {result.extractedCount} {result.extractedCount === 1 ? "medicine" : "medicines"} read
        {seriousFlags.length > 0 && (
          <>
            {" "}· <span className="font-semibold text-danger">{seriousFlags.length} warning{seriousFlags.length === 1 ? "" : "s"}</span>
          </>
        )}
      </p>

      {result.flags.length > 0 && (
        <section aria-label="Safety warnings" className="mt-8">
          <h2 className="text-lg font-bold text-brand">Safety first</h2>
          <div className="mt-4 grid gap-4">
            {result.flags.map((flag, i) => (
              <motion.article
                key={`${flag.kind}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className={`rounded-lg border p-5 ${
                  flag.severity === "danger"
                    ? "border-danger/50 bg-red-50"
                    : flag.severity === "caution"
                      ? "border-caution/50 bg-amber-50"
                      : "border-paper-deep bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <WarningIcon tone={flag.severity === "danger" ? "text-danger" : flag.severity === "caution" ? "text-caution" : "text-ink-soft"} />
                  <div>
                    <p
                      className={`font-semibold ${
                        flag.severity === "danger"
                          ? "text-danger"
                          : flag.severity === "caution"
                            ? "text-caution"
                            : "text-ink"
                      }`}
                    >
                      {flag.titleEn}
                    </p>
                    <p dir="rtl" lang="ur" className="font-urdu mt-1 leading-loose text-ink">{flag.titleUr}</p>
                    <p className="mt-2 text-ink">{flag.detailEn}</p>
                    <p dir="rtl" lang="ur" className="font-urdu mt-1 leading-loose text-ink-soft">{flag.detailUr}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Medicines" className="mt-10">
        <h2 className="text-lg font-bold text-brand">Each medicine</h2>
        <div className="mt-4 grid gap-4">
          {result.medicines.map((med, i) => (
            <motion.article
              key={`${med.raw.name}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.05 }}
              className="rounded-lg border border-paper-deep bg-white p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-bold text-ink">
                  {med.raw.name}
                  {med.raw.strength && (
                    <span className="ml-2 font-medium text-ink-soft">{med.raw.strength}</span>
                  )}
                </h3>
                {med.matched && (
                  <p className="text-sm text-ink-soft">{med.matched.molecule}</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2" aria-label="Daily schedule">
                {(["Morning", "Afternoon", "Night"] as const).map((slot, idx) => (
                  <span
                    key={slot}
                    className={`rounded-md px-3 py-1 text-sm font-semibold ${
                      med.raw.schedule[idx]
                        ? "bg-brand/10 text-brand"
                        : "bg-paper text-ink-soft line-through"
                    }`}
                  >
                    {slot}
                    <span className="sr-only">
                      {med.raw.schedule[idx] ? ": take a dose" : ": no dose"}
                    </span>
                  </span>
                ))}
              </div>

              {med.raw.instructions && (
                <p className="mt-3 text-ink">
                  <span className="font-semibold">Written on the paper:</span>{" "}
                  {med.raw.instructions}
                </p>
              )}

              {(med.raw.confidence === "low" || med.raw.confidence === "medium") && !result.sample && (
                <div className="mt-3 rounded-md border border-caution/40 bg-amber-50 px-4 py-3">
                  <p className="font-semibold text-caution">
                    {med.raw.confidence === "low"
                      ? "Nuskha could not read this name clearly."
                      : "Nuskha is not fully sure about this name."}
                  </p>
                  <p className="mt-1 text-ink">
                    Check it against the paper or the medicine box before relying on the details below.
                  </p>
                  <p dir="rtl" lang="ur" className="font-urdu mt-1 leading-loose text-ink-soft">
                    یہ نام صاف نہیں پڑھا گیا۔ کاغذ یا دوا کے ڈبے سے ملا لیں۔
                  </p>
                </div>
              )}

              <p className="mt-4 text-ink">{med.explanationEn}</p>
              <p dir="rtl" lang="ur" className="font-urdu mt-1 leading-loose text-ink-soft">{med.explanationUr}</p>

              {med.generics.length > 0 && (
                <div className="mt-4 rounded-md bg-paper p-4">
                  <p className="text-base font-semibold text-ink-soft">
                    Cheaper registered options
                  </p>
                  {med.generics.map((g) => (
                    <p key={g.name} className="mt-2 text-ink">
                      {g.name}, around Rs. {g.priceBand[0]} to {g.priceBand[1]} ·{" "}
                      <span className="font-semibold text-safe">
                        about {g.savingPct}% less
                      </span>{" "}
                      than {med.matched?.brand ?? med.raw.name}
                    </p>
                  ))}
                </div>
              )}
            </motion.article>
          ))}
        </div>
      </section>

      <section aria-label="Daily schedule" className="mt-10">
        <h2 className="text-lg font-bold text-brand">Your day, the 1-0-1 way</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(
            [
              ["morning", "صبح"],
              ["afternoon", "دوپہر"],
              ["night", "رات"],
            ] as const
          ).map(([slot, urdu]) => (
            <div key={slot} className="rounded-lg border border-paper-deep bg-white p-5">
              <p className="font-semibold capitalize text-ink-soft">{slot}</p>
              <p dir="rtl" lang="ur" className="font-urdu text-xl leading-loose text-brand">{urdu}</p>
              {result.schedule[slot].length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {result.schedule[slot].map((item) => (
                    <li key={item} className="text-ink">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-ink-soft">No doses at this time.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => toggleSpeech(speakingText)}
          aria-pressed={speaking}
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-accent px-8 text-lg font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          {speaking ? <StopIcon /> : <SpeakerIcon />}
          {speaking ? "Stop" : "Hear it in Urdu"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText(result))}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-brand px-8 text-lg font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          <WhatsAppIcon />
          Send to WhatsApp
        </a>
        <Link
          href="/"
          className="inline-flex min-h-14 items-center justify-center rounded-lg border border-brand/30 bg-white px-8 text-lg font-semibold text-brand transition-colors hover:bg-paper"
        >
          Scan another
        </Link>
      </div>
      {(voiceNote || !urduReady) && (
        <p role="status" className="mt-4 max-w-xl text-base text-ink-soft">
          {voiceNote === "unsupported"
            ? "This browser cannot speak aloud. Try Chrome on Android."
            : "This device has no Urdu voice installed, so the reading may sound unclear. On Android, add Urdu in Settings, Text-to-speech, Google speech engine."}
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1">
      <header className="px-6 pt-6 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-baseline gap-3">
          <Link
            href="/"
            className="font-hand text-3xl font-semibold text-brand underline-offset-4 hover:underline"
          >
            Nuskha
          </Link>
          <span dir="rtl" lang="ur" className="font-urdu text-xl leading-relaxed text-ink-soft">نسخہ</span>
        </div>
        <div className="rx-rule mx-auto mt-4 max-w-3xl" />
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10 sm:px-10">
        {children}
      </main>
      <footer className="px-6 pb-8 sm:px-10">
        <div className="rx-rule mx-auto max-w-3xl" />
        <p className="mx-auto mt-6 max-w-3xl text-sm text-ink-soft">
          Nuskha explains your prescription. Your doctor and pharmacist make the decisions.
        </p>
      </footer>
    </div>
  );
}

function buildSpeechText(result: AnalysisResult): string {
  const parts: string[] = [];
  parts.push("آپ کے نسخے کی وضاحت");
  const serious = result.flags.filter((f) => f.severity !== "info");
  if (serious.length > 0) {
    parts.push("توجہ دیں: " + serious.map((f) => f.titleUr).join("۔ "));
  }
  for (const med of result.medicines) {
    const label = med.raw.strength ? `${med.raw.name} ${med.raw.strength}` : med.raw.name;
    const slots = [
      med.raw.schedule[0] ? "صبح" : null,
      med.raw.schedule[1] ? "دوپہر" : null,
      med.raw.schedule[2] ? "رات" : null,
    ]
      .filter(Boolean)
      .join("، ");
    parts.push(`${label}، وقت: ${slots || "جیسا ڈاکٹر نے کہا"}`);
  }
  parts.push("یہ صرف وضاحت ہے۔ فیصلہ آپ کے ڈاکٹر اور فارماسسٹ کریں گے۔");
  return parts.join("۔ ");
}

// Warning triangle: directly relevant to a safety flag, drawn in-house.
function WarningIcon({ tone }: { tone: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`mt-1 shrink-0 ${tone}`}
      aria-hidden="true"
    >
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4" />
      <path d="M12 17.5v.5" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.1 4c-.2 0-.5.1-.7.3-.6.6-1 1.5-.8 2.4.2 1.2 1 2.6 2.3 3.9 1.6 1.7 3 2.3 4.1 2.5.9.2 1.8-.2 2.4-.8.2-.3.3-.9.2-1.1-.1-.2-1.2-.8-1.5-.9-.3-.1-.5 0-.7.2l-.5.5c-.2.2-.4.2-.7.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2-.1-.4.1-.6l.4-.5c.1-.2.2-.4.1-.6l-.7-1.6c-.1-.4-.3-.5-.7-.5z" />
    </svg>
  );
}
