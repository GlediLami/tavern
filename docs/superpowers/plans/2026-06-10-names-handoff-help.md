# Player Names + Handoff + Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, the
> owner's preference) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Three pass-and-play QoL features in one ship — custom player names surfaced across the
game text, an opt-in pass-the-device handoff before each hero combat turn, and a "How to Play"
help overlay.

**Architecture:** A `heroDisplayName` helper + a `playerNames` map on `GameState` drive names
everywhere (including the engine combat log, via each combatant's `name`). A localStorage-backed
`handoff.ts` setting gates hero turns in `CombatView`. A presentational `HelpOverlay` opens from a
top-right control cluster.

**Tech Stack:** React 18 + TypeScript, Vitest, plain CSS.

---

### Task 1: `heroDisplayName` helper (engine)

**Files:**
- Modify: `src/engine/party.ts`
- Test: `src/engine/party.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/engine/party.test.ts` (and extend the import line to include `heroDisplayName`):
```ts
import { getCharacter, getAllCharacters, getAdventure, makeHeroAttackLookup, toHero, heroDisplayName } from './party';
```
```ts
  it('heroDisplayName uses the player name, falling back to the hero name', () => {
    expect(heroDisplayName('bjorn-ironhelm', { 'bjorn-ironhelm': 'Sam' })).toBe('Sam');
    expect(heroDisplayName('bjorn-ironhelm', {})).toBe('Bjorn Ironhelm');
    expect(heroDisplayName('bjorn-ironhelm', { 'bjorn-ironhelm': '   ' })).toBe('Bjorn Ironhelm');
    expect(heroDisplayName('bjorn-ironhelm')).toBe('Bjorn Ironhelm');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/party.test.ts`
Expected: FAIL — `heroDisplayName` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/engine/party.ts`, add at the end:
```ts
export function heroDisplayName(heroId: string, playerNames: Record<string, string> = {}): string {
  return playerNames[heroId]?.trim() || getCharacter(heroId).name;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/party.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/party.ts src/engine/party.test.ts
git commit -m "feat: heroDisplayName helper (player name with hero fallback)"
```

---

### Task 2: `playerNames` state + persistence

**Files:**
- Modify: `src/state/gameReducer.ts`
- Modify: `src/state/persistence.ts`
- Test: `src/state/gameReducer.test.ts`, `src/state/persistence.test.ts`
- Modify (fixtures): `src/components/CombatView.test.tsx`, `src/components/GameScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/state/gameReducer.test.ts`:
```ts
  it('CONFIRM_PARTY stores player names and carries them across the campaign', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'], playerNames: { 'bjorn-ironhelm': 'Sam' } });
    expect(s.playerNames).toEqual({ 'bjorn-ironhelm': 'Sam' });
    s = gameReducer(s, { type: 'ADVANCE_CAMPAIGN' });
    expect(s.playerNames).toEqual({ 'bjorn-ironhelm': 'Sam' });
  });
```
Add to `src/state/persistence.test.ts` — extend the `valid` fixture and add a test:
```ts
  sceneId: 'tavern_start', log: [], stats: emptyStats, inventory: {}, relics: {}, draftsAvailable: 0, playerNames: {},
};
```
```ts
  it('normalizes a save that predates player names', () => {
    const { playerNames, ...partial } = valid;
    void playerNames;
    saveGame(partial);
    expect(loadValidatedGame()?.playerNames).toEqual({});
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/state/gameReducer.test.ts src/state/persistence.test.ts`
Expected: FAIL — `playerNames` undefined / not stored.

- [ ] **Step 3: Add the field, action payload, reset, and normalization**

In `src/state/gameReducer.ts`:

(a) `GameState` interface (after `draftsAvailable`):
```ts
  draftsAvailable: number;            // relic drafts the party can still take
  playerNames: Record<string, string>; // heroId -> the human player's name
```
(b) `initialState` (after `draftsAvailable: 0,`):
```ts
  draftsAvailable: 0,
  playerNames: {},
};
```
(c) `CONFIRM_PARTY` action type — add the optional payload:
```ts
  | { type: 'CONFIRM_PARTY'; partyIds: string[]; playerNames?: Record<string, string> }
```
(d) `CONFIRM_PARTY` returned object (after `draftsAvailable: 0,`):
```ts
        draftsAvailable: 0,
        playerNames: action.playerNames ?? {},
      };
