import type { Ability, Skill, Character } from '../types';

export const SKILL_ABILITY: Record<Skill, Ability> = {
  acrobatics: 'dex',
  animalHandling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleightOfHand: 'dex',
  stealth: 'dex',
  survival: 'wis',
};

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function getSkillAbility(skill: Skill): Ability {
  return SKILL_ABILITY[skill];
}

export function skillModifier(character: Character, skill: Skill): number {
  const base = abilityMod(character.abilities[getSkillAbility(skill)]);
  const prof = character.skillProficiencies.includes(skill) ? character.proficiencyBonus : 0;
  return base + prof;
}

// Human-readable skill label, e.g. "animalHandling" -> "Animal Handling".
export function skillLabel(skill: Skill): string {
  return skill
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase());
}
