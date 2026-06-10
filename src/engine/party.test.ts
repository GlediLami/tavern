import { describe, it, expect } from 'vitest';
import { getCharacter, getAllCharacters, getAdventure, makeHeroAttackLookup, toHero, heroDisplayName } from './party';

describe('party helpers', () => {
  it('getAllCharacters returns the full roster', () => {
    expect(getAllCharacters()).toHaveLength(12);
  });

  it('getCharacter finds by id and throws on unknown', () => {
    expect(getCharacter('bjorn-ironhelm').name).toBe('Bjorn Ironhelm');
    expect(() => getCharacter('nope')).toThrow();
  });

  it('getAdventure returns the requested adventure with a start scene', () => {
    expect(getAdventure('brackenmoor').startSceneId).toBe('tavern_start');
    expect(getAdventure('snakewater').startSceneId).toBe('road_start');
  });

  it('toHero attaches current hp', () => {
    const h = toHero('bjorn-ironhelm', 5);
    expect(h.hp).toBe(5);
    expect(h.maxHp).toBe(13);
  });

  it('heroDisplayName uses the player name, falling back to the hero name', () => {
    expect(heroDisplayName('bjorn-ironhelm', { 'bjorn-ironhelm': 'Sam' })).toBe('Sam');
    expect(heroDisplayName('bjorn-ironhelm', {})).toBe('Bjorn Ironhelm');
    expect(heroDisplayName('bjorn-ironhelm', { 'bjorn-ironhelm': '   ' })).toBe('Bjorn Ironhelm');
    expect(heroDisplayName('bjorn-ironhelm')).toBe('Bjorn Ironhelm');
  });

  it('makeHeroAttackLookup resolves attack stats by hero + attack name', () => {
    const lookup = makeHeroAttackLookup(['bjorn-ironhelm']);
    const s = lookup('bjorn-ironhelm', 'Longsword');
    expect(s.damageDice).toBe('1d8');
    expect(s.damageBonus).toBe(3);
    expect(s.ability).toBe('str');
    expect(s.abilityScore).toBe(16);
  });
});
