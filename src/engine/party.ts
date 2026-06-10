import charactersData from '../content/characters.json';
import { getAdventureData } from '../content/adventures';
import type { Character, Adventure, Hero } from '../types';
import type { ResolvedAttack, HeroAttackLookup } from './combat';

const characters = charactersData as unknown as Character[];

export function getAllCharacters(): Character[] {
  return characters;
}

export function getCharacter(id: string): Character {
  const c = characters.find((ch) => ch.id === id);
  if (!c) throw new Error(`Unknown character id: "${id}"`);
  return c;
}

export function getAdventure(adventureId: string): Adventure {
  return getAdventureData(adventureId);
}

export function toHero(id: string, hp: number, relics: string[] = []): Hero {
  return { ...getCharacter(id), hp, relics };
}

export function heroDisplayName(heroId: string, playerNames: Record<string, string> = {}): string {
  return playerNames[heroId]?.trim() || getCharacter(heroId).name;
}

export function makeHeroAttackLookup(_partyIds: string[]): HeroAttackLookup {
  return (heroId: string, attackName: string): ResolvedAttack => {
    const c = getCharacter(heroId);
    const atk = c.attacks.find((a) => a.name === attackName) ?? c.attacks[0];
    return {
      ability: atk.ability,
      damageDice: atk.damageDice,
      damageBonus: atk.damageBonus,
      abilityScore: c.abilities[atk.ability],
      save: atk.save,
    };
  };
}
