# Run Summary + Ending Gallery + Share — Design Spec

**Date:** 2026-06-01
**Status:** Approved for planning

## Goal

Add the missing retention/replay layer: a per-run summary shown at the end of a
run, a persistent "Hall of Tales" gallery of endings unlocked across all
adventures, and a copy/native-share result card.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Stats depth | **Rich** — ending, party level, encounters won, checks passed/failed, heroes downed, crits, biggest hit, MVP (most damage) |
| Sharing | **Copy text card + native share** (`navigator.share` when available, else clipboard). No image cards. |
| Gallery | A **"Hall of Tales"** screen reachable from Home, showing endings unlocked per adventure (e.g. 3/5) + campaign-complete flag |
| Out of scope | Generated image cards, server leaderboards, a full per-run history list |

## 1. Run stats

A `RunStats` accumulator lives in `GameState` (so it persists in the save and
spans a whole run). It is reset on `CONFIRM_PARTY` (run start), **not** reset on
`ADVANCE_CAMPAIGN` (a campaign summary covers all four tales), and cleared on
`RESET`.

```ts
export interface RunStats {
  encountersWon: number;
  checksPassed: number;
  checksFailed: number;
  heroesDowned: number;
  crits: number;
  biggestHit: number;
  damageByHero: Record<string, number>; // heroId -> total damage dealt; MVP = max
}

export const emptyStats: RunStats = {
  encountersWon: 0, checksPassed: 0, checksFailed: 0,
  heroesDowned: 0, crits: 0, biggestHit: 0, damageByHero: {},
};
```

A single action merges partial deltas:

```ts
| { type: 'RECORD'; delta: Partial<RunStats> }
```

`RECORD` semantics (in the reducer):
- numeric fields (`encountersWon`, `checksPassed`, `checksFailed`,
  `heroesDowned`, `crits`) **add**.
- `biggestHit` takes the **max** of current and `delta.biggestHit`.
- `damageByHero` **adds per hero** (merge).

### Instrumentation (call sites that already know the actor)
- `GameScreen` (check resolution, in `attemptWith`): after `resolveCheck`,
  dispatch `{ checksPassed: 1 }` on success or `{ checksFailed: 1 }` on failure.
