# Combat depth + party-sheet improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, the
> owner's preference) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make Sacred Flame a Dexterity save, give ranged heroes "back-line cover," scale
campaign enemies with party level, and let players expand party stat cards while delving.

**Architecture:** Extend the pure combat engine with a save-based attack path and a back-line
flag, add a `level` parameter to enemy scaling, and make `PartyPanel` cards expandable. All new
data fields are optional, so no `GameState` fixture changes are needed.

**Tech Stack:** React 18 + TypeScript, Vitest, plain CSS.

---

### Task 1: Save-based attacks (engine + types + Sacred Flame content)

**Files:**
- Modify: `src/types.ts` (Attack, Enemy, Combatant, AttackEvent)
- Modify: `src/engine/combat.ts` (ResolvedAttack, applyAttack, startCombat)
- Modify: `src/engine/party.ts` (makeHeroAttackLookup passes `save`)
- Modify: `src/content/characters.json` (Sacred Flame gets `"save": "dex"`)
- Test: `src/engine/combat.test.ts`

- [ ] **Step 1: Add the type fields**

In `src/types.ts`, `Attack` interface — add two optional fields:
```ts
export interface Attack {
  name: string;
  ability: Ability;
  damageDice: string;   // e.g. "1d8"
  damageBonus: number;
  save?: Ability;       // if set, target makes this saving throw instead of being attacked
  ranged?: boolean;     // ranged/thrown attack (used for back-line cover)
}
```
`Enemy` interface — add an optional Dexterity-save bonus:
```ts
export interface Enemy {
  name: string;
  maxHp: number;
  ac: number;
  attack: EnemyAttack;
  ability?: EnemyAbility;
  dexSave?: number;     // bonus to Dexterity saving throws (default +1 in the engine)
}
```
`Combatant` interface — add the carried-over fields:
```ts
  nextAttack?: 'adv' | 'dis';  // one-shot advantage/disadvantage on this combatant's next attack
  backLine?: boolean;          // hero whose primary attack is ranged (eligible for cover)
  dexSave?: number;            // enemy Dexterity save bonus
}
```
`AttackEvent` interface — add save readout fields:
```ts
  mode?: 'adv' | 'dis';  // advantage/disadvantage applied to the attack roll, if any
  d20Rolls?: number[];   // both raw d20s when rolled with advantage/disadvantage
  save?: Ability;        // set when this was a saving-throw spell (d20 is the target's save roll)
  saveDC?: number;       // the spell save DC the target rolled against
```

- [ ] **Step 2: Write the failing tests**

