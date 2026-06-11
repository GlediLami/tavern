// Small presentational helpers shared across components.

// HP bar color shifts from vigorous green -> gold -> blood red as the ratio drops.
export function hpColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  if (r > 0.6) return 'linear-gradient(90deg, #4e7d3f, #6fa86b)';
  if (r > 0.3) return 'linear-gradient(90deg, #b8862f, #e0b450)';
  return 'linear-gradient(90deg, #7a2222, #c0392b)';
}

// Screen-shake distance (px) for a hit of `amount` damage; crits hit hardest.
export function shakeIntensity(amount: number, crit: boolean): number {
  if (amount <= 0) return 0;
  if (crit) return 12;
  if (amount >= 14) return 10;
  if (amount >= 6) return 6;
  return 3;
}

// True when the user has asked the OS to minimize motion. Safe in non-browser/test envs.
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
