# Choices That Echo — Design

Date: 2026-06-11
Status: Approved (autonomous — owner asked to complete without per-feature approval)

A flag system so a player's choices ripple forward: choices/scenes set flags, later choices can
be gated on them, and the ending shows an **epilogue** that reflects the run.

## Decisions
- **Flags = `GameState.flags: string[]`** (a set of named flags). Reset each adventure (on
  `CONFIRM_PARTY` and `ADVANCE_CAMPAIGN`) so an adventure's ending reflects that adventure.
- **Setting flags** — two authoring hooks:
  - `Choice.setFlags?: string[]` — applied when the player commits to that choice (GameScreen
    dispatches `SET_FLAGS`).
  - `Scene.setFlags?: string[]` — applied on arrival, inside `GOTO_SCENE` (pure).
- **Gating choices** — `Choice.requiresFlag?: string`; a choice with it renders only when the flag
  is set.
- **Reflecting in the ending** — ending scenes gain `epilogues?: { flag: string; text: string }[]`;
  `EndingScreen` renders each epilogue whose flag is present.

## Content (Brackenmoor demo)
- `route_choice`: `c_marsh` sets `route_marsh`; `c_ridge` sets `route_ridge` — every victory takes
  one route, so the echo is always visible.
- `gravedigger_cottage`: `setFlags: ["visited_cottage"]` on arrival.
- `route_choice`: a new `requiresFlag: "visited_cottage"` option ("Follow the gravedigger's
  scrawled map to the marsh shrine" → `marsh_approach`, also `setFlags: ["route_marsh"]`) that
  appears only if you detoured through the cottage.
- `ending_victory`: epilogues for `route_marsh` and `route_ridge`.

## Types & state
- `Choice`: `+ setFlags?: string[]; requiresFlag?: string;`
- `Scene` (all variants): `+ setFlags?: string[];`; ending variant `+ epilogues?: { flag: string; text: string }[];`
- `GameState.flags: string[]` (required). `initialState`: `[]`.
- `CONFIRM_PARTY` / `ADVANCE_CAMPAIGN`: `flags: []`. `GOTO_SCENE`: merge destination
  `scene.setFlags`. New action `SET_FLAGS { flags: string[] }` (merge unique).
- Persistence: validate optional `flags` (array), normalize to `[]`. Add `flags: []` to the three
  `GameState` fixtures.

## UI
- `GameScreen`: filter `scene.choices` by `requiresFlag`; in `pickChoice`, if the choice has
  `setFlags`, dispatch `SET_FLAGS` before routing.
- `EndingScreen`: new `flags` prop; render matching epilogues as paragraphs under the narration.
  `App` passes `state.flags`.

## Testing (TDD)
- `gameReducer.test.ts`: `SET_FLAGS` merges unique; `GOTO_SCENE` into a scene with `setFlags`
  applies them; `CONFIRM_PARTY` / `ADVANCE_CAMPAIGN` reset.
- `persistence.test.ts`: a save missing `flags` normalizes to `[]`.
- `adventure.test.ts`: every `requiresFlag` and every epilogue flag is set somewhere in the
  adventure (flag connectivity, runs over all adventures).
- `GameScreen.test.tsx`: a `requiresFlag` choice is hidden without the flag and shown with it.
- `EndingScreen.test.tsx`: a matching epilogue renders for a present flag and not otherwise.

Then full `lint && tsc && test && build` green + a Playwright spot-check, commit, push to `main`.

## Out of scope
Conditional narration text; cross-adventure (campaign-wide) flags; flag-gated combat.
