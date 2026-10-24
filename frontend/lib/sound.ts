"use client";
/* Small UI sounds, synthesised with the Web Audio API (no audio files).
   Browsers only allow sound after the user has interacted with the page, so
   a sound requested before that is skipped silently. Mute is per browser. */

export type SoundName = "success" | "error" | "notify" | "info";

const KEY = "fv_sound";
let ctx: AudioContext | null = null;

export function isSoundOn(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
export function setSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* ignore */ }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/* One soft tone: frequency (Hz), start offset and length (s), waveform, peak volume. */
function tone(ac: AudioContext, freq: number, at: number, len: number, type: OscillatorType = "sine", peak = 0.08) {
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

export function playSound(name: SoundName) {
  if (!isSoundOn()) return;
  try {
    const ac = audio();
    if (!ac || ac.state !== "running") return;
    if (name === "success") { tone(ac, 659.25, 0, 0.16); tone(ac, 987.77, 0.09, 0.24); }           // E5 → B5 chime
    else if (name === "error") { tone(ac, 311.13, 0, 0.18, "triangle", 0.1); tone(ac, 233.08, 0.14, 0.28, "triangle", 0.1); } // low falling pair
    else if (name === "notify") {                                                                    // two-strike bell
      tone(ac, 880, 0, 0.7, "sine", 0.07); tone(ac, 1760, 0, 0.35, "sine", 0.02);
      tone(ac, 1174.66, 0.16, 0.8, "sine", 0.06); tone(ac, 2349.32, 0.16, 0.4, "sine", 0.015);
    } else tone(ac, 587.33, 0, 0.22);                                                                // D5 blip
  } catch { /* sound is a nicety — never break the UI */ }
}

/* Browsers keep audio locked until a gesture; unlock on the first one so
   later notifications (from polling) can ring. */
if (typeof window !== "undefined") {
  const unlock = () => { audio(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}
