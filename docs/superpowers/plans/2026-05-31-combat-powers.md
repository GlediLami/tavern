# Combat Powers + Advantage/Disadvantage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each of the 12 hero classes one signature per-encounter "power" and add an advantage/disadvantage dice mechanic, so classes play differently in combat.

**Architecture:** A new pure `powers.ts` engine module holds a data registry of powers and an `applyPower` resolver that reuses shared attack/heal helpers factored out of `combat.ts`. The only new persistent combat state is a one-shot `nextAttack: 'adv' | 'dis'` flag per combatant, consumed on the next attack roll. The UI generalizes the current Cleric-heal flow into a power button + targeting.

**Tech Stack:** React + Vite + TypeScript, Vitest. No new dependencies.

---

## File structure

- `src/types.ts` — add `Power`/`PowerKind`/`PowerTargeting`/`AdvMode`; `Combatant.nextAttack`; `AttackEvent.mode`/`d20Rolls`; `Character.powerId`.
- `src/engine/dice.ts` — add `rollD20WithMode`.
- `src/engine/combat.ts` — export `clone`/`checkStatus`/`advanceTurn`; add `applyAttack`/`applyHeal`; route `nextAttack` + advantage into hero & enemy attacks.
- `src/engine/powers.ts` (new) — `POWERS` registry, `getPower`, `applyPower`.
- `src/content/characters.json` — add `powerId` to each hero.
- `src/components/CombatView.tsx` — power button + targeting + adv/dis badges (replaces the bespoke Cleric-heal flow).
- `src/components/CombatDice.tsx` — show advantage/disadvantage + both d20s.

---

## Task 1: Domain types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add the advantage flag and attack-event fields**

In `src/types.ts`, add to the `Combatant` interface a new optional field:

```ts
  nextAttack?: 'adv' | 'dis';   // one-shot advantage/disadvantage on this combatant's next attack
```

In the `AttackEvent` interface, add two optional fields (after `crit`):

```ts
  mode?: 'adv' | 'dis';   // advantage/disadvantage applied to the attack roll, if any
  d20Rolls?: number[];    // both raw d20s when rolled with advantage/disadvantage
```

- [ ] **Step 2: Add the power types and the character reference**

Append to `src/types.ts`:

```ts
export type AdvMode = 'adv' | 'dis';

export type PowerTargeting = 'self' | 'ally' | 'enemy' | 'all-enemies';

export type PowerKind =
  | 'bonus-attack'         // a weapon attack with extra damage dice / flat / advantage
  | 'multi-attack'         // N weapon attacks against the chosen target this turn
  | 'aoe-attack'           // a weapon attack roll against every living enemy
  | 'aoe-damage'           // fixed rolled damage to every living enemy (auto-hit)
  | 'single-damage'        // fixed rolled damage to one enemy (auto-hit)
  | 'heal'                 // restore HP to one ally/self
  | 'grant-advantage'      // set nextAttack='adv' on self or an ally
  | 'impose-disadvantage'; // set nextAttack='dis' on a target or all enemies

export interface Power {
  id: string;
  name: string;
  description: string;
  kind: PowerKind;
  targeting: PowerTargeting;
  uses: number;
  bonusDice?: string;        // bonus-attack extra damage dice, e.g. "2d6"
  bonusDamageFlat?: number;  // bonus-attack flat extra damage
  withAdvantage?: boolean;   // bonus-attack rolls with advantage
  attacks?: number;          // multi-attack count (default 2)
  damageDice?: string;       // aoe-damage / single-damage dice, e.g. "2d6"
  alsoDisadvantage?: boolean;// aoe-damage also imposes disadvantage on all enemies
  healDice?: string;         // heal dice, e.g. "1d8"
  healBonus?: number;        // heal flat bonus
}
```

Add to the `Character` interface:

```ts
  powerId?: string;   // references a Power in the powers registry
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add power + advantage types"
```

---

## Task 2: Advantage-aware d20 roll

**Files:**
- Modify: `src/engine/dice.ts`
- Test: `src/engine/dice.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/dice.test.ts` (inside the existing top-level `describe('dice', ...)` block, before its closing `});`):