```
(`ADVANCE_CAMPAIGN` already spreads `...state`, so names carry.)

In `src/state/persistence.ts`:

(e) After the `draftsAvailable` validation line:
```ts
  if (g.draftsAvailable !== undefined && typeof g.draftsAvailable !== 'number') return false;
  if (g.playerNames !== undefined && (typeof g.playerNames !== 'object' || g.playerNames === null)) return false;
```
(f) Update the normalization:
```ts
  if (raw && isValid(raw)) return { ...raw, inventory: raw.inventory ?? {}, relics: raw.relics ?? {}, draftsAvailable: raw.draftsAvailable ?? 0, playerNames: raw.playerNames ?? {} };
```

- [ ] **Step 4: Update the component fixtures**

In `src/components/CombatView.test.tsx`, base `full`:
```tsx
    sceneId: 'ridge_wolves', log: [], stats: emptyStats, inventory: {}, relics: {}, draftsAvailable: 0, playerNames: {}, ...overrides,
```
In `src/components/GameScreen.test.tsx`, `renderAt` base:
```tsx
    sceneId: 'tavern_start', log: [], stats: emptyStats, inventory: {}, relics: {}, draftsAvailable: 0, playerNames: {}, ...state,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/state/gameReducer.test.ts src/state/persistence.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state/gameReducer.ts src/state/persistence.ts src/state/gameReducer.test.ts src/state/persistence.test.ts src/components/CombatView.test.tsx src/components/GameScreen.test.tsx
