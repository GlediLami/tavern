# Luck Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Checkbox steps.

**Goal:** A party-wide Luck pool — spend a token to reroll a skill check or grant a hero
advantage on their next attack.

**Architecture:** `GameState.luck` with a `SPEND_LUCK` action and per-adventure refills; the
`DiceRoller` exposes a reroll affordance; `CombatView` spends luck for advantage.

**Tech Stack:** React 18 + TypeScript, Vitest.

---

### Task 1: Luck state + persistence

**Files:** `src/state/gameReducer.ts`, `src/state/persistence.ts`, tests + fixtures.

- [ ] **Step 1: Failing tests**

Add to `src/state/gameReducer.test.ts`:
```ts
  it('CONFIRM_PARTY seeds luck and SPEND_LUCK decrements (clamped)', () => {
    let s = gameReducer(initialState, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    expect(s.luck).toBe(LUCK_PER_ADVENTURE);
    s = gameReducer(s, { type: 'SPEND_LUCK' });
    expect(s.luck).toBe(LUCK_PER_ADVENTURE - 1);
    s = gameReducer({ ...s, luck: 0 }, { type: 'SPEND_LUCK' });
    expect(s.luck).toBe(0);
  });

  it('ADVANCE_CAMPAIGN and resting refill luck', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    s = gameReducer({ ...s, luck: 0 }, { type: 'ADVANCE_CAMPAIGN' });
    expect(s.luck).toBe(LUCK_PER_ADVENTURE);
    const atRest = gameReducer({ ...s, luck: 0, phase: 'scene', sceneId: 'town_briefing' }, { type: 'GOTO_SCENE', sceneId: 'safe_alcove' });
    expect(atRest.luck).toBe(LUCK_PER_ADVENTURE);
  });
```
Extend the import:
```ts
import { initialState, gameReducer, LUCK_PER_ADVENTURE, type GameState } from './gameReducer';
```
Add to `src/state/persistence.test.ts` — extend the `valid` fixture (`luck: 0`) and:
```ts
  it('normalizes a save that predates luck', () => {
    const { luck, ...partial } = valid;
    void luck;
    saveGame(partial);
    expect(loadValidatedGame()?.luck).toBe(0);
  });
```

- [ ] **Step 2: Run — expect FAIL**

`npx vitest run src/state/gameReducer.test.ts src/state/persistence.test.ts`

- [ ] **Step 3: Implement**

In `src/state/gameReducer.ts`:
- Add the constant near `CAMPAIGN_ORDER`:
```ts
export const LUCK_PER_ADVENTURE = 2;
```
- `GameState` (after `playerNames`):
```ts
  playerNames: Record<string, string>; // heroId -> the human player's name
  luck: number;                       // party-wide reroll/advantage tokens
```
- `initialState` (after `playerNames: {},`): `luck: 0,`.
- `GameAction` union: `| { type: 'SPEND_LUCK' }`.
- `CONFIRM_PARTY` returned object (after `playerNames: action.playerNames ?? {},`): `luck: LUCK_PER_ADVENTURE,`.
- `ADVANCE_CAMPAIGN` returned object (after `draftsAvailable: state.draftsAvailable + 1,`): `luck: LUCK_PER_ADVENTURE,`.
- `GOTO_SCENE` rest branch return — add `luck: LUCK_PER_ADVENTURE` to the returned object.
- Add the case (next to `SKIP_DRAFT`):
```ts
    case 'SPEND_LUCK':
      return { ...state, luck: Math.max(0, state.luck - 1) };
```

In `src/state/persistence.ts`:
- Validation (after `playerNames` line): `if (g.luck !== undefined && typeof g.luck !== 'number') return false;`
- Normalization: add `luck: raw.luck ?? 0` to the returned object.

Fixtures — add `luck: 0`:
- `persistence.test.ts` `valid`
- `CombatView.test.tsx` base `full`
- `GameScreen.test.tsx` `renderAt` base

- [ ] **Step 4: Run — expect PASS**; **Step 5: Commit** `feat: party-wide Luck token state with per-adventure refills`

---

### Task 2: DiceRoller reroll affordance

**Files:** `src/components/DiceRoller.tsx`, `src/components/DiceRoller.test.tsx`