Add to `src/engine/combat.test.ts`. First add the import for the lookup type at the top:
```ts
import type { HeroAttackLookup } from './combat';
```
Then add these tests inside the `describe('combat', ...)` block:
```ts
  const saveLookup: HeroAttackLookup = () => ({
    ability: 'wis', damageDice: '1d8', damageBonus: 0, abilityScore: 17, save: 'dex',
  });

  it('a save spell damages a target that fails its Dexterity save', () => {
    const st = startCombat([makeHero('h1', 10)], [goblin], hit);
    // miss rng => save roll d20=1 (+1 default) = 2 < DC 13 -> fails; 1d8 rolls 1 -> 1 damage
    const ev = applyAttack(st, 'h1', 'Sacred Flame', 'enemy-0', miss, saveLookup);
    expect(ev.save).toBe('dex');
    expect(ev.saveDC).toBe(13);          // 8 + 2 prof + 3 (WIS 17)
    expect(ev.hit).toBe(true);           // failed save = "hit" for damage/flash
    expect(ev.amount).toBe(1);
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.hp).toBe(6);
  });

  it('a save spell deals no damage when the target succeeds', () => {
    const st = startCombat([makeHero('h1', 10)], [goblin], hit);
    // hit rng => save roll d20=20 (+1) = 21 >= DC 13 -> saves; no damage
    const ev = applyAttack(st, 'h1', 'Sacred Flame', 'enemy-0', hit, saveLookup);
    expect(ev.save).toBe('dex');
    expect(ev.hit).toBe(false);
    expect(ev.amount).toBe(0);
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.hp).toBe(7);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: FAIL — `ev.save` is undefined / property does not exist (save path not implemented).

- [ ] **Step 4: Implement the save path**

In `src/engine/combat.ts`:

(a) Add a constant near the top (after the imports):
```ts
export const DEFAULT_ENEMY_DEX_SAVE = 1;
```

(b) Extend `ResolvedAttack`:
```ts
export interface ResolvedAttack {
  ability: Ability;
  damageDice: string;
  damageBonus: number;
  abilityScore: number;
  save?: Ability;       // if set, the attack is resolved as a target saving throw
}
```

(c) In `applyAttack`, right after the line `attacker.nextAttack = undefined;`, insert the save
branch (before the existing `const { value: d20, ... }` line):
```ts
  if (stats.save) {
    const saveDC = 8 + 2 + abilityMod(stats.abilityScore); // 8 + proficiency + casting mod
    const saveBonus = stats.save === 'dex' ? (target.dexSave ?? DEFAULT_ENEMY_DEX_SAVE) : 0;
    const saveRoll = rollD20(rng);
    const saved = saveRoll + saveBonus >= saveDC;
    let saveRolls: number[] = [];
    let saveTotal = 0;
    const saveFlat = stats.damageBonus + (opts.bonusFlat ?? 0);
    if (!saved) {
      saveRolls = [...rollDice(stats.damageDice, rng).rolls];
      saveTotal = saveRolls.reduce((a, b) => a + b, 0) + saveFlat;
      target.hp = Math.max(0, target.hp - saveTotal);
      next.log.push(`${attacker.name} invokes ${attackName} — ${target.name} fails a DC ${saveDC} ${stats.save.toUpperCase()} save and takes ${saveTotal} damage.`);
      if (target.hp === 0) next.log.push(`${target.name} falls!`);
    } else {
      next.log.push(`${attacker.name} invokes ${attackName} — ${target.name} succeeds on a DC ${saveDC} ${stats.save.toUpperCase()} save and is unharmed.`);
    }
    return {
      kind: 'attack', attackerName: attacker.name, targetName: target.name, actionName: attackName,
      targetId, d20: saveRoll, toHit: saveBonus, ac: saveDC, hit: !saved, crit: false,
      save: stats.save, saveDC,
      damageDice: stats.damageDice, damageRolls: saveRolls, damageBonus: saveFlat, amount: saveTotal,
    };
  }
```

(d) In `startCombat`, the enemy push — carry the dex save onto the combatant:
```ts
  enemies.forEach((e, i) => {
    combatants.push({
      id: `enemy-${i}`, name: e.name, isHero: false,
      maxHp: e.maxHp, hp: e.maxHp, ac: e.ac,
      initiative: rollD20(rng) + 1,
      attack: e.attack,
      ability: e.ability,
      abilityUses: e.ability?.uses,
      dexSave: e.dexSave,
    });
  });
```

- [ ] **Step 5: Pass `save` through the hero lookup**

In `src/engine/party.ts`, `makeHeroAttackLookup` return value — add `save`:
```ts
    return {
      ability: atk.ability,
      damageDice: atk.damageDice,
      damageBonus: atk.damageBonus,
      abilityScore: c.abilities[atk.ability],
      save: atk.save,
    };
```

- [ ] **Step 6: Tag Sacred Flame in content**

In `src/content/characters.json`, Mara's Sacred Flame attack — add `"save": "dex"`:
```json
      {
        "name": "Sacred Flame",
        "ability": "wis",
        "damageDice": "1d8",
        "damageBonus": 0,
        "save": "dex"
      }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: PASS (all combat tests, including the two new save tests).

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/engine/combat.ts src/engine/party.ts src/content/characters.json src/engine/combat.test.ts
git commit -m "feat: Sacred Flame and other spells can force a saving throw"
```

---

### Task 2: Save line in the dice readout

**Files:**
- Modify: `src/components/CombatDice.tsx`
- Test: `src/components/CombatDice.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/CombatDice.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CombatDice } from './CombatDice';
import type { AttackEvent } from '../types';

