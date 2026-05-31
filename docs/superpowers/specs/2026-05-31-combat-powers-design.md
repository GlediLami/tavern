# Combat Depth + Class Powers — Design Spec

**Date:** 2026-05-31
**Status:** Approved for planning

## Goal

Make the 12 hero classes play differently in combat by adding (1) one signature
**power** per class with limited per-encounter uses, and (2) an **advantage /
disadvantage** dice mechanic. Keep the engine small: the only new persistent
combat state is a one-shot adv/dis flag per combatant.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Ability model | Per-encounter **powers**, one signature per class (generalizes the existing Cleric heal) |
| Extra mechanic | **Advantage / disadvantage** (2d20 take higher/lower) |
| Status conditions | **None** — no poison/stun/frighten framework; adv/dis covers the needed effects |
| Defend action | Not in v1 |
| Enemy powers | Not in v1 (enemies remain attack-only; they do honor incoming disadvantage) |
| Difficulty | Power uses are the same on Normal and Hard (difficulty already scales enemies/healing) |

## Advantage / Disadvantage

- A combatant carries an optional `nextAttack: 'adv' | 'dis'` flag.
- `rollD20(rng, mode?)`: `mode === 'adv'` rolls two d20 and takes the higher;
  `'dis'` takes the lower; otherwise a single d20.
- When a combatant attacks, its `nextAttack` flag selects the mode, then the flag
  is cleared (one-shot). Applies to both hero and enemy attacks.
- The `AttackEvent` / combat dice readout records the mode and (when adv/dis) both
  raw d20 values so the existing readout can show it.

## Powers

Powers live in a data registry keyed by class. Each `Character` references its
power by id. Effects are built from a small primitive set; nothing requires
multi-round duration tracking.

### Power data shape

```ts
type PowerTargeting = 'self' | 'ally' | 'enemy' | 'all-enemies';
type PowerKind =
  | 'bonus-attack'    // a weapon attack with extra damage dice
  | 'multi-attack'    // N weapon attacks against the chosen single target this turn
  | 'aoe-attack'      // a weapon attack roll against every living enemy
  | 'aoe-damage'      // fixed rolled damage to every living enemy (no attack roll)
  | 'single-damage'   // fixed rolled damage to one enemy (no attack roll)
  | 'heal'            // restore HP to one ally/self
  | 'grant-advantage' // set nextAttack='adv' on self or an ally
  | 'impose-disadvantage'; // set nextAttack='dis' on a target or all enemies

interface Power {
  id: string;
  name: string;
  description: string;       // shown on the button / tooltip
  kind: PowerKind;
  targeting: PowerTargeting;
  uses: number;              // per encounter
  // effect parameters (interpreted by kind):
  bonusDice?: string;        // e.g. "2d6" extra damage (bonus-attack)
  damageDice?: string;       // e.g. "2d6" (aoe-damage / single-damage)
  attacks?: number;          // count for multi-attack (default 2)
  withAdvantage?: boolean;   // bonus-attack rolls with advantage (Reckless)
  bonusDamageFlat?: number;  // flat extra damage (Reckless +2)
  healDice?: string;         // e.g. "1d8"
  healBonus?: number;        // e.g. +3
  alsoDisadvantage?: boolean;// aoe-damage that also imposes dis on all enemies
}
```

### The 12 powers

| Class | id | Name | kind | targeting | params | uses |
| --- | --- | --- | --- | --- | --- | --- |
| Fighter | `action-surge` | Action Surge | multi-attack | enemy | attacks 2 | 1 |
| Barbarian | `reckless-strike` | Reckless Strike | bonus-attack | enemy | withAdvantage, bonusDamageFlat 2 | 2 |
| Rogue | `sneak-attack` | Sneak Attack | bonus-attack | enemy | bonusDice "2d6" | 2 |
| Monk | `flurry-of-blows` | Flurry of Blows | multi-attack | enemy | attacks 2 | 2 |
| Paladin | `divine-smite` | Divine Smite | bonus-attack | enemy | bonusDice "2d8" | 2 |
| Ranger | `volley` | Volley | aoe-attack | all-enemies | — | 1 |
| Cleric | `cure-wounds` | Cure Wounds | heal | ally | healDice "1d8", healBonus 3 | 2 |
| Druid | `entangle` | Entangle | impose-disadvantage | all-enemies | — | 1 |
| Wizard | `burning-hands` | Burning Hands | aoe-damage | all-enemies | damageDice "2d6" | 1 |
| Sorcerer | `chaos-bolt` | Chaos Bolt | single-damage | enemy | damageDice "3d6" | 2 |
| Warlock | `arms-of-hadar` | Arms of Hadar | aoe-damage | all-enemies | damageDice "2d6", alsoDisadvantage | 1 |
| Bard | `bardic-inspiration` | Bardic Inspiration | grant-advantage | ally | — | 3 |

