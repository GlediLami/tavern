import { describe, it, expect } from 'vitest';
import { resolveCheck } from './checks';
import type { Character } from '../types';

const hero: Character = {
  id: 'x', name: 'X', race: 'Dwarf', class: 'Fighter', level: 1, portrait: '🛡️',
  abilities: { str: 16, dex: 13, con: 16, int: 8, wis: 12, cha: 10 },
  maxHp: 13, ac: 18, proficiencyBonus: 2,
  skillProficiencies: ['athletics'],
  attacks: [], backstory: '',
};

const forceD20 = (n: number) => () => (n - 1) / 20 + 0.0001;

describe('resolveCheck', () => {
  it('succeeds when total >= dc', () => {
    const res = resolveCheck(hero, 'athletics', 13, forceD20(10));
    expect(res.roll).toBe(10);
    expect(res.modifier).toBe(5);
    expect(res.total).toBe(15);
    expect(res.success).toBe(true);
    expect(res.crit).toBeNull();
  });

  it('fails when total < dc', () => {
    const res = resolveCheck(hero, 'athletics', 20, forceD20(5));
    expect(res.success).toBe(false);
    expect(res.crit).toBeNull();
  });

  it('nat 20 is a crit success regardless of dc', () => {
    const res = resolveCheck(hero, 'athletics', 99, forceD20(20));
    expect(res.success).toBe(true);
    expect(res.crit).toBe('success');
  });

  it('nat 1 is a crit fail regardless of dc', () => {
    const res = resolveCheck(hero, 'athletics', 1, forceD20(1));
    expect(res.success).toBe(false);
    expect(res.crit).toBe('fail');
  });
});
