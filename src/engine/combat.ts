import type { Hero, Enemy, Ability, Combatant, CombatState, AttackEvent } from '../types';
import type { Rng } from './rng';
import { defaultRng } from './rng';
import { rollD20, rollDice, rollD20WithMode } from './dice';
import { abilityMod } from './skills';

export interface ResolvedAttack {
  ability: Ability;
  damageDice: string;
  damageBonus: number;
  abilityScore: number;
}

export type HeroAttackLookup = (heroId: string, attackName: string) => ResolvedAttack;

export interface AttackOpts {
  mode?: 'adv' | 'dis';   // explicit advantage/disadvantage (overrides the attacker flag)
  bonusDice?: string;     // extra damage dice on hit, e.g. "2d6"
  bonusFlat?: number;     // extra flat damage on hit
}

export function clone(state: CombatState): CombatState {
  return {
    ...state,
    combatants: state.combatants.map((c) => ({ ...c })),
    order: [...state.order],
    log: [...state.log],
  };
}

export function startCombat(heroes: Hero[], enemies: Enemy[], rng: Rng = defaultRng): CombatState {
  const combatants: Combatant[] = [];

  for (const h of heroes) {
    combatants.push({
      id: h.id, name: h.name, isHero: true, heroId: h.id,
      primaryAttack: h.attacks[0]?.name,
      maxHp: h.maxHp, hp: h.hp, ac: h.ac,
      initiative: rollD20(rng) + abilityMod(h.abilities.dex),
    });
  }
  enemies.forEach((e, i) => {
    combatants.push({
      id: `enemy-${i}`, name: e.name, isHero: false,
      maxHp: e.maxHp, hp: e.maxHp, ac: e.ac,
      initiative: rollD20(rng) + 1,
      attack: e.attack,
    });
  });

  const order = [...combatants]
    .sort((a, b) => b.initiative - a.initiative)
    .map((c) => c.id);

  return {
    combatants,
    order,
    turnIndex: 0,
    round: 1,
    log: ['Roll for initiative! Combat begins.'],
    status: 'active',
  };
}

export function currentCombatant(state: CombatState): Combatant {
  const id = state.order[state.turnIndex];
  return state.combatants.find((c) => c.id === id)!;
}

function livingHeroes(state: CombatState): Combatant[] {
  return state.combatants.filter((c) => c.isHero && c.hp > 0);
}
function livingEnemies(state: CombatState): Combatant[] {
  return state.combatants.filter((c) => !c.isHero && c.hp > 0);
}

// Advance to the next living combatant; bump round when wrapping past the end.
export function advanceTurn(state: CombatState): void {
  let next = state.turnIndex;
  for (let i = 0; i < state.order.length; i++) {
    next = (next + 1) % state.order.length;
    if (next === 0) state.round += 1;
    const c = state.combatants.find((x) => x.id === state.order[next])!;
    if (c.hp > 0) break;
  }
  state.turnIndex = next;
}

export function checkStatus(state: CombatState): void {
  if (livingEnemies(state).length === 0) state.status = 'victory';
  else if (livingHeroes(state).length === 0) state.status = 'defeat';
}

// Resolve ONE attack against a target, mutating `next` (hp + log). Returns the
// event for the dice readout. Honors the attacker's nextAttack flag (or an
// explicit opts.mode) and optional bonus damage. Does NOT advance the turn.
export function applyAttack(
  next: CombatState,
  attackerId: string,
  attackName: string,
  targetId: string,
  rng: Rng = defaultRng,
  lookup?: HeroAttackLookup,
  opts: AttackOpts = {},
): AttackEvent {
  const attacker = next.combatants.find((c) => c.id === attackerId)!;
  const target = next.combatants.find((c) => c.id === targetId)!;

  const stats: ResolvedAttack = lookup
    ? lookup(attackerId, attackName)
    : { ability: 'str', damageDice: '1d8', damageBonus: 3, abilityScore: 16 };

  const toHitMod = abilityMod(stats.abilityScore) + 2; // proficiency +2 at level 1
  const mode = opts.mode ?? attacker.nextAttack;
  attacker.nextAttack = undefined;

  const { value: d20, rolls: d20Rolls } = rollD20WithMode(rng, mode);
  const isCrit = d20 === 20;
  const hit = isCrit || (d20 !== 1 && d20 + toHitMod >= target.ac);

  let rolls: number[] = [];
  let total = 0;
  const flat = stats.damageBonus + (opts.bonusFlat ?? 0);
  if (hit) {
    rolls = [...rollDice(stats.damageDice, rng).rolls];
    if (isCrit) rolls = [...rolls, ...rollDice(stats.damageDice, rng).rolls];
    if (opts.bonusDice) rolls = [...rolls, ...rollDice(opts.bonusDice, rng).rolls];
    total = rolls.reduce((a, b) => a + b, 0) + flat;
    target.hp = Math.max(0, target.hp - total);
    next.log.push(`${attacker.name} hits ${target.name} with ${attackName} for ${total} damage${isCrit ? ' (CRITICAL!)' : ''}.`);
    if (target.hp === 0) next.log.push(`${target.name} falls!`);
  } else {
    next.log.push(`${attacker.name} attacks ${target.name} with ${attackName} but misses.`);
  }

  return {
    kind: 'attack', attackerName: attacker.name, targetName: target.name, actionName: attackName,
    targetId, d20, toHit: toHitMod, ac: target.ac, hit, crit: isCrit,
    damageDice: stats.damageDice, damageRolls: rolls, damageBonus: flat, amount: total,
    mode, d20Rolls: mode ? d20Rolls : undefined,
  };
}