```ts
  it('rollD20WithMode: no mode returns one die', () => {
    const r = makeRng(5);
    const res = rollD20WithMode(r);
    expect(res.rolls).toHaveLength(1);
    expect(res.value).toBe(res.rolls[0]);
  });

  it('rollD20WithMode: advantage takes the higher of two', () => {
    // first two d20 from this seed:
    const probe = makeRng(99);
    const a = rollDie(20, probe);
    const b = rollDie(20, probe);
    const res = rollD20WithMode(makeRng(99), 'adv');
    expect(res.rolls).toEqual([a, b]);
    expect(res.value).toBe(Math.max(a, b));
  });

  it('rollD20WithMode: disadvantage takes the lower of two', () => {
    const probe = makeRng(99);
    const a = rollDie(20, probe);
    const b = rollDie(20, probe);
    const res = rollD20WithMode(makeRng(99), 'dis');
    expect(res.value).toBe(Math.min(a, b));
  });
```

Add `rollD20WithMode` to the import at the top of the file:

```ts
import { rollDie, rollD20, rollDice, rollD20WithMode } from './dice';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dice`
Expected: FAIL ("rollD20WithMode is not a function").

- [ ] **Step 3: Implement `rollD20WithMode` in `src/engine/dice.ts`**

Add after the existing `rollD20` function:

```ts
// Roll a d20 with optional advantage ('adv' = higher of two) or disadvantage
// ('dis' = lower of two). Returns the chosen value and the raw dice rolled.
export function rollD20WithMode(rng: Rng = defaultRng, mode?: 'adv' | 'dis'): { value: number; rolls: number[] } {
  if (!mode) {
    const v = rollDie(20, rng);
    return { value: v, rolls: [v] };
  }
  const a = rollDie(20, rng);
  const b = rollDie(20, rng);
  const value = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
  return { value, rolls: [a, b] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dice`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/dice.ts src/engine/dice.test.ts
git commit -m "feat: advantage/disadvantage d20 roll"
```

---

## Task 3: Refactor combat.ts to shared helpers + advantage

**Files:**
- Modify: `src/engine/combat.ts`
- Test: `src/engine/combat.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/combat.test.ts` (before the final closing `});` of the top-level `describe('combat', ...)`):

```ts
  it('applyAttack adds bonus damage dice and clears the attacker advantage flag', () => {
    let st = startCombat([makeHero('h1', 10)], [goblin], hit);
    const attacker = st.combatants.find((c) => c.id === 'h1')!;
    attacker.nextAttack = 'adv';
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit, undefined, { bonusDice: '2d6' });
    // 1d8(8)+3 base, +2d6(12) bonus, max rolls -> 8+12+3 = 23
    expect(ev.amount).toBe(23);
    expect(ev.mode).toBe('adv');                 // used the flag
    expect(attacker.nextAttack).toBeUndefined(); // flag consumed
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
    let st = startCombat([makeHero('h1', 10, 6)], [goblin], hit); // hp 6 / max 6? makeHero hp=max
    const h = st.combatants.find((c) => c.id === 'h1')!;
    h.hp = 2;
    const ev = applyHeal(st, 'h1', 'h1', '1d8', 3, 'Cure Wounds', hit);
    expect(ev.kind).toBe('heal');
    expect(h.hp).toBeLessThanOrEqual(h.maxHp);
    expect(h.hp).toBeGreaterThan(2);
  });
```

Update the import at the top of `src/engine/combat.test.ts`:

```ts
import { startCombat, performHeroAttack, performHeroHeal, performEnemyTurn, currentCombatant, applyAttack, applyHeal } from './combat';
```

(Note: `makeHero('h1', 10, 6)` — the third arg is hp, which also sets maxHp in the helper; the test then lowers hp to 2 before healing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- combat`
Expected: FAIL (`applyAttack`/`applyHeal` not exported).

- [ ] **Step 3: Replace `src/engine/combat.ts` with the refactored version**

Replace the entire file contents with:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- combat`
Expected: PASS (all existing combat tests plus the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/engine/combat.ts src/engine/combat.test.ts
git commit -m "refactor: factor applyAttack/applyHeal, route advantage flag"
```

---

## Task 4: Powers registry + applyPower

**Files:**
- Create: `src/engine/powers.ts`
- Test: `src/engine/powers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/powers.test.ts`:

```ts
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
  it('registry covers the expected ids', () => {
    ['action-surge','reckless-strike','sneak-attack','flurry-of-blows','divine-smite','volley','cure-wounds','entangle','burning-hands','chaos-bolt','arms-of-hadar','bardic-inspiration']
      .forEach((id) => expect(POWERS[id]).toBeDefined());
    expect(() => getPower('nope')).toThrow();
  });

  it('bonus-attack (sneak-attack) adds extra dice', () => {
    const st = applyPower(start(), 'h1', 'sneak-attack', ['enemy-0'], hit, lookup);
    // 1d8(8)+3 +2d6(12) = 23
    expect(st.lastAttack?.amount).toBe(23);
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
    expect(e0.maxHp - e0.hp).toBeGreaterThan(7); // two 1d8+3 hits exceed one
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- powers`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/engine/powers.ts`**

```ts
import type { CombatState, AttackEvent, Power } from '../types';
import type { Rng } from './rng';
import { defaultRng } from './rng';
import { rollDice } from './dice';
import { clone, checkStatus, advanceTurn, applyAttack, applyHeal, type HeroAttackLookup } from './combat';
import { getCharacter } from './party';

