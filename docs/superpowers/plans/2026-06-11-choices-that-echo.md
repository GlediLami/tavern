# Choices That Echo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Checkbox steps.

**Goal:** Flags set by choices/scenes, gated choices, and an ending epilogue that reflects the run.

**Architecture:** `GameState.flags: string[]` with a `SET_FLAGS` action and `GOTO_SCENE`
flag-application; `GameScreen` filters/sets flags; `EndingScreen` renders epilogues. Brackenmoor
demonstrates a route echo + a cottage-gated option.

**Tech Stack:** React 18 + TypeScript, Vitest.

---

### Task 1: Types + flags state + persistence

**Files:** `src/types.ts`, `src/state/gameReducer.ts`, `src/state/persistence.ts`, tests + fixtures.

- [ ] **Step 1: Add types**

In `src/types.ts`:
- `Choice` (after `next?: string;`):
```ts
  next?: string;
  setFlags?: string[];     // flags set when this choice is committed
  requiresFlag?: string;   // choice only shown when this flag is set
}
```
- `Scene` union — add `setFlags?: string[]` to all three variants, and `epilogues` to the ending:
```ts
export type Scene =
  | { id: string; type: 'story'; title: string; narration: string; choices: Choice[]; rest?: boolean; setFlags?: string[] }
  | { id: string; type: 'combat'; title: string; narration: string; enemies: Enemy[]; onVictory: string; onDefeat: string; setFlags?: string[] }
  | { id: string; type: 'ending'; endingType: 'victory' | 'defeat'; title: string; narration: string; setFlags?: string[]; epilogues?: { flag: string; text: string }[] };
```

- [ ] **Step 2: Failing tests**

Add to `src/state/gameReducer.test.ts`:
```ts
  it('SET_FLAGS merges flags uniquely', () => {
    let s = gameReducer(initialState, { type: 'SET_FLAGS', flags: ['a', 'b'] });
    s = gameReducer(s, { type: 'SET_FLAGS', flags: ['b', 'c'] });
    expect([...s.flags].sort()).toEqual(['a', 'b', 'c']);
  });

  it('GOTO_SCENE applies a destination scene\'s setFlags', () => {
    const s: GameState = { ...initialState, phase: 'scene', partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 }, sceneId: 'village_square' };
    const next = gameReducer(s, { type: 'GOTO_SCENE', sceneId: 'gravedigger_cottage' });
    expect(next.flags).toContain('visited_cottage');
  });

  it('CONFIRM_PARTY and ADVANCE_CAMPAIGN reset flags', () => {
    let s: GameState = { ...initialState, flags: ['x'] };
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    expect(s.flags).toEqual([]);
  });
```
Add to `src/state/persistence.test.ts` — extend `valid` (`flags: []`) and:
```ts
  it('normalizes a save that predates flags', () => {
    const { flags, ...partial } = valid;
    void flags;
    saveGame(partial);
    expect(loadValidatedGame()?.flags).toEqual([]);
  });
```

- [ ] **Step 3: Run — expect FAIL** (`gravedigger_cottage` setFlags is added in Task 4, so the
  GOTO test will fail until then — that's expected; it passes after Task 4. Run the reducer
  merge/reset tests and persistence now.)

`npx vitest run src/state/persistence.test.ts`

- [ ] **Step 4: Implement state**

In `src/state/gameReducer.ts`:
- `GameState` (after `luck`): `flags: string[];`
- `initialState` (after `luck: 0,`): `flags: [],`
- `GameAction`: `| { type: 'SET_FLAGS'; flags: string[] }`
- `CONFIRM_PARTY` returned object (after `luck: LUCK_PER_ADVENTURE,`): `flags: [],`
- `ADVANCE_CAMPAIGN` returned object (after `luck: LUCK_PER_ADVENTURE,`): `flags: [],`
- `GOTO_SCENE` — apply destination flags. Replace the `const base = {...}` line:
```ts
      const scene = getAdventureData(state.adventureId).scenes[action.sceneId];
      const flags = scene?.setFlags?.length ? Array.from(new Set([...state.flags, ...scene.setFlags])) : state.flags;
      const base = { ...state, sceneId: action.sceneId, phase: phaseForScene(state.adventureId, action.sceneId), flags };
```
- Add the case (next to `SPEND_LUCK`):
```ts
    case 'SET_FLAGS':
      return { ...state, flags: Array.from(new Set([...state.flags, ...action.flags])) };
```

