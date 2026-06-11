# Status Effects + Synergy + Boss Phases (Ship B) — Design

Date: 2026-06-11
Status: Approved (autonomous — owner asked to complete B and C without per-feature approval)

Second combat-depth ship. Adds **fixed-duration status effects** with **apply→exploit synergy**,
and **boss phases** that enrage at HP thresholds (telegraphed automatically through Ship A's intent).

## Decisions (no per-turn saves, no full stun — per the research)
- 3 curated statuses, each a distinct mechanic:
  - **Burning** 🔥 — 3 damage at the **end of the afflicted's turn**, 2 turns (DoT).
  - **Vulnerable** 💥 — takes **+2** from attacks, 2 turns.
  - **Weakened** 🔻 — deals **−2** attack damage, 2 turns.
- `Combatant.statuses: Record<string, number>` (statusId → turns left); re-applying refreshes to the
  max duration. Statuses **tick at the end of the afflicted's own turn** (DoT damage, then all
  durations −1, expired removed) — clean, no React lifecycle, DoT death handled by `checkStatus`.

## Engine — `src/engine/status.ts` (new)
- `STATUSES` registry (`{ id, name, kind:'dot'|'vulnerable'|'weakened', icon, amount, duration, description }`).
- `applyStatus(c, id)`, `tickStatuses(state, combatantId)` (returns DoT damage + logs), `incomingBonus(c)`
  (+vuln), `outgoingPenalty(c)` (−weaken), `hasAnyStatus(c)`, `activeStatuses(c)` (for the UI).

## Integration (`combat.ts`, `powers.ts`, `items.ts`)
- `applyAttack`: `flat += incomingBonus(target)`; on hit, `total -= outgoingPenalty(attacker)` (≥0);
  relic `bonusVsAfflicted` adds when `hasAnyStatus(target)`; relic `inflictOnHit` applies a status.
- `performEnemyTurn` attack: same incoming/outgoing modifiers vs the hero target / weakened enemy.
- Every `perform*` ticks the **actor's** statuses at end of turn (before `checkStatus`/`advanceTurn`).
- Infliction sources: item `alchemists-fire`→Burning; powers `burning-hands`→Burning,
  `arms-of-hadar`→Weakened, `volley`→Vulnerable (via a new optional `Power.inflicts` / `Item.inflicts`).
- Synergy relics (registry additions): **Emberbrand** (`inflictOnHit:'burning'`) and **Executioner's
  Eye** (`bonusVsAfflicted:3`). `RelicEffect`/`Combatant` gain `inflictOnHit?`, `bonusVsAfflicted?`;
  `startCombat` folds them in.

## Boss phases
- `Enemy.phases?: { atHpPct: number; enrageDamage?: number; heal?: number; message: string }[]`
  (sorted high→low threshold). `Combatant` carries `phases?` + `phasesDone?` (count). `startCombat`
  copies them.
- `checkPhases(state)`: for each enemy, while `phasesDone < phases.length` and
  `hp/maxHp <= phases[phasesDone].atHpPct`, trigger it — `attack.damageBonus += enrageDamage`,
  heal (capped), log `message`, `phasesDone++`. Called in the hero damage paths
  (`performHeroAttack`, `applyPower`, `applyItem`) before `checkStatus`. Enrage raises the boss's
  attack damage → its **intent badge automatically shows the bigger threat** (Ship A synergy).
- Content: **The Pit Champion** (arena `fight_champion`) gets two phases (≤50% enrage +3; ≤25%
  enrage +2 & heal 4).

## UI (`CombatView.tsx`)
- Status tags on every combatant card (foe + hero): `🔥2 💥1` from `activeStatuses`.
- DoT shows in the combat log via `tickStatuses`; intent badges already reflect enrage.

## Testing (TDD)
- `status.test.ts`: `applyStatus` refreshes duration; `tickStatuses` deals DoT, decrements, removes
  expired; `incomingBonus`/`outgoingPenalty`.
- `combat.test.ts`: `applyAttack` adds vuln incoming + relic `bonusVsAfflicted` and subtracts weaken;
  a perform tick burns the actor; `checkPhases` enrages a boss at a threshold once.
- `powers.test.ts`/`items.test.ts`: tagged power/item inflicts its status.
- `adventure.test.ts`: phase entries are well-formed (0<atHpPct≤1, message present) across adventures.
- `CombatView.test.tsx`: a combatant with a status shows its tag.

Then full `lint && tsc && test && build` green, a Playwright spot-check (ignite a foe → 🔥 ticks; a
boss enrages and its intent jumps), commit, push to `main`.

## Out of scope
Poisoned/Bleed (more DoTs later); status immunities; per-status flashes; phases beyond enrage/heal.
