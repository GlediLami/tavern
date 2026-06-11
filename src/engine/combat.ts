import type { Hero, Enemy, Ability, Combatant, CombatState, AttackEvent, EnemyIntent } from '../types';
import type { Rng } from './rng';
import { defaultRng } from './rng';
import { rollD20, rollDice, rollD20WithMode } from './dice';
import { abilityMod } from './skills';
import { sumRelicEffects } from './relics';

export const DEFAULT_ENEMY_DEX_SAVE = 1;
export const MARK_BONUS = 2;
export const TACTIC_USES = 2;

export interface ResolvedAttack {
  ability: Ability;
  damageDice: string;
  damageBonus: number;
  abilityScore: number;
  save?: Ability;       // if set, the attack is resolved as a target saving throw
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
    const eff = sumRelicEffects(h.relics ?? []);
    combatants.push({
      id: h.id, name: h.name, isHero: true, heroId: h.id,
      primaryAttack: h.attacks[0]?.name,
      maxHp: h.maxHp, hp: h.hp, ac: h.ac + (eff.acBonus ?? 0),
      initiative: rollD20(rng) + abilityMod(h.abilities.dex),
      backLine: !!h.attacks[0]?.ranged,
      relicDamage: eff.damageBonus,
      relicToHit: eff.attackBonus,
      bloodiedDamage: eff.bloodiedDamage,
      critHeal: eff.critHeal,
      damageReduction: eff.damageReduction,
      nextAttack: eff.firstStrikeAdvantage ? 'adv' : undefined,
    });
  }
  enemies.forEach((e, i) => {
    combatants.push({
      id: `enemy-${i}`, name: e.name, isHero: false,
      maxHp: e.maxHp, hp: e.maxHp, ac: e.ac,
      initiative: rollD20(rng) + 1,
      attack: e.attack,
      ability: e.ability,
      abilityUses: e.ability?.uses,
      dexSave: e.dexSave,
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
  if (state.tauntTargetId && state.order[next] === state.tauntTargetId) state.tauntTargetId = undefined;
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

  const toHitMod = abilityMod(stats.abilityScore) + 2 + (attacker.relicToHit ?? 0); // proficiency +2 at level 1
  const mode = opts.mode ?? attacker.nextAttack;
  attacker.nextAttack = undefined;

  if (stats.save) {
    const saveDC = 8 + 2 + abilityMod(stats.abilityScore); // 8 + proficiency + casting mod
    const saveBonus = stats.save === 'dex' ? (target.dexSave ?? DEFAULT_ENEMY_DEX_SAVE) : 0;
    const saveRoll = rollD20(rng);
    const saved = saveRoll + saveBonus >= saveDC;
    let saveRolls: number[] = [];
    let saveTotal = 0;
    const saveFlat = stats.damageBonus + (opts.bonusFlat ?? 0);
    if (!saved) {
      saveRolls = [...rollDice(stats.damageDice, rng).rolls];
      saveTotal = saveRolls.reduce((a, b) => a + b, 0) + saveFlat;
      target.hp = Math.max(0, target.hp - saveTotal);
      next.log.push(`${attacker.name} invokes ${attackName} — ${target.name} fails a DC ${saveDC} ${stats.save.toUpperCase()} save and takes ${saveTotal} damage.`);
      if (target.hp === 0) next.log.push(`${target.name} falls!`);
    } else {
      next.log.push(`${attacker.name} invokes ${attackName} — ${target.name} succeeds on a DC ${saveDC} ${stats.save.toUpperCase()} save and is unharmed.`);
    }
    return {
      kind: 'attack', attackerName: attacker.name, targetName: target.name, actionName: attackName,
      targetId, d20: saveRoll, toHit: saveBonus, ac: saveDC, hit: !saved, crit: false,
      save: stats.save, saveDC,
      damageDice: stats.damageDice, damageRolls: saveRolls, damageBonus: saveFlat, amount: saveTotal,
    };
  }

  const { value: d20, rolls: d20Rolls } = rollD20WithMode(rng, mode);
  const isCrit = d20 === 20;
  const hit = isCrit || (d20 !== 1 && d20 + toHitMod >= target.ac);

  let rolls: number[] = [];
  let total = 0;
  const bloodied = attacker.hp * 2 <= attacker.maxHp;
  const flat = stats.damageBonus + (opts.bonusFlat ?? 0) + (attacker.relicDamage ?? 0) + (bloodied ? (attacker.bloodiedDamage ?? 0) : 0) + (target.marked ? MARK_BONUS : 0);
  if (hit) {
    rolls = [...rollDice(stats.damageDice, rng).rolls];
    if (isCrit) rolls = [...rolls, ...rollDice(stats.damageDice, rng).rolls];
    if (opts.bonusDice) rolls = [...rolls, ...rollDice(opts.bonusDice, rng).rolls];
    total = rolls.reduce((a, b) => a + b, 0) + flat;
    target.hp = Math.max(0, target.hp - total);
    next.log.push(`${attacker.name} hits ${target.name} with ${attackName} for ${total} damage${isCrit ? ' (CRITICAL!)' : ''}.`);
    if (target.hp === 0) next.log.push(`${target.name} falls!`);
    if (isCrit && attacker.critHeal) attacker.hp = Math.min(attacker.maxHp, attacker.hp + attacker.critHeal);
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

export function performTaunt(state: CombatState, taunterId: string): CombatState {
  const next = clone(state);
  const taunter = next.combatants.find((c) => c.id === taunterId)!;
  next.tauntTargetId = taunterId;
  next.log.push(`${taunter.name} roars a challenge — the foes turn toward them!`);
  next.lastAttack = undefined;
  if (next.status === 'active') advanceTurn(next);
  return next;
}

export function performMark(state: CombatState, markerId: string, enemyId: string): CombatState {
  const next = clone(state);
  const marker = next.combatants.find((c) => c.id === markerId)!;
  const enemy = next.combatants.find((c) => c.id === enemyId);
  if (enemy) { enemy.marked = true; next.log.push(`${marker.name} marks ${enemy.name} — strike it down!`); }
  next.lastAttack = undefined;
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

export function avgDamage(dice: string, bonus: number): number {
  const m = /^\s*(\d+)d(\d+)/.exec(dice);
  if (!m) return bonus;
  return Math.round((parseInt(m[1], 10) * (parseInt(m[2], 10) + 1)) / 2) + bonus;
}

// Deterministic hero target: the taunter if alive, else the lowest-HP hero (ties -> turn order).
function pickHero(state: CombatState, candidates: Combatant[]): Combatant | undefined {
  if (candidates.length === 0) return undefined;
  if (state.tauntTargetId) {
    const t = candidates.find((h) => h.id === state.tauntTargetId);
    if (t) return t;
  }
  let best = candidates[0];
  let bestIdx = state.order.indexOf(best.id);
  for (const h of candidates) {
    const idx = state.order.indexOf(h.id);
    if (h.hp < best.hp || (h.hp === best.hp && idx < bestIdx)) { best = h; bestIdx = idx; }
  }
  return best;
}

// Pure: what this enemy will do on its turn (the telegraph), matching performEnemyTurn.
export function enemyIntent(state: CombatState, enemyId: string): EnemyIntent | undefined {
  const enemy = state.combatants.find((c) => c.id === enemyId);
  if (!enemy || enemy.hp <= 0) return undefined;
  if (enemy.ability && (enemy.abilityUses ?? 0) > 0) {
    if (enemy.ability.kind === 'buff') {
      const ally = state.combatants.find((c) => !c.isHero && c.hp > 0 && c.id !== enemy.id && c.nextAttack !== 'adv');
      if (ally) return { kind: 'buff', targetId: ally.id, label: enemy.ability.name };
    } else {
      const hero = pickHero(state, livingHeroes(state).filter((h) => h.nextAttack !== 'dis'));
      if (hero) return { kind: 'debuff', targetId: hero.id, label: enemy.ability.name };
    }
  }
  const target = pickHero(state, livingHeroes(state));
  if (!enemy.attack || !target) return undefined;
  return { kind: 'attack', targetId: target.id, estDamage: avgDamage(enemy.attack!.damageDice, enemy.attack!.damageBonus), label: enemy.attack!.name };
}

export function performEnemyTurn(state: CombatState, rng: Rng = defaultRng): CombatState {
  const next = clone(state);
  const enemy = next.combatants.find((c) => c.id === next.order[next.turnIndex])!;
  const intent = enemyIntent(next, enemy.id);

  if (intent?.kind === 'buff') {
    const ally = next.combatants.find((c) => c.id === intent.targetId)!;
    ally.nextAttack = 'adv';
    enemy.abilityUses = (enemy.abilityUses ?? 0) - 1;
    next.log.push(`${enemy.name} uses ${enemy.ability!.name} — ${ally.name} attacks with advantage.`);
    next.lastAttack = undefined;
  } else if (intent?.kind === 'debuff') {
    const hero = next.combatants.find((c) => c.id === intent.targetId)!;
    hero.nextAttack = 'dis';
    enemy.abilityUses = (enemy.abilityUses ?? 0) - 1;
    next.log.push(`${enemy.name} uses ${enemy.ability!.name} — ${hero.name} attacks with disadvantage.`);
    next.lastAttack = undefined;
  } else if (intent?.kind === 'attack') {
    const target = next.combatants.find((c) => c.id === intent.targetId)!;
    const frontLineAlive = next.combatants.some((c) => c.isHero && c.hp > 0 && !c.backLine);
    const covered = !!target.backLine && frontLineAlive;
    const hasAdv = enemy.nextAttack === 'adv';
    const hasDis = enemy.nextAttack === 'dis' || covered;
    let mode: 'adv' | 'dis' | undefined;
    if (hasAdv && hasDis) mode = undefined;
    else if (hasAdv) mode = 'adv';
    else if (hasDis) mode = 'dis';
    enemy.nextAttack = undefined;
    if (covered && mode === 'dis') next.log.push(`${target.name} fights from cover — ${enemy.name} attacks at disadvantage.`);
    const { value: d20, rolls: d20Rolls } = rollD20WithMode(rng, mode);
    const isCrit = d20 === 20;
    const hit = isCrit || (d20 !== 1 && d20 + enemy.attack!.toHit >= target.ac);
    let rolls: number[] = [];
    let total = 0;
    if (hit) {
      const dmg = rollDice(enemy.attack!.damageDice, rng, enemy.attack!.damageBonus);
      rolls = [...dmg.rolls];
      if (isCrit) rolls = [...rolls, ...rollDice(enemy.attack!.damageDice, rng).rolls];
      total = rolls.reduce((a, b) => a + b, 0) + enemy.attack!.damageBonus;
      total = Math.max(0, total - (target.damageReduction ?? 0));
      target.hp = Math.max(0, target.hp - total);
      next.log.push(`${enemy.name} hits ${target.name} with ${enemy.attack!.name} for ${total} damage${isCrit ? ' (CRITICAL!)' : ''}.`);
      if (target.hp === 0) next.log.push(`${target.name} is down!`);
    } else {
      next.log.push(`${enemy.name} attacks ${target.name} but misses.`);
    }
    next.lastAttack = {
      kind: 'attack', attackerName: enemy.name, targetName: target.name, actionName: enemy.attack!.name,
      targetId: target.id, d20, toHit: enemy.attack!.toHit, ac: target.ac, hit, crit: isCrit,
      damageDice: enemy.attack!.damageDice, damageRolls: rolls, damageBonus: enemy.attack!.damageBonus, amount: total,
      mode, d20Rolls: mode ? d20Rolls : undefined,
    };
  }

  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
}