git commit -m "feat: playerNames state, CONFIRM_PARTY payload, persistence"
```

---

### Task 3: Name inputs in PartySelect + App wiring

**Files:**
- Modify: `src/components/PartySelect.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/PartySelect.test.tsx`

- [ ] **Step 1: Update the existing test and add a new one**

In `src/components/PartySelect.test.tsx`, update the ids assertion to expect the new 2nd arg:
```ts
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(['bjorn-ironhelm'], {});
```
Then add a name-entry test:
```ts
  it('passes typed player names to onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<PartySelect onConfirm={onConfirm} />);
    await userEvent.click(screen.getByText('Bjorn Ironhelm'));
    await userEvent.type(screen.getByLabelText(/player name for Bjorn Ironhelm/i), 'Sam');
    await userEvent.click(screen.getByRole('button', { name: /enter the tavern/i }));
    expect(onConfirm).toHaveBeenCalledWith(['bjorn-ironhelm'], { 'bjorn-ironhelm': 'Sam' });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/PartySelect.test.tsx`
Expected: FAIL — `onConfirm` called with one arg; no player-name input exists.

- [ ] **Step 3: Add the name inputs and pass names to onConfirm**

In `src/components/PartySelect.tsx`:

(a) Update the `Props`:
```ts
interface Props {
  onConfirm: (partyIds: string[], playerNames: Record<string, string>) => void;
}
```
(b) Add a `names` state next to `selected`:
```ts
  const [selected, setSelected] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
```
(c) Add a "Name your players" panel between the `</div>` that closes `.grid-cards` and the
final confirm `.row`:
```tsx
      {selected.length > 0 && (
        <div className="panel" style={{ marginTop: 18, padding: 16 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Name Your Players (optional)</h3>
          <div className="stack">
            {selected.map((id) => {
              const c = getAllCharacters().find((ch) => ch.id === id)!;
              return (
                <div key={id} className="row" style={{ alignItems: 'center', gap: 10 }}>
                  <span className="portrait" style={{ width: 30, height: 30, fontSize: '1rem' }}>{c.portrait}</span>
                  <span style={{ minWidth: 150 }}>{c.name}</span>
                  <input
                    className="name-input"
                    aria-label={`Player name for ${c.name}`}
                    placeholder="Player name"
                    value={names[id] ?? ''}
                    onChange={(e) => setNames((n) => ({ ...n, [id]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
```
(d) Update the confirm `onClick`:
```tsx
          onClick={() => {
            sfx.click();
            const playerNames: Record<string, string> = {};
            for (const id of selected) { const v = names[id]?.trim(); if (v) playerNames[id] = v; }
            onConfirm(selected, playerNames);
          }}
```

- [ ] **Step 4: Wire App to pass names into the action**

In `src/App.tsx`, the `party-select` case:
```tsx
    case 'party-select':
      return <PartySelect onConfirm={(ids, playerNames) => dispatch({ type: 'CONFIRM_PARTY', partyIds: ids, playerNames })} />;
```

- [ ] **Step 5: Add the input styling**

In `src/styles/theme.css`, add:
```css
.name-input {
  flex: 1; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--border-soft);
  color: var(--ink); border-radius: 8px; padding: 8px 11px; font: inherit; font-size: 0.95rem;
}
.name-input:focus { outline: none; border-color: var(--accent); }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/components/PartySelect.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/PartySelect.tsx src/App.tsx src/styles/theme.css src/components/PartySelect.test.tsx
git commit -m "feat: per-hero player-name inputs at party select"
```

---

### Task 4: Surface names in combat, checks, and the party panel

**Files:**
- Modify: `src/components/CombatView.tsx`
- Modify: `src/components/GameScreen.tsx`
- Modify: `src/components/PartyPanel.tsx`
- Test: `src/components/CombatView.test.tsx`, `src/components/GameScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `src/components/CombatView.test.tsx`:
```tsx
  it('shows the player name in the turn banner', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // Gronk's turn
    try {
      renderCombat({ playerNames: { 'gronk-skullsplitter': 'Sam' } });
      expect(screen.getByText('Sam')).toBeInTheDocument(); // "<Sam>'s turn"
    } finally {
      spy.mockRestore();
    }
  });
```
Add to `src/components/GameScreen.test.tsx`:
```tsx
  it('the who-attempts prompt shows the player name', async () => {
    renderAt({ sceneId: 'tavern_start', playerNames: { 'bjorn-ironhelm': 'Sam' } });
    await userEvent.click(screen.getByRole('button', { name: /muttering locals/i }));
    expect(await screen.findByText(/who attempts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sam/ })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/CombatView.test.tsx src/components/GameScreen.test.tsx`
Expected: FAIL — banner shows hero name; prompt button shows hero name.

- [ ] **Step 3: Feed display names into combat**

In `src/components/CombatView.tsx`:

(a) Add to the party import:
```ts
import { getAdventure, getCharacter, toHero, makeHeroAttackLookup, heroDisplayName } from '../engine/party';
```
(b) In the `useState<CombatState>` initializer, after the `heroes.forEach((h) => { h.maxHp = ... });`
line, override each hero's name:
```ts
    heroes.forEach((h) => { h.name = heroDisplayName(h.id, state.playerNames); });
```
(c) In the combat hero card, keep the title hero-anchored and add a "Played by" line. Replace:
```tsx
                  <strong style={{ fontWeight: 600 }}>{getCharacter(h.heroId!).portrait} {h.name} {badge(h)}</strong>
                  {h.hp <= 0 && <span style={{ color: 'var(--accent-bright)' }}> — down</span>}
```
with:
```tsx
                  <strong style={{ fontWeight: 600 }}>{getCharacter(h.heroId!).portrait} {getCharacter(h.heroId!).name} {badge(h)}</strong>
                  {h.hp <= 0 && <span style={{ color: 'var(--accent-bright)' }}> — down</span>}
                  {state.playerNames[h.heroId!]?.trim() && <div className="faint" style={{ fontSize: '0.72rem' }}>Played by {state.playerNames[h.heroId!]}</div>}
```

- [ ] **Step 4: Use display names in GameScreen checks**

In `src/components/GameScreen.tsx`:

(a) Add to the party import:
```ts
import { getAdventure, getCharacter, heroDisplayName } from '../engine/party';
```
(b) In `attemptWith`, replace `hero.name` in both the log entry and `setPending`:
```ts
    const hero = getCharacter(heroId);
    const name = heroDisplayName(heroId, state.playerNames);
    const { skill, dc } = pending.choice.check;
    const result = resolveCheck(hero, skill, dc, defaultRng);
    dispatch({
      type: 'LOG',
      entry: `${name} rolled ${result.roll}${result.modifier >= 0 ? '+' : ''}${result.modifier} = ${result.total} vs DC ${dc} — ${result.success ? 'success' : 'failure'}.`,
    });
    dispatch({ type: 'RECORD', delta: result.success ? { checksPassed: 1 } : { checksFailed: 1 } });
    setPending({ stage: 'reveal', choice: pending.choice, heroName: name, result });
```
(c) In the "who attempts" buttons, use the display name:
```tsx
                {consciousHeroes.map((id) => (
                  <button key={id} className="btn" onClick={() => { sfx.click(); attemptWith(id); }}>
                    {getCharacter(id).portrait} {heroDisplayName(id, state.playerNames)}
                  </button>
                ))}
```
(d) In the relic-draft "Give to" hero buttons, use the display name:
```tsx
                    <button key={id} className="btn btn-primary" onClick={() => { sfx.click(); dispatch({ type: 'GRANT_RELIC', heroId: id, relicId: pendingRelic }); setPendingRelic(null); }}>
                      {getCharacter(id).portrait} {heroDisplayName(id, state.playerNames)}
                    </button>
```
(e) Add a `title` hint to the check DC pill:
```tsx
                    <span className="stat-pill" style={{ marginLeft: 8 }} title="Roll a d20, add the hero's skill modifier, and meet or beat the Difficulty Class (DC). A natural 20 is a critical success, a natural 1 a critical failure.">
                      {skillLabel(c.check.skill)} · DC {c.check.dc}
                    </span>
```
(f) Pass `playerNames` to the party panel:
```tsx
        <PartyPanel partyIds={state.partyIds} hp={state.hp} difficulty={state.difficulty} level={state.campaign?.level ?? 1} relics={state.relics} playerNames={state.playerNames} />
```

- [ ] **Step 5: Show "Played by" in PartyPanel**

In `src/components/PartyPanel.tsx`:

(a) Extend `Props` and the signature:
```ts
  relics?: Record<string, string[]>;
  playerNames?: Record<string, string>;
}

export function PartyPanel({ partyIds, hp, difficulty, level = 1, relics = {}, playerNames = {} }: Props) {
```
(b) Immediately after the toggle `</button>` (and before the `<div className="hp-bar" ...>`), add:
```tsx
            </button>
            {playerNames[id]?.trim() && <div className="faint" style={{ fontSize: '0.72rem', marginTop: 2 }}>Played by {playerNames[id]}</div>}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/CombatView.test.tsx src/components/GameScreen.test.tsx src/components/PartyPanel.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/CombatView.tsx src/components/GameScreen.tsx src/components/PartyPanel.tsx src/components/CombatView.test.tsx src/components/GameScreen.test.tsx
git commit -m "feat: surface player names in combat, checks, and party panel"
```

---

### Task 5: Pass-the-device handoff

**Files:**
- Create: `src/ui/handoff.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/CombatView.tsx`
- Test: `src/ui/handoff.test.ts`, `src/components/CombatView.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/handoff.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { isHandoffOn, setHandoffOn } from './handoff';

describe('handoff setting', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to off', () => {
    expect(isHandoffOn()).toBe(false);
  });

  it('persists when turned on', () => {
    setHandoffOn(true);
    expect(isHandoffOn()).toBe(true);
    setHandoffOn(false);
    expect(isHandoffOn()).toBe(false);
  });
});
```
Add to `src/components/CombatView.test.tsx`:
```tsx
  it('gates a hero turn behind the handoff when it is on', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // Gronk's turn
    localStorage.setItem('tavern.handoff.v1', '1');
    try {
      renderCombat({ playerNames: { 'gronk-skullsplitter': 'Sam' } });
      expect(screen.getByText(/Pass the device/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /I'm ready/i }));
      expect(screen.getByText(/left\)/i)).toBeInTheDocument(); // power button now visible
    } finally {
      localStorage.removeItem('tavern.handoff.v1');
      spy.mockRestore();
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/handoff.test.ts src/components/CombatView.test.tsx`
Expected: FAIL — `./handoff` missing; no "Pass the device" gate.

- [ ] **Step 3: Implement the setting**

Create `src/ui/handoff.ts`:
```ts
// Pass-and-play "pass the device" handoff toggle, persisted in localStorage. Default off.
const HANDOFF_KEY = 'tavern.handoff.v1';

export function isHandoffOn(): boolean {
  try { return localStorage.getItem(HANDOFF_KEY) === '1'; } catch { return false; }
}

export function setHandoffOn(on: boolean): void {
  try { localStorage.setItem(HANDOFF_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}
```

- [ ] **Step 4: Add the handoff gate to CombatView**

In `src/components/CombatView.tsx`:

(a) Add the import:
```ts
import { isHandoffOn } from '../ui/handoff';
```
(b) Add state next to the other `useState` hooks (e.g. after `itemMenuOpen`):
```ts
  const [handoffDoneFor, setHandoffDoneFor] = useState<string | null>(null);
```
(c) After `const selectingAlly = ...` (the derived values block), add:
```ts
  const handoffNeeded = actor.isHero && handoffDoneFor !== actor.id && isHandoffOn();
```
(d) In the action panel, make the handoff the first branch of the hero area. Change:
```tsx
        {actor.isHero && heroChar ? (
          pendingPower ? (
```
to:
```tsx
        {actor.isHero && heroChar ? (
          handoffNeeded ? (
            <>
              <p className="muted" style={{ marginTop: 4 }}>
                Pass the device to <strong className="accent-text">{actor.name}</strong> — {getCharacter(actor.heroId!).name}'s turn.
              </p>
              <button className="btn btn-primary" onClick={() => { sfx.click(); setHandoffDoneFor(actor.id); }}>I'm ready ▸</button>
            </>
          ) : pendingPower ? (
```

- [ ] **Step 5: Add the handoff toggle to App**

In `src/App.tsx`:

(a) Update the import:
```ts
import { isMuted, setMuted } from './ui/sfx';
import { isHandoffOn, setHandoffOn } from './ui/handoff';
import { HelpOverlay } from './components/HelpOverlay';
```
(b) Replace the `MuteToggle` component and add the cluster + new toggles:
```tsx
function TopControls() {
  const [muted, setMutedState] = useState<boolean>(isMuted());
  const [handoff, setHandoffState] = useState<boolean>(isHandoffOn());
  const [showHelp, setShowHelp] = useState(false);
  return (
    <>
      <div className="top-controls">
        <button className={`top-control${handoff ? ' on' : ''}`} title={handoff ? 'Pass-the-device handoff on' : 'Pass-the-device handoff off'} aria-label="Toggle pass-the-device handoff"
          onClick={() => { const next = !handoff; setHandoffOn(next); setHandoffState(next); }}>🤝</button>
        <button className="top-control" title={muted ? 'Unmute sound' : 'Mute sound'} aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          onClick={() => { const next = !muted; setMuted(next); setMutedState(next); }}>{muted ? '🔇' : '🔊'}</button>
        <button className="top-control" title="How to play" aria-label="How to play" onClick={() => setShowHelp(true)}>?</button>
      </div>
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </>
  );
}
```
(c) Replace `<MuteToggle />` in `App` with `<TopControls />`.

- [ ] **Step 6: Add the control styling**

In `src/styles/theme.css`, replace the `.mute-toggle` rules with:
```css
/* top-right control cluster */
.top-controls { position: fixed; top: 14px; right: 16px; z-index: 50; display: flex; gap: 8px; }
.top-control {
  background: rgba(0, 0, 0, 0.4); border: 1px solid var(--border-soft); color: var(--ink-dim);
  width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 1.05rem;
  transition: border-color 0.18s ease, color 0.18s ease;
}
.top-control:hover { border-color: var(--accent); color: var(--ink); }
.top-control.on { border-color: var(--accent); color: var(--ink); }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/ui/handoff.test.ts src/components/CombatView.test.tsx`
Expected: PASS. (This task depends on Task 6's `HelpOverlay`; if running tasks strictly in
order, create a minimal `HelpOverlay` stub first or do Step 5b's `HelpOverlay` import together
with Task 6. To avoid a broken import, do Task 6 Step 3 before this step's `npm run build`.)

- [ ] **Step 8: Commit**

```bash
git add src/ui/handoff.ts src/ui/handoff.test.ts src/App.tsx src/components/CombatView.tsx src/styles/theme.css
git commit -m "feat: opt-in pass-the-device handoff before hero combat turns"
```

---

### Task 6: How-to-Play help overlay

**Files:**
- Create: `src/components/HelpOverlay.tsx`
- Modify: `src/styles/theme.css`
- Test: `src/components/HelpOverlay.test.tsx`

> Note: `App.tsx` already imports `HelpOverlay` (Task 5 Step 5a). Implement this component before
> running the full build so the import resolves.

- [ ] **Step 1: Write the failing test**

Create `src/components/HelpOverlay.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpOverlay } from './HelpOverlay';

describe('HelpOverlay', () => {
  it('renders the core rules and closes', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    expect(screen.getByText(/How to Play/i)).toBeInTheDocument();
    expect(screen.getByText(/Difficulty Class/i)).toBeInTheDocument();
    expect(screen.getByText(/Advantage/i)).toBeInTheDocument();
    expect(screen.getByText(/saving throw/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/HelpOverlay.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the overlay**

Create `src/components/HelpOverlay.tsx`:
```tsx
interface Props { onClose: () => void; }

const SECTIONS: { title: string; body: string }[] = [
  { title: 'Skill checks', body: 'When an action is uncertain, a hero rolls a d20 and adds their ability modifier (plus their proficiency bonus if trained) versus a Difficulty Class (DC). Meet or beat the DC to succeed. A natural 20 is a critical success; a natural 1 a critical failure.' },
  { title: 'Advantage & disadvantage', body: 'Advantage (⬆) rolls two d20s and keeps the higher; disadvantage (⬇) keeps the lower. They cancel out. Powers, relics, cover, and enemy abilities can grant either.' },
  { title: 'Combat', body: 'Everyone rolls initiative for turn order. An attack rolls a d20 + to-hit versus the target\'s Armor Class (AC); a hit rolls the weapon\'s damage dice. A natural 20 doubles the damage dice.' },
  { title: 'Saving throws', body: 'Some spells let the target resist instead of being attacked — e.g. Sacred Flame forces a Dexterity save: the foe rolls a d20 + their save versus the caster\'s save DC, taking damage only if they fail.' },
  { title: 'Powers, items & relics', body: 'Each class has one signature power with limited uses. Potions and other items can be used as a combat action. Relics drafted at rests and level-ups grant passive bonuses for the rest of the run.' },
];

export function HelpOverlay({ onClose }: Props) {
  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="How to play" onClick={onClose}>
      <div className="panel panel--framed help-card" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="display" style={{ margin: 0 }}>How to Play</h2>
          <button className="btn" aria-label="Close help" onClick={onClose}>✕ Close</button>
        </div>
        <div className="scene-rule" />
        <div className="stack" style={{ gap: 14 }}>
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="accent-text" style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>{s.title}</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the overlay styling**

In `src/styles/theme.css`, add:
```css
.help-overlay {
  position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.66); padding: 20px; overflow-y: auto;
}
.help-card { max-width: 620px; width: 100%; max-height: 88vh; overflow-y: auto; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/HelpOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/HelpOverlay.tsx src/components/HelpOverlay.test.tsx src/styles/theme.css
git commit -m "feat: How-to-Play help overlay"
```

---

### Task 7: Full verification, browser check, push

- [ ] **Step 1: Run the whole suite + lint + type-check + build**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```
Expected: lint clean (one known benign react-refresh warning on GameContext.tsx), type-check
clean, all tests pass, build succeeds. If `App.test.tsx` exists and queries buttons ambiguously,
adjust its selectors (the new 🤝/🔊/? controls are fixed top-right).

- [ ] **Step 2: Browser spot-check with Playwright**

Reuse the chromium build at `/home/lamig/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`.
Start `npm run dev -- --port 5183 --host` in the background, then a `.mjs` from the repo root
that: opens the app, toggles 🤝 handoff on, opens the **?** help overlay and screenshots it,
closes it, seeds a scene save with `playerNames` and screenshots the "who attempts" prompt /
party "Played by" line, then seeds a combat save (handoff on) and screenshots the "Pass the
device" gate. Read the screenshots with the Read tool. Stop the dev server and delete the drive
script + screenshots afterward.

- [ ] **Step 3: Push to main and watch the deploy**

```bash
git push origin main
gh run watch "$(gh run list --workflow=deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId')" --exit-status
```
Expected: deploy succeeds; confirm the live bundle hash changed at https://gledilami.github.io/tavern/.
```
