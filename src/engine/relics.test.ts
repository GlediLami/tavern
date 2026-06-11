import { describe, it, expect } from 'vitest';
import { RELICS, getRelic, sumRelicEffects, rollRelicChoices } from './relics';

describe('relics', () => {
  it('sumRelicEffects merges numeric fields and ORs the flag', () => {
    const eff = sumRelicEffects(['ironhide-charm', 'guardian-sigil', 'hunters-focus']);
    expect(eff.acBonus).toBe(3);             // ironhide +2, guardian +1
    expect(eff.damageReduction).toBe(1);      // guardian -1
    expect(eff.firstStrikeAdvantage).toBe(true);
  });

  it('sumRelicEffects ignores unknown ids', () => {
    expect(sumRelicEffects(['nope'])).toEqual({});
  });

  it('rollRelicChoices returns distinct valid ids', () => {
    const choices = rollRelicChoices(() => 0.99, 3);
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    choices.forEach((id) => expect(RELICS[id]).toBeDefined());
  });

  it('getRelic throws on unknown', () => {
    expect(() => getRelic('nope')).toThrow();
  });

  it('sumRelicEffects merges the status-synergy relics', () => {
    const eff = sumRelicEffects(['emberbrand', 'executioners-eye']);
    expect(eff.inflictOnHit).toBe('burning');
    expect(eff.bonusVsAfflicted).toBe(3);
  });
});
