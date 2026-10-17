// Client-side Urdu text-to-speech via the Web Speech API. No network, no cost.
// Urdu voices are not installed on every device, so callers learn which case applied.

export type SpeakOutcome = "urdu" | "no-urdu-voice" | "unsupported";

function supported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function urduVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith("ur")) ?? null;
}

export function hasUrduVoice(): boolean {
  return supported() && urduVoice() !== null;
}

export function onVoicesReady(cb: () => void): () => void {
  if (!supported()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", cb);
}

// Chrome stops long utterances after about 15 seconds, so speak sentence by sentence.
export function speakUr(text: string, onEnd?: () => void): SpeakOutcome {
  if (!supported()) return "unsupported";
  const synth = window.speechSynthesis;
  synth.cancel();
  const voice = urduVoice();
  const sentences = text
    .split("۔")
    .map((s) => s.trim())
    .filter(Boolean);
  sentences.forEach((sentence, i) => {
    const u = new SpeechSynthesisUtterance(sentence);
    u.lang = "ur-PK";
    u.rate = 0.9;
    if (voice) u.voice = voice;
    if (i === sentences.length - 1 && onEnd) {
      u.onend = onEnd;
      u.onerror = onEnd;
    }
    synth.speak(u);
  });
  return voice ? "urdu" : "no-urdu-voice";
}

export function stopSpeaking() {
  if (supported()) window.speechSynthesis.cancel();
}