export const POWERS: Record<string, Power> = {
  'action-surge': { id: 'action-surge', name: 'Action Surge', description: 'Make two weapon attacks against one foe.', kind: 'multi-attack', targeting: 'enemy', uses: 1, attacks: 2 },
  'reckless-strike': { id: 'reckless-strike', name: 'Reckless Strike', description: 'A furious attack with advantage and +2 damage.', kind: 'bonus-attack', targeting: 'enemy', uses: 2, withAdvantage: true, bonusDamageFlat: 2 },
  'sneak-attack': { id: 'sneak-attack', name: 'Sneak Attack', description: 'A precise strike dealing +2d6 damage.', kind: 'bonus-attack', targeting: 'enemy', uses: 2, bonusDice: '2d6' },
  'flurry-of-blows': { id: 'flurry-of-blows', name: 'Flurry of Blows', description: 'Two rapid unarmed strikes against one foe.', kind: 'multi-attack', targeting: 'enemy', uses: 2, attacks: 2 },
  'divine-smite': { id: 'divine-smite', name: 'Divine Smite', description: 'A radiant strike dealing +2d8 damage.', kind: 'bonus-attack', targeting: 'enemy', uses: 2, bonusDice: '2d8' },
  'volley': { id: 'volley', name: 'Volley', description: 'Loose an arrow at every enemy.', kind: 'aoe-attack', targeting: 'all-enemies', uses: 1 },
  'cure-wounds': { id: 'cure-wounds', name: 'Cure Wounds', description: 'Heal an ally for 1d8+3.', kind: 'heal', targeting: 'ally', uses: 2, healDice: '1d8', healBonus: 3 },
  'entangle': { id: 'entangle', name: 'Entangle', description: 'Vines grip all enemies — they attack with disadvantage next.', kind: 'impose-disadvantage', targeting: 'all-enemies', uses: 1 },
  'burning-hands': { id: 'burning-hands', name: 'Burning Hands', description: 'A fan of flame: every enemy takes 2d6 fire.', kind: 'aoe-damage', targeting: 'all-enemies', uses: 1, damageDice: '2d6' },
  'chaos-bolt': { id: 'chaos-bolt', name: 'Chaos Bolt', description: 'Hurl raw chaos at one foe for 3d6.', kind: 'single-damage', targeting: 'enemy', uses: 2, damageDice: '3d6' },
  'arms-of-hadar': { id: 'arms-of-hadar', name: 'Arms of Hadar', description: 'Dark tendrils: all enemies take 2d6 and attack with disadvantage.', kind: 'aoe-damage', targeting: 'all-enemies', uses: 1, damageDice: '2d6', alsoDisadvantage: true },
  'bardic-inspiration': { id: 'bardic-inspiration', name: 'Bardic Inspiration', description: "Inspire an ally — their next attack has advantage.", kind: 'grant-advantage', targeting: 'ally', uses: 3 },
};

export function getPower(id: string): Power {
  const p = POWERS[id];
  if (!p) throw new Error(`Unknown power: "${id}"`);
  return p;
}

function livingEnemyIds(state: CombatState): string[] {
  return state.combatants.filter((c) => !c.isHero && c.hp > 0).map((c) => c.id);
}
function primaryAttackName(heroId: string): string {
  return getCharacter(heroId).attacks[0].name;
}

