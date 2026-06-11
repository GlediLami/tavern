# Combat Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Checkbox steps.

**Goal:** Telegraphed enemy intent (deterministic targeting) + battle-line Taunt/Mark verbs.

**Architecture:** A pure `enemyIntent(state, enemyId)` is the single source of truth for what an
enemy will do; `performEnemyTurn` executes it. Targeting is deterministic (taunter > lowest-HP >
order). `performTaunt`/`performMark` + a mark damage bonus in `applyAttack`.

**Tech Stack:** React 18 + TypeScript, Vitest.

---

### Task 1: enemyIntent + deterministic targeting (engine)

**Files:** `src/types.ts`, `src/engine/combat.ts`, `src/engine/combat.test.ts`

- [ ] **Step 1: Add types**

In `src/types.ts`:
- Add the intent type (after `AttackEvent`):
```ts
export interface EnemyIntent {
  kind: 'attack' | 'buff' | 'debuff';
  targetId?: string;
  estDamage?: number;   // rounded average damage, for attack intents
  label?: string;       // attack or ability name
}
```
- `Combatant` — add `marked?: boolean;` (after `damageReduction?`).
- `CombatState` — add `tauntTargetId?: string;` (after `lastAttack?`).

- [ ] **Step 2: Failing tests** — add to `src/engine/combat.test.ts`:
```ts
  it('avgDamage rounds the average of the dice plus bonus', () => {
    expect(avgDamage('1d6', 2)).toBe(6); // 3.5 -> 4, +2
    expect(avgDamage('2d6', 0)).toBe(7);
  });

  it('enemyIntent attacks the lowest-HP hero (ties by order)', () => {
    let st = startCombat([makeHero('h1', 10, 20), makeHero('h2', 10, 20)], [goblin], hit);
    st.combatants.find((c) => c.id === 'h2')!.hp = 4; // h2 wounded
    const intent = enemyIntent(st, 'enemy-0');
    expect(intent?.kind).toBe('attack');
    expect(intent?.targetId).toBe('h2');
    expect(intent?.estDamage).toBe(avgDamage('1d6', 2));
  });

  it('enemyIntent prefers the taunter over the lowest-HP hero', () => {
    let st = startCombat([makeHero('h1', 10, 20), makeHero('h2', 10, 20)], [goblin], hit);
    st.combatants.find((c) => c.id === 'h2')!.hp = 4;
    st = { ...st, tauntTargetId: 'h1' };
    expect(enemyIntent(st, 'enemy-0')?.targetId).toBe('h1');
  });

  it('enemyIntent reports a buff/debuff for ability enemies', () => {
    const bSt = startCombat([makeHero('h1', 10)], [buffer, goblin], hit);
    expect(enemyIntent(bSt, 'enemy-0')).toMatchObject({ kind: 'buff', targetId: 'enemy-1' });
    const hSt = startCombat([makeHero('h1', 10)], [hexer], hit);
    expect(enemyIntent(hSt, 'enemy-0')).toMatchObject({ kind: 'debuff', targetId: 'h1' });
  });
```
Extend the imports at the top of the file:
```ts
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant, applyAttack, applyHeal, enemyIntent, avgDamage } from './combat';
```

- [ ] **Step 3: Run — expect FAIL** (`enemyIntent`/`avgDamage` not exported)

`npx vitest run src/engine/combat.test.ts`

- [ ] **Step 4: Implement** — in `src/engine/combat.ts`:
- Add the `EnemyIntent` import to the type import line:
```ts
import type { Hero, Enemy, Ability, Combatant, CombatState, AttackEvent, EnemyIntent } from '../types';
```
- Add constants near the top (after the imports):
```ts
export const MARK_BONUS = 2;
export const TACTIC_USES = 2;
```
- Add these functions (place them just before `performEnemyTurn`):
```ts
export function avgDamage(dice: string, bonus: number): number {
  const m = /^\s*(\d+)d(\d+)/.exec(dice);
  if (!m) return bonus;
  return Math.round((parseInt(m[1], 10) * (parseInt(m[2], 10) + 1)) / 2) + bonus;
}

// Deterministic hero target: the taunter if alive, else the lowest-HP hero (ties -> turn order).
function pickHero(state: CombatState, candidates: Combatant[]): Combatant | undefined {
  if (candidates.length === 0) return undefined;
  if (state.tauntTargetId) {
    const t = candidates.find((h) => h.id === state.tauntTargetId);
    if (t) return t;
  }
  let best = candidates[0];
  let bestIdx = state.order.indexOf(best.id);
  for (const h of candidates) {
    const idx = state.order.indexOf(h.id);
    if (h.hp < best.hp || (h.hp === best.hp && idx < bestIdx)) { best = h; bestIdx = idx; }
  }
  return best;
}

// Pure: what this enemy will do on its turn (the telegraph), matching performEnemyTurn.
export function enemyIntent(state: CombatState, enemyId: string): EnemyIntent | undefined {
  const enemy = state.combatants.find((c) => c.id === enemyId);
  if (!enemy || enemy.hp <= 0) return undefined;
  if (enemy.ability && (enemy.abilityUses ?? 0) > 0) {
    if (enemy.ability.kind === 'buff') {
      const ally = state.combatants.find((c) => !c.isHero && c.hp > 0 && c.id !== enemy.id && c.nextAttack !== 'adv');
      if (ally) return { kind: 'buff', targetId: ally.id, label: enemy.ability.name };
    } else {
      const hero = pickHero(state, livingHeroes(state).filter((h) => h.nextAttack !== 'dis'));
      if (hero) return { kind: 'debuff', targetId: hero.id, label: enemy.ability.name };
    }
  }
  const target = pickHero(state, livingHeroes(state));
  if (!enemy.attack || !target) return undefined;
  return { kind: 'attack', targetId: target.id, estDamage: avgDamage(enemy.attack.damageDice, enemy.attack.damageBonus), label: enemy.attack.name };
}
```

