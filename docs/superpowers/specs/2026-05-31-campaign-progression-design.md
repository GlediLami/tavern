# Mini-Campaign + Progression — Design Spec

**Date:** 2026-05-31
**Status:** Approved for planning

## Goal

Add a Campaign mode that chains the four adventures in a fixed order with a
persistent party that levels up between tales (more HP + more power uses),
turning four one-shots into a journey with stakes. Single-tale play is kept.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Mode | Add **Campaign** alongside **Single Tale** (both kept) |
| Order | Fixed curated, easy→hard: `snakewater` → `chaoticcaves` → `brackenmoor` → `arena` |
| Level rewards | **+Max HP (full heal)** and **+1 use to the signature power** per level |
| On defeat | Campaign ends with a light run summary (tales completed, level reached) |
| Out of scope | Per-hero levels, perk-choice menus, a second power, XP numbers, full run-summary/gallery |

## Progression model

A single **party level** starting at 1, +1 per cleared adventure. Two effects,
threaded through existing helpers via the party level (`state.campaign?.level ?? 1`):

- **HP:** `effectiveMaxHp(character, difficulty, level = 1)` adds
  `(level - 1) * HP_PER_LEVEL` where `HP_PER_LEVEL = 4`. The party fully heals on
  each level-up (and HP is seeded to the leveled max when an adventure begins).
- **Power uses:** combat seeds each hero's power uses as
  `getPower(powerId).uses + levelPowerBonus(level)` where
  `levelPowerBonus(level) = level - 1`.

`CAMPAIGN_ORDER = ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena']`.

## Flow

```
Home → New Game → Setup (mode toggle on the existing adventure-select screen)
  ├─ Single Tale → pick tale + difficulty → party-select → one adventure → ending (Return to Tavern)
  └─ Campaign    → pick difficulty (order shown read-only) → party-select → adventure[0]
                     → victory ending (non-final): level-up panel + "Onward to <next>" → ADVANCE_CAMPAIGN → adventure[i+1]
                     → victory ending (final): "Campaign complete" → Return to Tavern
                     → any defeat ending: run summary → Return to Tavern
```

No new screens: the Campaign/Single toggle folds into `AdventureSelect`, and the
level-up feedback rides on the existing `EndingScreen`.

## State & actions (`state/gameReducer.ts`)

Add to `GameState`:

```ts
  mode: 'single' | 'campaign';
  campaign?: { order: string[]; index: number; level: number };
```

`initialState`: `mode: 'single'`, `campaign: undefined`.

New/changed actions:

- `START_GAME` → unchanged target (`phase: 'adventure-select'`), but resets
  `mode` to `'single'` and clears `campaign` (via `initialState`).
- `SELECT_ADVENTURE { adventureId, difficulty }` (single) → `mode: 'single'`,
  `campaign: undefined`, set adventure/difficulty, `phase: 'party-select'`.
- `START_CAMPAIGN { difficulty }` (new) → `mode: 'campaign'`,
  `campaign: { order: CAMPAIGN_ORDER, index: 0, level: 1 }`,
  `adventureId: CAMPAIGN_ORDER[0]`, set difficulty, `phase: 'party-select'`.
