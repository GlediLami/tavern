# Luck / Inspiration Tokens — Design

Date: 2026-06-10
Status: Approved (autonomous — owner asked to complete without per-feature approval)

A small party-wide pool of **Luck** tokens that add player agency over the dice: spend one to
**reroll a failed/any skill check**, or to give a hero **advantage on their next attack** in
combat.

## Decisions
- **Party-wide pool** (shared, simplest for pass-and-play): `GameState.luck: number`.
- **`LUCK_PER_ADVENTURE = 2`** — set on `CONFIRM_PARTY`, refilled on `ADVANCE_CAMPAIGN` and on
  arriving at a rest scene (a mid-adventure top-up).
- Two spends, both costing one token via a `SPEND_LUCK` action:
  1. **Reroll a skill check** — after the result is revealed, reroll the d20 and keep the new result.
  2. **Combat advantage** — set the acting hero's `nextAttack='adv'` (reuses the existing mechanic).

## State & persistence
- New required `GameState.luck: number`. `initialState`: 0.
- `CONFIRM_PARTY` → `LUCK_PER_ADVENTURE`; `ADVANCE_CAMPAIGN` → `LUCK_PER_ADVENTURE`; `GOTO_SCENE`
  rest branch → `LUCK_PER_ADVENTURE`. `SPEND_LUCK` → `Math.max(0, luck - 1)`.
- Persistence: validate optional `luck` (number), normalize to 0 on load. Add `luck: 0` to the
  three `GameState` fixtures.

## UI
- **`DiceRoller`** gains optional `onReroll?: () => void` + `rerollsLeft?: number`; in the settled
  state it renders a "✦ Spend Luck to reroll ({n})" button before Continue when `rerollsLeft > 0`.
- **`GameScreen`**: the `reveal` pending stage carries `heroId`. The check's `RECORD` (pass/fail)
  moves to `finishReveal` so a reroll doesn't double-count. `rerollCheck` re-resolves with the
  hero, dispatches `SPEND_LUCK`, updates `pending.result`, and bumps a nonce used as the
  `DiceRoller` `key` so it re-animates. A "✦ Luck N" pill shows by the party header.
- **`CombatView`**: a "✦ Luck: advantage ({n})" button in the hero action row (when `luck > 0`
  and the actor has no pending adv/dis) dispatches `SPEND_LUCK` and sets the actor's
  `nextAttack='adv'` via a cloned combat state. The turn line shows "✦ Luck N".

## Testing (TDD)
- `gameReducer.test.ts`: `CONFIRM_PARTY` seeds `LUCK_PER_ADVENTURE`; `SPEND_LUCK` decrements and
  clamps at 0; `ADVANCE_CAMPAIGN` and a rest `GOTO_SCENE` refill.
- `persistence.test.ts`: a save missing `luck` normalizes to 0.
- `DiceRoller.test.tsx`: with `onReroll`/`rerollsLeft` (reduced motion mocked on), the reroll
  button renders and calls back.
- `CombatView.test.tsx`: with `luck`, the "✦ Luck: advantage" button shows.
- `GameScreen.test.tsx`: the "✦ Luck" pill shows the count.

Then full `lint && tsc && test && build` green + a Playwright spot-check, commit, push to `main`.

## Out of scope
Per-hero token pools; rerolling combat attacks (advantage only); using luck to reroll enemy rolls.
