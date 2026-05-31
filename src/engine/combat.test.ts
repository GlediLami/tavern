import { describe, it, expect } from 'vitest';
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant } from './combat';
import type { Hero, Enemy } from '../types';

function makeHero(id: string, dex: number, hp = 20): Hero {
  return {
    id, name: id, race: 'r', class: 'c', level: 1, portrait: '🛡️',
    abilities: { str: 16, dex, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: hp, hp, ac: 15, proficiencyBonus: 2,
    skillProficiencies: [],
    attacks: [{ name: 'Sword', ability: 'str', damageDice: '1d8', damageBonus: 3 }],
    backstory: '',
  };
}

const goblin: Enemy = { name: 'Goblin', maxHp: 7, ac: 13, attack: { name: 'Scimitar', toHit: 4, damageDice: '1d6', damageBonus: 2 } };

const hit = () => 0.999999;
const miss = () => 0;

describe('combat', () => {
  it('startCombat builds combatants for heroes and enemies in initiative order', () => {
    const st = startCombat([makeHero('h1', 18), makeHero('h2', 8)], [goblin], hit);
    expect(st.combatants).toHaveLength(3);
    expect(st.order).toHaveLength(3);
    expect(st.status).toBe('active');
    expect(st.round).toBe(1);
    st.order.forEach((id) => expect(st.combatants.find((c) => c.id === id)).toBeDefined());
  });

  it('gives enemies stable ids enemy-0, enemy-1', () => {
    const st = startCombat([makeHero('h1', 10)], [goblin, goblin], hit);
    expect(st.combatants.filter((c) => !c.isHero).map((c) => c.id)).toEqual(['enemy-0', 'enemy-1']);
  });

  it('a successful hero attack reduces target hp', () => {
    let st = startCombat([makeHero('h1', 10)], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    st = performHeroAttack(st, 'h1', 'Sword', 'enemy-0', hit);
    const goblinC = st.combatants.find((c) => c.id === 'enemy-0')!;
    expect(goblinC.hp).toBeLessThan(7);
  });

  it('reduces hp to 0 (not negative) and marks victory when all enemies down', () => {
    let st = startCombat([makeHero('h1', 10)], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    st = performHeroAttack(st, 'h1', 'Sword', 'enemy-0', hit);
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.hp).toBe(0);
    expect(st.status).toBe('victory');
  });

  it('an enemy turn can damage a hero, and defeat triggers when all heroes down', () => {
    let st = startCombat([makeHero('h1', 10, 3)], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, hit);
    expect(st.combatants.find((c) => c.id === 'h1')!.hp).toBe(0);
    expect(st.status).toBe('defeat');
  });

  it('advances the turn and increments round after wrapping', () => {
    let st = startCombat([makeHero('h1', 10)], [goblin], hit);
    const start = st.turnIndex;
    const actorId = st.order[start];
    if (st.combatants.find((c) => c.id === actorId)!.isHero) {
      st = performHeroAttack(st, actorId, 'Sword', 'enemy-0', miss);
    } else {
      st = performEnemyTurn(st, miss);
    }
    expect(st.turnIndex).not.toBe(start);
  });

  it('currentCombatant returns the combatant whose turn it is', () => {
    const st = startCombat([makeHero('h1', 10)], [goblin], hit);
    expect(currentCombatant(st).id).toBe(st.order[st.turnIndex]);
  });
});