- [ ] **Step 5: Run — expect PASS**; **Commit** `feat: enemyIntent + deterministic targeting + avgDamage`

---

### Task 2: performEnemyTurn executes the intent

**Files:** `src/engine/combat.ts`, `src/engine/combat.test.ts`

- [ ] **Step 1: Failing test** — add to `src/engine/combat.test.ts`:
```ts
  it('performEnemyTurn attacks the intent target (deterministic, not random)', () => {
    let st = startCombat([makeHero('h1', 10, 20), makeHero('h2', 10, 20)], [goblin], hit);
    st.combatants.find((c) => c.id === 'h2')!.hp = 4; // h2 is the focus
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, hit);
    expect(st.lastAttack?.targetName).toBe('h2');
  });
```

- [ ] **Step 2: Run — expect FAIL** (random pick may not choose h2)

- [ ] **Step 3: Refactor `performEnemyTurn`** — in `src/engine/combat.ts`, replace the whole body
from `const enemy = ...` through the end of the function with:
```ts
  const enemy = next.combatants.find((c) => c.id === next.order[next.turnIndex])!;
  const intent = enemyIntent(next, enemy.id);

  if (intent?.kind === 'buff') {
    const ally = next.combatants.find((c) => c.id === intent.targetId)!;
    ally.nextAttack = 'adv';
    enemy.abilityUses = (enemy.abilityUses ?? 0) - 1;
    next.log.push(`${enemy.name} uses ${enemy.ability!.name} — ${ally.name} attacks with advantage.`);
    next.lastAttack = undefined;
  } else if (intent?.kind === 'debuff') {
    const hero = next.combatants.find((c) => c.id === intent.targetId)!;
    hero.nextAttack = 'dis';
    enemy.abilityUses = (enemy.abilityUses ?? 0) - 1;
    next.log.push(`${enemy.name} uses ${enemy.ability!.name} — ${hero.name} attacks with disadvantage.`);
    next.lastAttack = undefined;
  } else if (intent?.kind === 'attack') {
    const target = next.combatants.find((c) => c.id === intent.targetId)!;
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
    const isCrit = d20 === 20;
    const hit = isCrit || (d20 !== 1 && d20 + enemy.attack!.toHit >= target.ac);
    let rolls: number[] = [];
    let total = 0;
    if (hit) {
      const dmg = rollDice(enemy.attack!.damageDice, rng, enemy.attack!.damageBonus);
      rolls = [...dmg.rolls];
      if (isCrit) rolls = [...rolls, ...rollDice(enemy.attack!.damageDice, rng).rolls];
      total = rolls.reduce((a, b) => a + b, 0) + enemy.attack!.damageBonus;
      total = Math.max(0, total - (target.damageReduction ?? 0));
      target.hp = Math.max(0, target.hp - total);
      next.log.push(`${enemy.name} hits ${target.name} with ${enemy.attack!.name} for ${total} damage${isCrit ? ' (CRITICAL!)' : ''}.`);
      if (target.hp === 0) next.log.push(`${target.name} is down!`);
    } else {
      next.log.push(`${enemy.name} attacks ${target.name} but misses.`);
    }
    next.lastAttack = {
      kind: 'attack', attackerName: enemy.name, targetName: target.name, actionName: enemy.attack!.name,
      targetId: target.id, d20, toHit: enemy.attack!.toHit, ac: target.ac, hit, crit: isCrit,
      damageDice: enemy.attack!.damageDice, damageRolls: rolls, damageBonus: enemy.attack!.damageBonus, amount: total,
      mode, d20Rolls: mode ? d20Rolls : undefined,
    };
  }

  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
```

