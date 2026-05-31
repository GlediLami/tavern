import { describe, it, expect } from 'vitest';
import { abilityMod, getSkillAbility, skillModifier, SKILL_ABILITY } from './skills';
import type { Character } from '../types';

const bjorn: Character = {
  id: 'x', name: 'X', race: 'Dwarf', class: 'Fighter', level: 1, portrait: '🛡️',
  abilities: { str: 16, dex: 13, con: 16, int: 8, wis: 12, cha: 10 },
  maxHp: 13, ac: 18, proficiencyBonus: 2,
  skillProficiencies: ['athletics', 'intimidation'],
  attacks: [], backstory: '',
};

describe('skills', () => {
  it('abilityMod uses floor((score-10)/2)', () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(16)).toBe(3);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(15)).toBe(2);
    expect(abilityMod(7)).toBe(-2);
  });

  it('maps all 18 skills to an ability', () => {
    expect(Object.keys(SKILL_ABILITY)).toHaveLength(18);
    expect(getSkillAbility('athletics')).toBe('str');
    expect(getSkillAbility('perception')).toBe('wis');
    expect(getSkillAbility('arcana')).toBe('int');
  });

  it('adds proficiency bonus only when proficient', () => {
    expect(skillModifier(bjorn, 'athletics')).toBe(5);
    expect(skillModifier(bjorn, 'stealth')).toBe(1);
  });
});
