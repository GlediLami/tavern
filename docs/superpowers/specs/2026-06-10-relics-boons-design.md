# Relics & Boons (Ship 2 of the rewards economy) — Design

Date: 2026-06-10
Status: Approved

Second half of the rewards economy. Per-hero, run-scoped **relics** that the party drafts at
rests and on campaign level-ups, each granting a passive combat effect (a curated mix of static
boosts and triggered effects). Relics carry across a campaign, building a per-hero identity.

Decisions locked in brainstorming: curated mix of effects; draft at each rest **and** on each
campaign level-up; per-hero assignment; carries across the campaign.

---

## 1. Effect model & engine — `src/engine/relics.ts` (new)

Data-driven registry like `powers.ts`/`items.ts`. Each relic declares a `RelicEffect`:

```ts
export interface RelicEffect {
  acBonus?: number;            // +AC (folded in at combat start)
  damageBonus?: number;        // flat +damage on every hero attack
  attackBonus?: number;        // +to-hit
  bloodiedDamage?: number;     // extra flat damage while the hero is at <= half HP
  critHeal?: number;           // heal self this much on a crit
  damageReduction?: number;    // reduce each incoming hit by this much
  firstStrikeAdvantage?: boolean; // advantage on the hero's first attack each fight
}
export interface Relic { id: string; name: string; description: string; synergy?: string; effect: RelicEffect; }
```

### Starter set (8)
| id | name | effect | synergy |
|----|------|--------|---------|
| `ironhide-charm` | Ironhide Charm | acBonus +2 | Defenders |
| `stoneward-totem` | Stoneward Totem | damageReduction 2 | Defenders |
| `whetstone` | Whetstone | damageBonus +2 | Strikers |
| `keen-sight` | Keen Sight | attackBonus +1 | Anyone |
| `berserkers-pact` | Berserker's Pact | bloodiedDamage +3 | Bruisers |
| `oathkeepers-light` | Oathkeeper's Light | critHeal 3 | Anyone |
| `hunters-focus` | Hunter's Focus | firstStrikeAdvantage | Archers/Rogues |
| `guardian-sigil` | Guardian Sigil | acBonus +1, damageReduction 1 | Defenders |

### Helpers
- `getRelic(id)` — throws on unknown (like `getItem`).
- `sumRelicEffects(ids: string[]): RelicEffect` — merge: numeric fields sum, `firstStrikeAdvantage` ORs.
- `rollRelicChoices(rng, count = 3): string[]` — Fisher–Yates over the registry ids, take `count`
  distinct ids (the draft offer).

### How relics reach combat
Relics are **compiled into the Combatant at `startCombat`** so the engine stays clean. New
optional `Combatant` fields (clearly named to avoid colliding with `attack.damageBonus`):
`relicDamage`, `relicToHit`, `bloodiedDamage`, `critHeal`, `damageReduction`. `startCombat`
reads each hero's `relics`, calls `sumRelicEffects`, and folds the result onto the combatant:
`ac += acBonus`, the new fields take their sums, and `nextAttack='adv'` if `firstStrikeAdvantage`.

`Hero` gains `relics?: string[]`; `toHero(id, hp, relics = [])` carries them; `combat.ts` imports
`sumRelicEffects` from `relics.ts` (no cycle — `relics.ts` imports only types/rng).

### Engine reads (all additive & guarded → existing tests unaffected)
- `applyAttack` (hero/power path):
  - `toHitMod += attacker.relicToHit ?? 0`
  - `const bloodied = attacker.hp * 2 <= attacker.maxHp;`
  - `flat += (attacker.relicDamage ?? 0) + (bloodied ? attacker.bloodiedDamage ?? 0 : 0)`
  - on a crit hit: `attacker.hp = Math.min(attacker.maxHp, attacker.hp + (attacker.critHeal ?? 0))`
- `performEnemyTurn`: after computing `total`, `total = Math.max(0, total - (target.damageReduction ?? 0))`.

Relic damage applies to attack-roll attacks/powers, **not** the Sacred Flame save path (deliberate).

---

## 2. State, draft cadence & persistence

