import { describe, it, expect } from 'vitest';
import { POWERS, getPower, applyPower } from './powers';
import { startCombat } from './combat';
import type { Hero, Enemy } from '../types';

function makeHero(id: string, dex: number, hp = 30): Hero {
  return {
    id, name: id, race: 'r', class: 'c', level: 1, portrait: '🛡️',
    abilities: { str: 16, dex, con: 14, int: 16, wis: 16, cha: 16 },
    maxHp: hp, hp, ac: 15, proficiencyBonus: 2,
    skillProficiencies: [],
    attacks: [{ name: 'Sword', ability: 'str', damageDice: '1d8', damageBonus: 3 }],
    backstory: '',
  };
}
const goblin: Enemy = { name: 'Goblin', maxHp: 20, ac: 13, attack: { name: 'Scimitar', toHit: 4, damageDice: '1d6', damageBonus: 2 } };
const lookup = (_id: string, _name: string) => ({ ability: 'str' as const, damageDice: '1d8', damageBonus: 3, abilityScore: 16 });
const hit = () => 0.999999;
const start = () => {
  const st = startCombat([makeHero('h1', 10)], [goblin, goblin], hit);
  return { ...st, turnIndex: st.order.indexOf('h1') };
};

describe('powers', () => {
  it('burning-hands sets every enemy Burning', () => {
    const st = start();
    const next = applyPower(st, 'h1', 'burning-hands', [], hit, lookup);
    next.combatants.filter((c) => !c.isHero && c.hp > 0).forEach((e) => expect(e.statuses?.burning).toBeGreaterThan(0));
  });

  it('registry covers the expected ids', () => {
    ['action-surge', 'reckless-strike', 'sneak-attack', 'flurry-of-blows', 'divine-smite', 'volley', 'cure-wounds', 'entangle', 'burning-hands', 'chaos-bolt', 'arms-of-hadar', 'bardic-inspiration']
      .forEach((id) => expect(POWERS[id]).toBeDefined());
    expect(() => getPower('nope')).toThrow();
  });

  it('bonus-attack (sneak-attack) adds extra dice', () => {
    const st = applyPower(start(), 'h1', 'sneak-attack', ['enemy-0'], hit, lookup);
    // forced-max rng => nat 20 crit: 1d8(8) + crit 1d8(8) + 2d6(12) + 3 flat = 31
    expect(st.lastAttack?.amount).toBe(31);
  });

  it('aoe-damage (burning-hands) hits every living enemy', () => {
    const st = applyPower(start(), 'h1', 'burning-hands', [], hit, lookup);
    const enemies = st.combatants.filter((c) => !c.isHero);
    expect(enemies.every((e) => e.hp < e.maxHp)).toBe(true);
  });

  it('aoe-damage (arms-of-hadar) also imposes disadvantage on all enemies', () => {
    const st = applyPower(start(), 'h1', 'arms-of-hadar', [], hit, lookup);
    expect(st.combatants.filter((c) => !c.isHero).every((e) => e.nextAttack === 'dis')).toBe(true);
  });

  it('multi-attack (flurry) strikes the target more than once', () => {
    const st = applyPower(start(), 'h1', 'flurry-of-blows', ['enemy-0'], hit, lookup);
    const e0 = st.combatants.find((c) => c.id === 'enemy-0')!;
    expect(e0.maxHp - e0.hp).toBeGreaterThan(7);
  });

  it('single-damage (chaos-bolt) damages one target with no attack roll', () => {
    const st = applyPower(start(), 'h1', 'chaos-bolt', ['enemy-0'], hit, lookup);
    expect(st.lastAttack?.d20).toBeUndefined();
    expect(st.lastAttack?.amount).toBeGreaterThan(0);
  });

  it('heal (cure-wounds) restores an ally', () => {
    let st = start();
    st.combatants.find((c) => c.id === 'h1')!.hp = 5;
    st = applyPower(st, 'h1', 'cure-wounds', ['h1'], hit, lookup);
    expect(st.combatants.find((c) => c.id === 'h1')!.hp).toBeGreaterThan(5);
  });

  it('grant-advantage flags the ally next attack', () => {
    const st = applyPower(start(), 'h1', 'bardic-inspiration', ['h1'], hit, lookup);
    expect(st.combatants.find((c) => c.id === 'h1')!.nextAttack).toBe('adv');
  });

  it('impose-disadvantage (entangle) flags all enemies', () => {
    const st = applyPower(start(), 'h1', 'entangle', [], hit, lookup);
    expect(st.combatants.filter((c) => !c.isHero).every((e) => e.nextAttack === 'dis')).toBe(true);
  });

  it('reckless-strike rolls with advantage', () => {
    const st = applyPower(start(), 'h1', 'reckless-strike', ['enemy-0'], hit, lookup);
    expect(st.lastAttack?.mode).toBe('adv');
  });
});
