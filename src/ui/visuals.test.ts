import { describe, it, expect } from 'vitest';
import { hpColor, shakeIntensity } from './visuals';

describe('visuals', () => {
  it('hpColor shifts green -> gold -> red', () => {
    expect(hpColor(0.9)).toContain('gradient');
    expect(hpColor(0.1)).toContain('gradient');
  });

  it('shakeIntensity scales with damage and peaks on a crit', () => {
    expect(shakeIntensity(0, false)).toBe(0);
    expect(shakeIntensity(3, false)).toBe(3);
    expect(shakeIntensity(8, false)).toBe(6);
    expect(shakeIntensity(20, false)).toBe(10);
    expect(shakeIntensity(5, true)).toBe(12); // crit overrides
  });
});
