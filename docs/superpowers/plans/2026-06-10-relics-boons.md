# Relics & Boons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, the
> owner's preference) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Per-hero, run-scoped relics drafted at rests and on campaign level-ups, each granting a
passive combat effect (static boosts + a few triggered effects) that carries across a campaign.

**Architecture:** A pure `relics.ts` registry + `sumRelicEffects`/`rollRelicChoices`. Relics are
compiled onto the Combatant at `startCombat`; `applyAttack`/`performEnemyTurn` read additive,
guarded fields. State holds `relics` + a `draftsAvailable` counter; a draft panel in `GameScreen`
resolves drafts.

**Tech Stack:** React 18 + TypeScript, Vitest, plain CSS.

---

### Task 1: Relic registry & helpers (engine)

**Files:**
- Modify: `src/types.ts`
- Create: `src/engine/relics.ts`
- Test: `src/engine/relics.test.ts`

- [ ] **Step 1: Add the relic types**

In `src/types.ts`, after the `Item` interface, add:
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

export interface Relic {
  id: string;
  name: string;
  description: string;
  synergy?: string;
  effect: RelicEffect;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/engine/relics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { RELICS, getRelic, sumRelicEffects, rollRelicChoices } from './relics';

describe('relics', () => {
  it('sumRelicEffects merges numeric fields and ORs the flag', () => {
    const eff = sumRelicEffects(['ironhide-charm', 'guardian-sigil', 'hunters-focus']);
    expect(eff.acBonus).toBe(3);             // ironhide +2, guardian +1
    expect(eff.damageReduction).toBe(1);      // guardian -1
    expect(eff.firstStrikeAdvantage).toBe(true);
  });

  it('sumRelicEffects ignores unknown ids', () => {
    expect(sumRelicEffects(['nope'])).toEqual({});
  });

  it('rollRelicChoices returns distinct valid ids', () => {
    const choices = rollRelicChoices(() => 0.99, 3);
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    choices.forEach((id) => expect(RELICS[id]).toBeDefined());
  });

  it('getRelic throws on unknown', () => {
    expect(() => getRelic('nope')).toThrow();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/engine/relics.test.ts`
Expected: FAIL — cannot import from `./relics` (module does not exist).

- [ ] **Step 4: Implement the relics module**

Create `src/engine/relics.ts`:
```ts
import type { Relic, RelicEffect } from '../types';
import type { Rng } from './rng';

export const RELICS: Record<string, Relic> = {
  'ironhide-charm': { id: 'ironhide-charm', name: 'Ironhide Charm', description: '+2 AC.', synergy: 'Defenders', effect: { acBonus: 2 } },
  'stoneward-totem': { id: 'stoneward-totem', name: 'Stoneward Totem', description: 'Reduce each incoming hit by 2.', synergy: 'Defenders', effect: { damageReduction: 2 } },
  'whetstone': { id: 'whetstone', name: 'Whetstone', description: '+2 damage on your attacks.', synergy: 'Strikers', effect: { damageBonus: 2 } },
  'keen-sight': { id: 'keen-sight', name: 'Keen Sight', description: '+1 to hit.', synergy: 'Anyone', effect: { attackBonus: 1 } },
  'berserkers-pact': { id: 'berserkers-pact', name: "Berserker's Pact", description: '+3 damage while bloodied (at or below half HP).', synergy: 'Bruisers', effect: { bloodiedDamage: 3 } },
  'oathkeepers-light': { id: 'oathkeepers-light', name: "Oathkeeper's Light", description: 'Heal 3 HP whenever you land a critical hit.', synergy: 'Anyone', effect: { critHeal: 3 } },
  'hunters-focus': { id: 'hunters-focus', name: "Hunter's Focus", description: 'Advantage on your first attack each fight.', synergy: 'Archers/Rogues', effect: { firstStrikeAdvantage: true } },
  'guardian-sigil': { id: 'guardian-sigil', name: 'Guardian Sigil', description: '+1 AC and reduce each incoming hit by 1.', synergy: 'Defenders', effect: { acBonus: 1, damageReduction: 1 } },
};

export function getRelic(id: string): Relic {
  const r = RELICS[id];
  if (!r) throw new Error(`Unknown relic: "${id}"`);
  return r;
}

const NUMERIC_KEYS = ['acBonus', 'damageBonus', 'attackBonus', 'bloodiedDamage', 'critHeal', 'damageReduction'] as const;

export function sumRelicEffects(ids: string[]): RelicEffect {
  const out: RelicEffect = {};
  for (const id of ids) {
    const e = RELICS[id]?.effect;
    if (!e) continue;
    for (const k of NUMERIC_KEYS) {
      if (e[k] !== undefined) out[k] = (out[k] ?? 0) + (e[k] as number);
    }
    if (e.firstStrikeAdvantage) out.firstStrikeAdvantage = true;
  }
  return out;
}

// Offer `count` distinct relic ids (a draft). Fisher–Yates over the registry.
export function rollRelicChoices(rng: Rng, count = 3): string[] {
  const ids = Object.keys(RELICS);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/engine/relics.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/engine/relics.ts src/engine/relics.test.ts
git commit -m "feat: relic registry, effect merge, and draft roll"
```

---

### Task 2: Combat integration (Combatant fields, startCombat, applyAttack, performEnemyTurn)

**Files:**
- Modify: `src/types.ts` (Combatant fields, Hero.relics)
- Modify: `src/engine/party.ts` (`toHero` relics param)
- Modify: `src/engine/combat.ts`
- Test: `src/engine/combat.test.ts`

- [ ] **Step 1: Add the Combatant fields and Hero.relics**

In `src/types.ts`, in the `Combatant` interface, after `dexSave?: number;`:
```ts
  dexSave?: number;            // enemy Dexterity save bonus
  relicDamage?: number;        // flat bonus damage from relics
  relicToHit?: number;         // bonus to-hit from relics
  bloodiedDamage?: number;     // extra flat damage while at <= half HP
  critHeal?: number;           // self-heal on a crit
  damageReduction?: number;    // reduce each incoming hit by this
```
And extend `Hero`:
```ts
export interface Hero extends Character { hp: number; relics?: string[]; }
```

- [ ] **Step 2: Write the failing tests**

Add to `src/engine/combat.test.ts` inside the `describe('combat', ...)` block:
```ts
  it('relic damage raises a hero attack', () => {
    const h = { ...makeHero('h1', 10), relics: ['whetstone'] }; // +2 dmg
    let st = startCombat([h], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit); // crit: 1d8(8)+1d8(8)+flat(3+2)
    expect(ev.amount).toBe(8 + 8 + 3 + 2);
  });

  it('keen-sight raises the to-hit modifier', () => {
    const h = { ...makeHero('h1', 10), relics: ['keen-sight'] };
    let st = startCombat([h], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit);
    expect(ev.toHit).toBe(3 + 2 + 1); // str mod 3 + prof 2 + keen-sight 1
  });

  it("berserker's pact adds damage only while bloodied", () => {
    const full = { ...makeHero('h1', 10, 20), relics: ['berserkers-pact'] };
    let st = startCombat([full], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    expect(applyAttack(st, 'h1', 'Sword', 'enemy-0', hit).amount).toBe(8 + 8 + 3); // not bloodied

    const low = { ...makeHero('h2', 10, 20), relics: ['berserkers-pact'] };
    let st2 = startCombat([low], [goblin], hit);
    st2.combatants.find((c) => c.id === 'h2')!.hp = 8; // 8/20 -> bloodied
    st2 = { ...st2, turnIndex: st2.order.indexOf('h2') };
    expect(applyAttack(st2, 'h2', 'Sword', 'enemy-0', hit).amount).toBe(8 + 8 + 3 + 3);
  });

  it("oathkeeper's light heals the attacker on a crit", () => {
    const h = { ...makeHero('h1', 10, 20), relics: ['oathkeepers-light'] };
    let st = startCombat([h], [goblin], hit);
    st.combatants.find((c) => c.id === 'h1')!.hp = 10;
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    applyAttack(st, 'h1', 'Sword', 'enemy-0', hit); // crit -> heal 3
    expect(st.combatants.find((c) => c.id === 'h1')!.hp).toBe(13);
  });

  it('damage reduction lowers incoming enemy damage', () => {
    const h = { ...makeHero('h1', 10, 30), relics: ['stoneward-totem'] }; // -2 per hit
    let st = startCombat([h], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    const before = st.combatants.find((c) => c.id === 'h1')!.hp;
    st = performEnemyTurn(st, hit); // crit: 1d6(6)+1d6(6)+bonus(2)=14, minus DR 2
    const dealt = before - st.combatants.find((c) => c.id === 'h1')!.hp;
    expect(dealt).toBe(14 - 2);
  });

  it("hunter's focus seeds advantage on the first attack", () => {
    const h = { ...makeHero('h1', 10), relics: ['hunters-focus'] };
    const st = startCombat([h], [goblin], hit);
    expect(st.combatants.find((c) => c.id === 'h1')!.nextAttack).toBe('adv');
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: FAIL — relic fields are unread, so amounts/to-hit/heal/DR don't change.

- [ ] **Step 4: Carry relics through `toHero`**

In `src/engine/party.ts`:
```ts
export function toHero(id: string, hp: number, relics: string[] = []): Hero {
  return { ...getCharacter(id), hp, relics };
}
```

- [ ] **Step 5: Fold relic effects into the Combatant at `startCombat`**

In `src/engine/combat.ts`, add the import near the top (after the `skills` import):
```ts
import { sumRelicEffects } from './relics';
```
Replace the hero push loop in `startCombat`:
```ts
  for (const h of heroes) {
    const eff = sumRelicEffects(h.relics ?? []);
    combatants.push({
      id: h.id, name: h.name, isHero: true, heroId: h.id,
      primaryAttack: h.attacks[0]?.name,
      maxHp: h.maxHp, hp: h.hp, ac: h.ac + (eff.acBonus ?? 0),
      initiative: rollD20(rng) + abilityMod(h.abilities.dex),
      backLine: !!h.attacks[0]?.ranged,
      relicDamage: eff.damageBonus,
      relicToHit: eff.attackBonus,
      bloodiedDamage: eff.bloodiedDamage,
      critHeal: eff.critHeal,
      damageReduction: eff.damageReduction,
      nextAttack: eff.firstStrikeAdvantage ? 'adv' : undefined,
    });
  }
```

- [ ] **Step 6: Read relic fields in `applyAttack`**

In `src/engine/combat.ts`, update the to-hit line (currently line ~120):
```ts
  const toHitMod = abilityMod(stats.abilityScore) + 2 + (attacker.relicToHit ?? 0); // proficiency +2 at level 1
```
Update the `flat` computation in the non-save path (currently line ~155):
```ts
  const bloodied = attacker.hp * 2 <= attacker.maxHp;
  const flat = stats.damageBonus + (opts.bonusFlat ?? 0) + (attacker.relicDamage ?? 0) + (bloodied ? (attacker.bloodiedDamage ?? 0) : 0);
```
Inside the `if (hit) {` block, after the `if (target.hp === 0) next.log.push(...falls...)` line, add the crit-heal:
```ts
    if (target.hp === 0) next.log.push(`${target.name} falls!`);
    if (isCrit && attacker.critHeal) attacker.hp = Math.min(attacker.maxHp, attacker.hp + attacker.critHeal);
```

- [ ] **Step 7: Apply damage reduction in `performEnemyTurn`**

In `src/engine/combat.ts`, in `performEnemyTurn`'s hit block, update the total line (currently
line ~285) to subtract the target's damage reduction:
```ts
      total = rolls.reduce((a, b) => a + b, 0) + enemy.attack.damageBonus;
      total = Math.max(0, total - (target.damageReduction ?? 0));
      target.hp = Math.max(0, target.hp - total);
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: PASS (existing combat tests unaffected — relic fields are undefined without relics).

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/engine/party.ts src/engine/combat.ts src/engine/combat.test.ts
git commit -m "feat: compile relic effects into combat (attack, defense, triggers)"
```

---

### Task 3: Relic state + draft cadence (reducer)

**Files:**
- Modify: `src/state/gameReducer.ts`
- Test: `src/state/gameReducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/state/gameReducer.test.ts` inside the `describe('gameReducer', ...)` block:
```ts
  it('GRANT_RELIC appends to a hero and consumes a draft', () => {
    let s = { ...initialState, draftsAvailable: 2 };
    s = gameReducer(s, { type: 'GRANT_RELIC', heroId: 'bjorn-ironhelm', relicId: 'ironhide-charm' });
    expect(s.relics['bjorn-ironhelm']).toEqual(['ironhide-charm']);
    expect(s.draftsAvailable).toBe(1);
  });

  it('SKIP_DRAFT consumes a draft (clamped at zero)', () => {
    let s = { ...initialState, draftsAvailable: 1 };
    s = gameReducer(s, { type: 'SKIP_DRAFT' });
    expect(s.draftsAvailable).toBe(0);
    s = gameReducer(s, { type: 'SKIP_DRAFT' });
    expect(s.draftsAvailable).toBe(0);
  });

  it('arriving at a rest scene grants a draft', () => {
    let s: GameState = { ...initialState, phase: 'scene', partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 }, sceneId: 'tower_base' };
    s = gameReducer(s, { type: 'GOTO_SCENE', sceneId: 'ridge_shrine' });
    expect(s.draftsAvailable).toBe(1);
  });

  it('ADVANCE_CAMPAIGN grants a draft and carries relics', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    s = gameReducer(s, { type: 'GRANT_RELIC', heroId: 'bjorn-ironhelm', relicId: 'whetstone' });
    s = gameReducer(s, { type: 'ADVANCE_CAMPAIGN' });
    expect(s.relics['bjorn-ironhelm']).toEqual(['whetstone']);
    expect(s.draftsAvailable).toBe(1);
  });

  it('CONFIRM_PARTY resets relics and drafts', () => {
    let s: GameState = { ...initialState, draftsAvailable: 3, relics: { 'bjorn-ironhelm': ['whetstone'] } };
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    expect(s.relics).toEqual({});
    expect(s.draftsAvailable).toBe(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/state/gameReducer.test.ts`
Expected: FAIL — `relics`/`draftsAvailable` undefined, `GRANT_RELIC`/`SKIP_DRAFT` unhandled.

- [ ] **Step 3: Add the state fields, actions, and draft grants**

In `src/state/gameReducer.ts`:

(a) Add to the `GameState` interface (after `inventory`):
```ts
  inventory: Record<string, number>;  // shared party stash: itemId -> count
  relics: Record<string, string[]>;   // heroId -> granted relic ids
  draftsAvailable: number;            // relic drafts the party can still take
```

(b) Add to `initialState` (after `inventory: {},`):
```ts
  inventory: {},
  relics: {},
  draftsAvailable: 0,
};
```

(c) Add the actions to the `GameAction` union:
```ts
  | { type: 'ADD_ITEM'; itemId: string; delta: number }
  | { type: 'GRANT_RELIC'; heroId: string; relicId: string }
  | { type: 'SKIP_DRAFT' }
```

(d) In `CONFIRM_PARTY`'s returned object (after `inventory: {},`):
```ts
        inventory: {},
        relics: {},
        draftsAvailable: 0,
      };
```

(e) In `ADVANCE_CAMPAIGN`'s returned object, add the draft grant. Find the returned object and
add `draftsAvailable`:
```ts
        campaign: { ...state.campaign, index, level },
        adventureId,
        hp: fullPartyHp(state.partyIds, state.difficulty, level),
        sceneId: getAdventureData(adventureId).startSceneId,
        log: [],
        phase: 'scene',
        draftsAvailable: state.draftsAvailable + 1,
      };
```

(f) In `GOTO_SCENE`'s rest branch, grant a draft. Find the rest `return` and add the field:
```ts
        return { ...base, hp, log: [...state.log, 'You make camp in safety and recover your strength.'], draftsAvailable: state.draftsAvailable + 1 };
```

(g) Add the action cases (next to `ADD_ITEM`):
```ts
    case 'GRANT_RELIC': {
      const list = [...(state.relics[action.heroId] ?? []), action.relicId];
      return { ...state, relics: { ...state.relics, [action.heroId]: list }, draftsAvailable: Math.max(0, state.draftsAvailable - 1) };
    }

    case 'SKIP_DRAFT':
      return { ...state, draftsAvailable: Math.max(0, state.draftsAvailable - 1) };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/state/gameReducer.test.ts`
Expected: PASS (existing reducer tests still pass — `initialState` carries the new fields, and
`{ ...initialState, ... }` literals inherit them).

- [ ] **Step 5: Commit**

```bash
git add src/state/gameReducer.ts src/state/gameReducer.test.ts
git commit -m "feat: relic state, draft counter, and rest/level-up grants"
```

---

### Task 4: Persistence validation + normalization

**Files:**
- Modify: `src/state/persistence.ts`
- Test: `src/state/persistence.test.ts`

- [ ] **Step 1: Update the fixture and add the failing test**

In `src/state/persistence.test.ts`, add the new fields to the `valid` fixture:
```ts
  sceneId: 'tavern_start', log: [], stats: emptyStats, inventory: {}, relics: {}, draftsAvailable: 0,
};
```
Then add this test inside the `describe('loadValidatedGame', ...)` block:
```ts
  it('normalizes a save that predates relics/drafts', () => {
    const { relics, draftsAvailable, ...partial } = valid;
    void relics; void draftsAvailable;
    saveGame(partial);
    const loaded = loadValidatedGame();
    expect(loaded?.relics).toEqual({});
    expect(loaded?.draftsAvailable).toBe(0);
  });
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `npx vitest run src/state/persistence.test.ts`
Expected: FAIL — `loaded?.relics` is `undefined` (no normalization yet).

- [ ] **Step 3: Add validation + normalization**

In `src/state/persistence.ts`:

(a) After the `inventory` validation line, add:
```ts
  if (g.inventory !== undefined && (typeof g.inventory !== 'object' || g.inventory === null)) return false;
  if (g.relics !== undefined && (typeof g.relics !== 'object' || g.relics === null)) return false;
  if (g.draftsAvailable !== undefined && typeof g.draftsAvailable !== 'number') return false;
```

(b) Update the normalization in `loadValidatedGame`:
```ts
  if (raw && isValid(raw)) return { ...raw, inventory: raw.inventory ?? {}, relics: raw.relics ?? {}, draftsAvailable: raw.draftsAvailable ?? 0 };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/state/persistence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/persistence.ts src/state/persistence.test.ts
git commit -m "feat: validate and normalize relics/drafts on save load"
```

---

### Task 5: Draft panel + relic display (UI)

**Files:**
- Modify: `src/components/GameScreen.tsx`
- Modify: `src/components/PartyPanel.tsx`
- Modify: `src/components/CombatView.tsx`
- Test: `src/components/GameScreen.test.tsx`, `src/components/PartyPanel.test.tsx`, `src/components/CombatView.test.tsx`

- [ ] **Step 1: Update component fixtures**

In `src/components/CombatView.test.tsx`, add the new fields to the `full` base:
```tsx
    sceneId: 'ridge_wolves', log: [], stats: emptyStats, inventory: {}, relics: {}, draftsAvailable: 0, ...overrides,
```
In `src/components/GameScreen.test.tsx`, add them to the `renderAt` base:
```tsx
    sceneId: 'tavern_start', log: [], stats: emptyStats, inventory: {}, relics: {}, draftsAvailable: 0, ...state,
```

- [ ] **Step 2: Write the failing tests**

In `src/components/GameScreen.test.tsx`, extend imports and add a draft test:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
```
```tsx
  it('a pending draft grants a relic to a chosen hero', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // deterministic trio (registry order)
    try {
      renderAt({ draftsAvailable: 1, partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 } });
      expect(screen.getByText(/Choose a Boon/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Ironhide Charm/i }));
      // Two buttons carry the hero name (party-sheet toggle + this one); pick the non-toggle.
      const give = screen.getAllByRole('button', { name: /Bjorn Ironhelm/i }).find((b) => !/Fighter/.test(b.textContent ?? ''));
      fireEvent.click(give!);
      expect(screen.queryByText(/Choose a Boon/i)).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
```
In `src/components/PartyPanel.test.tsx`, add a relic-display test (imports already include
`fireEvent` from the items work):
```tsx
  it('lists a hero relic when expanded', () => {
    render(<PartyPanel partyIds={['mara-dawnwarden']} hp={{ 'mara-dawnwarden': 8 }} difficulty="normal" relics={{ 'mara-dawnwarden': ['whetstone'] }} />);
    fireEvent.click(screen.getByRole('button', { name: /Mara Dawnwarden/i }));
    expect(screen.getByText(/Whetstone/)).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/GameScreen.test.tsx src/components/PartyPanel.test.tsx`
Expected: FAIL — no "Choose a Boon" panel; PartyPanel ignores `relics`.

- [ ] **Step 4: Add the draft panel to GameScreen**

In `src/components/GameScreen.tsx`:

(a) Update imports:
```tsx
import { useMemo, useState } from 'react';
```
```tsx
import { getItem } from '../engine/items';
import { rollRelicChoices, getRelic } from '../engine/relics';
import { defaultRng } from '../engine/rng';
```
(`getItem`, `getCharacter`, `defaultRng` may already be imported — keep a single import line each.)

(b) After the existing `const [pending, setPending] = useState<Pending | null>(null);`, add the
draft hooks (must be before the `if (scene.type !== 'story') return null;` early return):
```tsx
  const [pendingRelic, setPendingRelic] = useState<string | null>(null);
  const drafting = state.draftsAvailable > 0;
  const draftChoices = useMemo(() => (drafting ? rollRelicChoices(defaultRng, 3) : []), [state.draftsAvailable, drafting]);
```

(c) In the returned JSX, at the very top of the left column `<div>` (immediately before
`<NarrationLog ... />`), insert the draft panel:
```tsx
      <div>
        {drafting && (
          <div className="panel panel--framed" style={{ marginBottom: 16 }}>
            <h3 className="scene-title" style={{ marginTop: 0 }}>Choose a Boon</h3>
            <div className="scene-rule" />
            {!pendingRelic ? (
              <>
                <p className="muted">Claim a relic for one of your heroes.</p>
                <div className="stack">
                  {draftChoices.map((id) => {
                    const r = getRelic(id);
                    return (
                      <button key={id} className="btn btn-choice" onClick={() => { sfx.click(); setPendingRelic(id); }}>
                        <strong>✦ {r.name}</strong> — {r.description}
                      </button>
                    );
                  })}
                </div>
                <button className="btn" style={{ marginTop: 10 }} onClick={() => { sfx.click(); dispatch({ type: 'SKIP_DRAFT' }); }}>Skip this boon</button>
              </>
            ) : (
              <>
                <p className="muted">Give <strong className="accent-text">✦ {getRelic(pendingRelic).name}</strong> to:</p>
                <div className="row">
                  {state.partyIds.map((id) => (
                    <button key={id} className="btn btn-primary" onClick={() => { sfx.click(); dispatch({ type: 'GRANT_RELIC', heroId: id, relicId: pendingRelic }); setPendingRelic(null); }}>
                      {getCharacter(id).portrait} {getCharacter(id).name}
                    </button>
                  ))}
                </div>
                <button className="btn" style={{ marginTop: 10 }} onClick={() => { sfx.click(); setPendingRelic(null); }}>← Back</button>
              </>
            )}
          </div>
        )}
        <NarrationLog entries={state.log} />
```
(The existing `<NarrationLog entries={state.log} />` line is now preceded by the draft panel —
do not duplicate it.)

(d) Pass `relics` to the party panel:
```tsx
        <PartyPanel partyIds={state.partyIds} hp={state.hp} difficulty={state.difficulty} level={state.campaign?.level ?? 1} relics={state.relics} />
```

- [ ] **Step 5: Show relics in PartyPanel**

In `src/components/PartyPanel.tsx`:

(a) Add the import:
```ts
import { getRelic } from '../engine/relics';
```
(b) Extend `Props`:
```ts
interface Props {
  partyIds: string[];
  hp: Record<string, number>;
  difficulty: Difficulty;
  level?: number;
  relics?: Record<string, string[]>;
}
```
(c) Update the signature:
```ts
export function PartyPanel({ partyIds, hp, difficulty, level = 1, relics = {} }: Props) {
```
(d) Inside the expanded block, after the `{power && ...}` line, add the relic list:
```tsx
                {power && <div className="accent-text" style={{ fontSize: '0.8rem' }}>✦ {power.name}</div>}
                {(relics[id] ?? []).length > 0 && (
                  <div className="faint" style={{ fontSize: '0.8rem' }}>
                    Relics: {(relics[id] ?? []).map((rid) => getRelic(rid).name).join(', ')}
                  </div>
                )}
```

- [ ] **Step 6: Show relic tags on combat hero cards**

In `src/components/CombatView.tsx`:

(a) Add the import:
```ts
import { getRelic } from '../engine/relics';
```
(b) In the hero card, after the cover-badge block (the `{h.backLine && h.hp > 0 && (...)}`
block), add the relic tags:
```tsx
                  {(state.relics[h.heroId!] ?? []).length > 0 && (
                    <div className="row" style={{ gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                      {(state.relics[h.heroId!] ?? []).map((rid) => (
                        <span key={rid} className="tag" style={{ fontSize: '0.7rem' }} title={getRelic(rid).description}>✦ {getRelic(rid).name}</span>
                      ))}
                    </div>
                  )}
```
(c) Build heroes with their relics — update the `toHero` call in the `useState` initializer:
```ts
      return toHero(id, state.hp[id] ?? effectiveMaxHp(c, state.difficulty, level), state.relics[id] ?? []);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/components/GameScreen.test.tsx src/components/PartyPanel.test.tsx src/components/CombatView.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/GameScreen.tsx src/components/PartyPanel.tsx src/components/CombatView.tsx src/components/GameScreen.test.tsx src/components/PartyPanel.test.tsx src/components/CombatView.test.tsx
git commit -m "feat: relic draft panel and relic display in party/combat"
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

Reuse the chromium build at `/home/lamig/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`.
Start `npm run dev -- --port 5183 --host` in the background, then a `.mjs` from the repo root
that: seeds a scene save with `draftsAvailable: 1`, reloads, screenshots the "Choose a Boon"
panel, clicks a relic then a hero, then expands that hero's party card and screenshots the
listed relic. Read the screenshots with the Read tool. Stop the dev server and delete the drive
script + screenshots afterward.

- [ ] **Step 3: Push to main and watch the deploy**

```bash
git push origin main
gh run watch "$(gh run list --workflow=deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId')" --exit-status
```
Expected: deploy succeeds; confirm the live bundle hash changed at https://gledilami.github.io/tavern/.
```