const base: AttackEvent = {
  kind: 'attack', attackerName: 'Mara', targetName: 'Goblin', actionName: 'Sacred Flame',
  targetId: 'enemy-0', d20: 9, toHit: 1, ac: 13, hit: true, crit: false,
  save: 'dex', saveDC: 13, damageDice: '1d8', damageRolls: [5], damageBonus: 0, amount: 5,
};

describe('CombatDice', () => {
  it('renders a saving-throw line for save spells', () => {
    render(<CombatDice event={base} />);
    expect(screen.getByText(/DEX save/i)).toBeInTheDocument();
    expect(screen.getByText(/FAILED/)).toBeInTheDocument();
  });

  it('shows SAVED and no damage when the target saves', () => {
    render(<CombatDice event={{ ...base, hit: false, amount: 0, damageRolls: [] }} />);
    expect(screen.getByText(/SAVED/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/CombatDice.test.tsx`
Expected: FAIL — "DEX save" / "FAILED" text not found (no save branch yet).

- [ ] **Step 3: Implement the save branch**

In `src/components/CombatDice.tsx`, change the existing attack-roll guard so it skips save
spells (add `!event.save`):
```tsx
      {!isHeal && !event.save && event.d20 !== undefined && (
```
Then add a save block immediately after that existing `)}` closing the attack-roll line and
before the damage block:
```tsx
      {!isHeal && event.save && event.d20 !== undefined && (
        <div className="cd-roll">
          <span className={`cd-d20${event.hit ? ' fumble' : ''}`}>{event.d20}</span>
          <span className="cd-math">
            {event.save.toUpperCase()} save: d20 {event.d20} {fmt(event.toHit ?? 0)} ={' '}
            <strong>{event.d20 + (event.toHit ?? 0)}</strong> vs DC {event.saveDC}
          </span>
          <span className={`cd-result ${event.hit ? 'hit' : 'miss'}`}>
            {event.hit ? 'FAILED' : 'SAVED'}
          </span>
        </div>
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/CombatDice.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CombatDice.tsx src/components/CombatDice.test.tsx
git commit -m "feat: show saving-throw line in the combat dice readout"
```

---

### Task 3: Back-line cover (engine + content tags)

**Files:**
- Modify: `src/engine/combat.ts` (startCombat sets `backLine`; performEnemyTurn applies cover)
- Modify: `src/content/characters.json` (tag ranged/thrown attacks `"ranged": true`)
- Test: `src/engine/combat.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/combat.test.ts`. First add a ranged-hero factory near `makeHero`:
```ts
function makeRangedHero(id: string, hp = 20): Hero {
  return {
    id, name: id, race: 'r', class: 'c', level: 1, portrait: '🏹',
    abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: hp, hp, ac: 14, proficiencyBonus: 2,
    skillProficiencies: [],
    attacks: [{ name: 'Bow', ability: 'dex', damageDice: '1d8', damageBonus: 3, ranged: true }],
    backstory: '',
  };
}
```
Then add these tests inside the `describe` block:
```ts
  it('marks a hero whose primary attack is ranged as back-line', () => {
    const st = startCombat([makeRangedHero('archer'), makeHero('tank', 10)], [goblin], hit);
    expect(st.combatants.find((c) => c.id === 'archer')!.backLine).toBe(true);
    expect(st.combatants.find((c) => c.id === 'tank')!.backLine).toBeFalsy();
  });

  it('enemies attack a covered back-line hero with disadvantage', () => {
    // party order [archer (back), tank (front)]; miss rng picks target index 0 = archer
    let st = startCombat([makeRangedHero('archer'), makeHero('tank', 10)], [goblin], miss);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, miss);
    expect(st.lastAttack?.targetName).toBe('archer');
    expect(st.lastAttack?.mode).toBe('dis');
    expect(st.lastAttack?.d20Rolls).toHaveLength(2);
  });

  it('back-line cover disappears once the front line is down', () => {
    let st = startCombat([makeRangedHero('archer'), makeHero('tank', 10)], [goblin], miss);
    st.combatants.find((c) => c.id === 'tank')!.hp = 0; // front line falls
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, miss);
    expect(st.lastAttack?.targetName).toBe('archer');
    expect(st.lastAttack?.mode).toBeUndefined();
  });

  it('enemy advantage cancels back-line cover to a straight roll', () => {
    let st = startCombat([makeRangedHero('archer'), makeHero('tank', 10)], [goblin], miss);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st.combatants.find((c) => c.id === 'enemy-0')!.nextAttack = 'adv';
    st = performEnemyTurn(st, miss);
    expect(st.lastAttack?.mode).toBeUndefined();
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.nextAttack).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: FAIL — `backLine` undefined / `mode` not 'dis' (cover not implemented).

- [ ] **Step 3: Set `backLine` in startCombat**

In `src/engine/combat.ts`, the hero push inside `startCombat`:
```ts
  for (const h of heroes) {
    combatants.push({
      id: h.id, name: h.name, isHero: true, heroId: h.id,
      primaryAttack: h.attacks[0]?.name,
      maxHp: h.maxHp, hp: h.hp, ac: h.ac,
      initiative: rollD20(rng) + abilityMod(h.abilities.dex),
      backLine: !!h.attacks[0]?.ranged,
    });
  }
```

- [ ] **Step 4: Apply cover in performEnemyTurn**

In `src/engine/combat.ts`, inside `performEnemyTurn`, replace this block:
```ts
    const target = targets[Math.floor(rng() * targets.length)];
    const mode = enemy.nextAttack;
    enemy.nextAttack = undefined;
    const { value: d20, rolls: d20Rolls } = rollD20WithMode(rng, mode);
```
with:
```ts
    const target = targets[Math.floor(rng() * targets.length)];
    const frontLineAlive = next.combatants.some((c) => c.isHero && c.hp > 0 && !c.backLine);
    const covered = !!target.backLine && frontLineAlive;
    const hasAdv = enemy.nextAttack === 'adv';
    const hasDis = enemy.nextAttack === 'dis' || covered;
    let mode: 'adv' | 'dis' | undefined;
    if (hasAdv && hasDis) mode = undefined;
    else if (hasAdv) mode = 'adv';
    else if (hasDis) mode = 'dis';
    enemy.nextAttack = undefined;
    if (covered && mode === 'dis') next.log.push(`${target.name} fights from cover — ${enemy.name} attacks at disadvantage.`);
    const { value: d20, rolls: d20Rolls } = rollD20WithMode(rng, mode);
```

- [ ] **Step 5: Tag ranged attacks in content**

In `src/content/characters.json`, add `"ranged": true` to each of these attacks (find them by
name and add the field alongside `damageBonus`):
- Bjorn → `Light Crossbow`
- Sable → `Shortbow`
- Mara → `Sacred Flame`
- Alaric → `Fire Bolt`
- Thornwick → `Longbow`
- Gronk → `Handaxe (thrown)`
- Lyra → `Javelin (thrown)`
- Fennel → `Vicious Mockery`
- Rowan → `Produce Flame`
- Ignis → `Fire Bolt`
- Vesper → `Eldritch Blast`

Example (Thornwick's Longbow, his primary — makes him back-line):
```json
      {
        "name": "Longbow",
        "ability": "dex",
        "damageDice": "1d8",
        "damageBonus": 3,
        "ranged": true
      },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/engine/combat.test.ts`
Expected: PASS (existing enemy-turn tests still pass — their heroes use melee `Sword`, so
`covered` is false and behavior is unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/engine/combat.ts src/content/characters.json src/engine/combat.test.ts
git commit -m "feat: ranged heroes gain back-line cover while a melee ally screens them"
```

---

### Task 4: Cover badge + scaling wiring in CombatView

**Files:**
- Modify: `src/components/CombatView.tsx`

- [ ] **Step 1: Pass campaign level to scaleEnemies**

In `src/components/CombatView.tsx`, the `scaleEnemies` call inside the `useState` initializer:
```ts
    const enemies = scaleEnemies(scene.enemies, state.difficulty, state.partyIds.length, level);
```
(`level` is already computed at the top of the component as `state.campaign?.level ?? 1`.)

- [ ] **Step 2: Compute front-line status for the cover badge**

In `src/components/CombatView.tsx`, after the line
`const livingEnemies = combat.combatants.filter((c) => !c.isHero && c.hp > 0);`, add:
```ts
  const frontLineAlive = combat.combatants.some((c) => c.isHero && c.hp > 0 && !c.backLine);
```

- [ ] **Step 3: Render the cover badge on back-line hero cards**

In `src/components/CombatView.tsx`, inside the hero `.map((h) => ...)`, just after the HP line
`<div className="muted" style={{ fontSize: '0.82rem', marginTop: 5 }}>{h.hp}/{h.maxHp} HP</div>`,
add:
```tsx
                  {h.backLine && h.hp > 0 && (
                    <div className="tag" style={{ fontSize: '0.72rem', marginTop: 5, display: 'inline-block' }}
                      title={frontLineAlive ? 'At range — enemies attack at disadvantage while the front line holds' : 'Exposed — no front line to screen'}>
                      ⤢ {frontLineAlive ? 'Covered' : 'Exposed'}
                    </div>
                  )}
```

- [ ] **Step 4: Verify nothing broke**

Run: `npx vitest run src/components/CombatView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CombatView.tsx
git commit -m "feat: scale enemies by campaign level and show back-line cover in combat"
```

---

### Task 5: Gentle campaign enemy scaling (engine)

**Files:**
- Modify: `src/engine/difficulty.ts` (`scaleEnemies` gains a `level` parameter)
- Test: `src/engine/difficulty.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/difficulty.test.ts` inside the `describe('difficulty', ...)` block:
```ts
  it('scales enemies up with campaign level on a gentle curve', () => {
    const big = enemies[0]; // maxHp 14, toHit 5, dmg 3
    const l1 = scaleEnemies([big], 'hard', 4, 1)[0];
    expect(l1.maxHp).toBe(14);
    expect(l1.attack.toHit).toBe(5);
    expect(l1.attack.damageBonus).toBe(3);

    const l4 = scaleEnemies([big], 'hard', 4, 4)[0];
    expect(l4.maxHp).toBe(Math.round(14 * 1.6));        // 22
    expect(l4.attack.toHit).toBe(5 + 1);                // + floor(3/2)
    expect(l4.attack.damageBonus).toBe(3 + Math.round(0.6 * 3)); // + 2 => 5
  });

  it('level-1 scaling is a no-op (single tales unaffected)', () => {
    expect(scaleEnemies(enemies, 'hard', 4, 1)).toEqual(scaleEnemies(enemies, 'hard', 4));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/difficulty.test.ts`
Expected: FAIL — `scaleEnemies` ignores the 4th argument, so L4 stats equal L1.

- [ ] **Step 3: Add the level parameter**

In `src/engine/difficulty.ts`, replace the `scaleEnemies` signature and its final `return`:
```ts
// Adjust an encounter's enemies for difficulty, party size, and campaign level.
export function scaleEnemies(enemies: Enemy[], difficulty: Difficulty, partySize: number, level = 1): Enemy[] {
  const cfg = config(difficulty);
  let list = enemies;

  // Solo/duo scaling: drop the weakest extra so small parties aren't swamped.
  if (cfg.soloScaling && partySize <= 2 && list.length > 1) {
    const sorted = [...list].sort((a, b) => a.maxHp - b.maxHp);
    const dropId = sorted[0];
    let dropped = false;
    list = list.filter((e) => {
      if (!dropped && e === dropId) { dropped = true; return false; }
      return true;
    });
  }

  // Gentle per-level ramp so leveled parties still meet resistance.
  const hpMult = 1 + 0.2 * (level - 1);
  const toHitBonus = Math.floor((level - 1) / 2);
  const dmgBonus = Math.round(0.6 * (level - 1));

  return list.map((e) => ({
    ...e,
    maxHp: Math.round(e.maxHp * hpMult),
    attack: {
      ...e.attack,
      toHit: e.attack.toHit + cfg.enemyToHitDelta + toHitBonus,
      damageBonus: Math.max(0, Math.round(e.attack.damageBonus * cfg.enemyDamageMult)) + dmgBonus,
    },
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/difficulty.test.ts`
Expected: PASS (the existing difficulty tests still hold — level defaults to 1, hpMult 1).

- [ ] **Step 5: Commit**

```bash
git add src/engine/difficulty.ts src/engine/difficulty.test.ts
git commit -m "feat: scale enemy HP, to-hit, and damage with campaign level"
```

---

### Task 6: Expandable party stat cards

**Files:**
- Modify: `src/components/PartyPanel.tsx`
- Test: `src/components/PartyPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/PartyPanel.test.tsx` (and extend the import line to include `fireEvent`):
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
```
```tsx
  it('expands a card to reveal abilities, AC, attacks, and power', () => {
    render(<PartyPanel partyIds={['mara-dawnwarden']} hp={{ 'mara-dawnwarden': 8 }} difficulty="normal" />);
    expect(screen.queryByText('WIS +3')).toBeNull();        // collapsed by default
    fireEvent.click(screen.getByRole('button', { name: /Mara Dawnwarden/i }));
    expect(screen.getByText('WIS +3')).toBeInTheDocument();
    expect(screen.getByText('AC 18')).toBeInTheDocument();
    expect(screen.getByText(/Sacred Flame 1d8 \(DEX save\)/)).toBeInTheDocument();
    expect(screen.getByText(/Cure Wounds/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/PartyPanel.test.tsx`
Expected: FAIL — no button / "WIS +3" text (cards aren't expandable yet).

- [ ] **Step 3: Rewrite PartyPanel with expandable cards**

Replace the entire contents of `src/components/PartyPanel.tsx` with:
```tsx
import { useState } from 'react';
import { getCharacter } from '../engine/party';
import { effectiveMaxHp } from '../engine/difficulty';
import { abilityMod } from '../engine/skills';
import { getPower } from '../engine/powers';
import { hpColor } from '../ui/visuals';
import type { Ability, Difficulty } from '../types';

const ABILS: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

interface Props {
  partyIds: string[];
  hp: Record<string, number>;
  difficulty: Difficulty;
  level?: number;
}

export function PartyPanel({ partyIds, hp, difficulty, level = 1 }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="stack">
      {partyIds.map((id) => {
        const c = getCharacter(id);
        const max = Math.max(1, effectiveMaxHp(c, difficulty, level));
        const current = hp[id] ?? max;
        const ratio = current / max;
        const pct = Math.max(0, Math.min(100, ratio * 100));
        const down = current <= 0;
        const isOpen = !!open[id];
        const power = c.powerId ? getPower(c.powerId) : null;
        const attacksLine = c.attacks
          .map((a) => `${a.name} ${a.damageDice}${a.damageBonus ? `+${a.damageBonus}` : ''}${a.save ? ` (${a.save.toUpperCase()} save)` : ''}`)
          .join(' · ');
        return (
          <div key={id} className="panel" style={{ padding: 13, opacity: down ? 0.5 : 1 }}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
              style={{ background: 'none', border: 'none', padding: 0, margin: 0, width: '100%', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
            >
              <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span className="row" style={{ alignItems: 'center', gap: 8 }}>
                  <span className="portrait" style={{ width: 34, height: 34, fontSize: '1.2rem' }}>{c.portrait}</span>
                  <strong style={{ fontWeight: 600 }}>{c.name}</strong>
                </span>
                <span className="row" style={{ alignItems: 'center', gap: 6 }}>
                  <span className="faint" style={{ fontSize: '0.78rem' }}>{c.class}</span>
                  <span className="faint" aria-hidden style={{ fontSize: '0.7rem' }}>{isOpen ? '▾' : '▸'}</span>
                </span>
              </div>
            </button>
            <div className="hp-bar" style={{ marginTop: 9 }} role="progressbar" aria-label={`${c.name} hit points`} aria-valuenow={Math.max(0, current)} aria-valuemin={0} aria-valuemax={max}>
              <div className="hp-fill" style={{ width: `${pct}%`, background: hpColor(ratio) }} />
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
              {down
                ? <span style={{ color: 'var(--accent-bright)', fontWeight: 700, letterSpacing: '0.08em' }}>✟ DOWN</span>
                : <span className="muted">{current} / {max}</span>}
            </div>
            {isOpen && (
              <div className="stack" style={{ marginTop: 10, gap: 6 }}>
                <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                  {ABILS.map((a) => (
                    <span key={a} className="stat-pill" style={{ fontSize: '0.72rem' }}>
                      {a.toUpperCase()} {abilityMod(c.abilities[a]) >= 0 ? '+' : ''}{abilityMod(c.abilities[a])}
                    </span>
                  ))}
                  <span className="stat-pill" style={{ fontSize: '0.72rem', color: 'var(--blue)' }}>AC {c.ac}</span>
                </div>
                <div className="faint" style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>{attacksLine}</div>
                {power && <div className="accent-text" style={{ fontSize: '0.8rem' }}>✦ {power.name}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/PartyPanel.test.tsx`
Expected: PASS (both the original HP test and the new expand test).

- [ ] **Step 5: Commit**

```bash
git add src/components/PartyPanel.tsx src/components/PartyPanel.test.tsx
git commit -m "feat: expandable party cards show full stats while delving"
```

---

### Task 7: Content test for Sacred Flame + ranged tags

**Files:**
- Test: `src/content/characters.test.ts`

- [ ] **Step 1: Write the test**

Add to `src/content/characters.test.ts` inside the `describe('characters.json', ...)` block:
```ts
  it('Sacred Flame is a Dexterity-save spell', () => {
    const mara = characters.find((c) => c.id === 'mara-dawnwarden')!;
    const sf = mara.attacks.find((a) => a.name === 'Sacred Flame')!;
    expect(sf.save).toBe('dex');
  });

  it('ranged-primary heroes have their first attack tagged ranged', () => {
    const ranged = ['alaric-vance', 'thornwick-greenstride', 'fennel-quill', 'rowan-mossheart', 'ignis-emberfell', 'vesper-nightvow'];
    for (const id of ranged) {
      const c = characters.find((ch) => ch.id === id)!;
      expect(c.attacks[0].ranged, `${id} primary should be ranged`).toBe(true);
    }
  });
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/content/characters.test.ts`
Expected: PASS (Task 1 and Task 3 already added the data).

- [ ] **Step 3: Commit**

```bash
git add src/content/characters.test.ts
git commit -m "test: assert Sacred Flame save and ranged attack tags"
```

---

### Task 8: Full verification, browser check, push

- [ ] **Step 1: Run the whole suite + lint + type-check + build**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```
Expected: lint clean (one known benign react-refresh warning on GameContext.tsx is OK),
type-check clean, all tests pass, build succeeds.

- [ ] **Step 2: Browser spot-check with Playwright**

```bash
npm install --no-save playwright@1.60.0
```
Start the dev server (`npm run dev -- --port 5183 --host` in the background), then a `.mjs`
drive script from the repo root that: starts a single tale, confirms a party including Mara
and a ranged hero, opens the scene, expands a party card (assert ability mods visible), then
screenshots. Read the screenshot with the Read tool to confirm the expanded card and (if a
combat is reached) the `⤢ Covered` tag and a Sacred Flame save readout render. Stop the dev
server afterward.

- [ ] **Step 3: Push to main and watch the deploy**

```bash
git push origin main
```
Then find the deploy run and watch it:
```bash
gh run watch "$(gh run list --workflow=deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId')" --exit-status
```
Expected: deploy succeeds; verify the live site at https://gledilami.github.io/tavern/.
