# Combat Intelligence — Telegraphed Intent + Taunt/Mark (Ship A) — Design

Date: 2026-06-11
Status: Approved

First of three greenlit "combat depth + feel" ships. Enemies **telegraph their next action**, and
heroes get a battle-line tactical verb — front-line **Taunt**, back-line **Mark** — to react to it.

## Decisions
- **Deterministic enemy targeting** (replaces random): an attacking/debuffing enemy targets the
  **taunter if active**, else the **lowest-current-HP living hero** (ties → turn order). Buffs
  target the first living ally enemy without advantage. Readable focus-fire AI; makes Taunt and
  the existing cover/Luck/relic systems into real decisions.
- **Intent is a pure function of the board** (computed, not stored) so the preview never desyncs.
- Taunt/Mark gated by the existing `backLine` flag; **2 uses each per encounter**; each costs the
  hero's turn.

## 1. Enemy intent (engine — `combat.ts`)
- New type `EnemyIntent = { kind: 'attack' | 'buff' | 'debuff'; targetId?: string; estDamage?: number; label?: string }`.
- `avgDamage(dice: string, bonus: number): number` — rounded average of `NdM` + bonus.
- `enemyIntent(state, enemyId): EnemyIntent | undefined` — pure; mirrors the AI decision:
  - If the enemy has an ability with uses left and a valid target: `buff` (first living ally
    enemy without `nextAttack==='adv'`) or `debuff` (the chosen hero, via the targeting rule, if
    not already `dis`); `label` = ability name. If no valid ability target, fall through to attack.
  - Else `attack`: target = taunter (if `state.tauntTargetId` is a living hero) else lowest-HP
    living hero (ties → first in `order`); `estDamage = avgDamage(attack.damageDice, attack.damageBonus)`,
    `label` = attack name. Returns `undefined` if no living hero / no attack.
- `performEnemyTurn` is refactored to **execute `enemyIntent(next, enemyId)`** (same decision
  source), removing the inline random target pick. The existing buff/debuff/attack resolution,
  cover-disadvantage, crit, and `damageReduction` logic stay.

## 2. Taunt & Mark
- New `Combatant.marked?: boolean`; new `CombatState.tauntTargetId?: string`.
- `performTaunt(state, taunterId)`: set `tauntTargetId = taunterId`, push a log line, `advanceTurn`.
  `enemyIntent` then targets the taunter; `advanceTurn` clears `tauntTargetId` when control returns
  to the taunter (taunt lasts until their next turn). Costs the turn.
- `performMark(state, markerId, enemyId)`: set that enemy's `marked = true`, log, `advanceTurn`.
- `applyAttack`: if `target.marked`, add `MARK_BONUS = 2` to the flat damage (so weapon attacks and
  attack-powers benefit; item *direct* damage does not — acceptable).
- `advanceTurn`: after updating `turnIndex`, if the new current combatant is the taunter, clear
  `tauntTargetId`.

## 3. UI (`CombatView.tsx`)
- **Intent badge** on each living enemy card from `enemyIntent(combat, e.id)`: e.g.
  `⚔ → Mara ·~6`, `✦ War Chant → ally`, `✦ Hex → Bjorn` (uses `heroDisplayName`/enemy name).
- **Marked tag** (🎯) on marked enemies.
- **Tactic buttons** in the hero action row, by line: front-line (`!actor.backLine`) →
  `🛡 Taunt (n)`; back-line → `🎯 Mark (n)` (Mark enters enemy-targeting like a power/item).
  Per-hero `tacticUses` starts at `TACTIC_USES = 2`, decremented on use; buttons disabled at 0.
- Taunt resolves immediately; Mark resolves on picking a foe. Both run through `applyResult`.

## Testing (TDD)
- `combat.test.ts`: `enemyIntent` targets the taunter > lowest-HP hero > order; produces
  buff/debuff/attack kinds with `estDamage`/`label`; `performEnemyTurn` executes the shown intent;
  `performTaunt` sets `tauntTargetId` and `advanceTurn` clears it on the taunter's turn; `performMark`
  sets `marked` and `applyAttack` adds +2 vs a marked target; existing enemy-turn/cover tests stay
  green (deterministic tie → first-in-order preserves them; fix any that assumed random).
- `CombatView.test.tsx`: an enemy card shows an intent badge; a front-line hero shows `🛡 Taunt`, a
  back-line hero shows `🎯 Mark`.

Then `npm run lint && npx tsc --noEmit && npm test && npm run build` green, a Playwright spot-check
(see an intent badge; Taunt swings the arrows onto the tank; Mark tags a foe and boosts damage),
commit, push to `main`.

## Out of scope (later ships)
Status effects + synergy and boss phases (Ship B); juice + ambient music (Ship C). Mark bonus on
item direct-damage; multi-target taunt nuance.