// Restore HP to a target, mutating `next`. Returns the event. Does NOT advance the turn.
export function applyHeal(
  next: CombatState,
  healerId: string,
  targetId: string,
  dice: string,
  bonus: number,
  actionName: string,
  rng: Rng = defaultRng,
): AttackEvent {
  const healer = next.combatants.find((c) => c.id === healerId)!;
  const target = next.combatants.find((c) => c.id === targetId)!;
  const roll = rollDice(dice, rng, bonus);
  target.hp = Math.min(target.maxHp, target.hp + roll.total);
  next.log.push(`${healer.name} heals ${target.name} for ${roll.total} HP with ${actionName}.`);
  return {
    kind: 'heal', attackerName: healer.name, targetName: target.name, actionName,
    targetId, hit: true, crit: false,
    damageDice: dice, damageRolls: roll.rolls, damageBonus: bonus, amount: roll.total,
  };
}

export function performHeroAttack(
  state: CombatState,
  heroId: string,
  attackName: string,
  targetId: string,
  rng: Rng = defaultRng,
  heroAttackLookup?: HeroAttackLookup,
): CombatState {
  const next = clone(state);
  next.lastAttack = applyAttack(next, heroId, attackName, targetId, rng, heroAttackLookup);
  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
}

// A supporting hero (e.g. Cleric) heals an ally for `dice` + `bonus`.
export function performHeroHeal(
  state: CombatState,
  healerId: string,
  targetId: string,
  dice: string,
  bonus: number,
  actionName: string,
  rng: Rng = defaultRng,
): CombatState {
  const next = clone(state);
  next.lastAttack = applyHeal(next, healerId, targetId, dice, bonus, actionName, rng);
  if (next.status === 'active') advanceTurn(next);
  return next;
}

export function performEnemyTurn(state: CombatState, rng: Rng = defaultRng): CombatState {
  const next = clone(state);
  const enemy = next.combatants.find((c) => c.id === next.order[next.turnIndex])!;
  const targets = livingHeroes(next);

  if (enemy.attack && targets.length > 0) {
    const target = targets[Math.floor(rng() * targets.length)];
    const mode = enemy.nextAttack;
    enemy.nextAttack = undefined;
    const { value: d20, rolls: d20Rolls } = rollD20WithMode(rng, mode);
    const isCrit = d20 === 20;
    const hit = isCrit || (d20 !== 1 && d20 + enemy.attack.toHit >= target.ac);
    let rolls: number[] = [];
    let total = 0;
    if (hit) {
      const dmg = rollDice(enemy.attack.damageDice, rng, enemy.attack.damageBonus);
      rolls = [...dmg.rolls];
      if (isCrit) rolls = [...rolls, ...rollDice(enemy.attack.damageDice, rng).rolls];
      total = rolls.reduce((a, b) => a + b, 0) + enemy.attack.damageBonus;
      target.hp = Math.max(0, target.hp - total);
      next.log.push(`${enemy.name} hits ${target.name} with ${enemy.attack.name} for ${total} damage${isCrit ? ' (CRITICAL!)' : ''}.`);
      if (target.hp === 0) next.log.push(`${target.name} is down!`);
    } else {
      next.log.push(`${enemy.name} attacks ${target.name} but misses.`);
    }
    next.lastAttack = {
      kind: 'attack', attackerName: enemy.name, targetName: target.name, actionName: enemy.attack.name,
      targetId: target.id, d20, toHit: enemy.attack.toHit, ac: target.ac, hit, crit: isCrit,
      damageDice: enemy.attack.damageDice, damageRolls: rolls, damageBonus: enemy.attack.damageBonus, amount: total,
      mode, d20Rolls: mode ? d20Rolls : undefined,
    };
  }

  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
}
