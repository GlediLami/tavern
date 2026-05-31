// Tiny synthesized sound effects via the Web Audio API — no audio assets.
// All calls are best-effort and fail silent if audio is unavailable.

let ctx: AudioContext | null = null;
const MUTE_KEY = 'tavern.muted.v1';

function getCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setMuted(muted: boolean): void {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
}

function tone(opts: {
  freq: number; type?: OscillatorType; dur: number;
  gain?: number; freqEnd?: number; delay?: number;
}): void {
  if (isMuted()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + (opts.delay ?? 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t0 + opts.dur);
    const peak = opts.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  } catch { /* ignore */ }
}

function noiseBurst(dur: number, gain = 0.08): void {
  if (isMuted()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    const frames = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ac.createBufferSource();
    const g = ac.createGain();
    g.gain.value = gain;
    src.buffer = buffer;
    src.connect(g).connect(ac.destination);
    src.start();
  } catch { /* ignore */ }
}

export const sfx = {
  // Dice clatter: a couple of short randomized noise ticks.
  diceRoll() {
    noiseBurst(0.18, 0.06);
    tone({ freq: 220, type: 'triangle', dur: 0.12, gain: 0.05, freqEnd: 320, delay: 0.05 });
  },
  // Triumphant rising chime for a nat-20.
  crit() {
    tone({ freq: 660, type: 'triangle', dur: 0.5, gain: 0.12 });
    tone({ freq: 880, type: 'triangle', dur: 0.5, gain: 0.1, delay: 0.08 });
    tone({ freq: 1320, type: 'sine', dur: 0.6, gain: 0.08, delay: 0.16 });
  },
  // Low descending thud for a nat-1.
  fumble() {
    tone({ freq: 180, type: 'sawtooth', dur: 0.45, gain: 0.12, freqEnd: 60 });
    noiseBurst(0.2, 0.05);
  },
  hit() {
    tone({ freq: 140, type: 'square', dur: 0.1, gain: 0.08, freqEnd: 70 });
    noiseBurst(0.08, 0.05);
  },
  click() {
    tone({ freq: 320, type: 'square', dur: 0.05, gain: 0.04, freqEnd: 220 });
  },
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.5, gain: 0.1, delay: i * 0.12 }));
  },
  defeat() {
    [392, 311, 233].forEach((f, i) => tone({ freq: f, type: 'sawtooth', dur: 0.6, gain: 0.1, delay: i * 0.16 }));
  },
};