- `CONFIRM_PARTY { partyIds }` → seed `hp[id] = effectiveMaxHp(char, difficulty,
  state.campaign?.level ?? 1)`; `sceneId` = current adventure's start; `phase:
  'scene'`.
- `ADVANCE_CAMPAIGN` (new) → require `state.campaign`; compute
  `level = campaign.level + 1`, `index = campaign.index + 1`,
  `adventureId = campaign.order[index]`; set `campaign = { ...campaign, index,
  level }`; `sceneId` = new adventure's start; `hp[id] = effectiveMaxHp(char,
  difficulty, level)` for every party member (full heal at leveled max);
  `log: []`; `phase: 'scene'`.
- `GOTO_SCENE`, `SET_HP`, `LOG`, `LOAD`, `RESET` unchanged (rest-scene heal in
  `GOTO_SCENE` also uses the party level for its cap — pass level into
  `campRestHp`'s max via `effectiveMaxHp(c, difficulty, level)`).

Helper: `campaignLevel(state) = state.campaign?.level ?? 1` (used wherever level
is needed). `isFinalAdventure(state) = !!state.campaign && state.campaign.index >=
state.campaign.order.length - 1`.

## Engine (`engine/difficulty.ts`)

- `effectiveMaxHp(character, difficulty, level = 1)` → existing floor logic
  `+ (level - 1) * 4`. Back-compatible (existing 2-arg callers get level 1).
- `levelPowerBonus(level: number): number` → `Math.max(0, level - 1)`.
- `HP_PER_LEVEL = 4` (exported const used by `effectiveMaxHp`).

## UI

### `AdventureSelect.tsx` (now also the mode picker)
- Add a Campaign / Single Tale segmented control at the top (default Single).
- **Single:** show adventure cards (as now) + difficulty; confirm button
  "Gather the Party →" calls `onSingle(adventureId, difficulty)`.
- **Campaign:** hide adventure cards; show a read-only ordered list of the four
  tales (emoji + title, "Bout 1..4") + the difficulty picker; confirm button
  "Begin the Campaign →" calls `onCampaign(difficulty)`.
- Props: `onSingle(adventureId, difficulty)` and `onCampaign(difficulty)`.

### `EndingScreen.tsx` (campaign-aware)
Props gain `mode`, `campaign` (level/index/order length), and callbacks
`onAdvance` and `onReturn`.
- **Single** (mode !== 'campaign'): unchanged — narration + "Return to the
  Tavern" (`onReturn`).
- **Campaign, victory, non-final:** show the ending narration plus a level-up
  panel — "Your party reaches **Level N+1** — +HP and +1 power use, wounds
  mended." — and a primary button **"Onward to <next adventure title>"**
  (`onAdvance`).
- **Campaign, victory, final:** a grand "The campaign is won" message +
  summary (tales completed = order length, final level) + "Return to the Tavern".
- **Campaign, defeat:** the defeat narration + summary ("You fell in <current
  adventure title>. Tales completed: <index>. Party level: <level>.") + "Return
  to the Tavern".

### `CombatView.tsx`, `PartyPanel.tsx`, `GameScreen.tsx`
- Read `level = state.campaign?.level ?? 1`.
- `CombatView`: build heroes with `effectiveMaxHp(c, difficulty, level)`; seed
  `powerUses[id] = getPower(pid).uses + levelPowerBonus(level)`.
- `PartyPanel`: accept a `level` prop; compute `max =
  effectiveMaxHp(c, difficulty, level)`. `GameScreen` passes `state.campaign?.level
  ?? 1`.

### `App.tsx`
- `adventure-select` case renders `AdventureSelect` with `onSingle` →
  `SELECT_ADVENTURE` and `onCampaign` → `START_CAMPAIGN`.
- `ending` case renders `EndingScreen` with `mode`, `campaign`, `onAdvance` →
  `ADVANCE_CAMPAIGN`, `onReturn` → clearSave + `RESET`.

## Persistence (`state/persistence.ts`)

Extend validation (lenient, backward compatible):
- `mode`, if present, must be `'single'` or `'campaign'`; missing ⇒ treat as
  valid (single).
- `campaign`, if present, must be an object with a string-array `order`, numeric
  `index` in range, and numeric `level >= 1`; otherwise the save is invalid.
- Existing checks (phase, adventureId exists, sceneId exists in the resolved
  adventure for in-game phases, partyIds are real heroes) still apply.

## Testing

- **gameReducer:**
  - `START_CAMPAIGN` sets `mode: 'campaign'`, `campaign.order` = the curated
    order, `index: 0`, `level: 1`, `adventureId` = order[0], `phase: 'party-select'`.
  - `CONFIRM_PARTY` at level 1 seeds base HP; at a higher campaign level seeds
    HP including the bonus.
  - `ADVANCE_CAMPAIGN` increments level + index, sets `adventureId` to the next
    in order with its start scene, full-heals to the new leveled max.
- **difficulty:** `effectiveMaxHp(c, diff, 3)` = base `+ 8`; `levelPowerBonus(1)
  = 0`, `levelPowerBonus(4) = 3`.
- **persistence:** a campaign save round-trips; a campaign with a bad `order`
  (non-array) is rejected.
- **EndingScreen:** a non-final campaign victory renders an "Onward" button and
  calls `onAdvance`; a defeat renders a summary and "Return to the Tavern".
- Existing tests updated for the `SELECT_ADVENTURE`/`AdventureSelect` prop change
  and the `effectiveMaxHp`/`PartyPanel` level argument.

## Success Criteria

A player can start a Campaign, pick a party, and play the four adventures in
order; after each non-final victory the party levels up (more max HP, full heal,
+1 power use) and continues to the next tale; the final victory shows a campaign
complete screen; a defeat ends the run with a summary; single-tale play is
unchanged; campaign progress persists; and all reducer/engine logic is covered by
passing tests.
