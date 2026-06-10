# Items, Loot & Potions (Ship 1 of the rewards economy) — Design

Date: 2026-06-10
Status: Approved

First half of the greenlit rewards economy. A consumable-item system: enemies drop loot
after fights, the party keeps a shared stash that carries across a campaign, and heroes spend
a combat turn to use an item. **Relics/boons are Ship 2** (a separate spec). Item use is
**combat-only** for this ship.

Decisions locked in brainstorming: automatic loot drops (no per-adventure authoring), shared
party stash, inventory carries across campaign adventures.

---

## 1. Data model & engine — `src/engine/items.ts` (new)

Mirrors the `powers.ts` pattern: a data-driven registry + a pure resolver. No React.

### Types (in `src/types.ts`)
```ts
export type ItemRarity = 'common' | 'uncommon' | 'rare';
export type ItemKind = 'heal' | 'damage' | 'grant-advantage' | 'mass-disadvantage';
export type ItemTargeting = 'self' | 'ally' | 'enemy' | 'all-enemies';

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  kind: ItemKind;
  targeting: ItemTargeting;
  healDice?: string;     // heal kind, e.g. "2d4"
  healBonus?: number;    // heal flat bonus
  damageDice?: string;   // damage kind, e.g. "2d6"
}
```

### Registry (5 starter items)
| id | name | rarity | kind | targeting | effect |
|----|------|--------|------|-----------|--------|
| `potion-healing` | Potion of Healing | common | heal | ally | 2d4+2 HP |
| `greater-healing-draught` | Greater Healing Draught | rare | heal | ally | 4d4+4 HP |
| `alchemists-fire` | Alchemist's Fire | uncommon | damage | enemy | 2d6 to one foe |
| `elixir-heroism` | Elixir of Heroism | uncommon | grant-advantage | ally | ally's next attack has advantage |
| `smoke-bomb` | Smoke Bomb | uncommon | mass-disadvantage | all-enemies | all foes attack at disadvantage next |

Healing an ally at 0 HP **revives** them in combat (emergent; no separate revive item).

### Resolver
`applyItem(state, userId, itemId, targetIds, rng = defaultRng): CombatState` — clones state,
resolves by `kind` (reusing `applyHeal`, direct damage like the `single-damage` power, and the
`nextAttack` flag), sets `lastAttack` for the dice readout where relevant, runs `checkStatus`,
and `advanceTurn` if still active. **Using an item costs the hero's turn.** Imports the shared
helpers from `combat.ts` (`clone`, `applyHeal`, `checkStatus`, `advanceTurn`) and `rollDice`.

### Loot
`rollLoot(rng, difficulty): string | null` — first `rng()` vs a drop chance
(`normal 0.6`, `hard 0.45`); on a drop, a second `rng()` does a rarity-weighted pick from
`LOOT_TABLE` (`potion-healing 45, alchemists-fire 20, elixir-heroism 18, smoke-bomb 12,
greater-healing-draught 5`). Returns the item id or `null`. All weights/chances are tunable
constants.

---

## 2. State & persistence

### `src/state/gameReducer.ts`
- New **required** field `GameState.inventory: Record<string, number>` — a shared party stash.
- `initialState.inventory = {}`.
- `CONFIRM_PARTY` resets `inventory: {}`.
- `ADVANCE_CAMPAIGN` keeps it (already spreads `...state`; carries across the 4 tales).
- `RESET` → `initialState` (empty).
- New action `{ type: 'ADD_ITEM'; itemId: string; delta: number }`:
  ```ts
  case 'ADD_ITEM': {
    const n = (state.inventory[action.itemId] ?? 0) + action.delta;
    const inventory = { ...state.inventory };
    if (n > 0) inventory[action.itemId] = n; else delete inventory[action.itemId];
    return { ...state, inventory };
  }
  ```
  (delta `+1` for loot, `-1` on use; never below 0; zero entries pruned.)

### `src/state/persistence.ts`
- Validate: `if (g.inventory !== undefined && (typeof g.inventory !== 'object' || g.inventory === null)) return false;` (optional → old saves still load).
- Normalize on load so the field always exists:
  `if (raw && isValid(raw)) return { ...raw, inventory: raw.inventory ?? {} };`

### Fixture updates (the documented "new required field" gotcha)
Add `inventory: {}` to every `GameState` literal: `persistence.test.ts` (`valid`),
`CombatView.test.tsx` (`full`), `GameScreen.test.tsx` (`full`), and any literal in
`gameReducer.test.ts`.

---

## 3. UI

### Combat (`src/components/CombatView.tsx`)
- A `🧪 Use Item (N)` button beside the attack/power buttons on a hero's turn, where `N` =
  total stash count; disabled when the stash is empty.
- Clicking opens an inline item picker (one button per stocked item: `Name ×count`).
- Choosing an item: `all-enemies`/`self` resolve immediately; `ally`/`enemy` enter targeting
  via the **existing** `pendingPower`-style flow (extend `selectingEnemy`/`selectingAlly` and
  the foe/ally `onClick` handlers to also resolve a `pendingItem`).
- Resolving dispatches `ADD_ITEM {itemId, delta:-1}`, runs `applyItem`, records damage to run
  stats for `damage` items (via the existing `recordHeroDamage`), and feeds `applyResult`.
- **Loot:** in `applyResult`'s victory branch, call `rollLoot(defaultRng, state.difficulty)`;
  on a hit, dispatch `ADD_ITEM {+1}` and a `LOG` line *"You loot a Potion of Healing!"*.

### Exploration (`src/components/GameScreen.tsx`)
- A compact, read-only **"Satchel"** panel under the party list showing item names + counts
  from `state.inventory` (hidden when empty). Item *use* stays combat-only this ship.

---

## 4. Testing (TDD)

- `src/engine/items.test.ts`:
  - `applyItem` per kind: heal restores HP and revives a 0-HP ally, damage reduces enemy HP and
    triggers victory on a kill, grant-advantage sets `nextAttack:'adv'` on the ally,
    mass-disadvantage sets `dis` on all living enemies; turn advances while active.
  - `rollLoot`: no drop when the first roll exceeds the chance (and `hard` is stingier than
    `normal`); weighted picks land on the expected item with forced RNG.
- `src/state/gameReducer.test.ts`: `ADD_ITEM` adds/increments/decrements/prunes;
  `CONFIRM_PARTY` clears inventory; `ADVANCE_CAMPAIGN` carries it.
- `src/state/persistence.test.ts`: `valid` fixture carries `inventory`; a save missing
  `inventory` loads normalized to `{}`.
- `src/components/CombatView.test.tsx`: a stocked stash shows `Use Item (N)`; opening the
  picker lists the item. (Deep resolution is covered by `items.test.ts`.)
- `src/components/GameScreen.test.tsx`: the Satchel renders item names/counts when the
  inventory is non-empty.

Then: `npm run lint && npx tsc --noEmit && npm test && npm run build` all green, a Playwright
spot-check (loot a potion in a fight, use it on a wounded hero, see the Satchel), commit, and
push to `main` (auto-deploys).

## Out of scope (later)
- Relics/boons (Ship 2).
- Using items outside combat.
- Shops / gold / an economy beyond drops.
