# Mini-Campaign + Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Campaign mode that chains the four adventures in a fixed order with a persistent party that levels up between tales (+max HP + full heal, +1 power use), while keeping single-tale play.

**Architecture:** A single party level lives in new `GameState.campaign` data; it threads into the existing `effectiveMaxHp` helper and the combat power-use seed. The Campaign/Single choice folds into the existing setup screen, and level-up feedback rides on the existing ending screen — no new phases.

**Tech Stack:** React + Vite + TypeScript, Vitest. No new dependencies.

---

## File structure

- `src/engine/difficulty.ts` — `effectiveMaxHp(c, diff, level=1)`, `levelPowerBonus`, `HP_PER_LEVEL`.
- `src/state/gameReducer.ts` — `mode` + `campaign` state, `CAMPAIGN_ORDER`, `START_CAMPAIGN`/`ADVANCE_CAMPAIGN`, level-aware HP seeding.
- `src/state/persistence.ts` — validate the new fields.
- `src/components/AdventureSelect.tsx` — Campaign/Single toggle + campaign preview.
- `src/components/EndingScreen.tsx` — campaign-aware routing + level-up panel + summary.
- `src/App.tsx` — wire `onSingle`/`onCampaign` and the ending callbacks.
- `src/components/CombatView.tsx`, `PartyPanel.tsx`, `GameScreen.tsx` — thread the party level.

---

## Task 1: Level-aware difficulty helpers

**Files:**
- Modify: `src/engine/difficulty.ts`
- Test: `src/engine/difficulty.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/engine/difficulty.test.ts` (before the final closing `});`):

```ts
  it('effectiveMaxHp adds +4 max HP per level above 1', () => {
    // wizard base 7, floored to 10 on normal; +4 per extra level
    expect(effectiveMaxHp(wizard, 'normal', 1)).toBe(10);
    expect(effectiveMaxHp(wizard, 'normal', 3)).toBe(18); // 10 + 2*4
    expect(effectiveMaxHp(wizard, 'hard', 3)).toBe(7 + 8); // no floor on hard: 7 + 8 = 15
  });

  it('levelPowerBonus is level-1, never negative', () => {
    expect(levelPowerBonus(1)).toBe(0);
    expect(levelPowerBonus(4)).toBe(3);
    expect(levelPowerBonus(0)).toBe(0);
  });
```

Update the import at the top of `src/engine/difficulty.test.ts`:

```ts
import { effectiveMaxHp, restHp, scaleEnemies, config, campRestHp, levelPowerBonus } from './difficulty';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- difficulty`
Expected: FAIL (`levelPowerBonus` undefined; `effectiveMaxHp` ignores level).

- [ ] **Step 3: Update `src/engine/difficulty.ts`**

Replace the `effectiveMaxHp` function with:

```ts
export const HP_PER_LEVEL = 4;

// Effective max HP after the difficulty's HP floor, plus campaign level bonus.
export function effectiveMaxHp(character: Character, difficulty: Difficulty, level = 1): number {
  return Math.max(character.maxHp, config(difficulty).hpFloor) + (level - 1) * HP_PER_LEVEL;
}

// Extra per-encounter power uses granted by campaign level.
export function levelPowerBonus(level: number): number {
  return Math.max(0, level - 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- difficulty`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/difficulty.ts src/engine/difficulty.test.ts
