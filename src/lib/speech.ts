// Client-side Urdu text-to-speech via the Web Speech API. No network, no cost.
// Voices for ur-PK are not installed on every device; we fall back gracefully.

let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  cachedVoices = window.speechSynthesis.getVoices();
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

export function speakUr(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ur-PK";
  utterance.rate = 0.9;
  const voice =
    cachedVoices.find((v) => v.lang.toLowerCase().startsWith("ur")) ??
    cachedVoices.find((v) => v.lang.toLowerCase().startsWith("pa")) ??
    null;
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