// Resolve a power, returning a new CombatState. UI tracks per-power uses.
export function applyPower(
  state: CombatState,
  casterId: string,
  powerId: string,
  targetIds: string[],
  rng: Rng = defaultRng,
  lookup?: HeroAttackLookup,
): CombatState {
  const next = clone(state);
  const power = getPower(powerId);
  const caster = next.combatants.find((c) => c.id === casterId)!;
  const atkName = primaryAttackName(casterId);

  switch (power.kind) {
    case 'bonus-attack':
      next.lastAttack = applyAttack(next, casterId, atkName, targetIds[0], rng, lookup, {
        mode: power.withAdvantage ? 'adv' : undefined,
        bonusDice: power.bonusDice,
        bonusFlat: power.bonusDamageFlat,
      });
      break;

    case 'multi-attack': {
      const n = power.attacks ?? 2;
      let last: AttackEvent | undefined;
      for (let i = 0; i < n; i++) {
        const t = next.combatants.find((c) => c.id === targetIds[0]);
        if (t && t.hp > 0) last = applyAttack(next, casterId, atkName, targetIds[0], rng, lookup);
      }
      next.lastAttack = last;
      break;
    }

    case 'aoe-attack': {
      let last: AttackEvent | undefined;
      for (const id of livingEnemyIds(next)) last = applyAttack(next, casterId, atkName, id, rng, lookup);
      next.lastAttack = last;
      break;
    }

    case 'aoe-damage': {
      const roll = rollDice(power.damageDice!, rng);
      const ids = livingEnemyIds(next);
      for (const id of ids) {
        const e = next.combatants.find((c) => c.id === id)!;
        e.hp = Math.max(0, e.hp - roll.total);
        if (power.alsoDisadvantage) e.nextAttack = 'dis';
      }
      next.log.push(`${caster.name} unleashes ${power.name} — every foe takes ${roll.total} damage${power.alsoDisadvantage ? ' and reels (disadvantage)' : ''}.`);
      next.lastAttack = {
        kind: 'attack', attackerName: caster.name, targetName: 'all foes', actionName: power.name,
        targetId: ids[0] ?? casterId, hit: true, crit: false,
        damageDice: power.damageDice!, damageRolls: roll.rolls, damageBonus: 0, amount: roll.total,
      };
      break;
    }

    case 'single-damage': {
      const roll = rollDice(power.damageDice!, rng);
      const t = next.combatants.find((c) => c.id === targetIds[0])!;
      t.hp = Math.max(0, t.hp - roll.total);
      next.log.push(`${caster.name} blasts ${t.name} with ${power.name} for ${roll.total} damage.`);
      if (t.hp === 0) next.log.push(`${t.name} falls!`);
      next.lastAttack = {
        kind: 'attack', attackerName: caster.name, targetName: t.name, actionName: power.name,
        targetId: t.id, hit: true, crit: false,
        damageDice: power.damageDice!, damageRolls: roll.rolls, damageBonus: 0, amount: roll.total,
      };
      break;
    }

    case 'heal':
      next.lastAttack = applyHeal(next, casterId, targetIds[0], power.healDice!, power.healBonus ?? 0, power.name, rng);
      break;

    case 'grant-advantage': {
      const t = next.combatants.find((c) => c.id === targetIds[0])!;
      t.nextAttack = 'adv';
      next.log.push(`${caster.name} uses ${power.name} — ${t.name}'s next attack has advantage.`);
      next.lastAttack = undefined;
      break;
    }

    case 'impose-disadvantage': {
      const ids = power.targeting === 'all-enemies' ? livingEnemyIds(next) : [targetIds[0]];
      for (const id of ids) {
        const c = next.combatants.find((x) => x.id === id)!;
        c.nextAttack = 'dis';
      }
      next.log.push(`${caster.name} uses ${power.name} — ${ids.length > 1 ? 'all foes' : 'the target'} attack with disadvantage.`);
      next.lastAttack = undefined;
      break;
    }
  }

  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- powers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/powers.ts src/engine/powers.test.ts
git commit -m "feat: add class powers registry and resolver"
```

---

## Task 5: Assign powers to characters

**Files:**
- Modify: `src/content/characters.json`
- Test: `src/content/characters.test.ts`

- [ ] **Step 1: Add `"powerId"` to each hero in `src/content/characters.json`**

Add the field (anywhere inside each hero object, e.g. right after `"proficiencyBonus": 2,`) using this mapping:

```
bjorn-ironhelm        -> "action-surge"
sable-quickfinger     -> "sneak-attack"
mara-dawnwarden       -> "cure-wounds"
alaric-vance          -> "burning-hands"
thornwick-greenstride -> "volley"
gronk-skullsplitter   -> "reckless-strike"
lyra-brightshield     -> "divine-smite"
kaito-stillwater      -> "flurry-of-blows"
fennel-quill          -> "bardic-inspiration"
rowan-mossheart       -> "entangle"
ignis-emberfell       -> "chaos-bolt"
vesper-nightvow       -> "arms-of-hadar"
```

For example, Bjorn becomes:

```json
    "proficiencyBonus": 2,
    "powerId": "action-surge",
```

- [ ] **Step 2: Add a validation test**

Append to `src/content/characters.test.ts` (before the final closing `});`):

```ts
  it('every hero has a powerId that exists in the registry', async () => {
    const { POWERS } = await import('../engine/powers');
    for (const c of characters) {
      expect(c.powerId, `${c.id} missing powerId`).toBeTruthy();
      expect(POWERS[c.powerId!], `${c.id} -> unknown power ${c.powerId}`).toBeDefined();
    }
  });
