import charactersData from '../content/characters.json';
import adventureData from '../content/adventure.json';
import type { Character, Adventure, Hero } from '../types';
import type { ResolvedAttack, HeroAttackLookup } from './combat';

const characters = charactersData as unknown as Character[];
const adventure = adventureData as unknown as Adventure;

export function getAllCharacters(): Character[] {
  return characters;
}

export function getCharacter(id: string): Character {
  const c = characters.find((ch) => ch.id === id);
  if (!c) throw new Error(`Unknown character id: "${id}"`);
  return c;
}

export function getAdventure(): Adventure {
  return adventure;
}

export function toHero(id: string, hp: number): Hero {
  return { ...getCharacter(id), hp };
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
    };
  };
}
