# Items, Loot & Potions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, the
> owner's preference) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a consumable-item economy — enemies drop loot, a shared party stash carries
across a campaign, and heroes spend a combat turn to use an item (heal/revive, burst damage,
grant advantage, or smoke all foes).

**Architecture:** A new pure engine module `items.ts` mirrors `powers.ts` (data-driven
registry + `applyItem` resolver reusing combat helpers) plus a `rollLoot` weighted picker. A
required `inventory` field on `GameState` with an `ADD_ITEM` action holds the shared stash.
`CombatView` gets a Use-Item flow + loot-on-victory; `GameScreen` shows a read-only Satchel.

**Tech Stack:** React 18 + TypeScript, Vitest, plain CSS.

---

### Task 1: Item types, registry, resolver, and loot roll (engine)

**Files:**
- Modify: `src/types.ts`
- Create: `src/engine/items.ts`
- Test: `src/engine/items.test.ts`

- [ ] **Step 1: Add the item types**

In `src/types.ts`, after the `Power` interface, add:
```ts
export type ItemRarity = 'common' | 'uncommon' | 'rare';
export type ItemKind = 'heal' | 'damage' | 'grant-advantage' | 'mass-disadvantage';
export type ItemTargeting = 'ally' | 'enemy' | 'all-enemies';

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

- [ ] **Step 2: Write the failing tests**

Create `src/engine/items.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { startCombat } from './combat';
import { applyItem, rollLoot, ITEMS, getItem } from './items';
import type { Hero, Enemy } from '../types';

function hero(id: string, hp = 20, maxHp = 20): Hero {
  return {
    id, name: id, race: 'r', class: 'c', level: 1, portrait: '🛡️',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp, hp, ac: 15, proficiencyBonus: 2, skillProficiencies: [],
    attacks: [{ name: 'Sword', ability: 'str', damageDice: '1d8', damageBonus: 3 }],
    backstory: '',
  };
}
const goblin: Enemy = { name: 'Goblin', maxHp: 7, ac: 13, attack: { name: 'Scimitar', toHit: 4, damageDice: '1d6', damageBonus: 2 } };
const hit = () => 0.999999;