```

- [ ] **Step 3: Run the test**

Run: `npm test -- characters`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/content/characters.json src/content/characters.test.ts
git commit -m "feat: assign a signature power to each hero"
```

---

## Task 6: CombatView UI — power button, targeting, adv/dis

**Files:**
- Modify: `src/components/CombatView.tsx`
- Modify: `src/components/CombatDice.tsx`

This generalizes the existing Cleric-only heal flow into a power flow for every class. The Cleric's power (`cure-wounds`) flows through the same path.

- [ ] **Step 1: Show advantage/disadvantage in the dice readout**

In `src/components/CombatDice.tsx`, replace the attack-roll block (the `{!isHeal && event.d20 !== undefined && ( ... )}` element) with one that shows the mode and both dice:

```tsx
      {!isHeal && event.d20 !== undefined && (
        <div className="cd-roll">
          <span className={`cd-d20${event.crit ? ' crit' : ''}${event.d20 === 1 ? ' fumble' : ''}`}>{event.d20}</span>
          <span className="cd-math">
            {event.mode && event.d20Rolls
              ? <span className="cd-adv">{event.mode === 'adv' ? 'advantage' : 'disadvantage'} ({event.d20Rolls.join(', ')}) → </span>
              : null}
            d20 {event.d20} {fmt(event.toHit ?? 0)} = <strong>{event.d20 + (event.toHit ?? 0)}</strong> vs AC {event.ac}
          </span>
          <span className={`cd-result ${event.hit ? 'hit' : 'miss'}`}>
            {event.crit ? 'CRIT!' : event.hit ? 'HIT' : 'MISS'}
          </span>
        </div>
      )}
```

Add a style for `.cd-adv` to `src/styles/theme.css` (next to the other `.cd-*` rules):

```css
.cd-adv { color: var(--gold); font-weight: 600; }
```

- [ ] **Step 2: Replace `src/components/CombatView.tsx`**

Replace the entire file with the version below. Changes vs. the current file: imports `applyPower`/`getPower`; `powerUses` keyed per hero seeded from each hero's own power; a generic power button + targeting (`self`/`ally`/`enemy`/`all-enemies`); adv/dis badge on combatants; removes the Cleric-specific heal code and the `config` import.

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../state/GameContext';
import { getScene } from '../engine/story';
import { getAdventure, getCharacter, toHero, makeHeroAttackLookup } from '../engine/party';
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant } from '../engine/combat';
import { applyPower, getPower } from '../engine/powers';
import { scaleEnemies, restHp, effectiveMaxHp } from '../engine/difficulty';
import { defaultRng } from '../engine/rng';
import { hpColor } from '../ui/visuals';
import { sfx } from '../ui/sfx';
import type { CombatState, Power } from '../types';
import { CombatDice } from './CombatDice';

interface Flash { id: string; amount: number; heal: boolean; nonce: number; }