In `src/state/persistence.ts`:
- Validation (after `luck` line): `if (g.flags !== undefined && !Array.isArray(g.flags)) return false;`
- Normalization: add `flags: raw.flags ?? []` to the returned object.

Fixtures — add `flags: []`:
- `persistence.test.ts` `valid`
- `CombatView.test.tsx` base `full`
- `GameScreen.test.tsx` `renderAt` base

- [ ] **Step 5: Run** `npx vitest run src/state/persistence.test.ts` — expect PASS (reducer
  merge/reset pass; the GOTO test passes after Task 4). **Commit** `feat: flags state + SET_FLAGS + GOTO flag application`

---

### Task 2: GameScreen — gate + set flags

**Files:** `src/components/GameScreen.tsx`, `src/components/GameScreen.test.tsx`

- [ ] **Step 1: Failing test** — add to `GameScreen.test.tsx`:
```tsx
  it('hides a requiresFlag choice until the flag is set', () => {
    const { unmount } = renderAt({ sceneId: 'route_choice', flags: [] });
    expect(screen.queryByText(/gravedigger's scrawled map/i)).toBeNull();
    unmount();
    renderAt({ sceneId: 'route_choice', flags: ['visited_cottage'] });
    expect(screen.getByText(/gravedigger's scrawled map/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — in `GameScreen.tsx`:
- In `pickChoice`, set flags when a choice is committed. Replace:
```ts
  function pickChoice(choice: Choice) {
    sfx.click();
    if (!choice.check) {
      dispatch({ type: 'GOTO_SCENE', sceneId: resolveChoice(choice, null) });
      return;
    }
    setPending({ stage: 'choose-hero', choice });
  }
```
with:
```ts
  function pickChoice(choice: Choice) {
    sfx.click();
    if (choice.setFlags && choice.setFlags.length) dispatch({ type: 'SET_FLAGS', flags: choice.setFlags });
    if (!choice.check) {
      dispatch({ type: 'GOTO_SCENE', sceneId: resolveChoice(choice, null) });
      return;
    }
    setPending({ stage: 'choose-hero', choice });
  }
