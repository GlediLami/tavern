// Procedural ambient music bed via the Web Audio API — no audio assets.
// Fail-silent and respects the shared mute toggle (tavern.muted.v1).
import { isMuted } from './sfx';

export type MusicScene = 'none' | 'explore' | 'combat';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let voices: OscillatorNode[] = [];
let scene: MusicScene = 'none';

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

function teardown(): void {
  for (const o of voices) { try { o.stop(); } catch { /* ignore */ } }
  voices = [];
}

// (Re)build the bed for the current scene, or leave silent when muted / 'none'.
function apply(): void {
  try {
    teardown();
    if (scene === 'none' || isMuted()) {
      if (master && ctx) { try { master.gain.setValueAtTime(0, ctx.currentTime); } catch { /* ignore */ } }
      return;
    }
    const ac = getCtx();
    if (!ac) return;
    if (!master) { master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); }
    const now = ac.currentTime;
    const peak = scene === 'combat' ? 0.06 : 0.04;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.linearRampToValueAtTime(peak, now + 1.2);

    const root = scene === 'combat' ? 110 : 98;                 // A2 vs ~G2
    const intervals = scene === 'combat' ? [1, 1.5, 1.19] : [1, 1.5]; // tense minor-ish vs open fifth
    for (const mult of intervals) {
      const osc = ac.createOscillator();
      osc.type = scene === 'combat' ? 'sawtooth' : 'sine';
      osc.frequency.value = root * mult;
      const g = ac.createGain();
      g.gain.value = scene === 'combat' ? 0.5 : 0.6;
      const lfo = ac.createOscillator();
      lfo.frequency.value = scene === 'combat' ? 0.5 : 0.18;   // breathing
      const lfoGain = ac.createGain();
      lfoGain.gain.value = 0.25;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(master);
      osc.start(); lfo.start();
      voices.push(osc, lfo);
    }
  } catch {
    /* fail silent */
  }
}

export function currentScene(): MusicScene {
  return scene;
}

export function setMusicScene(next: MusicScene): void {
  if (next === scene) return;
  scene = next;
  apply();
}

// Re-apply the current scene (e.g. after the mute toggle changes).
export function refreshMusic(): void {
  apply();
}

export function stopMusic(): void {
  scene = 'none';
  apply();
}