- [ ] **Step 1: Failing test** — add to `DiceRoller.test.tsx`:
```tsx
  it('offers a reroll when luck is available', async () => {
    const onReroll = vi.fn();
    render(<DiceRoller heroName="Bjorn" skillLabel="Athletics" result={success} onContinue={() => {}} onReroll={onReroll} rerollsLeft={2} />);
    const btn = screen.getByRole('button', { name: /reroll/i });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onReroll).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — in `DiceRoller.tsx`:
- Extend `Props`:
```ts
interface Props {
  heroName: string;
  skillLabel: string;
  result: CheckResult;
  onContinue: () => void;
  onReroll?: () => void;
  rerollsLeft?: number;
}
```
- Update the signature: `export function DiceRoller({ heroName, skillLabel, result, onContinue, onReroll, rerollsLeft }: Props) {`
- In the settled `outcome-block`, before the Continue button, add:
```tsx
          {onReroll && (rerollsLeft ?? 0) > 0 && (
            <button className="btn reveal" style={{ marginRight: 8 }} onClick={() => { sfx.click(); onReroll(); }}>
              ✦ Spend Luck to reroll ({rerollsLeft})
            </button>
          )}
```

- [ ] **Step 4: Run — expect PASS**; **Step 5: Commit** `feat: DiceRoller reroll affordance`

---

### Task 3: Wire reroll + luck pill into GameScreen

**Files:** `src/components/GameScreen.tsx`, `src/components/GameScreen.test.tsx`

- [ ] **Step 1: Failing test** — add to `GameScreen.test.tsx`:
```tsx
  it('shows the Luck pill with the token count', () => {
    renderAt({ luck: 2 });
    expect(screen.getByText(/Luck 2/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — in `GameScreen.tsx`:
- Extend the `Pending` reveal variant with `heroId` and a `nonce`:
```ts
type Pending =
  | { stage: 'choose-hero'; choice: Choice }
  | { stage: 'reveal'; choice: Choice; heroId: string; heroName: string; result: CheckResult; nonce: number };
```
- In `attemptWith`, store `heroId`/`nonce` and DROP the `RECORD` dispatch (it moves to
  `finishReveal`):
```ts
    dispatch({
      type: 'LOG',
      entry: `${name} rolled ${result.roll}${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total} vs DC ${dc} — ${result.success ? 'success' : 'failure'}.`,
    });
    setPending({ stage: 'reveal', choice: pending.choice, heroId, heroName: name, result, nonce: 0 });
```
- Add a `rerollCheck` function (after `attemptWith`):
```ts
  function rerollCheck() {
    if (!pending || pending.stage !== 'reveal' || !pending.choice.check || state.luck <= 0) return;
    sfx.click();
    const hero = getCharacter(pending.heroId);
    const { skill, dc } = pending.choice.check;
    const result = resolveCheck(hero, skill, dc, defaultRng);
    dispatch({ type: 'SPEND_LUCK' });
    dispatch({ type: 'LOG', entry: `${pending.heroName} spends Luck and rerolls: ${result.roll}${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total} vs DC ${dc} — ${result.success ? 'success' : 'failure'}.` });
    setPending({ ...pending, result, nonce: pending.nonce + 1 });
  }
```
- In `finishReveal`, record the (possibly rerolled) result before routing:
```ts
  function finishReveal() {
    if (!pending || pending.stage !== 'reveal') return;
    dispatch({ type: 'RECORD', delta: pending.result.success ? { checksPassed: 1 } : { checksFailed: 1 } });
    const next = resolveChoice(pending.choice, pending.result.success);
    setPending(null);
    dispatch({ type: 'GOTO_SCENE', sceneId: next });
  }
```
- Update the `DiceRoller` render to add the key + reroll props:
```tsx
            <DiceRoller
              key={pending.nonce}
              heroName={pending.heroName}
              skillLabel={skillLabel(pending.choice.check!.skill)}
              result={pending.result}
              onContinue={finishReveal}
              onReroll={rerollCheck}
              rerollsLeft={state.luck}
            />
```
- Add a Luck pill in the right column, just before `<PartyPanel ... />`'s wrapping — change the
  party header line to include it. Replace:
```tsx
        <h3 style={{ margin: '0 0 10px', fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>The Party</h3>
```
with:
```tsx
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 10px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>The Party</h3>
          <span className="stat-pill" title="Spend a Luck token to reroll a check or gain advantage in combat">✦ Luck {state.luck}</span>
        </div>
```

- [ ] **Step 4: Run** `npx vitest run src/components/GameScreen.test.tsx` — expect PASS;
  **Step 5: Commit** `feat: spend Luck to reroll checks + Luck pill`

---

### Task 4: Spend Luck for combat advantage

**Files:** `src/components/CombatView.tsx`, `src/components/CombatView.test.tsx`

- [ ] **Step 1: Failing test** — add to `CombatView.test.tsx`:
```tsx
  it('offers a Luck advantage button when luck is available', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // Gronk's turn
    try {
      renderCombat({ luck: 1 });
      expect(screen.getByRole('button', { name: /Luck: advantage/i })).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — in `CombatView.tsx`:
- Add `clone` to the combat import:
```ts
import { startCombat, performHeroAttack, performEnemyTurn, currentCombatant, clone } from '../engine/combat';
```
- Add the handler (after `consumeItem`/`chooseItem`):
```ts
  function spendLuckAdvantage() {
    if (state.luck <= 0 || actor.nextAttack) return;
    sfx.click();
    dispatch({ type: 'SPEND_LUCK' });
    setCombat((c) => {
      const next = clone(c);
      const a = next.combatants.find((x) => x.id === actor.id);
      if (a) a.nextAttack = 'adv';
      return next;
    });
  }
```
- In the normal hero-action button row, after the `{stashCount > 0 && (...)}` Use-Item button,
  add the Luck button:
```tsx
                {state.luck > 0 && !actor.nextAttack && (
                  <button className="btn" title="Spend a Luck token for advantage on this attack" onClick={spendLuckAdvantage}>
                    ✦ Luck: advantage ({state.luck})
                  </button>
                )}
```
- Show the count on the turn line — replace:
```tsx
          <strong className="accent-text">{actor.name}</strong>’s turn
```
with:
```tsx
          <strong className="accent-text">{actor.name}</strong>’s turn
          <span className="tag" style={{ marginLeft: 8 }}>✦ Luck {state.luck}</span>
```

- [ ] **Step 4: Run** `npx vitest run src/components/CombatView.test.tsx` — expect PASS;
  **Step 5: Commit** `feat: spend Luck for combat advantage`

---

### Task 5: Verify + push

- [ ] **Step 1:** `npm run lint && npx tsc --noEmit && npm test && npm run build` — all green.
- [ ] **Step 2:** Playwright spot-check: seed a scene save with `luck: 2`, attempt a check, click
  "Spend Luck to reroll" (the die re-rolls, Luck drops to 1); screenshot. Seed a combat save with
  `luck` and click "Luck: advantage" (⬆ badge appears). Read screenshots; clean up.
- [ ] **Step 3:** `git push origin main` and watch the deploy; confirm the live bundle hash changed.
```