Notes:
- **multi-attack / bonus-attack** use the caster's primary weapon attack
  (`character.attacks[0]`) for to-hit and base damage, via the existing
  `makeHeroAttackLookup`. `bonus-attack` adds `bonusDice` / `bonusDamageFlat`
  and may roll `withAdvantage`.
- **aoe-attack** (Volley) makes one attack roll per living enemy using the
  caster's primary attack.
- **aoe-damage / single-damage** deal rolled damage with no attack roll (auto-hit,
  like a failed-save spell) — `damageDice` only, no ability mod.
- **heal** restores `healDice + healBonus`, capped at maxHp; can revive a downed
  ally (hp 0 → healed) only if you choose — v1: heal targets living allies only
  (consistent with current Cleric heal targeting; downed heroes recover at the
  between-fight rest).
- **grant-advantage / impose-disadvantage** set the one-shot `nextAttack` flag.

## Engine

### `src/engine/powers.ts` (new)
- `POWERS: Record<string, Power>` registry (data above) keyed by power id.
- `getPower(id): Power`.
- `applyPower(state, casterId, powerId, targetIds, lookup, rng): CombatState` —
  pure; clones state, resolves the effect by `kind`, pushes log lines, sets
  `lastAttack` for damage/heal/attack effects so the dice readout renders, then
  advances the turn (except it does NOT advance until all sub-attacks resolve).
  Sets victory/defeat status via the same checks combat.ts uses (exported helper).

### `src/engine/combat.ts` (modified)
- `rollD20(rng, mode?: 'adv' | 'dis')` — advantage-aware; existing callers pass no
  mode (unchanged behavior). Returns the chosen value; a sibling
  `rollD20Pair(rng, mode)` may return `{ value, rolls }` for the readout.
- `performHeroAttack` / `performEnemyTurn`: read and clear the attacker's
  `nextAttack` flag, roll with that mode, and record the mode + both raw rolls in
  the `AttackEvent`.
- Export `checkStatus` / `advanceTurn` (or a small `resolveAfterAction(state)`
  helper) so `powers.ts` reuses the exact same victory/defeat + turn logic.

### `types.ts` (modified)
- `Combatant.nextAttack?: 'adv' | 'dis'`.
- `AttackEvent.mode?: 'adv' | 'dis'` and `AttackEvent.d20Rolls?: number[]` (both
  raw dice when adv/dis).
- `Character.powerId?: string` (references the registry; every class gets one).
- Add the `Power` / `PowerKind` / `PowerTargeting` types.

### Content
- `characters.json`: add `"powerId"` to each of the 12 heroes per the table.

## UI (`CombatView.tsx`)

- Generalize `healUses` → `powerUses: Record<heroId, number>` seeded from the
  acting hero's power `uses` at combat start (only the caster's own power).
- On a hero's turn, render the existing **Attack** buttons plus a **Power** button
  (name + uses left, disabled at 0 uses). Selecting it enters a targeting mode
  mirroring the current heal flow:
  - `self` / `all-enemies`: resolve immediately.
  - `ally`: highlight party, click an ally.
  - `enemy`: highlight foes, click a foe (reuses the existing target selection).
- After resolving, decrement that power's uses, route victory/defeat as today
  (with the between-fight rest), and show the `CombatDice` readout (now including
  adv/dis).
- Show a small **⬆ / ⬇** badge on any combatant with a `nextAttack` flag.

## Testing

- **powers.ts** unit tests (seeded RNG) for each `kind`: bonus-attack adds dice;
  multi-attack hits twice; aoe-attack rolls per enemy; aoe-damage hits all;
  single-damage; heal caps at maxHp; grant-advantage/impose-disadvantage set the
  flag; uses can't go below available; victory/defeat detected after a power.
- **combat.ts**: `rollD20` adv returns the higher of two seeded rolls, dis the
  lower; an attacker with `nextAttack:'adv'` rolls with advantage and the flag is
  cleared; enemy with `nextAttack:'dis'` rolls with disadvantage.
- **characters.json**: every hero has a `powerId` that exists in the registry
  (extend the existing characters test).
- Component smoke test: a power button renders for a hero whose turn it is, and
  clicking a no-target power (e.g. Wizard Burning Hands) damages all enemies.

## Success Criteria

In combat, each class can use its signature power (correct uses, targeting, and
effect), advantage/disadvantage changes rolls and is visible in the dice readout,
the existing attack/heal/rest/victory/defeat flow still works, and all engine
logic is covered by passing unit tests.