- `CombatView`:
  - On a hero attack (`heroAttack`) or power (`resolvePower`) whose resulting
    `next.lastAttack` is an attack with `amount > 0`: dispatch
    `{ damageByHero: { [actorHeroId]: amount }, biggestHit: amount, crits:
    lastAttack.crit ? 1 : 0 }` (use the acting hero's id, known at the call site).
  - In `applyResult`: count heroes that went from `hp > 0` (in the pre-action
    `combat`) to `hp <= 0` (in `next`) → dispatch `{ heroesDowned: count }` when
    > 0; on victory dispatch `{ encountersWon: 1 }`.

MVP = the `damageByHero` entry with the highest value (ties: first); rendered as
the character's name. If `damageByHero` is empty, MVP is omitted.

## 2. Run summary UI (EndingScreen)

The summary appears only on a **terminal** ending — i.e. when the screen is NOT
advancing to a next campaign tale (`advancing === false`): a single-tale ending,
a campaign final victory, or any campaign defeat. While advancing (intermediate
campaign victory) only the existing level-up panel shows.

A stats panel renders: party level, encounters won, checks (passed/failed),
heroes downed, crits, biggest hit, and MVP. Below it, a **Share** button.

## 3. Share (`ui/share.ts`)

```ts
export interface ShareContext {
  title: string;          // adventure or campaign title
  difficulty: Difficulty;
  level: number;
  outcome: 'victory' | 'defeat';
  isCampaign: boolean;
  mvpName?: string;
}
export function buildShareText(stats: RunStats, ctx: ShareContext): string;
export function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'failed'>;
```

`buildShareText` returns a tidy single string, e.g.:
> ⚔️ Tavern — I cleared "The Snakewater Raid" on Normal at Level 2. MVP: Gronk
> Skullsplitter · 2 crits · biggest hit 14 · 3 fights won. Play:
> https://gledilami.github.io/tavern/

`shareOrCopy` uses `navigator.share({ text })` when available (resolves
`'shared'`), else `navigator.clipboard.writeText` (resolves `'copied'`), else
`'failed'`. All wrapped in try/catch; a user cancelling the native sheet resolves
`'failed'` (no error surfaced).

The EndingScreen Share button calls `shareOrCopy` and briefly shows "Copied!" /
"Shared!" feedback.

## 4. Ending gallery — Hall of Tales

### Persistence (`state/chronicle.ts`, separate key)
Independent of the game save (survives `RESET`/`clearSave`), key
`tavern.chronicle.v1`:

```ts
interface Chronicle {
  endings: Record<string, string[]>; // adventureId -> discovered ending scene ids
  campaignWon: boolean;
}
export function loadChronicle(): Chronicle;
export function recordEnding(adventureId: string, endingId: string): void;
export function recordCampaignWon(): void;
export function clearChronicle(): void;
export function endingsOf(adventureId: string): { id: string; title: string }[]; // all ending scenes in the adventure
```

- `recordEnding` adds `endingId` to that adventure's list (deduped), persists.
- Called from `EndingScreen`'s mount effect with `(adventureId, sceneId)`. On a
  campaign final victory, also `recordCampaignWon()`.
- `endingsOf` reads the adventure data and returns its `ending`-type scenes
  (`{ id, title }`) — used to show "discovered / total".
- All reads/writes wrapped in try/catch (localStorage may be unavailable).

### Hall of Tales screen (`components/HallOfTales.tsx`)
- Lists each adventure (all four) with its emoji + title, a count "endings
  found: N/M", and the list of that adventure's endings — discovered ones show
  their title (gold for victory, red for defeat), undiscovered show "— ???".
- A campaign-complete badge when `campaignWon`.
- A "Back to the Tavern" button and a small "Clear records" button (clears the
  chronicle, with no confirmation dialog — it only affects the gallery).

### Surfacing
- `TavernHome` gets a secondary **"Hall of Tales"** button.
- `App` shows the Hall via local component state (`useState` `showHall`), not the
  reducer — it is a transient view over the home screen, kept out of the save.

## Persistence validation (`state/persistence.ts`)

Extend `isValid` leniently: if `g.stats` is present it must be an object;
otherwise ignore. (A missing `stats` is tolerated and treated as `emptyStats`
when loaded — the reducer's `LOAD` returns the state as-is, and the EndingScreen
reads `state.stats ?? emptyStats`.) To keep `LOAD` safe, `initialState.stats =
emptyStats`, and any code reading stats uses `state.stats ?? emptyStats`.

## Architecture / files

- `state/gameReducer.ts`: `RunStats`/`emptyStats`, `stats` field on `GameState`,
  `RECORD` action + merge, reset on `CONFIRM_PARTY`, clear on `RESET`,
  `initialState.stats`.
- `state/chronicle.ts` (new): the chronicle persistence + `endingsOf`.
- `ui/share.ts` (new): `buildShareText` + `shareOrCopy`.
- `components/EndingScreen.tsx`: stats panel + Share button (terminal endings);
  record the ending + campaign-won in a mount effect.
- `components/HallOfTales.tsx` (new) + `TavernHome` button + `App` `showHall`
  state and routing.
- `components/GameScreen.tsx`, `components/CombatView.tsx`: `RECORD` dispatches.
- `state/persistence.ts`: lenient `stats` validation.

## Testing

- **gameReducer:** `RECORD` adds numerics, maxes `biggestHit`, merges
  `damageByHero`; `CONFIRM_PARTY` resets stats; `ADVANCE_CAMPAIGN` keeps stats.
- **chronicle:** `recordEnding` dedupes and persists; `loadChronicle` returns a
  default when empty; `endingsOf('brackenmoor')` returns that tale's ending
  scenes; `clearChronicle` empties it.
- **share:** `buildShareText` includes the title, level, MVP, and crit count;
  handles an empty `damageByHero` (no MVP clause). (`shareOrCopy` is exercised
  via a mocked `navigator`.)
- **EndingScreen:** a terminal ending renders the stats panel + a Share button;
  an advancing campaign victory does not render the stats panel.
- **HallOfTales:** renders discovered ending titles and "???" for undiscovered.
- Existing tests updated for the new optional `stats` field where literals build
  `GameState`.

## Success Criteria

After a run ends, the player sees a rich summary (MVP, crits, biggest hit,
encounters, checks, level) and can copy/share a result card; reaching endings
records them in a persistent Hall of Tales reachable from Home that shows
endings unlocked per adventure and campaign completion; single-tale and campaign
play are otherwise unchanged; and all new logic is covered by passing tests.