git commit -m "feat: level-aware effectiveMaxHp + levelPowerBonus"
```

---

## Task 2: Campaign state + actions in the reducer

**Files:**
- Modify: `src/state/gameReducer.ts`
- Test: `src/state/gameReducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/state/gameReducer.test.ts` (before the final closing `});`):

```ts
  it('START_CAMPAIGN sets campaign mode, order, level 1, and the first adventure', () => {
    let s = gameReducer(initialState, { type: 'START_GAME' });
    s = gameReducer(s, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    expect(s.mode).toBe('campaign');
    expect(s.campaign).toEqual({ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 0, level: 1 });
    expect(s.adventureId).toBe('snakewater');
    expect(s.phase).toBe('party-select');
  });

  it('CONFIRM_PARTY in a campaign seeds HP at the party level', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = { ...s, campaign: { ...s.campaign!, level: 3 } };
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    expect(s.hp['bjorn-ironhelm']).toBe(13 + 8); // base 13 + (3-1)*4
  });

  it('ADVANCE_CAMPAIGN levels up, moves to the next adventure, and full-heals', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    s = gameReducer(s, { type: 'ADVANCE_CAMPAIGN' });
    expect(s.campaign).toEqual({ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 1, level: 2 });
    expect(s.adventureId).toBe('chaoticcaves');
    expect(s.sceneId).toBe('town_briefing'); // chaoticcaves start
    expect(s.phase).toBe('scene');
    expect(s.hp['bjorn-ironhelm']).toBe(13 + 4); // healed to level-2 max
  });

  it('SELECT_ADVENTURE keeps single mode and clears campaign', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'hard' });
    s = gameReducer(s, { type: 'SELECT_ADVENTURE', adventureId: 'brackenmoor', difficulty: 'normal' });
    expect(s.mode).toBe('single');
    expect(s.campaign).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- gameReducer`
Expected: FAIL (`mode`/`campaign` and the new actions don't exist).

- [ ] **Step 3: Replace `src/state/gameReducer.ts`**

Replace the entire file with:

```ts
import charactersData from '../content/characters.json';
import { getAdventureData, DEFAULT_ADVENTURE_ID } from '../content/adventures';
import { effectiveMaxHp, campRestHp } from '../engine/difficulty';
import type { Character, Difficulty } from '../types';

const characters = charactersData as unknown as Character[];

export type Phase = 'home' | 'adventure-select' | 'party-select' | 'scene' | 'combat' | 'ending';

// Curated campaign sequence, easy -> hard, ending on the arena gauntlet.
export const CAMPAIGN_ORDER = ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'];

export interface CampaignState {
  order: string[];
  index: number;
  level: number;
}

export interface GameState {
  phase: Phase;
  mode: 'single' | 'campaign';
  campaign?: CampaignState;
  adventureId: string;
  difficulty: Difficulty;
  partyIds: string[];
  hp: Record<string, number>;   // heroId -> current hp
  sceneId: string;
  log: string[];                // narration / roll history
}

export const initialState: GameState = {
  phase: 'home',
  mode: 'single',
  campaign: undefined,
  adventureId: DEFAULT_ADVENTURE_ID,
  difficulty: 'normal',
  partyIds: [],
  hp: {},
  sceneId: getAdventureData(DEFAULT_ADVENTURE_ID).startSceneId,
  log: [],
};

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'SELECT_ADVENTURE'; adventureId: string; difficulty: Difficulty }
  | { type: 'START_CAMPAIGN'; difficulty: Difficulty }
  | { type: 'CONFIRM_PARTY'; partyIds: string[] }
  | { type: 'ADVANCE_CAMPAIGN' }
  | { type: 'GOTO_SCENE'; sceneId: string }
  | { type: 'SET_HP'; hp: Record<string, number> }
  | { type: 'LOG'; entry: string }
  | { type: 'LOAD'; state: GameState }
  | { type: 'RESET' };

function phaseForScene(adventureId: string, sceneId: string): Phase {
  const scene = getAdventureData(adventureId).scenes[sceneId];
  if (!scene) return 'scene';
  if (scene.type === 'combat') return 'combat';
  if (scene.type === 'ending') return 'ending';
  return 'scene';
}

