import { describe, it, expect } from 'vitest';
import { startCombat } from './combat';
import { applyItem, rollLoot, ITEMS, getItem } from './items';
import type { Hero, Enemy } from '../types';

function hero(id: string, hp = 20, maxHp = 20): Hero {
  return {
    id, name: id, race: 'r', class: 'c', level: 1, portrait: '🛡️',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp, hp, ac: 15, proficiencyBonus: 2, skillProficiencies: [],
    attacks: [{ name: 'Sword', ability: 'str', damageDice: '1d8', damageBonus: 3 }],
    backstory: '',
  };
}
const goblin: Enemy = { name: 'Goblin', maxHp: 7, ac: 13, attack: { name: 'Scimitar', toHit: 4, damageDice: '1d6', damageBonus: 2 } };
const hit = () => 0.999999;

describe('items', () => {
  it('Potion of Healing restores HP to an ally', () => {
    let st = startCombat([hero('h1', 5)], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'potion-healing', ['h1'], hit);
    expect(next.combatants.find((c) => c.id === 'h1')!.hp).toBeGreaterThan(5);
  });

  it('healing revives a downed ally in combat', () => {
    let st = startCombat([hero('h1'), hero('h2')], [goblin], hit);
    st.combatants.find((c) => c.id === 'h2')!.hp = 0;
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'potion-healing', ['h2'], hit);
    expect(next.combatants.find((c) => c.id === 'h2')!.hp).toBeGreaterThan(0);
  });

  it("Alchemist's Fire damages a foe and can end the fight", () => {
    const weakling: Enemy = { name: 'Weakling', maxHp: 3, ac: 10, attack: { name: 'x', toHit: 0, damageDice: '1d4', damageBonus: 0 } };
    let st = startCombat([hero('h1')], [weakling], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'alchemists-fire', ['enemy-0'], hit);
    expect(next.combatants.find((c) => c.id === 'enemy-0')!.hp).toBe(0);
    expect(next.status).toBe('victory');
  });

  it("Elixir of Heroism grants advantage to an ally's next attack", () => {
    let st = startCombat([hero('h1'), hero('h2')], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'elixir-heroism', ['h2'], hit);
    expect(next.combatants.find((c) => c.id === 'h2')!.nextAttack).toBe('adv');
  });

  it('Smoke Bomb imposes disadvantage on all living enemies', () => {
    let st = startCombat([hero('h1')], [goblin, goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'smoke-bomb', [], hit);
    next.combatants.filter((c) => !c.isHero).forEach((e) => expect(e.nextAttack).toBe('dis'));
  });

  it('using an item advances the turn', () => {
    let st = startCombat([hero('h1'), hero('h2')], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'elixir-heroism', ['h2'], hit);
    expect(next.turnIndex).not.toBe(st.turnIndex);
  });

  it('rollLoot returns null when the roll exceeds the drop chance', () => {
    expect(rollLoot(() => 0.7, 'normal')).toBeNull(); // 0.7 >= 0.6
    expect(rollLoot(() => 0.5, 'hard')).toBeNull();   // 0.5 >= 0.45
  });

  it('rollLoot picks a weighted item on a successful roll', () => {
    expect(rollLoot(() => 0, 'normal')).toBe('potion-healing');
    expect(rollLoot(() => 0.5, 'normal')).toBe('alchemists-fire');
  });

  it('every loot entry maps to a real item; getItem throws on unknown', () => {
    for (const id of ['potion-healing', 'greater-healing-draught', 'alchemists-fire', 'elixir-heroism', 'smoke-bomb']) {
      expect(ITEMS[id]).toBeDefined();
    }
    expect(() => getItem('nope')).toThrow();
  });
});
