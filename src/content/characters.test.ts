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

  it('Sacred Flame is a Dexterity-save spell', () => {
    const mara = characters.find((c) => c.id === 'mara-dawnwarden')!;
    const sf = mara.attacks.find((a) => a.name === 'Sacred Flame')!;
    expect(sf.save).toBe('dex');
  });

  it('ranged-primary heroes have their first attack tagged ranged', () => {
    const ranged = ['alaric-vance', 'thornwick-greenstride', 'fennel-quill', 'rowan-mossheart', 'ignis-emberfell', 'vesper-nightvow'];
    for (const id of ranged) {
      const c = characters.find((ch) => ch.id === id)!;
      expect(c.attacks[0].ranged, `${id} primary should be ranged`).toBe(true);
    }
  });

  it('every hero has a powerId that exists in the registry', async () => {
    const { POWERS } = await import('../engine/powers');
    for (const c of characters) {
      expect(c.powerId, `${c.id} missing powerId`).toBeTruthy();
      expect(POWERS[c.powerId!], `${c.id} -> unknown power ${c.powerId}`).toBeDefined();
    }
  });
});