// Full HP for every party member at the given campaign level.
function fullPartyHp(partyIds: string[], difficulty: Difficulty, level: number): Record<string, number> {
  const hp: Record<string, number> = {};
  for (const id of partyIds) {
    const c = characters.find((ch) => ch.id === id);
    if (c) hp[id] = effectiveMaxHp(c, difficulty, level);
  }
  return hp;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return { ...initialState, phase: 'adventure-select' };

    case 'SELECT_ADVENTURE':
      return {
        ...state,
        mode: 'single',
        campaign: undefined,
        phase: 'party-select',
        adventureId: action.adventureId,
        difficulty: action.difficulty,
      };

    case 'START_CAMPAIGN':
      return {
        ...state,
        mode: 'campaign',
        campaign: { order: [...CAMPAIGN_ORDER], index: 0, level: 1 },
        adventureId: CAMPAIGN_ORDER[0],
        difficulty: action.difficulty,
        phase: 'party-select',
      };

    case 'CONFIRM_PARTY': {
      const level = state.campaign?.level ?? 1;
      return {
        ...state,
        phase: 'scene',
        partyIds: action.partyIds,
        hp: fullPartyHp(action.partyIds, state.difficulty, level),
        sceneId: getAdventureData(state.adventureId).startSceneId,
        log: [],
      };
    }

    case 'ADVANCE_CAMPAIGN': {
      if (!state.campaign) return state;
      const index = state.campaign.index + 1;
      if (index >= state.campaign.order.length) return state; // no next adventure
      const level = state.campaign.level + 1;
      const adventureId = state.campaign.order[index];
      return {
        ...state,
        campaign: { ...state.campaign, index, level },
        adventureId,
        difficulty: state.difficulty,
        hp: fullPartyHp(state.partyIds, state.difficulty, level),
        sceneId: getAdventureData(adventureId).startSceneId,
        log: [],
        phase: 'scene',
      };
    }

    case 'GOTO_SCENE': {
      const scene = getAdventureData(state.adventureId).scenes[action.sceneId];
      const base = { ...state, sceneId: action.sceneId, phase: phaseForScene(state.adventureId, action.sceneId) };
      // A safe-room rest scene restores the party on arrival (capped at leveled max).
      if (scene && scene.type === 'story' && scene.rest) {
        const level = state.campaign?.level ?? 1;
        const hp = { ...state.hp };
        for (const id of state.partyIds) {
          const c = characters.find((ch) => ch.id === id);
          if (c) hp[id] = campRestHp(state.hp[id] ?? 0, effectiveMaxHp(c, state.difficulty, level), state.difficulty);
        }
        return { ...base, hp, log: [...state.log, 'You make camp in safety and recover your strength.'] };
      }
      return base;
    }

    case 'SET_HP':
      return { ...state, hp: { ...state.hp, ...action.hp } };

    case 'LOG':
      return { ...state, log: [...state.log, action.entry] };

    case 'LOAD':
      return action.state;

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- gameReducer`
Expected: PASS (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/state/gameReducer.ts src/state/gameReducer.test.ts
git commit -m "feat: campaign state, START_CAMPAIGN + ADVANCE_CAMPAIGN, level HP"
```

---

## Task 3: Persistence validation for campaign saves

**Files:**
- Modify: `src/state/persistence.ts`
- Test: `src/state/persistence.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/state/persistence.test.ts` (before the final closing `});`):

```ts
  it('round-trips a valid campaign save', () => {
    const campaignSave = {
      ...valid, mode: 'campaign',
      campaign: { order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 1, level: 2 },
      adventureId: 'chaoticcaves', sceneId: 'town_briefing',
    };
    saveGame(campaignSave);
    expect(loadValidatedGame()).toEqual(campaignSave);
  });

  it('rejects a campaign save with a non-array order', () => {
    saveGame({ ...valid, mode: 'campaign', campaign: { order: 'nope', index: 0, level: 1 } });
    expect(loadValidatedGame()).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- persistence`
Expected: the round-trip test FAILS (loaded object lacks `mode`/`campaign` round-trip guarantee, or validation drops it). The reject test may already pass.

- [ ] **Step 3: Update `src/state/persistence.ts`**

In `isValid`, after the `if (!Array.isArray(g.log)) return false;` line, add:

```ts
  // Optional campaign fields (backward compatible: missing mode ⇒ single).
  if (g.mode !== undefined && g.mode !== 'single' && g.mode !== 'campaign') return false;
  if (g.campaign !== undefined) {
    const c = g.campaign as Record<string, unknown>;
    if (!c || typeof c !== 'object') return false;
    if (!Array.isArray(c.order) || !c.order.every((x) => typeof x === 'string')) return false;
    if (typeof c.index !== 'number' || c.index < 0 || c.index >= c.order.length) return false;
    if (typeof c.level !== 'number' || c.level < 1) return false;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- persistence`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/persistence.ts src/state/persistence.test.ts
git commit -m "feat: validate campaign fields in saved games"
```

---

## Task 4: AdventureSelect — Campaign/Single toggle

**Files:**
- Modify: `src/components/AdventureSelect.tsx`

- [ ] **Step 1: Replace `src/components/AdventureSelect.tsx`**

```tsx
import { useState } from 'react';
import { ADVENTURES, getAdventureEntry } from '../content/adventures';
import { DIFFICULTIES } from '../engine/difficulty';
import { CAMPAIGN_ORDER } from '../state/gameReducer';
import { sfx } from '../ui/sfx';
import type { Difficulty } from '../types';

interface Props {
  onSingle: (adventureId: string, difficulty: Difficulty) => void;
  onCampaign: (difficulty: Difficulty) => void;
}

const DIFFS: Difficulty[] = ['normal', 'hard'];
type Mode = 'single' | 'campaign';

export function AdventureSelect({ onSingle, onCampaign }: Props) {
  const [mode, setMode] = useState<Mode>('single');
  const [adventureId, setAdventureId] = useState<string>(ADVENTURES[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');

  return (
    <div className="app-shell screen">
      <h2 className="display" style={{ fontSize: '2rem', marginBottom: 2 }}>Choose Your Tale</h2>
      <div className="rule-accent" />

      {/* Mode toggle */}
      <div className="row" style={{ marginBottom: 18 }}>
        {(['single', 'campaign'] as Mode[]).map((m) => (
          <button
            key={m}
            className={`panel choose-card${mode === m ? ' selected' : ''}`}
            style={{ flex: '1 1 260px', textAlign: 'left' }}
            onClick={() => { sfx.click(); setMode(m); }}
          >
            <strong className="display" style={{ fontSize: '1.15rem' }}>{m === 'single' ? 'Single Tale' : 'Campaign'}</strong>
            <p className="muted" style={{ fontSize: '0.9rem', margin: '6px 0 0' }}>
              {m === 'single'
                ? 'Play one adventure of your choice.'
                : 'Chain all four tales with a party that levels up between them.'}
            </p>
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <>
          <p className="muted">Pick a tale, set the challenge, then gather your party.</p>
          <div className="grid-cards stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {ADVENTURES.map((a) => {
              const sel = adventureId === a.id;
              return (
                <button
                  key={a.id}
                  className={`panel choose-card${sel ? ' selected' : ''}`}
                  onClick={() => { sfx.click(); setAdventureId(a.id); }}
                >
                  <div style={{ fontSize: '2.4rem' }}>{a.emoji}</div>
                  <h3 className="display" style={{ margin: '6px 0 2px', fontSize: '1.3rem' }}>{a.title}</h3>
                  <div className="tag" style={{ marginBottom: 8 }}>{a.mood}</div>
                  <p className="muted" style={{ fontSize: '0.98rem', margin: 0 }}>{a.tagline}</p>
                  {a.attribution && <p className="faint" style={{ fontSize: '0.74rem', margin: '8px 0 0' }}>{a.attribution}</p>}
                  {sel && <div className="accent-text" style={{ fontWeight: 700, marginTop: 10 }}>✓ Selected</div>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="muted">Face all four tales in order. Survive each and your party grows stronger.</p>
          <div className="stack">
            {CAMPAIGN_ORDER.map((id, i) => {
              const a = getAdventureEntry(id);
              return (
                <div key={id} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="tag">Bout {i + 1}</span>
                  <span style={{ fontSize: '1.5rem' }}>{a.emoji}</span>
                  <strong className="display">{a.title}</strong>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3 style={{ margin: '26px 0 6px', fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Difficulty</h3>
      <div className="row">
        {DIFFS.map((d) => {
          const cfg = DIFFICULTIES[d];
          const sel = difficulty === d;
          return (
            <button
              key={d}
              className={`panel choose-card${sel ? ' selected' : ''}`}
              style={{ flex: '1 1 280px', textAlign: 'left' }}
              onClick={() => { sfx.click(); setDifficulty(d); }}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <strong className="display" style={{ fontSize: '1.15rem' }}>{cfg.label}</strong>
                {sel && <span className="accent-text" style={{ fontWeight: 700 }}>✓</span>}
              </div>
              <p className="muted" style={{ fontSize: '0.92rem', margin: '6px 0 0' }}>{cfg.blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: '1.02rem', padding: '13px 26px' }}
          onClick={() => { sfx.click(); mode === 'single' ? onSingle(adventureId, difficulty) : onCampaign(difficulty); }}
        >
          {mode === 'single' ? 'Gather the Party →' : 'Begin the Campaign →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check (App wiring updates in Task 6 — expect a temporary error here)**

Run: `npx tsc --noEmit 2>&1 | head`
Expected: an error in `App.tsx` about `AdventureSelect` props (`onConfirm` no longer exists). This is fixed in Task 6; proceed.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdventureSelect.tsx
git commit -m "feat: campaign/single mode toggle on the setup screen"
```

---

## Task 5: EndingScreen — campaign routing + level-up panel

**Files:**
- Modify: `src/components/EndingScreen.tsx`
- Test: `src/components/EndingScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the contents of `src/components/EndingScreen.test.tsx` with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EndingScreen } from './EndingScreen';

describe('EndingScreen', () => {
  it('single-mode victory shows Return to the Tavern', async () => {
    const onReturn = vi.fn();
    render(<EndingScreen mode="single" adventureId="brackenmoor" sceneId="ending_victory" onReturn={onReturn} onAdvance={() => {}} />);
    expect(screen.getByText(/The Bell That Sleeps/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /return to the tavern/i }));
    expect(onReturn).toHaveBeenCalled();
  });

  it('campaign non-final victory shows an Onward button that advances', async () => {
    const onAdvance = vi.fn();
    render(
      <EndingScreen
        mode="campaign"
        adventureId="snakewater"
        sceneId="ending_victory"
        campaign={{ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 0, level: 1 }}
        onReturn={() => {}}
        onAdvance={onAdvance}
      />,
    );
    const onward = screen.getByRole('button', { name: /onward/i });
    expect(onward).toBeInTheDocument();
    await userEvent.click(onward);
    expect(onAdvance).toHaveBeenCalled();
  });

  it('campaign defeat shows a run summary and Return', () => {
    render(
      <EndingScreen
        mode="campaign"
        adventureId="snakewater"
        sceneId="ending_ford_fall"
        campaign={{ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 0, level: 1 }}
        onReturn={() => {}}
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByText(/tales completed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to the tavern/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EndingScreen`
Expected: FAIL (props `mode`/`campaign`/`onAdvance` don't exist).

- [ ] **Step 3: Replace `src/components/EndingScreen.tsx`**

```tsx
import { useEffect } from 'react';
import { getAdventure, getCharacter } from '../engine/party';
import { getAdventureEntry } from '../content/adventures';
import { getScene } from '../engine/story';
import { sfx } from '../ui/sfx';
import type { CampaignState } from '../state/gameReducer';

interface Props {
  mode: 'single' | 'campaign';
  adventureId: string;
  sceneId: string;
  campaign?: CampaignState;
  onReturn: () => void;
  onAdvance: () => void;
}

export function EndingScreen({ mode, adventureId, sceneId, campaign, onReturn, onAdvance }: Props) {
  const scene = getScene(getAdventure(adventureId), sceneId);
  const victory = scene.type === 'ending' && scene.endingType === 'victory';

  useEffect(() => {
    if (scene.type !== 'ending') return;
    if (victory) sfx.victory(); else sfx.defeat();
  }, [scene.type, victory]);

  if (scene.type !== 'ending') return null;

  const inCampaign = mode === 'campaign' && !!campaign;
  const hasNext = inCampaign && campaign!.index < campaign!.order.length - 1;
  const advancing = inCampaign && victory && hasNext;
  const nextTitle = hasNext ? getAdventureEntry(campaign!.order[campaign!.index + 1]).title : '';

  return (
    <div className="app-shell screen center" style={{ paddingTop: '9vh' }}>
      <div style={{ fontSize: '3.4rem', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))' }}>
        {victory ? '🏆' : '💀'}
      </div>
      <h1 className="title-xl" style={{ color: victory ? 'var(--gold)' : 'var(--accent-bright)', textShadow: victory ? '0 2px 22px rgba(217,164,65,0.3)' : '0 2px 22px rgba(230,59,80,0.3)' }}>
        {scene.title}
      </h1>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.35em', fontWeight: 700, color: victory ? 'var(--gold)' : 'var(--accent-bright)', marginTop: 6 }}>
        {scene.endingType}
      </p>
      <div className="rule-accent" style={{ maxWidth: 240, margin: '16px auto', background: victory ? 'linear-gradient(90deg, transparent, var(--gold), transparent)' : 'linear-gradient(90deg, transparent, var(--accent-bright), transparent)' }} />
      <p className="subtitle" style={{ maxWidth: 600, margin: '0 auto 28px', lineHeight: 1.8, fontSize: '1.12rem' }}>
        {scene.narration}
      </p>

      {advancing && (
        <div className="panel panel--framed" style={{ maxWidth: 460, margin: '0 auto 26px' }}>
          <p className="accent-text" style={{ fontWeight: 700, fontSize: '1.15rem', margin: 0 }}>Your party reaches Level {campaign!.level + 1}!</p>
          <p className="muted" style={{ margin: '6px 0 0' }}>+{4} max HP, +1 power use, and all wounds are mended.</p>
        </div>
      )}

      {inCampaign && !advancing && (
        <p className="muted" style={{ marginBottom: 22 }}>
          {victory
            ? `The campaign is won — your party of ${campaign!.order.length} tales stands undefeated at Level ${campaign!.level}.`
            : `You fell in ${getAdventureEntry(adventureId).title}. Tales completed: ${campaign!.index}. Party level: ${campaign!.level}.`}
        </p>
      )}

      {advancing ? (
        <button className="btn btn-primary" style={{ fontSize: '1.02rem', padding: '13px 28px' }} onClick={() => { sfx.click(); onAdvance(); }}>
          Onward to {nextTitle} →
        </button>
      ) : (
        <button className="btn btn-primary" style={{ fontSize: '1.02rem', padding: '13px 28px' }} onClick={() => { sfx.click(); onReturn(); }}>
          Return to the Tavern
        </button>
      )}
    </div>
  );
}
```

> Note: `getCharacter` is imported for parity with other screens but not required here; if the linter flags it as unused, remove it from the import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EndingScreen`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/EndingScreen.tsx src/components/EndingScreen.test.tsx
git commit -m "feat: campaign-aware ending screen (level-up + summary)"
```

---

## Task 6: Wire App + thread the party level into combat/panels

**Files:**
- Modify: `src/App.tsx`, `src/components/CombatView.tsx`, `src/components/PartyPanel.tsx`, `src/components/GameScreen.tsx`

- [ ] **Step 1: Update `App.tsx` — adventure-select and ending wiring**

In `src/App.tsx`, replace the `adventure-select` case:

```tsx
    case 'adventure-select':
      return (
        <AdventureSelect
          onSingle={(adventureId, difficulty) => dispatch({ type: 'SELECT_ADVENTURE', adventureId, difficulty })}
          onCampaign={(difficulty) => dispatch({ type: 'START_CAMPAIGN', difficulty })}
        />
      );
```

And replace the `ending` case:

```tsx
    case 'ending':
      return (
        <EndingScreen
          mode={state.mode}
          adventureId={state.adventureId}
          sceneId={state.sceneId}
          campaign={state.campaign}
          onAdvance={() => dispatch({ type: 'ADVANCE_CAMPAIGN' })}
          onReturn={() => { clearSave(); dispatch({ type: 'RESET' }); }}
        />
      );
```

- [ ] **Step 2: Thread level into `CombatView.tsx`**

In `src/components/CombatView.tsx`, update the difficulty import to include `levelPowerBonus`:

```ts
import { scaleEnemies, restHp, effectiveMaxHp, levelPowerBonus } from '../engine/difficulty';
```

Add a level constant right after `const scene = getScene(adventure, state.sceneId);`:

```ts
  const level = state.campaign?.level ?? 1;
```

In the `useState<CombatState>` initializer, change the two `effectiveMaxHp(...)` calls to pass `level`:

```ts
      return toHero(id, state.hp[id] ?? effectiveMaxHp(c, state.difficulty, level));
    });
    heroes.forEach((h) => { h.maxHp = effectiveMaxHp(getCharacter(h.id), state.difficulty, level); });
```

In the `powerUses` initializer, add the level bonus:

```ts
      if (pid) u[id] = getPower(pid).uses + levelPowerBonus(level);
```

- [ ] **Step 3: Thread level into `PartyPanel.tsx`**

In `src/components/PartyPanel.tsx`, update the props and HP calc:

```tsx
interface Props {
  partyIds: string[];
  hp: Record<string, number>;
  difficulty: Difficulty;
  level?: number;
}

export function PartyPanel({ partyIds, hp, difficulty, level = 1 }: Props) {
```

and change the `max` line:

```tsx
        const max = Math.max(1, effectiveMaxHp(c, difficulty, level));
```

- [ ] **Step 4: Pass level from `GameScreen.tsx`**

In `src/components/GameScreen.tsx`, find the `<PartyPanel ... />` usage and add the level prop:

```tsx
        <PartyPanel partyIds={state.partyIds} hp={state.hp} difficulty={state.difficulty} level={state.campaign?.level ?? 1} />
```

- [ ] **Step 5: Type-check, lint, run the full suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc clean, lint clean, all tests pass. (If `getCharacter` is unused in `EndingScreen.tsx`, remove it from that import to satisfy lint.)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/CombatView.tsx src/components/PartyPanel.tsx src/components/GameScreen.tsx src/components/EndingScreen.tsx
git commit -m "feat: wire campaign mode + thread party level into combat/panels"
```

---

## Task 7: Full verification + deploy

**Files:** none (verification only)

- [ ] **Step 1: Full CI sequence locally**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json && npm test && npm run build`
Expected: all green (one pre-existing react-refresh warning OK).

- [ ] **Step 2: Manual playthrough (run or verify skill)**

Run `npm run dev`. On New Game, choose **Campaign**, pick difficulty, gather a party, and verify:
- The campaign preview lists the four tales as Bout 1–4.
- After winning the first adventure (Snakewater), the ending screen shows the **level-up panel** ("Your party reaches Level 2!") and an **"Onward to The Chaotic Caves →"** button.
- Clicking it starts the next adventure with the party at full, leveled HP (party panel max HP is higher).
- In a combat, a hero's power shows **+1 use** vs single-tale at the same point.
- A defeat ends the campaign with the **"Tales completed: N"** summary.
- Single Tale mode still plays one adventure and returns to the tavern.

- [ ] **Step 3: Push (auto-deploys) and confirm**

```bash
git push origin main
gh run watch "$(gh run list --workflow='Deploy to GitHub Pages' --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: deploy succeeds; campaign mode is live at https://gledilami.github.io/tavern/.

---

## Self-Review

- **Spec coverage:** mode + campaign state, `CAMPAIGN_ORDER`, `START_CAMPAIGN`/`ADVANCE_CAMPAIGN`, level HP seeding (T2) ✓; `effectiveMaxHp` level arg + `levelPowerBonus` + `HP_PER_LEVEL` (T1) ✓; persistence validation of mode/campaign (T3) ✓; Campaign/Single toggle + campaign preview (T4) ✓; campaign-aware ending with level-up panel + summary (T5) ✓; App wiring + level threaded into combat/panels (T6) ✓; tests across reducer/difficulty/persistence/ending (T1–T5) ✓; verify + deploy (T7) ✓.
- **Placeholder scan:** none — complete code/commands throughout.
- **Type consistency:** `CampaignState { order; index; level }` defined in T2, imported by `EndingScreen` (T5) and used in `GameState.campaign`; `effectiveMaxHp(c, diff, level=1)` signature consistent across T1 def and T2/T6 callers; `levelPowerBonus` used in T6; `AdventureSelect` props `onSingle`/`onCampaign` (T4) match App wiring (T6); `EndingScreen` props `mode`/`campaign`/`onAdvance`/`onReturn` (T5) match App wiring (T6); `PartyPanel` `level?` (T6) matches GameScreen call (T6). `CONFIRM_PARTY` HP seeding via `fullPartyHp` matches the level model.
- **Scope:** single cohesive plan; per-hero levels, perk menus, second powers, XP numbers, and full run-summary/gallery excluded per spec.
```
