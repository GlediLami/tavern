import type { Hero, Enemy, Ability, Combatant, CombatState } from '../types';
import type { Rng } from './rng';
import { defaultRng } from './rng';
import { rollD20, rollDice } from './dice';
import { abilityMod } from './skills';

export interface ResolvedAttack {
  ability: Ability;
  damageDice: string;
  damageBonus: number;
  abilityScore: number;
}

export type HeroAttackLookup = (heroId: string, attackName: string) => ResolvedAttack;

function clone(state: CombatState): CombatState {
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
function advanceTurn(state: CombatState): void {
  let next = state.turnIndex;
  for (let i = 0; i < state.order.length; i++) {
    next = (next + 1) % state.order.length;
    if (next === 0) state.round += 1;
    const c = state.combatants.find((x) => x.id === state.order[next])!;
    if (c.hp > 0) break;
  }
  state.turnIndex = next;
}

function checkStatus(state: CombatState): void {
  if (livingEnemies(state).length === 0) state.status = 'victory';
  else if (livingHeroes(state).length === 0) state.status = 'defeat';
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
  const attacker = next.combatants.find((c) => c.id === heroId)!;
  const target = next.combatants.find((c) => c.id === targetId)!;

  // Resolve attack stats. If no lookup provided, fall back to a generic +5 to hit / 1d8+3.
  const stats: ResolvedAttack = heroAttackLookup
    ? heroAttackLookup(heroId, attackName)
    : { ability: 'str', damageDice: '1d8', damageBonus: 3, abilityScore: 16 };

  const toHitMod = abilityMod(stats.abilityScore) + 2; // proficiency +2 at level 1
  const d20 = rollD20(rng);
  const isCrit = d20 === 20;
  const hit = isCrit || (d20 !== 1 && d20 + toHitMod >= target.ac);

  if (hit) {
    const dmg = rollDice(stats.damageDice, rng, stats.damageBonus);
    const critDmg = isCrit ? rollDice(stats.damageDice, rng).rolls.reduce((a, b) => a + b, 0) : 0;
    const total = dmg.total + critDmg;
    target.hp = Math.max(0, target.hp - total);
    next.log.push(`${attacker.name} hits ${target.name} with ${attackName} for ${total} damage${isCrit ? ' (CRITICAL!)' : ''}.`);
    if (target.hp === 0) next.log.push(`${target.name} falls!`);
  } else {
    next.log.push(`${attacker.name} attacks ${target.name} with ${attackName} but misses.`);
  }

  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
}

export function performEnemyTurn(state: CombatState, rng: Rng = defaultRng): CombatState {
  const next = clone(state);
  const enemy = next.combatants.find((c) => c.id === next.order[next.turnIndex])!;
  const targets = livingHeroes(next);

  if (enemy.attack && targets.length > 0) {
    const target = targets[Math.floor(rng() * targets.length)];
    const d20 = rollD20(rng);
    const isCrit = d20 === 20;
    const hit = isCrit || (d20 !== 1 && d20 + enemy.attack.toHit >= target.ac);
    if (hit) {
      const dmg = rollDice(enemy.attack.damageDice, rng, enemy.attack.damageBonus);
      const critDmg = isCrit ? rollDice(enemy.attack.damageDice, rng).rolls.reduce((a, b) => a + b, 0) : 0;
      const total = dmg.total + critDmg;
      target.hp = Math.max(0, target.hp - total);
      next.log.push(`${enemy.name} hits ${target.name} with ${enemy.attack.name} for ${total} damage${isCrit ? ' (CRITICAL!)' : ''}.`);
      if (target.hp === 0) next.log.push(`${target.name} is down!`);
    } else {
      next.log.push(`${enemy.name} attacks ${target.name} but misses.`);
    }
  }

  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
}
