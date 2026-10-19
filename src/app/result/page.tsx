"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { whatsappText } from "@/lib/schedule";
import { hasUrduVoice, onVoicesReady, speakUr, stopSpeaking } from "@/lib/speech";
import { PROFILE_FIELDS, setProfileField, useProfile } from "@/lib/profile";
import { allFlags, dailyTotals, formatMg } from "@/lib/review";
import { buildCalendar } from "@/lib/calendar";
import type { AnalysisResult, SafetyFlag } from "@/lib/types";

type VoiceNote = null | "no-urdu-voice" | "unsupported";

const noSubscribe = () => () => {};

export default function ResultPage() {
  // undefined while rendering on the server, null when no reading is stored.
  const raw = useSyncExternalStore(
    noSubscribe,
    () => sessionStorage.getItem("nuskha-result"),
    () => undefined
  );
  const photo = useSyncExternalStore(
    noSubscribe,
    () => sessionStorage.getItem("nuskha-photo"),
    () => null
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
  const profile = useProfile();
  const flags = useMemo(() => (result ? allFlags(result, profile) : []), [result, profile]);
  const totals = useMemo(() => (result ? dailyTotals(result, profile) : []), [result, profile]);
  const urduReady = useSyncExternalStore(onVoicesReady, hasUrduVoice, () => true);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNote, setVoiceNote] = useState<VoiceNote>(null);
  const [calendarNote, setCalendarNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const photoRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => stopSpeaking(), []);

  function showOnPhoto(index: number) {
    setSelected(index);
    photoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showCard(index: number) {
    setSelected(index);
    document.getElementById(`med-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function downloadCalendar(r: AnalysisResult) {
    const cal = buildCalendar(r);
    if (cal.events === 0) {
      setCalendarNote("No dose times are marked on this reading, so there is nothing to remind you about.");
      return;
    }
    const url = URL.createObjectURL(new Blob([cal.ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "nuskha-reminders.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const open = cal.events - cal.withEnd;
    setCalendarNote(
      `Downloaded ${cal.events} reminder${cal.events === 1 ? "" : "s"}. Open the file to add them to your calendar.` +
        (cal.withEnd > 0 ? ` ${cal.withEnd} stop when the written course ends.` : "") +
        (open > 0 ? ` ${open} repeat daily until you delete them.` : "")
    );
  }

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

  const seriousFlags = flags.filter((f) => f.severity !== "info");
  const speakingText = buildSpeechText(result, flags);
  const boxed = photo ? result.medicines.filter((m) => m.raw.box).length : 0;
  const activeProfile = PROFILE_FIELDS.filter((f) => profile[f.key]).length;

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

      <ProfilePanel profile={profile} activeCount={activeProfile} />

      {flags.length > 0 && (
        <section aria-label="Safety warnings" className="mt-8">
          <h2 className="text-lg font-bold text-brand">Safety first</h2>
          <div className="mt-4 grid gap-4">
            {flags.map((flag, i) => (
              <motion.article
                key={`${flag.kind}-${flag.titleEn}-${i}`}
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

      {totals.length > 0 && (
        <section aria-labelledby="totals-heading" className="mt-10">
          <h2 id="totals-heading" className="text-lg font-bold text-brand">
            How much in one day
          </h2>
          <p className="mt-1 text-ink-soft">
            Added up from the strength and the daily marks on the paper, across every medicine.
          </p>
          <div className="mt-4 grid gap-3">
            {totals.map((t) => {
              const pct = Math.min(100, Math.round((t.mgPerDay / t.limitMg) * 100));
              return (
                <div key={t.ingredient} className="rounded-lg border border-paper-deep bg-white p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold capitalize text-ink">{t.labelEn}</p>
                    <p className={`font-semibold ${t.over ? "text-danger" : "text-safe"}`}>
                      {formatMg(t.mgPerDay)} of {formatMg(t.limitMg)} a day
                      {t.over ? ", over the limit" : ", within the limit"}
                    </p>
                  </div>
                  <div
                    className="mt-3 h-3 overflow-hidden rounded-full bg-paper-deep"
                    role="img"
                    aria-label={`${formatMg(t.mgPerDay)} out of a ${formatMg(t.limitMg)} daily limit`}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full rounded-full ${t.over ? "bg-danger" : "bg-safe"}`}
                    />
                  </div>
                  <p className="mt-2 text-base text-ink-soft">
                    {t.parts.map((p) => `${p.name} ${formatMg(p.mgPerDay)}`).join(" + ")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {photo && boxed > 0 && (
        <section aria-labelledby="photo-heading" className="mt-10">
          <h2 id="photo-heading" className="text-lg font-bold text-brand">
            Where Nuskha read it
          </h2>
          <p className="mt-1 text-ink-soft">
            Tap a box to jump to that medicine. Check each line against your paper.
          </p>
          <div ref={photoRef} className="relative mt-4 overflow-hidden rounded-lg border border-paper-deep bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing for next/image to optimize */}
            <img src={photo} alt="Your prescription photo" className="block h-auto w-full" />
            {result.medicines.map((med, i) => {
              if (!med.raw.box) return null;
              const [ymin, xmin, ymax, xmax] = med.raw.box;
              const active = selected === i;
              const warned = seriousFlags.some((f) => f.medicineIndices.includes(i));
              return (
                <button
                  key={`box-${i}`}
                  type="button"
                  onClick={() => showCard(i)}
                  aria-label={`${med.raw.name}: show its explanation`}
                  aria-pressed={active}
                  className={`absolute rounded-sm border-2 transition-colors ${
                    active
                      ? "border-accent bg-accent/20"
                      : warned
                        ? "border-danger/80 bg-danger/5 hover:bg-danger/15"
                        : "border-brand/70 bg-brand/5 hover:bg-brand/15"
                  }`}
                  style={{
                    top: `${ymin / 10}%`,
                    left: `${xmin / 10}%`,
                    height: `${(ymax - ymin) / 10}%`,
                    width: `${(xmax - xmin) / 10}%`,
                    minHeight: 24,
                  }}
                >
                  <span
                    className={`absolute -top-3 left-0 rounded px-1.5 text-xs font-bold text-white ${
                      active ? "bg-accent-deep" : warned ? "bg-danger" : "bg-brand"
                    }`}
                  >
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section aria-label="Medicines" className="mt-10">
        <h2 className="text-lg font-bold text-brand">Each medicine</h2>
        <div className="mt-4 grid gap-4">
          {result.medicines.map((med, i) => (
            <motion.article
              key={`${med.raw.name}-${i}`}
              id={`med-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.05 }}
              className={`scroll-mt-6 rounded-lg border bg-white p-5 transition-shadow ${
                selected === i ? "border-accent shadow-[0_0_0_3px_rgba(184,92,0,0.25)]" : "border-paper-deep"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl font-bold text-ink">
                  {photo && med.raw.box && (
                    <span className="mr-2 text-base font-semibold text-ink-soft">{i + 1}.</span>
                  )}
                  {med.raw.name}
                  {med.raw.strength && (
                    <span className="ml-2 font-medium text-ink-soft">{med.raw.strength}</span>
                  )}
                </h3>
                {med.matched && (
                  <p className="text-sm text-ink-soft">{med.matched.molecule}</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Daily schedule">
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
                {med.raw.unitsPerDose && med.raw.unitsPerDose !== 1 && (
                  <span className="rounded-md bg-accent/10 px-3 py-1 text-sm font-semibold text-accent-deep">
                    {med.raw.unitsPerDose} at a time
                  </span>
                )}
              </div>

              {photo && med.raw.box && (
                <button
                  type="button"
                  onClick={() => showOnPhoto(i)}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 font-medium text-brand underline underline-offset-4 hover:text-brand-deep"
                >
                  Show where it was read
                </button>
              )}

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
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText(result, flags))}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-brand px-8 text-lg font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          <WhatsAppIcon />
          Send to WhatsApp
        </a>
        <button
          type="button"
          onClick={() => downloadCalendar(result)}
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg border border-brand/30 bg-white px-8 text-lg font-semibold text-brand transition-colors hover:bg-paper"
        >
          <CalendarIcon />
          Add reminders to calendar
        </button>
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
      {calendarNote && (
        <p role="status" className="mt-4 max-w-xl text-base text-ink">
          {calendarNote} Dose times are set to 8 am, 2 pm and 9 pm. Change them in your calendar if your doctor said otherwise.
        </p>
      )}
    </Shell>
  );
}

function ProfilePanel({
  profile,
  activeCount,
}: {
  profile: ReturnType<typeof useProfile>;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="profile-heading" className="mt-6 rounded-lg border border-paper-deep bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="profile-body"
        className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-paper"
      >
        <span>
          <span id="profile-heading" className="block font-semibold text-brand">
            About you
            <span dir="rtl" lang="ur" className="font-urdu mr-0 ml-2 font-normal text-ink-soft">آپ کے بارے میں</span>
          </span>
          <span className="block text-base text-ink-soft">
            {activeCount > 0
              ? `Checking against ${activeCount} thing${activeCount === 1 ? "" : "s"} you told us`
              : "Tell Nuskha about you for warnings that fit you"}
          </span>
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`shrink-0 text-brand transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="profile-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-paper-deep px-5 pb-5 pt-3">
              <div className="grid gap-1 sm:grid-cols-2">
                {PROFILE_FIELDS.map((field) => (
                  <label
                    key={field.key}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-paper"
                  >
                    <input
                      type="checkbox"
                      checked={profile[field.key]}
                      onChange={(e) => setProfileField(field.key, e.target.checked)}
                      className="h-5 w-5 shrink-0 accent-brand"
                    />
                    <span>
                      <span className="block text-ink">{field.en}</span>
                      <span dir="rtl" lang="ur" className="font-urdu block text-left text-base leading-loose text-ink-soft">
                        {field.ur}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                Saved only on this device. Warnings update straight away.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
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

function buildSpeechText(result: AnalysisResult, flags: SafetyFlag[]): string {
  const parts: string[] = [];
  parts.push("آپ کے نسخے کی وضاحت");
  const serious = flags.filter((f) => f.severity !== "info");
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

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M12 13v3l2 1" />
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