- [ ] **Step 4: Run** `npx vitest run src/engine/combat.test.ts` — expect PASS (the existing
  buff/debuff/attack/cover tests stay green — deterministic tie-break uses turn order, and those
  fixtures put the targeted hero first). **Commit** `feat: performEnemyTurn executes the telegraphed intent`

---

### Task 3: Taunt, Mark, and the mark damage bonus

**Files:** `src/engine/combat.ts`, `src/engine/combat.test.ts`

- [ ] **Step 1: Failing tests** — add to `src/engine/combat.test.ts`:
```ts
  it('performTaunt sets tauntTargetId; advanceTurn clears it on the taunter\'s turn', () => {
    let st = startCombat([makeHero('tank', 10), makeHero('archer', 10)], [goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('tank') };
    st = performTaunt(st, 'tank');
    expect(st.tauntTargetId).toBe('tank');
    // cycle the turn order all the way back to the tank -> taunt expires
    while (st.order[st.turnIndex] !== 'tank') advanceTurn(st);
    expect(st.tauntTargetId).toBeUndefined();
  });

  it('performMark marks an enemy and applyAttack adds the mark bonus', () => {
    let st = startCombat([makeHero('h1', 10)], [goblin], hit);
    st = performMark(st, 'h1', 'enemy-0');
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.marked).toBe(true);
    st = { ...st, turnIndex: st.order.indexOf('h1') };
    const ev = applyAttack(st, 'h1', 'Sword', 'enemy-0', hit); // crit: 1d8(8)+1d8(8)+3+MARK(2)
    expect(ev.amount).toBe(8 + 8 + 3 + 2);
  });
```
Extend the import line to include `performTaunt, performMark`:
```ts
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant, applyAttack, applyHeal, enemyIntent, avgDamage, performTaunt, performMark } from './combat';
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — in `src/engine/combat.ts`:
- In `advanceTurn`, clear an expired taunt. After `state.turnIndex = next;` add:
```ts
  state.turnIndex = next;
  if (state.tauntTargetId && state.order[next] === state.tauntTargetId) state.tauntTargetId = undefined;
```
- In `applyAttack`, add the mark bonus to `flat`. Change the `const flat = ...` line to:
```ts
  const flat = stats.damageBonus + (opts.bonusFlat ?? 0) + (attacker.relicDamage ?? 0) + (bloodied ? (attacker.bloodiedDamage ?? 0) : 0) + (target.marked ? MARK_BONUS : 0);
```
- Add the two perform functions (after `performHeroHeal`):
```ts
export function performTaunt(state: CombatState, taunterId: string): CombatState {
  const next = clone(state);
  const taunter = next.combatants.find((c) => c.id === taunterId)!;
  next.tauntTargetId = taunterId;
  next.log.push(`${taunter.name} roars a challenge — the foes turn toward them!`);
  next.lastAttack = undefined;
  if (next.status === 'active') advanceTurn(next);
  return next;
}