### `gameReducer.ts`
- New **required** fields: `relics: Record<string, string[]>` (heroId → relicIds) and
  `draftsAvailable: number`.
- `initialState`: `relics: {}`, `draftsAvailable: 0`.
- `CONFIRM_PARTY`: reset both (`{}`, `0`).
- `ADVANCE_CAMPAIGN`: `draftsAvailable: state.draftsAvailable + 1` (relics carry via `...state`).
- `GOTO_SCENE` into a rest scene: `draftsAvailable: state.draftsAvailable + 1` (alongside the
  existing heal). Rests are forward-only in all four adventures, so arrival-grants-a-draft needs
  no extra idempotency tracking.
- Actions:
  - `GRANT_RELIC { heroId, relicId }` → append to `relics[heroId]`, `draftsAvailable -= 1` (clamped ≥ 0).
  - `SKIP_DRAFT` → `draftsAvailable -= 1` (clamped ≥ 0).

The reducer stays pure — it only bumps/decrements a counter; the UI rolls the 3 choices.

### `persistence.ts`
- Validate `relics` and `draftsAvailable` as optional (old saves still load).
- Normalize on load: `{ ...raw, inventory: raw.inventory ?? {}, relics: raw.relics ?? {}, draftsAvailable: raw.draftsAvailable ?? 0 }`.
- Add `relics: {}, draftsAvailable: 0` to the three `GameState` fixtures (`persistence.test`
  `valid`, `CombatView.test` `full`, `GameScreen.test` default).

---

## 3. UI

### Draft panel (`GameScreen.tsx`)
When `state.draftsAvailable > 0`, render a "Choose a Boon" panel at the top of the left column
(both rests and level-ups land in the scene phase, so this is the single surface):
- Roll three relics once via `useMemo(() => rollRelicChoices(defaultRng, 3), [state.draftsAvailable])`.
- Two-step: pick a relic (shows name + effect) → "Give to:" hero buttons → `GRANT_RELIC`. A
  **Skip** button dispatches `SKIP_DRAFT`. If more drafts remain, the memo re-rolls a fresh trio.

### Display
- **`PartyPanel`** (expandable card) gains an optional `relics?: Record<string, string[]>` prop;
  the expanded section lists each hero's relic names. `GameScreen` passes `state.relics`.
- **`CombatView`** hero cards show small `✦ <relic>` tags for that hero's relics (built from
  `state.relics`), so players remember their build mid-fight.

---

## 4. Testing (TDD)

- `src/engine/relics.test.ts`: `sumRelicEffects` merges numeric fields and ORs the flag;
  `rollRelicChoices` returns `count` distinct, valid ids; `getRelic` throws on unknown.
- `src/engine/combat.test.ts`: with a relic-bearing hero —
  `relicDamage`/`relicToHit` raise damage/to-hit; `bloodiedDamage` only applies at ≤ half HP;
  `critHeal` heals the attacker on a crit; `damageReduction` lowers incoming enemy damage;
  `firstStrikeAdvantage` seeds `nextAttack='adv'` at `startCombat`.
- `src/state/gameReducer.test.ts`: `GRANT_RELIC` appends + decrements; `SKIP_DRAFT` decrements
  (clamped); a rest `GOTO_SCENE` and `ADVANCE_CAMPAIGN` each grant a draft; `CONFIRM_PARTY`
  resets; relics carry across `ADVANCE_CAMPAIGN`.
- `src/state/persistence.test.ts`: `valid` carries the new fields; a save missing them normalizes.
- `src/components/GameScreen.test.tsx`: with `draftsAvailable: 1` (Math.random pinned for a
  deterministic trio), the draft panel shows; picking a relic then a hero resolves the draft.
- `src/components/PartyPanel.test.tsx`: an expanded card lists a granted relic.

Then `npm run lint && npx tsc --noEmit && npm test && npm run build` green, a Playwright
spot-check (draft a relic at a rest, see it on the hero, feel it in combat), commit, and push to
`main` (auto-deploys).

## Out of scope (later)
- Relic rarity/tiers, removing/swapping relics, relic shops.
- Relic effects on the save-spell path.
