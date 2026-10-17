"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SAMPLE_KEYS, SAMPLE_PRESCRIPTIONS } from "@/lib/analysis";
import { photoToDataUrl } from "@/lib/image";
import {
  clearHistory,
  historyTitle,
  useHistory,
  openReading,
  removeFromHistory,
  saveToHistory,
  type HistoryEntry,
} from "@/lib/history";

type Status = "idle" | "processing" | "error";

const STAGES = [
  "Reading the handwriting",
  "Checking for dangerous combinations",
  "Explaining in plain words",
];

export default function Home() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busySample, setBusySample] = useState<string | null>(null);
  const history = useHistory();

  function openPast(entry: HistoryEntry) {
    openReading(entry.result);
    router.push("/result");
  }

  async function analyze(body: Record<string, unknown>) {
    setStatus("processing");
    setStage(0);
    setError(null);
    const timers = [0, 2600, 5200].map((ms, i) =>
      window.setTimeout(() => setStage(i), ms)
    );
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      openReading(data.result);
      saveToHistory(data.result);
      router.push("/result");
    } catch {
      setError("Could not reach the reader. Check your connection and try again.");
      setStatus("error");
    } finally {
      timers.forEach((t) => window.clearTimeout(t));
    }
  }

  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not a photo. Choose a picture of the prescription.");
      setStatus("error");
      return;
    }
    try {
      const image = await photoToDataUrl(file);
      await analyze({ image });
    } catch {
      setError("Could not open that photo. Try taking it again.");
      setStatus("error");
    }
  }

  function trySample(key: string) {
    setBusySample(key);
    analyze({ sample: key }).finally(() => setBusySample(null));
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="px-6 pt-6 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-baseline gap-3">
          <span className="font-hand text-4xl font-semibold text-brand">Nuskha</span>
          <span dir="rtl" lang="ur" className="font-urdu text-2xl leading-relaxed text-ink-soft">نسخہ</span>
        </div>
        <div className="rx-rule mx-auto mt-4 max-w-3xl" />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 sm:px-10">
        <AnimatePresence mode="wait">
          {status === "processing" ? (
            <motion.section
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col items-center justify-center py-24 text-center"
              aria-live="polite"
            >
              <div className="rx-pad w-full max-w-md border border-paper-deep p-8">
                <motion.p
                  key={stage}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-xl font-semibold text-brand"
                >
                  {STAGES[stage]}
                </motion.p>
                <p className="mt-3 text-ink-soft">
                  This usually takes a few seconds.
                </p>
                <div className="mt-6 flex justify-center gap-2" aria-hidden="true">
                  {STAGES.map((_, i) => (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full ${
                        i <= stage ? "bg-accent" : "bg-paper-deep"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="capture"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-1 flex-col justify-center py-16"
            >
              <h1 className="max-w-xl text-3xl font-bold leading-tight text-brand sm:text-4xl">
                Your prescription, in plain words.
              </h1>
              <p dir="rtl" lang="ur" className="font-urdu mt-4 text-2xl leading-loose text-ink">
                نسخہ سمجھیں، محفوظ رہیں
              </p>
              <p className="mt-4 max-w-xl text-ink-soft">
                Photograph a handwritten prescription. Nuskha reads it, explains
                each medicine in Urdu, warns you about dangerous combinations,
                and shows cheaper registered generics.
              </p>

              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex min-h-14 items-center gap-3 rounded-lg bg-accent px-8 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline-offset-4"
                >
                  <CameraIcon />
                  Scan a prescription
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={onPhotoPicked}
                  aria-label="Take or choose a prescription photo"
                />
                <p className="mt-3 text-sm text-ink-soft">
                  Works best in daylight, with the full page in frame.
                </p>
              </div>

              <div className="mt-10">
                <p className="text-base font-semibold text-ink-soft">
                  No prescription handy? Try a labeled sample:
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {SAMPLE_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => trySample(key)}
                      disabled={busySample !== null}
                      className="min-h-11 rounded-lg border border-brand/30 bg-white px-5 text-base font-medium text-brand transition-colors hover:bg-paper disabled:opacity-50"
                    >
                      {busySample === key
                        ? "Reading…"
                        : SAMPLE_PRESCRIPTIONS[key].label}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-base text-ink-soft">
                  Want to test the camera?{" "}
                  <a
                    href="/sample-rx/printable.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4 hover:text-brand-deep"
                  >
                    Print a handwritten test sheet
                  </a>
                </p>
              </div>

              <AnimatePresence>
                {status === "error" && error && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 max-w-xl rounded-lg border border-danger/40 bg-white p-5"
                  >
                    <p className="font-semibold text-danger">That did not work</p>
                    <p className="mt-1 text-ink-soft">{error}</p>
                    <button
                      type="button"
                      onClick={() => setStatus("idle")}
                      className="mt-4 min-h-11 rounded-lg bg-brand px-6 font-medium text-white transition-colors hover:bg-brand-deep"
                    >
                      Try again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {history.length > 0 && (
                <section aria-labelledby="history-heading" className="mt-14">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 id="history-heading" className="text-lg font-bold text-brand">
                      Your recent readings
                    </h2>
                    <button
                      type="button"
                      onClick={() => clearHistory()}
                      className="min-h-11 px-2 text-base font-medium text-ink-soft underline underline-offset-4 hover:text-danger"
                    >
                      Clear all
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    Saved only on this device. Nothing is stored on our servers.
                  </p>
                  <ul className="mt-4 grid gap-3">
                    {history.map((entry) => {
                      const warnings = entry.result.flags.filter(
                        (f) => f.severity !== "info"
                      ).length;
                      return (
                        <li
                          key={entry.id}
                          className="flex items-center gap-2 rounded-lg border border-paper-deep bg-white"
                        >
                          <button
                            type="button"
                            onClick={() => openPast(entry)}
                            className="flex min-h-14 flex-1 flex-col items-start px-4 py-3 text-left hover:bg-paper"
                          >
                            <span className="font-semibold text-ink">
                              {historyTitle(entry.result)}
                            </span>
                            <span className="text-sm text-ink-soft">
                              {new Date(entry.savedAt).toLocaleString("en-PK", {
                                day: "numeric",
                                month: "short",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                              {entry.result.sample && " · Sample"}
                              {warnings > 0 && (
                                <span className="font-semibold text-danger">
                                  {" "}
                                  · {warnings} warning{warnings === 1 ? "" : "s"}
                                </span>
                              )}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromHistory(entry.id)}
                            aria-label={`Remove reading: ${historyTitle(entry.result)}`}
                            className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-paper hover:text-danger"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="M6 6l12 12M18 6 6 18" />
                            </svg>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <div className="rx-rule mt-14" />
              <ol className="mt-8 grid gap-6 sm:grid-cols-2">
                {[
                  [
                    "Photograph the paper",
                    "Any handwritten prescription, in English or Roman Urdu.",
                  ],
                  [
                    "Nuskha reads each line",
                    "Medicine names, strength, and the 1-0-1 daily marks.",
                  ],
                  [
                    "Danger gets flagged first",
                    "Double paracetamol, bleeding pairs, kidney strain.",
                  ],
                  [
                    "Hear it in Urdu",
                    "Spoken explanations, a daily schedule, and savings on generics.",
                  ],
                ].map(([title, text]) => (
                  <li key={title} className="max-w-sm">
                    <p className="font-semibold text-brand">{title}</p>
                    <p className="mt-1 text-ink-soft">{text}</p>
                  </li>
                ))}
              </ol>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="px-6 pb-8 sm:px-10">
        <div className="rx-rule mx-auto max-w-3xl" />
        <div className="mx-auto mt-6 flex max-w-3xl flex-col gap-2 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>Nuskha explains your prescription. Your doctor and pharmacist make the decisions.</p>
          <a
            href="https://github.com/AHMEDALIGHORI/nuskha"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

// Purpose-written icons: a camera for the scan action. No icon library look.
function CameraIcon() {
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
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
