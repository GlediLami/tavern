import { describe, it, expect } from 'vitest';
import charactersData from './characters.json';
import { abilityMod, SKILL_ABILITY } from '../engine/skills';
import type { Character } from '../types';

const characters = charactersData as unknown as Character[];

describe('characters.json', () => {
  it('has 12 characters with unique ids', () => {
    expect(characters).toHaveLength(12);
    expect(new Set(characters.map((c) => c.id)).size).toBe(12);
  });

  it('every skill proficiency is a real skill', () => {
    const valid = new Set(Object.keys(SKILL_ABILITY));
    for (const c of characters) {
      for (const s of c.skillProficiencies) expect(valid.has(s)).toBe(true);
    }
  });

  it('every attack ability is valid and damageDice parses', () => {
    for (const c of characters) {
      for (const a of c.attacks) {
        expect(['str', 'dex', 'con', 'int', 'wis', 'cha']).toContain(a.ability);
        expect(a.damageDice).toMatch(/^\d+d\d+$/);
      }
    }
  });

  it('hp, ac, and modifiers are sane positive numbers', () => {
    for (const c of characters) {
      expect(c.maxHp).toBeGreaterThan(0);
      expect(c.ac).toBeGreaterThanOrEqual(10);
      expect(c.proficiencyBonus).toBe(2);
      const mods = Object.values(c.abilities).map(abilityMod);
      expect(Math.max(...mods)).toBeGreaterThan(0);
    }
  });
});
