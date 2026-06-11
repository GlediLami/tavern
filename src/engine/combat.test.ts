import { describe, it, expect } from 'vitest';
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant, applyAttack, applyHeal, enemyIntent, avgDamage, performTaunt, performMark, advanceTurn, checkPhases } from './combat';
import type { HeroAttackLookup } from './combat';
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

function makeRangedHero(id: string, hp = 20): Hero {
  return {
    id, name: id, race: 'r', class: 'c', level: 1, portrait: '🏹',
    abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: hp, hp, ac: 14, proficiencyBonus: 2,
    skillProficiencies: [],
    attacks: [{ name: 'Bow', ability: 'dex', damageDice: '1d8', damageBonus: 3, ranged: true }],
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

  it('applyAttack adds bonus damage dice and clears the attacker advantage flag', () => {
    const st = startCombat([makeHero('h1', 10)], [goblin], hit);
    const attacker = st.combatants.find((c) => c.id === 'h1')!;
    attacker.nextAttack = 'adv';
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit, undefined, { bonusDice: '2d6' });
    // forced-max rng => nat 20 crit: 1d8(8) + crit 1d8(8) + 2d6(12) bonus + 3 flat = 31
    expect(ev.amount).toBe(31);
    expect(ev.mode).toBe('adv');
    expect(attacker.nextAttack).toBeUndefined();
  });

  it('an attacker with nextAttack="dis" rolls with disadvantage via performHeroAttack', () => {
    let st = startCombat([makeHero('h1', 10)], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    st.combatants.find((c) => c.id === 'h1')!.nextAttack = 'dis';
    st = performHeroAttack(st, 'h1', 'Sword', 'enemy-0', hit);
    expect(st.lastAttack?.mode).toBe('dis');
    expect(st.lastAttack?.d20Rolls).toHaveLength(2);
  });

  it('applyHeal restores HP capped at max', () => {
    const st = startCombat([makeHero('h1', 10, 6)], [goblin], hit);
    const h = st.combatants.find((c) => c.id === 'h1')!;
    h.hp = 2;
    const ev = applyHeal(st, 'h1', 'h1', '1d8', 3, 'Cure Wounds', hit);
    expect(ev.kind).toBe('heal');
    expect(h.hp).toBeLessThanOrEqual(h.maxHp);
    expect(h.hp).toBeGreaterThan(2);
  });

  const buffer: Enemy = { name: 'Warchanter', maxHp: 8, ac: 12, attack: { name: 'Spear', toHit: 4, damageDice: '1d6', damageBonus: 1 }, ability: { name: 'War Chant', kind: 'buff', uses: 1 } };
  const hexer: Enemy = { name: 'Hexweaver', maxHp: 10, ac: 12, attack: { name: 'Hex Bolt', toHit: 4, damageDice: '1d6', damageBonus: 2 }, ability: { name: 'Hex', kind: 'debuff', uses: 1 } };

  it('startCombat copies ability and seeds uses onto enemy combatants', () => {
    const st = startCombat([makeHero('h1', 10)], [buffer], hit);
    const e = st.combatants.find((c) => c.id === 'enemy-0')!;
    expect(e.ability?.name).toBe('War Chant');
    expect(e.abilityUses).toBe(1);
  });

  it('a buff enemy grants advantage to a living ally and spends a use', () => {
    let st = startCombat([makeHero('h1', 10)], [buffer, goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, hit);
    expect(st.combatants.find((c) => c.id === 'enemy-1')!.nextAttack).toBe('adv');
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.abilityUses).toBe(0);
  });

  it('a buff enemy with no other living ally just attacks', () => {
    let st = startCombat([makeHero('h1', 10)], [buffer], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, hit);
    expect(st.lastAttack?.kind).toBe('attack');
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.abilityUses).toBe(1);
  });

  it('a debuff enemy imposes disadvantage on a living hero and spends a use', () => {
    let st = startCombat([makeHero('h1', 10)], [hexer], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, hit);
    expect(st.combatants.find((c) => c.id === 'h1')!.nextAttack).toBe('dis');
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.abilityUses).toBe(0);
  });

  it('an enemy with no ability uses left makes a normal attack', () => {
    let st = startCombat([makeHero('h1', 10)], [hexer], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st.combatants.find((c) => c.id === 'enemy-0')!.abilityUses = 0;
    st = performEnemyTurn(st, hit);
    expect(st.lastAttack?.kind).toBe('attack');
    expect(st.combatants.find((c) => c.id === 'h1')!.nextAttack).toBeUndefined();
  });

  it('relic damage raises a hero attack', () => {
    const h = { ...makeHero('h1', 10), relics: ['whetstone'] }; // +2 dmg
    let st = startCombat([h], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit); // crit: 1d8(8)+1d8(8)+flat(3+2)
    expect(ev.amount).toBe(8 + 8 + 3 + 2);
  });

  it('keen-sight raises the to-hit modifier', () => {
    const h = { ...makeHero('h1', 10), relics: ['keen-sight'] };
    let st = startCombat([h], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit);
    expect(ev.toHit).toBe(3 + 2 + 1); // str mod 3 + prof 2 + keen-sight 1
  });

  it("berserker's pact adds damage only while bloodied", () => {
    const full = { ...makeHero('h1', 10, 20), relics: ['berserkers-pact'] };
    let st = startCombat([full], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    expect(applyAttack(st, 'h1', 'Sword', 'enemy-0', hit).amount).toBe(8 + 8 + 3); // not bloodied

    const low = { ...makeHero('h2', 10, 20), relics: ['berserkers-pact'] };
    let st2 = startCombat([low], [goblin], hit);
    st2.combatants.find((c) => c.id === 'h2')!.hp = 8; // 8/20 -> bloodied
    st2 = { ...st2, turnIndex: st2.order.indexOf('h2') };
    expect(applyAttack(st2, 'h2', 'Sword', 'enemy-0', hit).amount).toBe(8 + 8 + 3 + 3);
  });

  it("oathkeeper's light heals the attacker on a crit", () => {
    const h = { ...makeHero('h1', 10, 20), relics: ['oathkeepers-light'] };
    let st = startCombat([h], [goblin], hit);
    st.combatants.find((c) => c.id === 'h1')!.hp = 10;
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    applyAttack(st, 'h1', 'Sword', 'enemy-0', hit); // crit -> heal 3
    expect(st.combatants.find((c) => c.id === 'h1')!.hp).toBe(13);
  });

  it('damage reduction lowers incoming enemy damage', () => {
    const h = { ...makeHero('h1', 10, 30), relics: ['stoneward-totem'] }; // -2 per hit
    let st = startCombat([h], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    const before = st.combatants.find((c) => c.id === 'h1')!.hp;
    st = performEnemyTurn(st, hit); // crit: 1d6(6)+1d6(6)+bonus(2)=14, minus DR 2
    const dealt = before - st.combatants.find((c) => c.id === 'h1')!.hp;
    expect(dealt).toBe(14 - 2);
  });

  it("hunter's focus seeds advantage on the first attack", () => {
    const h = { ...makeHero('h1', 10), relics: ['hunters-focus'] };
    const st = startCombat([h], [goblin], hit);
    expect(st.combatants.find((c) => c.id === 'h1')!.nextAttack).toBe('adv');
  });

  const saveLookup: HeroAttackLookup = () => ({
    ability: 'wis', damageDice: '1d8', damageBonus: 0, abilityScore: 17, save: 'dex',
  });

  it('avgDamage rounds the average of the dice plus bonus', () => {
    expect(avgDamage('1d6', 2)).toBe(6); // 3.5 -> 4, +2
    expect(avgDamage('2d6', 0)).toBe(7);
  });

  it('enemyIntent attacks the lowest-HP hero (ties by order)', () => {
    const st = startCombat([makeHero('h1', 10, 20), makeHero('h2', 10, 20)], [goblin], hit);
    st.combatants.find((c) => c.id === 'h2')!.hp = 4; // h2 wounded
    const intent = enemyIntent(st, 'enemy-0');
    expect(intent?.kind).toBe('attack');
    expect(intent?.targetId).toBe('h2');
    expect(intent?.estDamage).toBe(avgDamage('1d6', 2));
  });

  it('enemyIntent prefers the taunter over the lowest-HP hero', () => {
    let st = startCombat([makeHero('h1', 10, 20), makeHero('h2', 10, 20)], [goblin], hit);
    st.combatants.find((c) => c.id === 'h2')!.hp = 4;
    st = { ...st, tauntTargetId: 'h1' };
    expect(enemyIntent(st, 'enemy-0')?.targetId).toBe('h1');
  });

  it('enemyIntent reports a buff/debuff for ability enemies', () => {
    const bSt = startCombat([makeHero('h1', 10)], [buffer, goblin], hit);
    expect(enemyIntent(bSt, 'enemy-0')).toMatchObject({ kind: 'buff', targetId: 'enemy-1' });
    const hSt = startCombat([makeHero('h1', 10)], [hexer], hit);
    expect(enemyIntent(hSt, 'enemy-0')).toMatchObject({ kind: 'debuff', targetId: 'h1' });
  });

  it('performEnemyTurn attacks the intent target (deterministic, not random)', () => {
    let st = startCombat([makeHero('h1', 10, 20), makeHero('h2', 10, 20)], [goblin], hit);
    st.combatants.find((c) => c.id === 'h2')!.hp = 4;
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, hit);
    expect(st.lastAttack?.targetName).toBe('h2');
  });

  it("performTaunt sets tauntTargetId; advanceTurn clears it on the taunter's turn", () => {
    let st = startCombat([makeHero('tank', 10), makeHero('archer', 10)], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('tank') };
    st = performTaunt(st, 'tank');
    expect(st.tauntTargetId).toBe('tank');
    let guard = 0;
    while (st.order[st.turnIndex] !== 'tank' && guard++ < 20) advanceTurn(st);
    expect(st.tauntTargetId).toBeUndefined();
  });

  it('performMark marks an enemy and applyAttack adds the mark bonus', () => {
    let st = startCombat([makeHero('h1', 10)], [goblin], hit);
    st = performMark(st, 'h1', 'enemy-0');
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.marked).toBe(true);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit); // crit: 1d8(8)+1d8(8)+3+MARK(2)
    expect(ev.amount).toBe(8 + 8 + 3 + 2);
  });

  it('applyAttack adds vulnerable incoming and the afflicted-target relic bonus', () => {
    let st = startCombat([makeHero('h1', 10)], [goblin], hit);
    st.combatants.find((c) => c.id === 'enemy-0')!.statuses = { vulnerable: 2 };
    st.combatants.find((c) => c.id === 'h1')!.bonusVsAfflicted = 3;
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit); // 8+8+3 +vuln2 +afflicted3
    expect(ev.amount).toBe(8 + 8 + 3 + 2 + 3);
  });

  it('a weakened attacker deals less damage', () => {
    let st = startCombat([makeHero('h1', 10)], [goblin], hit);
    st.combatants.find((c) => c.id === 'h1')!.statuses = { weakened: 2 };
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit); // 8+8+3 -2
    expect(ev.amount).toBe(8 + 8 + 3 - 2);
  });

  it("a perform tick burns the actor at end of turn", () => {
    let st = startCombat([makeHero('h1', 10, 20), makeHero('h2', 10, 20)], [goblin], hit);
    st.combatants.find((c) => c.id === 'h1')!.statuses = { burning: 2 };
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    st = performHeroAttack(st, 'h1', 'Sword', 'enemy-0', hit);
    expect(st.combatants.find((c) => c.id === 'h1')!.hp).toBe(20 - 3);
  });

  it('checkPhases enrages a boss once when it crosses a threshold', () => {
    const boss: Enemy = { name: 'Boss', maxHp: 20, ac: 12, attack: { name: 'Smash', toHit: 5, damageDice: '1d8', damageBonus: 2 }, phases: [{ atHpPct: 0.5, enrageDamage: 3, message: 'Enrage!' }] };
    const st = startCombat([makeHero('h1', 10)], [boss], hit);
    st.combatants.find((c) => c.id === 'enemy-0')!.hp = 8; // below 50%
    checkPhases(st);
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.attack!.damageBonus).toBe(2 + 3);
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.phasesDone).toBe(1);
    checkPhases(st);
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.attack!.damageBonus).toBe(2 + 3);
  });

  it('a save spell damages a target that fails its Dexterity save', () => {
    const st = startCombat([makeHero('h1', 10)], [goblin], hit);
    // miss rng => save roll d20=1 (+1 default) = 2 < DC 13 -> fails; 1d8 rolls 1 -> 1 damage
    const ev = applyAttack(st, 'h1', 'Sacred Flame', 'enemy-0', miss, saveLookup);
    expect(ev.save).toBe('dex');
    expect(ev.saveDC).toBe(13);          // 8 + 2 prof + 3 (WIS 17)
    expect(ev.hit).toBe(true);           // failed save = "hit" for damage/flash
    expect(ev.amount).toBe(1);
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.hp).toBe(6);
  });

  it('a save spell deals no damage when the target succeeds', () => {
    const st = startCombat([makeHero('h1', 10)], [goblin], hit);
    // hit rng => save roll d20=20 (+1) = 21 >= DC 13 -> saves; no damage
    const ev = applyAttack(st, 'h1', 'Sacred Flame', 'enemy-0', hit, saveLookup);
    expect(ev.save).toBe('dex');
    expect(ev.hit).toBe(false);
    expect(ev.amount).toBe(0);
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.hp).toBe(7);
  });

  it('marks a hero whose primary attack is ranged as back-line', () => {
    const st = startCombat([makeRangedHero('archer'), makeHero('tank', 10)], [goblin], hit);
    expect(st.combatants.find((c) => c.id === 'archer')!.backLine).toBe(true);
    expect(st.combatants.find((c) => c.id === 'tank')!.backLine).toBeFalsy();
  });

  it('enemies attack a covered back-line hero with disadvantage', () => {
    // party order [archer (back), tank (front)]; miss rng picks target index 0 = archer
    let st = startCombat([makeRangedHero('archer'), makeHero('tank', 10)], [goblin], miss);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, miss);
    expect(st.lastAttack?.targetName).toBe('archer');
    expect(st.lastAttack?.mode).toBe('dis');
    expect(st.lastAttack?.d20Rolls).toHaveLength(2);
  });

  it('back-line cover disappears once the front line is down', () => {
    let st = startCombat([makeRangedHero('archer'), makeHero('tank', 10)], [goblin], miss);
    st.combatants.find((c) => c.id === 'tank')!.hp = 0; // front line falls
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, miss);
    expect(st.lastAttack?.targetName).toBe('archer');
    expect(st.lastAttack?.mode).toBeUndefined();
  });

  it('enemy advantage cancels back-line cover to a straight roll', () => {
    let st = startCombat([makeRangedHero('archer'), makeHero('tank', 10)], [goblin], miss);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st.combatants.find((c) => c.id === 'enemy-0')!.nextAttack = 'adv';
    st = performEnemyTurn(st, miss);
    expect(st.lastAttack?.mode).toBeUndefined();
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.nextAttack).toBeUndefined();
  });
});