export function CombatView() {
  const { state, dispatch } = useGame();
  const adventure = getAdventure(state.adventureId);
  const scene = getScene(adventure, state.sceneId);

  const lookup = useMemo(() => makeHeroAttackLookup(state.partyIds), [state.partyIds]);

  const [combat, setCombat] = useState<CombatState>(() => {
    if (scene.type !== 'combat') throw new Error('CombatView requires a combat scene');
    const heroes = state.partyIds.map((id) => {
      const c = getCharacter(id);
      return toHero(id, state.hp[id] ?? effectiveMaxHp(c, state.difficulty));
    });
    heroes.forEach((h) => { h.maxHp = effectiveMaxHp(getCharacter(h.id), state.difficulty); });
    const enemies = scaleEnemies(scene.enemies, state.difficulty, state.partyIds.length);
    return startCombat(heroes, enemies, defaultRng);
  });

  const [target, setTarget] = useState<string | null>(null);
  // when a power needs a target, we stash it here and enter a targeting mode
  const [pendingPower, setPendingPower] = useState<Power | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Per-hero remaining uses of that hero's own power.
  const [powerUses, setPowerUses] = useState<Record<string, number>>(() => {
    const u: Record<string, number> = {};
    state.partyIds.forEach((id) => {
      const pid = getCharacter(id).powerId;
      if (pid) u[id] = getPower(pid).uses;
    });
    return u;
  });

  if (scene.type !== 'combat') return null;

  const actor = currentCombatant(combat);
  const livingEnemies = combat.combatants.filter((c) => !c.isHero && c.hp > 0);
  const heroChar = actor.isHero ? getCharacter(actor.heroId!) : null;
  const power = heroChar?.powerId ? getPower(heroChar.powerId) : null;
  const usesLeft = power ? (powerUses[actor.id] ?? 0) : 0;

  function applyResult(next: CombatState) {
    const ev = next.lastAttack;
    if (ev && ev.amount > 0) {
      if (ev.kind === 'heal') sfx.click(); else sfx.hit();
      setFlash({ id: ev.targetId, amount: ev.amount, heal: ev.kind === 'heal', nonce: Date.now() });
      setTimeout(() => { if (mounted.current) setFlash(null); }, 850);
    }
    setCombat(next);

    const hp: Record<string, number> = {};
    next.combatants.filter((c) => c.isHero).forEach((c) => { hp[c.heroId!] = c.hp; });
    dispatch({ type: 'SET_HP', hp });

    if (next.status !== 'active' && scene.type === 'combat') {
      next.log.forEach((entry) => dispatch({ type: 'LOG', entry }));
      if (next.status === 'victory') {
        const healed: Record<string, number> = {};
        next.combatants.filter((c) => c.isHero).forEach((c) => {
          healed[c.heroId!] = restHp(c.hp, c.maxHp, state.difficulty);
        });
        dispatch({ type: 'SET_HP', hp: healed });
        const gained = Object.keys(healed).some((id) => healed[id] > (hp[id] ?? 0));
        if (gained) dispatch({ type: 'LOG', entry: 'The party catches their breath and binds their wounds.' });
        setTimeout(() => dispatch({ type: 'GOTO_SCENE', sceneId: scene.onVictory }), 700);
      } else {
        setTimeout(() => dispatch({ type: 'GOTO_SCENE', sceneId: scene.onDefeat }), 700);
      }
    }
  }

  function heroAttack(attackName: string) {
    if (!target) return;
    sfx.click();
    applyResult(performHeroAttack(combat, actor.id, attackName, target, defaultRng, lookup));
    setTarget(null);
  }

  function resolvePower(targetIds: string[]) {
    if (!power) return;
    sfx.click();
    setPowerUses((u) => ({ ...u, [actor.id]: (u[actor.id] ?? 0) - 1 }));
    setPendingPower(null);
    setTarget(null);
    applyResult(applyPower(combat, actor.id, power.id, targetIds, defaultRng, lookup));
  }

  function choosePower() {
    if (!power) return;
    sfx.click();
    // No-target powers resolve immediately.
    if (power.targeting === 'self') { resolvePower([actor.id]); return; }
    if (power.targeting === 'all-enemies') { resolvePower([]); return; }
    setPendingPower(power); // ally / enemy: enter targeting mode
  }

  function enemyContinue() {
    applyResult(performEnemyTurn(combat, defaultRng));
  }

  const selectingEnemy = pendingPower?.targeting === 'enemy';
  const selectingAlly = pendingPower?.targeting === 'ally';

  function badge(c: { nextAttack?: 'adv' | 'dis' }) {
    if (c.nextAttack === 'adv') return <span className="adv-badge adv" title="Advantage on next attack">⬆</span>;
    if (c.nextAttack === 'dis') return <span className="adv-badge dis" title="Disadvantage on next attack">⬇</span>;
    return null;
  }

  return (
    <div className="app-shell screen">
      <h2 className="display danger-title" style={{ fontSize: '1.7rem' }}>⚔ {scene.title}</h2>
      <div className="rule-accent danger" />
      <p style={{ lineHeight: 1.7, fontSize: '1.08rem' }}>{scene.narration}</p>

      <div className="game-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Foes</h3>
          <div className="stack">
            {combat.combatants.filter((c) => !c.isHero).map((e) => {
              const isFlash = flash?.id === e.id;
              const selectable = e.hp > 0 && actor.isHero && (target !== null || selectingEnemy || (!pendingPower)) && (selectingEnemy || !pendingPower);
              return (
                <button
                  key={e.id}
                  className={`panel combatant${isFlash ? (flash!.heal ? ' heal' : ' hit') : ''}${target === e.id ? ' active-turn' : ''}`}
                  disabled={!(e.hp > 0 && actor.isHero && (!pendingPower || selectingEnemy))}
                  onClick={() => { sfx.click(); if (selectingEnemy) resolvePower([e.id]); else setTarget(e.id); }}
                  style={{ position: 'relative', textAlign: 'left', cursor: e.hp > 0 && actor.isHero ? 'pointer' : 'default', opacity: e.hp <= 0 ? 0.4 : 1, padding: 14 }}
                >
                  {isFlash && <span key={flash!.nonce} className={`dmg-float${flash!.heal ? ' heal' : ''}`}>{flash!.heal ? '+' : '-'}{flash!.amount}</span>}
                  <strong style={{ fontWeight: 600 }}>{e.name} {badge(e)}</strong>
                  {e.hp <= 0 && <span className="faint"> — slain</span>}
                  <div className="hp-bar" style={{ marginTop: 8 }} role="progressbar" aria-label={`${e.name} hit points`} aria-valuenow={e.hp} aria-valuemin={0} aria-valuemax={e.maxHp}>
                    <div className="hp-fill" style={{ width: `${(e.hp / Math.max(1, e.maxHp)) * 100}%`, background: hpColor(e.hp / Math.max(1, e.maxHp)) }} />
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 5, fontSize: '0.82rem' }}>
                    <span className="muted">{e.hp}/{e.maxHp} HP</span>
                    <span className="tag">AC {e.ac}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '0.95rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>The Party</h3>
          <div className="stack">
            {combat.combatants.filter((c) => c.isHero).map((h) => {
              const isFlash = flash?.id === h.id;
              const allyTargetable = selectingAlly && h.hp > 0;
              return (
                <button
                  key={h.id}
                  className={`panel combatant${isFlash ? (flash!.heal ? ' heal' : ' hit') : ''}${actor.id === h.id ? ' active-turn' : ''}`}
                  disabled={!allyTargetable}
                  onClick={() => allyTargetable && resolvePower([h.id])}
                  style={{ position: 'relative', textAlign: 'left', width: '100%', opacity: h.hp <= 0 ? 0.45 : 1, padding: 14, cursor: allyTargetable ? 'pointer' : 'default' }}
                >
                  {isFlash && <span key={flash!.nonce} className={`dmg-float${flash!.heal ? ' heal' : ''}`}>{flash!.heal ? '+' : '-'}{flash!.amount}</span>}
                  <strong style={{ fontWeight: 600 }}>{getCharacter(h.heroId!).portrait} {h.name} {badge(h)}</strong>
                  {h.hp <= 0 && <span style={{ color: 'var(--accent-bright)' }}> — down</span>}
                  <div className="hp-bar" style={{ marginTop: 8 }} role="progressbar" aria-label={`${h.name} hit points`} aria-valuenow={h.hp} aria-valuemin={0} aria-valuemax={h.maxHp}>
                    <div className="hp-fill" style={{ width: `${(h.hp / Math.max(1, h.maxHp)) * 100}%`, background: hpColor(h.hp / Math.max(1, h.maxHp)) }} />
                  </div>
                  <div className="muted" style={{ fontSize: '0.82rem', marginTop: 5 }}>{h.hp}/{h.maxHp} HP</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {combat.lastAttack && (
        <div style={{ marginTop: 16 }}>
          <CombatDice event={combat.lastAttack} />
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <p style={{ marginTop: 0 }}>
          <span className="tag" style={{ marginRight: 8 }}>Round {combat.round}</span>
          <strong className="accent-text">{actor.name}</strong>’s turn
        </p>
        {actor.isHero && heroChar ? (
          pendingPower ? (
            <>
              <p className="muted" style={{ marginTop: 4 }}>
                {selectingAlly ? `Choose an ally for ${pendingPower.name}.` : `Choose a foe for ${pendingPower.name}.`}
              </p>
              <button className="btn" onClick={() => { sfx.click(); setPendingPower(null); }}>← Cancel</button>
            </>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 4 }}>
                {target ? `Striking ${combat.combatants.find((c) => c.id === target)?.name}` : 'Choose a foe, then your attack — or use your power.'}
              </p>
              <div className="row">
                {heroChar.attacks.map((a) => (
                  <button key={a.name} className="btn btn-primary" disabled={!target || livingEnemies.length === 0} onClick={() => heroAttack(a.name)}>
                    {a.name} <span style={{ opacity: 0.7 }}>({a.damageDice}{a.damageBonus ? `+${a.damageBonus}` : ''})</span>
                  </button>
                ))}
                {power && (
                  <button className="btn btn-power" disabled={usesLeft <= 0} title={power.description} onClick={choosePower}>
                    ✦ {power.name} <span style={{ opacity: 0.7 }}>({usesLeft} left)</span>
                  </button>
                )}
              </div>
              {power && <p className="faint" style={{ fontSize: '0.82rem', marginTop: 8 }}>{power.description}</p>}
            </>
          )
        ) : (
          <button className="btn btn-danger" onClick={enemyContinue}>Continue — {actor.name} acts ▸</button>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16, maxHeight: 140, overflowY: 'auto', padding: '12px 16px' }}>
        {combat.log.map((entry, i) => (
          <p key={i} className="muted" style={{ margin: '2px 0', fontSize: '0.86rem' }}>{entry}</p>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add styles for the power button and adv/dis badge**

Append to `src/styles/theme.css`:

```css
.btn-power { border-color: var(--gold); color: var(--gold); }
.btn-power:hover:not(:disabled) { background: rgba(217,164,65,0.12); border-color: var(--gold-bright, #f4d27a); }
.adv-badge { font-size: 0.85rem; vertical-align: middle; }
.adv-badge.adv { color: var(--green); }
.adv-badge.dis { color: var(--accent-bright); }
```

- [ ] **Step 4: Type-check and run the existing CombatView test**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test -- CombatView`
Expected: PASS (the existing smoke test — encounter title + names render — still holds; the party now includes whatever heroes, and power buttons appear for the active hero).

- [ ] **Step 5: Add a CombatView power smoke test**

Append to `src/components/CombatView.test.tsx` (before the final closing `});`):

```ts
  it('shows the active hero\'s power button', () => {
    renderCombat();
    // Gronk (reckless-strike) leads or not depending on initiative; at least one
    // power button should be present for whoever's turn it is.
    expect(screen.getByText(/left\)/i)).toBeInTheDocument();
  });
```

> Note: `renderCombat()` in this test seeds a single-hero party (`gronk-skullsplitter`), so it is always Gronk's turn first and his "✦ Reckless Strike (2 left)" button renders.

- [ ] **Step 6: Run the test**

Run: `npm test -- CombatView`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/CombatView.tsx src/components/CombatDice.tsx src/components/CombatView.test.tsx src/styles/theme.css
git commit -m "feat: combat power button, targeting, and advantage/disadvantage UI"
```

---

## Task 7: Full verification + deploy

**Files:** none (verification only)

- [ ] **Step 1: Full CI sequence locally**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json && npm test && npm run build`
Expected: lint clean (the one pre-existing react-refresh warning is OK), tsc clean, all tests pass, build succeeds.

- [ ] **Step 2: Manual playthrough (use the run or verify skill)**

Run `npm run dev`, start a game, pick a party that includes a caster (e.g. Alaric/Wizard) and the Cleric (Mara), enter a combat, and verify:
- Each hero shows a "✦ <Power> (N left)" button on their turn.
- Wizard Burning Hands damages all foes at once; the dice readout shows it.
- Barbarian Reckless Strike's readout shows "advantage (a, b) →".
- Bardic Inspiration puts a ⬆ badge on the chosen ally; their next attack rolls 2d20-take-higher.
- Cleric Cure Wounds heals (green +N float).
- Uses decrement and the button disables at 0.
- Victory still routes onward with the between-fight rest; defeat still ends.

- [ ] **Step 3: Commit any fixes, then push (auto-deploys via Pages)**

```bash
git push origin main
```

Then confirm the deploy run succeeds:

```bash
gh run watch "$(gh run list --workflow='Deploy to GitHub Pages' --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: the run completes successfully; the new combat is live at https://gledilami.github.io/tavern/.

---

## Self-Review

- **Spec coverage:** adv/dis flag + advantage-aware roll (T1, T2, T3) ✓; `applyAttack`/`applyHeal` shared helpers + flag routing (T3) ✓; powers registry + `applyPower` with all kinds (T4) ✓; all 12 class powers mapped (T5, T4 registry) ✓; `Character.powerId` + validation (T1, T5) ✓; CombatView power button/targeting + adv/dis badge + readout (T6) ✓; tests for each kind + adv/dis (T2,T3,T4,T5,T6) ✓; victory/defeat/rest flow preserved (T6 reuses existing applyResult) ✓.
- **Placeholder scan:** none — every step has complete code/commands.
- **Type consistency:** `Power`/`PowerKind`/`PowerTargeting`/`AdvMode` (T1) used consistently in T4/T6; `applyAttack(next, attackerId, attackName, targetId, rng, lookup?, opts?)` and `applyHeal(next, healerId, targetId, dice, bonus, name, rng?)` signatures match between T3 definition and T4 callers; `applyPower(state, casterId, powerId, targetIds, rng?, lookup?)` matches T4 definition and T6 callers; `POWERS`/`getPower` names consistent; `Combatant.nextAttack` and `AttackEvent.mode`/`d20Rolls` consistent across T1/T3/T6.
- **Scope:** single cohesive plan; out-of-scope items (spell slots, named conditions, Defend, enemy powers, leveling) explicitly excluded per spec.
```