export function performMark(state: CombatState, markerId: string, enemyId: string): CombatState {
  const next = clone(state);
  const marker = next.combatants.find((c) => c.id === markerId)!;
  const enemy = next.combatants.find((c) => c.id === enemyId);
  if (enemy) { enemy.marked = true; next.log.push(`${marker.name} marks ${enemy.name} — strike it down!`); }
  next.lastAttack = undefined;
  if (next.status === 'active') advanceTurn(next);
  return next;
}
```

- [ ] **Step 4: Run** `npx vitest run src/engine/combat.test.ts` — expect PASS.
  **Commit** `feat: Taunt redirects intents, Mark adds a damage bonus`

---

### Task 4: CombatView — intent badge, Taunt/Mark buttons

**Files:** `src/components/CombatView.tsx`, `src/components/CombatView.test.tsx`

- [ ] **Step 1: Failing tests** — add to `src/components/CombatView.test.tsx`:
```tsx
  it('shows an enemy intent badge', () => {
    renderCombat();
    expect(screen.getAllByText(/→ Gronk Skullsplitter/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows Taunt for a front-line hero and Mark for a back-line hero', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      renderCombat(); // Gronk (Greataxe = melee, front line)
      expect(screen.getByRole('button', { name: /Taunt/i })).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it('shows Mark for a back-line hero', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      renderCombat({ partyIds: ['thornwick-greenstride'], hp: { 'thornwick-greenstride': 12 } });
      expect(screen.getByRole('button', { name: /Mark/i })).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — in `src/components/CombatView.tsx`:

(a) Extend the combat import:
```ts
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant, clone, enemyIntent, performTaunt, performMark, TACTIC_USES } from '../engine/combat';
```
(b) Add state (next to `handoffDoneFor`):
```ts
  const [pendingMark, setPendingMark] = useState(false);
  const [tacticUses, setTacticUses] = useState<Record<string, number>>(() => {
    const u: Record<string, number> = {};
    state.partyIds.forEach((id) => { u[id] = TACTIC_USES; });
    return u;
  });
```
(c) Extend `selectingEnemy` to include mark targeting:
```ts
  const selectingEnemy = pendingPower?.targeting === 'enemy' || pendingItem?.targeting === 'enemy' || pendingMark;
```
(d) Add a combatant-display helper + the tactic handlers (after `spendLuckAdvantage`):
```ts
  function nameOf(id: string): string {
    const c = combat.combatants.find((x) => x.id === id);
    if (!c) return '';
    return c.isHero ? heroDisplayName(c.heroId!, state.playerNames) : c.name;
  }

  function doTaunt() {
    sfx.click();
    setTacticUses((u) => ({ ...u, [actor.id]: (u[actor.id] ?? 0) - 1 }));
    applyResult(performTaunt(combat, actor.id));
  }

  function markFoe(enemyId: string) {
    sfx.click();
    setPendingMark(false);
    setTacticUses((u) => ({ ...u, [actor.id]: (u[actor.id] ?? 0) - 1 }));
    applyResult(performMark(combat, actor.id, enemyId));
  }
```
(e) The foe button `onClick` — handle a pending mark. Replace it with:
```tsx
                  onClick={() => { sfx.click(); if (!selectingEnemy) { setTarget(e.id); } else if (pendingMark) { markFoe(e.id); } else if (pendingItem) { consumeItem(pendingItem, [e.id]); } else { resolvePower([e.id]); } }}
```
(f) Render the intent badge + marked tag inside the enemy card, just after the
`<div className="row" style={{ gap: 8, marginTop: 5, ... }}>...AC/ability...</div>` block (i.e.
before the closing `</button>` of the foe card). Insert:
```tsx
                  {e.hp > 0 && (() => {
                    const intent = enemyIntent(combat, e.id);
                    if (!intent) return null;
                    const txt = intent.kind === 'attack'
                      ? `⚔ → ${nameOf(intent.targetId!)} ·~${intent.estDamage}`
                      : intent.kind === 'buff'
                        ? `✦ ${intent.label} → ${nameOf(intent.targetId!)}`
                        : `✦ ${intent.label} → ${nameOf(intent.targetId!)}`;
                    return <div className="tag" style={{ fontSize: '0.74rem', marginTop: 6, display: 'inline-block' }}>{txt}</div>;
                  })()}
                  {e.marked && <div className="tag" style={{ fontSize: '0.72rem', marginTop: 6, marginLeft: 6, display: 'inline-block', color: 'var(--accent-bright)' }}>🎯 Marked</div>}
```
(g) Add a `pendingMark` prompt branch in the action panel — insert it right after the `pendingItem`
branch's closing `)` and before the normal-actions `: (`:
```tsx
          ) : pendingMark ? (
            <>
              <p className="muted" style={{ marginTop: 4 }}>Choose a foe to mark.</p>
              <button className="btn" onClick={() => { sfx.click(); setPendingMark(false); }}>← Cancel</button>
            </>
```
(h) Add the Taunt/Mark button in the normal hero-action row, right after the Luck button block:
```tsx
                {state.luck > 0 && !actor.nextAttack && (
                  <button className="btn" title="Spend a Luck token for advantage on this attack" onClick={spendLuckAdvantage}>
                    ✦ Luck: advantage ({state.luck})
                  </button>
                )}
                {!actor.backLine ? (
                  <button className="btn" disabled={(tacticUses[actor.id] ?? 0) <= 0} title="Roar a challenge — foes target you until your next turn" onClick={doTaunt}>
                    🛡 Taunt ({tacticUses[actor.id] ?? 0})
                  </button>
                ) : (
                  <button className="btn" disabled={(tacticUses[actor.id] ?? 0) <= 0} title="Mark a foe — the party deals +2 damage to it" onClick={() => { sfx.click(); setItemMenuOpen(false); setPendingMark(true); }}>
                    🎯 Mark ({tacticUses[actor.id] ?? 0})
                  </button>
                )}
```

- [ ] **Step 4: Run** `npx vitest run src/components/CombatView.test.tsx` — expect PASS.
  **Commit** `feat: enemy intent badges + Taunt/Mark buttons in combat`

---

### Task 5: Verify + push

- [ ] **Step 1:** `npm run lint && npx tsc --noEmit && npm test && npm run build` — all green.
- [ ] **Step 2:** Playwright spot-check: seed a combat with a melee + ranged hero; screenshot the
  enemy intent badges; click 🛡 Taunt and confirm the arrows retarget onto the taunter; on a ranged
  hero, click 🎯 Mark a foe and confirm the 🎯 tag. Read screenshots, clean up.
- [ ] **Step 3:** `git push origin main`, watch the deploy, confirm the live bundle hash changed.
```