describe('items', () => {
  it('Potion of Healing restores HP to an ally', () => {
    let st = startCombat([hero('h1', 5)], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'potion-healing', ['h1'], hit);
    expect(next.combatants.find((c) => c.id === 'h1')!.hp).toBeGreaterThan(5);
  });

  it('healing revives a downed ally in combat', () => {
    let st = startCombat([hero('h1'), hero('h2')], [goblin], hit);
    st.combatants.find((c) => c.id === 'h2')!.hp = 0;
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'potion-healing', ['h2'], hit);
    expect(next.combatants.find((c) => c.id === 'h2')!.hp).toBeGreaterThan(0);
  });

  it("Alchemist's Fire damages a foe and can end the fight", () => {
    const weakling: Enemy = { name: 'Weakling', maxHp: 3, ac: 10, attack: { name: 'x', toHit: 0, damageDice: '1d4', damageBonus: 0 } };
    let st = startCombat([hero('h1')], [weakling], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'alchemists-fire', ['enemy-0'], hit);
    expect(next.combatants.find((c) => c.id === 'enemy-0')!.hp).toBe(0);
    expect(next.status).toBe('victory');
  });

  it("Elixir of Heroism grants advantage to an ally's next attack", () => {
    let st = startCombat([hero('h1'), hero('h2')], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'elixir-heroism', ['h2'], hit);
    expect(next.combatants.find((c) => c.id === 'h2')!.nextAttack).toBe('adv');
  });

  it('Smoke Bomb imposes disadvantage on all living enemies', () => {
    let st = startCombat([hero('h1')], [goblin, goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'smoke-bomb', [], hit);
    next.combatants.filter((c) => !c.isHero).forEach((e) => expect(e.nextAttack).toBe('dis'));
  });

  it('using an item advances the turn', () => {
    let st = startCombat([hero('h1'), hero('h2')], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const next = applyItem(st, 'h1', 'elixir-heroism', ['h2'], hit);
    expect(next.turnIndex).not.toBe(st.turnIndex);
  });

  it('rollLoot returns null when the roll exceeds the drop chance', () => {
    expect(rollLoot(() => 0.7, 'normal')).toBeNull(); // 0.7 >= 0.6
    expect(rollLoot(() => 0.5, 'hard')).toBeNull();   // 0.5 >= 0.45
  });

  it('rollLoot picks a weighted item on a successful roll', () => {
    expect(rollLoot(() => 0, 'normal')).toBe('potion-healing');
    expect(rollLoot(() => 0.5, 'normal')).toBe('alchemists-fire');
  });

  it('every loot entry maps to a real item; getItem throws on unknown', () => {
    for (const id of ['potion-healing', 'greater-healing-draught', 'alchemists-fire', 'elixir-heroism', 'smoke-bomb']) {
      expect(ITEMS[id]).toBeDefined();
    }
    expect(() => getItem('nope')).toThrow();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/engine/items.test.ts`
Expected: FAIL — cannot import from `./items` (module does not exist yet).

- [ ] **Step 4: Implement the items engine**

Create `src/engine/items.ts`:
```ts
import type { CombatState, Item, Difficulty } from '../types';
import type { Rng } from './rng';
import { defaultRng } from './rng';
import { rollDice } from './dice';
import { clone, checkStatus, advanceTurn, applyHeal } from './combat';

export const ITEMS: Record<string, Item> = {
  'potion-healing': { id: 'potion-healing', name: 'Potion of Healing', description: 'Restore 2d4+2 HP to a hero.', rarity: 'common', kind: 'heal', targeting: 'ally', healDice: '2d4', healBonus: 2 },
  'greater-healing-draught': { id: 'greater-healing-draught', name: 'Greater Healing Draught', description: 'Restore 4d4+4 HP to a hero.', rarity: 'rare', kind: 'heal', targeting: 'ally', healDice: '4d4', healBonus: 4 },
  'alchemists-fire': { id: 'alchemists-fire', name: "Alchemist's Fire", description: 'Hurl fire at one foe for 2d6 damage.', rarity: 'uncommon', kind: 'damage', targeting: 'enemy', damageDice: '2d6' },
  'elixir-heroism': { id: 'elixir-heroism', name: 'Elixir of Heroism', description: "An ally's next attack has advantage.", rarity: 'uncommon', kind: 'grant-advantage', targeting: 'ally' },
  'smoke-bomb': { id: 'smoke-bomb', name: 'Smoke Bomb', description: 'Every foe attacks with disadvantage next.', rarity: 'uncommon', kind: 'mass-disadvantage', targeting: 'all-enemies' },
};

export function getItem(id: string): Item {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item: "${id}"`);
  return it;
}

function livingEnemyIds(state: CombatState): string[] {
  return state.combatants.filter((c) => !c.isHero && c.hp > 0).map((c) => c.id);
}

// Resolve an item, returning a new CombatState. Using an item costs the hero's turn.
export function applyItem(
  state: CombatState,
  userId: string,
  itemId: string,
  targetIds: string[],
  rng: Rng = defaultRng,
): CombatState {
  const next = clone(state);
  const item = getItem(itemId);
  const user = next.combatants.find((c) => c.id === userId)!;

  switch (item.kind) {
    case 'heal':
      next.lastAttack = applyHeal(next, userId, targetIds[0], item.healDice!, item.healBonus ?? 0, item.name, rng);
      break;

    case 'damage': {
      const roll = rollDice(item.damageDice!, rng);
      const t = next.combatants.find((c) => c.id === targetIds[0])!;
      t.hp = Math.max(0, t.hp - roll.total);
      next.log.push(`${user.name} uses ${item.name} — ${t.name} takes ${roll.total} damage.`);
      if (t.hp === 0) next.log.push(`${t.name} falls!`);
      next.lastAttack = {
        kind: 'attack', attackerName: user.name, targetName: t.name, actionName: item.name,
        targetId: t.id, hit: true, crit: false,
        damageDice: item.damageDice!, damageRolls: roll.rolls, damageBonus: 0, amount: roll.total,
      };
      break;
    }

    case 'grant-advantage': {
      const t = next.combatants.find((c) => c.id === targetIds[0])!;
      t.nextAttack = 'adv';
      next.log.push(`${user.name} uses ${item.name} — ${t.name}'s next attack has advantage.`);
      next.lastAttack = undefined;
      break;
    }

    case 'mass-disadvantage': {
      for (const id of livingEnemyIds(next)) {
        next.combatants.find((c) => c.id === id)!.nextAttack = 'dis';
      }
      next.log.push(`${user.name} uses ${item.name} — every foe attacks with disadvantage.`);
      next.lastAttack = undefined;
      break;
    }
  }

  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
}

// Loot dropped after a won encounter: a drop-chance gate, then a rarity-weighted pick.
const LOOT_TABLE: { id: string; weight: number }[] = [
  { id: 'potion-healing', weight: 45 },
  { id: 'alchemists-fire', weight: 20 },
  { id: 'elixir-heroism', weight: 18 },
  { id: 'smoke-bomb', weight: 12 },
  { id: 'greater-healing-draught', weight: 5 },
];
const DROP_CHANCE: Record<Difficulty, number> = { normal: 0.6, hard: 0.45 };

export function rollLoot(rng: Rng, difficulty: Difficulty): string | null {
  if (rng() >= DROP_CHANCE[difficulty]) return null;
  const total = LOOT_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let r = rng() * total;
  for (const entry of LOOT_TABLE) {
    if (r < entry.weight) return entry.id;
    r -= entry.weight;
  }
  return LOOT_TABLE[LOOT_TABLE.length - 1].id;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/items.test.ts`
Expected: PASS (all 9 item tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/engine/items.ts src/engine/items.test.ts
git commit -m "feat: item engine — registry, applyItem resolver, and loot roll"
```

---

### Task 2: Inventory state + ADD_ITEM action (reducer)

**Files:**
- Modify: `src/state/gameReducer.ts`
- Test: `src/state/gameReducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/state/gameReducer.test.ts` inside the `describe('gameReducer', ...)` block:
```ts
  it('ADD_ITEM adds, increments, decrements, and prunes at zero', () => {
    let s = gameReducer(initialState, { type: 'ADD_ITEM', itemId: 'potion-healing', delta: 1 });
    expect(s.inventory['potion-healing']).toBe(1);
    s = gameReducer(s, { type: 'ADD_ITEM', itemId: 'potion-healing', delta: 2 });
    expect(s.inventory['potion-healing']).toBe(3);
    s = gameReducer(s, { type: 'ADD_ITEM', itemId: 'potion-healing', delta: -3 });
    expect(s.inventory['potion-healing']).toBeUndefined();
  });

  it('CONFIRM_PARTY clears the inventory', () => {
    let s = gameReducer(initialState, { type: 'ADD_ITEM', itemId: 'potion-healing', delta: 2 });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    expect(s.inventory).toEqual({});
  });

  it('ADVANCE_CAMPAIGN carries the inventory across tales', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    s = gameReducer(s, { type: 'ADD_ITEM', itemId: 'smoke-bomb', delta: 1 });
    s = gameReducer(s, { type: 'ADVANCE_CAMPAIGN' });
    expect(s.inventory['smoke-bomb']).toBe(1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/state/gameReducer.test.ts`
Expected: FAIL — `inventory` is undefined / `ADD_ITEM` not handled (type error or undefined access).

- [ ] **Step 3: Add the inventory field + action + reset**

In `src/state/gameReducer.ts`:

(a) Add `inventory` to the `GameState` interface (after `stats`):
```ts
  stats: RunStats;              // accumulated stats for the current run
  inventory: Record<string, number>;  // shared party stash: itemId -> count
}
```

(b) Add it to `initialState` (after `stats: emptyStats,`):
```ts
  stats: emptyStats,
  inventory: {},
};
```

(c) Add the action to the `GameAction` union:
```ts
  | { type: 'RECORD'; delta: Partial<RunStats> }
  | { type: 'ADD_ITEM'; itemId: string; delta: number }
```

(d) In `CONFIRM_PARTY`'s returned object, reset the stash (after `stats: emptyStats,`):
```ts
        stats: emptyStats,
        inventory: {},
      };
```

(e) Add the `ADD_ITEM` case (next to `RECORD`):
```ts
    case 'ADD_ITEM': {
      const n = (state.inventory[action.itemId] ?? 0) + action.delta;
      const inventory = { ...state.inventory };
      if (n > 0) inventory[action.itemId] = n; else delete inventory[action.itemId];
      return { ...state, inventory };
    }
```

(`ADVANCE_CAMPAIGN` already spreads `...state`, so the stash carries automatically.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/state/gameReducer.test.ts`
Expected: PASS (existing reducer tests still pass — `initialState` now carries `inventory: {}`, and the `{ ...initialState, ... }` literals inherit it).

- [ ] **Step 5: Commit**

```bash
git add src/state/gameReducer.ts src/state/gameReducer.test.ts
git commit -m "feat: shared party inventory state with ADD_ITEM action"
```

---

### Task 3: Persistence validation + normalization

**Files:**
- Modify: `src/state/persistence.ts`
- Test: `src/state/persistence.test.ts`

- [ ] **Step 1: Update the fixture and add the failing test**

In `src/state/persistence.test.ts`, add `inventory: {}` to the `valid` fixture:
```ts
const valid: GameState = {
  phase: 'scene', mode: 'single', adventureId: 'brackenmoor', difficulty: 'normal',
  partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 },
  sceneId: 'tavern_start', log: [], stats: emptyStats, inventory: {},
};
```
Then add this test inside the `describe('loadValidatedGame', ...)` block:
```ts
  it('normalizes a save that predates inventory to an empty stash', () => {
    const { inventory, ...noInv } = valid;
    void inventory;
    saveGame(noInv);
    expect(loadValidatedGame()?.inventory).toEqual({});
  });
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `npx vitest run src/state/persistence.test.ts`
Expected: FAIL — `loadValidatedGame()?.inventory` is `undefined`, not `{}` (no normalization yet).

- [ ] **Step 3: Add validation + normalization**

In `src/state/persistence.ts`:

(a) In `isValid`, after the `stats` check, add:
```ts
  if (g.stats !== undefined && (typeof g.stats !== 'object' || g.stats === null)) return false;
  if (g.inventory !== undefined && (typeof g.inventory !== 'object' || g.inventory === null)) return false;
```

(b) In `loadValidatedGame`, normalize so the field always exists:
```ts
export function loadValidatedGame(): GameState | null {
  const raw = loadGame<GameState>();
  if (raw && isValid(raw)) return { ...raw, inventory: raw.inventory ?? {} };
  if (raw) clearSave(); // prune the unusable save so "Continue" disappears
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/state/persistence.test.ts`
Expected: PASS (the round-trip and campaign tests still match — `valid` now carries `inventory: {}`).

- [ ] **Step 5: Commit**

```bash
git add src/state/persistence.ts src/state/persistence.test.ts
git commit -m "feat: validate and normalize inventory on save load"
```

---

### Task 4: Use-Item flow + loot on victory (CombatView)

**Files:**
- Modify: `src/components/CombatView.tsx`
- Test: `src/components/CombatView.test.tsx`

- [ ] **Step 1: Update fixture + write the failing test**

In `src/components/CombatView.test.tsx`, change `renderCombat` to accept overrides and add
`inventory: {}` to the base, then add a Use-Item test:
```tsx
function renderCombat(overrides: Partial<GameState> = {}) {
  const full: GameState = {
    phase: 'combat', mode: 'single', adventureId: 'brackenmoor', difficulty: 'normal',
    partyIds: ['gronk-skullsplitter'], hp: { 'gronk-skullsplitter': 14 },
    sceneId: 'ridge_wolves', log: [], stats: emptyStats, inventory: {}, ...overrides,
  };
  return render(
    <GameProvider initial={full}>
      <CombatView />
    </GameProvider>,
  );
}
```
```tsx
  it('shows a Use Item button and item picker when the stash is stocked', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // Gronk wins initiative
    try {
      renderCombat({ inventory: { 'potion-healing': 2 } });
      const useBtn = screen.getByRole('button', { name: /Use Item \(2\)/i });
      expect(useBtn).toBeInTheDocument();
      fireEvent.click(useBtn);
      expect(screen.getByRole('button', { name: /Potion of Healing ×2/i })).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
```
And extend the imports at the top of the file:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/CombatView.test.tsx`
Expected: FAIL — no "Use Item" button exists yet.

- [ ] **Step 3: Add imports + item state/derived values**

In `src/components/CombatView.tsx`:

(a) Add the items import (after the `powers` import):
```ts
import { applyItem, rollLoot, getItem } from '../engine/items';
```
(b) Add `Item` to the types import:
```ts
import type { CombatState, Power, Item } from '../types';
```
(c) Add state next to `pendingPower` (after the `pendingPower` useState):
```ts
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
```
(d) Replace the `selectingEnemy` / `selectingAlly` lines with versions that also honor a
pending item, and add stash-derived values:
```ts
  const selectingEnemy = pendingPower?.targeting === 'enemy' || pendingItem?.targeting === 'enemy';
  const selectingAlly = pendingPower?.targeting === 'ally' || pendingItem?.targeting === 'ally';
  const stash = Object.entries(state.inventory).filter(([, n]) => n > 0);
  const stashCount = stash.reduce((sum, [, n]) => sum + n, 0);
```

- [ ] **Step 4: Add the use-item handlers + loot on victory**

In `src/components/CombatView.tsx`:

(a) Add these functions (after `resolvePower`):
```ts
  function useItem(item: Item, targetIds: string[]) {
    sfx.click();
    dispatch({ type: 'ADD_ITEM', itemId: item.id, delta: -1 });
    setPendingItem(null);
    setItemMenuOpen(false);
    setTarget(null);
    const next = applyItem(combat, actor.id, item.id, targetIds, defaultRng);
    recordHeroDamage(actor.heroId!, next);
    applyResult(next);
  }

  function chooseItem(item: Item) {
    sfx.click();
    if (item.targeting === 'all-enemies') { useItem(item, []); return; }
    setItemMenuOpen(false);
    setPendingItem(item); // ally / enemy -> enter targeting
  }
```

(b) In `applyResult`, inside the `if (next.status === 'victory')` block, after the
`dispatch({ type: 'SET_HP', hp: healed });` line, add the loot roll:
```ts
        dispatch({ type: 'SET_HP', hp: healed });
        const drop = rollLoot(defaultRng, state.difficulty);
        if (drop) {
          dispatch({ type: 'ADD_ITEM', itemId: drop, delta: 1 });
          dispatch({ type: 'LOG', entry: `You loot a ${getItem(drop).name}!` });
        }
```

- [ ] **Step 5: Wire item targeting into the foe/ally cards**

In `src/components/CombatView.tsx`:

(a) The foe button — update `clickable` and `onClick`:
```tsx
              const clickable = e.hp > 0 && actor.isHero && ((!pendingPower && !pendingItem) || selectingEnemy);
```
```tsx
                  onClick={() => { sfx.click(); if (selectingEnemy) { pendingItem ? useItem(pendingItem, [e.id]) : resolvePower([e.id]); } else setTarget(e.id); }}
```

(b) The ally (hero) button — update `onClick`:
```tsx
                  onClick={() => { if (!allyTargetable) return; pendingItem ? useItem(pendingItem, [h.id]) : resolvePower([h.id]); }}
```

- [ ] **Step 6: Add the Use-Item button, picker, and targeting prompt**

In `src/components/CombatView.tsx`, in the action panel, replace the hero branch
`pendingPower ? (...) : (...)` with a three-way that also handles `pendingItem`. Find:
```tsx
        {actor.isHero && heroChar ? (
          pendingPower ? (
```
and change the conditional chain so it reads `pendingPower ? (...) : pendingItem ? (...) : (...)`.
Insert this `pendingItem` branch immediately after the closing `)` of the `pendingPower` branch
(i.e. between the pendingPower block and the normal-actions block):
```tsx
          ) : pendingItem ? (
            <>
              <p className="muted" style={{ marginTop: 4 }}>
                {pendingItem.targeting === 'ally' ? `Choose an ally for ${pendingItem.name}.` : `Choose a foe for ${pendingItem.name}.`}
              </p>
              <button className="btn" onClick={() => { sfx.click(); setPendingItem(null); }}>← Cancel</button>
            </>
```
Then, inside the normal-actions block, after the power button (the `{power && (... )}` block that
renders the `✦` button), add the Use-Item button and picker:
```tsx
                {stashCount > 0 && (
                  <button className="btn" onClick={() => { sfx.click(); setItemMenuOpen((o) => !o); }}>
                    🧪 Use Item ({stashCount})
                  </button>
                )}
              </div>
              {itemMenuOpen && (
                <div className="row" style={{ marginTop: 8 }}>
                  {stash.map(([id, n]) => {
                    const it = getItem(id);
                    return (
                      <button key={id} className="btn" title={it.description} onClick={() => chooseItem(it)}>
                        {it.name} ×{n}
                      </button>
                    );
                  })}
                </div>
              )}
```
Note: the `</div>` above closes the existing `<div className="row">` that wraps the attack/power
buttons — make sure the new picker `{itemMenuOpen && ...}` sits *after* that closing `</div>`
and *before* the existing `{power && <p className="faint" ...>` description line.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/components/CombatView.test.tsx`
Expected: PASS (all CombatView tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/CombatView.tsx src/components/CombatView.test.tsx
git commit -m "feat: use items in combat and drop loot on victory"
```

---

### Task 5: Satchel display in exploration (GameScreen)

**Files:**
- Modify: `src/components/GameScreen.tsx`
- Test: `src/components/GameScreen.test.tsx`

- [ ] **Step 1: Update fixture + write the failing test**

In `src/components/GameScreen.test.tsx`, add `inventory: {}` to the `renderAt` base `full`:
```tsx
    partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 },
    sceneId: 'tavern_start', log: [], stats: emptyStats, inventory: {}, ...state,
```
Then add a Satchel test:
```tsx
  it('shows the Satchel with carried items', () => {
    renderAt({ inventory: { 'potion-healing': 2 } });
    expect(screen.getByText(/Satchel/i)).toBeInTheDocument();
    expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/GameScreen.test.tsx`
Expected: FAIL — no "Satchel" text rendered.

- [ ] **Step 3: Render the Satchel**

In `src/components/GameScreen.tsx`:

(a) Add the import (after the `getCharacter` import line):
```ts
import { getItem } from '../engine/items';
```
(b) In the right-hand column, after the `<PartyPanel ... />` line, add:
```tsx
        <PartyPanel partyIds={state.partyIds} hp={state.hp} difficulty={state.difficulty} level={state.campaign?.level ?? 1} />
        {Object.keys(state.inventory).length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Satchel</h3>
            <div className="panel" style={{ padding: 12 }}>
              {Object.entries(state.inventory).map(([id, n]) => (
                <div key={id} className="row" style={{ justifyContent: 'space-between', gap: 8, fontSize: '0.88rem', padding: '2px 0' }}>
                  <span>{getItem(id).name}</span>
                  <span className="muted">×{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/GameScreen.test.tsx`
Expected: PASS (original tests + the Satchel test).

- [ ] **Step 5: Commit**

```bash
git add src/components/GameScreen.tsx src/components/GameScreen.test.tsx
git commit -m "feat: show the party Satchel on the exploration screen"
```

---

### Task 6: Full verification, browser check, push

- [ ] **Step 1: Run the whole suite + lint + type-check + build**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```
Expected: lint clean (one known benign react-refresh warning on GameContext.tsx), type-check
clean, all tests pass, build succeeds.

- [ ] **Step 2: Browser spot-check with Playwright**

Reinstall ad-hoc if needed (`npm install --no-save playwright@1.60.0`) and reuse the existing
chromium build at `/home/lamig/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`. Start
`npm run dev -- --port 5183 --host` in the background, then a `.mjs` from the repo root that:
seeds a combat save (`marsh_spider`) with `inventory: { 'potion-healing': 1 }` and a wounded
hero, drives turns until a hero acts, opens **Use Item**, heals an ally, and screenshots; then
seeds a scene save with a non-empty inventory and screenshots the **Satchel**. Read the
screenshots with the Read tool. Stop the dev server afterward and delete the drive script +
screenshots.

- [ ] **Step 3: Push to main and watch the deploy**

```bash
git push origin main
gh run watch "$(gh run list --workflow=deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId')" --exit-status
```
Expected: deploy succeeds; confirm the live bundle hash changed at https://gledilami.github.io/tavern/.
```