```
- Filter the rendered choices by `requiresFlag`. Replace `{scene.choices.map((c) => (` with:
```tsx
              {scene.choices.filter((c) => !c.requiresFlag || state.flags.includes(c.requiresFlag)).map((c) => (
```

- [ ] **Step 4: Run** `npx vitest run src/components/GameScreen.test.tsx` — expect PASS (after
  Task 4 adds the content; if running strictly in order, do Task 4 before this Step 4).
  **Commit** `feat: gate choices on flags and set flags on pick`

---

### Task 3: EndingScreen epilogues

**Files:** `src/components/EndingScreen.tsx`, `src/App.tsx`, `src/components/EndingScreen.test.tsx`

- [ ] **Step 1: Failing test** — add to `EndingScreen.test.tsx`:
```tsx
  it('renders an epilogue for a flag the run set', () => {
    render(<EndingScreen mode="single" adventureId="brackenmoor" sceneId="ending_victory" difficulty="normal" level={1} stats={stats} flags={['route_marsh']} onReturn={() => {}} onAdvance={() => {}} />);
    expect(screen.getByText(/drowned marsh/i)).toBeInTheDocument();
  });

  it('omits epilogues whose flag is absent', () => {
    render(<EndingScreen mode="single" adventureId="brackenmoor" sceneId="ending_victory" difficulty="normal" level={1} stats={stats} flags={[]} onReturn={() => {}} onAdvance={() => {}} />);
    expect(screen.queryByText(/drowned marsh/i)).toBeNull();
  });
```

- [ ] **Step 2: Run — expect FAIL** (needs the epilogue content from Task 4 + the prop)

- [ ] **Step 3: Implement** — in `EndingScreen.tsx`:
- Add `flags` to `Props`: `flags?: string[];`
- Update the signature: `export function EndingScreen({ mode, adventureId, sceneId, difficulty, level, stats, campaign, flags = [], onReturn, onAdvance }: Props) {`
- After the `<p className="subtitle" ...>{scene.narration}</p>` block, add:
```tsx
      {scene.epilogues && scene.epilogues.some((e) => flags.includes(e.flag)) && (
        <div style={{ maxWidth: 600, margin: '0 auto 26px' }}>
          {scene.epilogues.filter((e) => flags.includes(e.flag)).map((e) => (
            <p key={e.flag} className="muted" style={{ fontStyle: 'italic', lineHeight: 1.7, margin: '0 0 8px' }}>{e.text}</p>
          ))}
        </div>
      )}
```
In `src/App.tsx`, pass `flags` to the ending screen:
```tsx
          stats={state.stats ?? emptyStats}
          campaign={state.campaign}
          flags={state.flags}
```

- [ ] **Step 4: Run** `npx vitest run src/components/EndingScreen.test.tsx` — expect PASS (after
  Task 4). **Commit** `feat: ending epilogues reflect the run's flags`

---

### Task 4: Brackenmoor content + flag-connectivity test

**Files:** `src/content/adventure.json`, `src/content/adventure.test.ts`

- [ ] **Step 1: Failing test** — add to `adventure.test.ts` inside the `describe.each` block:
```ts
  it('every requiresFlag / epilogue flag is set somewhere in the adventure', () => {
    const set = new Set<string>();
    for (const s of Object.values(adventure.scenes)) {
      (s.setFlags ?? []).forEach((f) => set.add(f));
      if (s.type === 'story') for (const c of s.choices) (c.setFlags ?? []).forEach((f) => set.add(f));
    }
    for (const s of Object.values(adventure.scenes)) {
      if (s.type === 'story') for (const c of s.choices) {
        if (c.requiresFlag) expect(set.has(c.requiresFlag), `flag "${c.requiresFlag}" never set in ${_id}`).toBe(true);
      }
      if (s.type === 'ending') for (const e of (s.epilogues ?? [])) {
        expect(set.has(e.flag), `epilogue flag "${e.flag}" never set in ${_id}`).toBe(true);
      }
    }
  });
```

- [ ] **Step 2: Run — expect PASS already** (no adventure uses flags yet; the set is empty and no
  requiresFlag/epilogue exists). Run to confirm green, then add content that keeps it green.

`npx vitest run src/content/adventure.test.ts`

- [ ] **Step 3: Add the content** — in `src/content/adventure.json`:

(a) `gravedigger_cottage` — add `setFlags` (after its `"narration": ...` value, before `"choices"`):
```json
   "narration": "Inside, the cottage has been ransacked — by the owner, it seems, in a hurry. A cold hearth, a half-packed bag, and a fresh patch of dug earth in the dirt floor where something was buried, then taken back up. Papers lie scattered in the damp.",
   "setFlags": ["visited_cottage"],
   "choices": [
```

(b) `route_choice` — add `setFlags` to the two route choices and a new gated choice. Replace its
`"choices"` array with:
```json
  "choices": [
   {
    "id": "c_marsh",
    "text": "Take the marsh path.",
    "next": "marsh_approach",
    "setFlags": ["route_marsh"]
   },
   {
    "id": "c_ridge",
    "text": "Take the ridge trail.",
    "next": "ridge_approach",
    "setFlags": ["route_ridge"]
   },
   {
    "id": "c_cottage_map",
    "text": "Follow the gravedigger's scrawled map straight to the marsh shrine.",
    "next": "marsh_approach",
    "setFlags": ["route_marsh"],
    "requiresFlag": "visited_cottage"
   }
  ]
```

(c) `ending_victory` — add `epilogues` (after its `"narration"` value):
```json
   "narration": "Brackenmoor wakes to a bell that tolls only at dawn, as it should. Otha pays your silver twice over, and the lost folk's families light candles in your name. The marsh recedes, and the Drowned Lantern's hearth has never felt warmer. You are heroes of a quiet, saved village.",
   "epilogues": [
    { "flag": "route_marsh", "text": "You came to the bell through the drowned marsh, and its silt still clings to your boots — the half-sunk shrine will remember the ones who passed." },
    { "flag": "route_ridge", "text": "You reached the bell over the wolf-haunted ridge, where the pack's amber eyes followed you up and, in the end, let you pass." }
   ]
```

- [ ] **Step 4: Run the content + dependent tests** — expect PASS:

`npx vitest run src/content/adventure.test.ts src/state/gameReducer.test.ts src/components/GameScreen.test.tsx src/components/EndingScreen.test.tsx`

- [ ] **Step 5: Commit** `feat(content): Brackenmoor route echo + cottage-gated path + epilogues`

---

### Task 5: Verify + push

- [ ] **Step 1:** `npm run lint && npx tsc --noEmit && npm test && npm run build` — all green.
- [ ] **Step 2:** Playwright spot-check: play Brackenmoor through the cottage → confirm the
  "gravedigger's scrawled map" option appears at the fork; reach the victory ending via the marsh
  and confirm the marsh epilogue renders. Screenshot, read, clean up.
- [ ] **Step 3:** `git push origin main`, watch the deploy, confirm the live bundle hash changed.
```
