# Run Summary + Ending Gallery + Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-run summary on the ending screen, a persistent "Hall of Tales" gallery of endings unlocked across all adventures, and a copy/native-share result card.

**Architecture:** A `RunStats` accumulator in game state is updated via a `RECORD` action from the few call sites that already know who acted (checks in GameScreen; damage/crits/downs/wins in CombatView). The ending screen renders the summary + a Share button. A separate `chronicle` localStorage record (independent of the save) tracks discovered endings, surfaced in a new Hall of Tales screen opened from Home via App-local state.

**Tech Stack:** React + Vite + TypeScript, Vitest. No new dependencies.

---

## File structure

- `src/state/gameReducer.ts` — `RunStats`/`emptyStats`, `stats` field, `RECORD` action + merge, reset rules.
- `src/state/chronicle.ts` (new) — discovered-endings persistence + `endingsOf`.
- `src/ui/share.ts` (new) — `buildShareText` + `shareOrCopy`.
- `src/components/EndingScreen.tsx` — summary panel + Share; record ending on mount.
- `src/components/HallOfTales.tsx` (new) — the gallery screen.
- `src/components/TavernHome.tsx` — a "Hall of Tales" button.
- `src/App.tsx` — `showHall` local state + routing; pass stats/difficulty/level to EndingScreen.
- `src/components/GameScreen.tsx`, `src/components/CombatView.tsx` — `RECORD` dispatches.
- `src/state/persistence.ts` — lenient `stats` validation.

---

## Task 1: RunStats + RECORD in the reducer

**Files:**
- Modify: `src/state/gameReducer.ts`
- Test: `src/state/gameReducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/state/gameReducer.test.ts` (before the final closing `});`):

```ts
  it('RECORD merges deltas: numbers add, biggestHit maxes, damageByHero merges', () => {
    let s = gameReducer(initialState, { type: 'RECORD', delta: { crits: 1, biggestHit: 8, damageByHero: { a: 5 } } });
    s = gameReducer(s, { type: 'RECORD', delta: { crits: 2, biggestHit: 5, damageByHero: { a: 3, b: 7 } } });
    expect(s.stats.crits).toBe(3);
    expect(s.stats.biggestHit).toBe(8);
    expect(s.stats.damageByHero).toEqual({ a: 8, b: 7 });
  });

  it('CONFIRM_PARTY resets run stats', () => {
    let s = gameReducer(initialState, { type: 'RECORD', delta: { crits: 5 } });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    expect(s.stats.crits).toBe(0);
  });

  it('ADVANCE_CAMPAIGN keeps run stats accumulating', () => {
    let s = gameReducer(initialState, { type: 'START_CAMPAIGN', difficulty: 'normal' });
    s = gameReducer(s, { type: 'CONFIRM_PARTY', partyIds: ['bjorn-ironhelm'] });
    s = gameReducer(s, { type: 'RECORD', delta: { encountersWon: 2 } });
    s = gameReducer(s, { type: 'ADVANCE_CAMPAIGN' });
    expect(s.stats.encountersWon).toBe(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- gameReducer`
Expected: FAIL (`stats`/`RECORD` don't exist).

- [ ] **Step 3: Add RunStats to `src/state/gameReducer.ts`**

After the `CampaignState` interface, add:

```ts
export interface RunStats {
  encountersWon: number;
  checksPassed: number;
  checksFailed: number;
  heroesDowned: number;
  crits: number;
  biggestHit: number;
  damageByHero: Record<string, number>;
}

export const emptyStats: RunStats = {
  encountersWon: 0, checksPassed: 0, checksFailed: 0,
  heroesDowned: 0, crits: 0, biggestHit: 0, damageByHero: {},
};

function mergeStats(a: RunStats, d: Partial<RunStats>): RunStats {
  const damageByHero = { ...a.damageByHero };
  if (d.damageByHero) for (const [id, n] of Object.entries(d.damageByHero)) damageByHero[id] = (damageByHero[id] ?? 0) + n;
  return {
    encountersWon: a.encountersWon + (d.encountersWon ?? 0),
    checksPassed: a.checksPassed + (d.checksPassed ?? 0),
    checksFailed: a.checksFailed + (d.checksFailed ?? 0),
    heroesDowned: a.heroesDowned + (d.heroesDowned ?? 0),
    crits: a.crits + (d.crits ?? 0),
    biggestHit: Math.max(a.biggestHit, d.biggestHit ?? 0),
    damageByHero,
  };
}
```

Add `stats: RunStats;` to the `GameState` interface (after `log`). Add
`stats: emptyStats,` to `initialState` (after `log: []`). Add the action to the
`GameAction` union:

```ts
  | { type: 'RECORD'; delta: Partial<RunStats> }
```

In `CONFIRM_PARTY`'s returned object, add `stats: emptyStats,`. Add the new case
(anywhere in the switch, e.g. before `SET_HP`):

```ts
    case 'RECORD':
      return { ...state, stats: mergeStats(state.stats, action.delta) };
```

> Note: `ADVANCE_CAMPAIGN` already spreads `...state` and does not touch `stats`,
> so stats correctly carry across campaign tales. `RESET` returns `initialState`
> (stats reset). No other change needed there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- gameReducer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/gameReducer.ts src/state/gameReducer.test.ts
git commit -m "feat: RunStats accumulator + RECORD action"
```

---

## Task 2: Chronicle persistence (Hall of Tales data)

**Files:**
- Create: `src/state/chronicle.ts`
- Test: `src/state/chronicle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/state/chronicle.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadChronicle, recordEnding, recordCampaignWon, clearChronicle, endingsOf } from './chronicle';

describe('chronicle', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(loadChronicle()).toEqual({ endings: {}, campaignWon: false });
  });

  it('records endings without duplicates', () => {
    recordEnding('brackenmoor', 'ending_victory');
    recordEnding('brackenmoor', 'ending_victory');
    recordEnding('brackenmoor', 'ending_pack');
    expect(loadChronicle().endings.brackenmoor.sort()).toEqual(['ending_pack', 'ending_victory']);
  });

  it('records campaign completion', () => {
    recordCampaignWon();
    expect(loadChronicle().campaignWon).toBe(true);
  });

  it('clearChronicle empties it', () => {
    recordEnding('arena', 'ending_pit_win');
    clearChronicle();
    expect(loadChronicle()).toEqual({ endings: {}, campaignWon: false });
  });

  it('endingsOf returns an adventure\'s ending scenes', () => {
    const ids = endingsOf('brackenmoor').map((e) => e.id);
    expect(ids).toContain('ending_victory');
    expect(ids).toContain('ending_pack');
    expect(endingsOf('brackenmoor').length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- chronicle`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/state/chronicle.ts`**

```ts
import { getAdventureEntry } from '../content/adventures';

const KEY = 'tavern.chronicle.v1';

export interface Chronicle {
  endings: Record<string, string[]>; // adventureId -> discovered ending scene ids
  campaignWon: boolean;
}

function read(): Chronicle {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Chronicle>;
      if (p && typeof p === 'object') {
        return { endings: p.endings ?? {}, campaignWon: !!p.campaignWon };
      }
    }
  } catch { /* ignore */ }
  return { endings: {}, campaignWon: false };
}

function write(c: Chronicle): void {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export function loadChronicle(): Chronicle {
  return read();
}

export function recordEnding(adventureId: string, endingId: string): void {
  const c = read();
  const list = c.endings[adventureId] ?? [];
  if (!list.includes(endingId)) {
    c.endings[adventureId] = [...list, endingId];
    write(c);
  }
}

export function recordCampaignWon(): void {
  const c = read();
  if (!c.campaignWon) { c.campaignWon = true; write(c); }
}

export function clearChronicle(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// All ending scenes (id + title) for an adventure, used for "discovered / total".
export function endingsOf(adventureId: string): { id: string; title: string }[] {
  const adventure = getAdventureEntry(adventureId).data;
  return Object.values(adventure.scenes)
    .filter((s) => s.type === 'ending')
    .map((s) => ({ id: s.id, title: s.title }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- chronicle`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/chronicle.ts src/state/chronicle.test.ts
git commit -m "feat: chronicle persistence for discovered endings"
```

---

## Task 3: Share helper

**Files:**
- Create: `src/ui/share.ts`
- Test: `src/ui/share.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui/share.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildShareText } from './share';
import { emptyStats } from '../state/gameReducer';

describe('buildShareText', () => {
  it('includes title, difficulty, level, MVP and crits', () => {
    const text = buildShareText(
      { ...emptyStats, crits: 2, biggestHit: 14, encountersWon: 3 },
      { title: 'The Snakewater Raid', difficulty: 'normal', level: 2, outcome: 'victory', isCampaign: false, mvpName: 'Gronk Skullsplitter' },
    );
    expect(text).toContain('The Snakewater Raid');
    expect(text).toContain('Level 2');
    expect(text).toContain('MVP: Gronk Skullsplitter');
    expect(text).toContain('2 crits');
    expect(text).toMatch(/Normal/);
  });

  it('omits the MVP clause when there is no MVP', () => {
    const text = buildShareText(emptyStats, { title: 'X', difficulty: 'hard', level: 1, outcome: 'defeat', isCampaign: false });
    expect(text).not.toContain('MVP');
    expect(text).toContain('Hard');
    expect(text).toContain('fell in');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "src/ui/share"`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/ui/share.ts`**

```ts
import type { Difficulty } from '../types';
import type { RunStats } from '../state/gameReducer';

export interface ShareContext {
  title: string;
  difficulty: Difficulty;
  level: number;
  outcome: 'victory' | 'defeat';
  isCampaign: boolean;
  mvpName?: string;
}

const PLAY_URL = 'https://gledilami.github.io/tavern/';

export function buildShareText(stats: RunStats, ctx: ShareContext): string {
  const verb = ctx.outcome === 'victory' ? 'cleared' : 'fell in';
  const diff = ctx.difficulty === 'hard' ? 'Hard' : 'Normal';
  const what = ctx.isCampaign ? 'the Tavern campaign' : `"${ctx.title}"`;
  const bits: string[] = [];
  if (ctx.mvpName) bits.push(`MVP: ${ctx.mvpName}`);
  if (stats.crits) bits.push(`${stats.crits} crit${stats.crits > 1 ? 's' : ''}`);
  if (stats.biggestHit) bits.push(`biggest hit ${stats.biggestHit}`);
  if (stats.encountersWon) bits.push(`${stats.encountersWon} fight${stats.encountersWon > 1 ? 's' : ''} won`);
  const tail = bits.length ? ` ${bits.join(' · ')}.` : '';
  return `⚔️ Tavern — I ${verb} ${what} on ${diff} at Level ${ctx.level}.${tail} Play: ${PLAY_URL}`;
}

// Try the native share sheet, fall back to clipboard. Never throws.
export async function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }) : undefined;
    if (nav?.share) { await nav.share({ text }); return 'shared'; }
    if (nav?.clipboard) { await nav.clipboard.writeText(text); return 'copied'; }
    return 'failed';
  } catch {
    return 'failed';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "src/ui/share"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/share.ts src/ui/share.test.ts
git commit -m "feat: share text builder + shareOrCopy"
```

---

## Task 4: Record stats during play

**Files:**
- Modify: `src/components/GameScreen.tsx`, `src/components/CombatView.tsx`

- [ ] **Step 1: Record check results in `GameScreen.tsx`**

In `src/components/GameScreen.tsx`, inside `attemptWith`, after the existing
`dispatch({ type: 'LOG', ... })` call, add:

```ts
    dispatch({ type: 'RECORD', delta: result.success ? { checksPassed: 1 } : { checksFailed: 1 } });
```

- [ ] **Step 2: Record combat stats in `CombatView.tsx`**

In `src/components/CombatView.tsx`, add a helper inside `applyResult` to count
newly-downed heroes and record wins. Replace the `applyResult` body's start
(the part from `function applyResult(next: CombatState) {` through the
`dispatch({ type: 'SET_HP', hp });` line) with:

```ts
  function applyResult(next: CombatState) {
    const ev = next.lastAttack;
    if (ev && ev.amount > 0) {
      if (ev.kind === 'heal') sfx.click(); else sfx.hit();
      setFlash({ id: ev.targetId, amount: ev.amount, heal: ev.kind === 'heal', nonce: Date.now() });
      setTimeout(() => { if (mounted.current) setFlash(null); }, 850);
    }

    // Count heroes that dropped this action (were up in `combat`, down in `next`).
    const downed = next.combatants.filter(
      (c) => c.isHero && c.hp <= 0 && (combat.combatants.find((p) => p.id === c.id)?.hp ?? 0) > 0,
    ).length;
    if (downed > 0) dispatch({ type: 'RECORD', delta: { heroesDowned: downed } });

    setCombat(next);

    const hp: Record<string, number> = {};
    next.combatants.filter((c) => c.isHero).forEach((c) => { hp[c.heroId!] = c.hp; });
    dispatch({ type: 'SET_HP', hp });
```

(The rest of `applyResult` — the `if (next.status !== 'active' ...)` block — stays
the same.) Then, inside that block, on the victory branch, add an encounters-won
record. Change the victory branch's first line:

```ts
      if (next.status === 'victory') {
        dispatch({ type: 'RECORD', delta: { encountersWon: 1 } });
        const healed: Record<string, number> = {};
```

- [ ] **Step 3: Record hero damage in `heroAttack` and `resolvePower`**

In `src/components/CombatView.tsx`, replace `heroAttack` and `resolvePower` with
versions that record the acting hero's damage:

```ts
  function recordHeroDamage(heroId: string, next: CombatState) {
    const ev = next.lastAttack;
    if (ev && ev.kind === 'attack' && ev.amount > 0) {
      dispatch({ type: 'RECORD', delta: { damageByHero: { [heroId]: ev.amount }, biggestHit: ev.amount, crits: ev.crit ? 1 : 0 } });
    }
  }

  function heroAttack(attackName: string) {
    if (!target) return;
    sfx.click();
    const next = performHeroAttack(combat, actor.id, attackName, target, defaultRng, lookup);
    recordHeroDamage(actor.heroId!, next);
    applyResult(next);
    setTarget(null);
  }

  function resolvePower(targetIds: string[]) {
    if (!power) return;
    sfx.click();
    setPowerUses((u) => ({ ...u, [actor.id]: (u[actor.id] ?? 0) - 1 }));
    setPendingPower(null);
    setTarget(null);
    const next = applyPower(combat, actor.id, power.id, targetIds, defaultRng, lookup);
    recordHeroDamage(actor.heroId!, next);
    applyResult(next);
  }
```

- [ ] **Step 4: Type-check and run the affected tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test -- CombatView GameScreen`
Expected: PASS (existing tests unaffected by the added dispatches).

- [ ] **Step 5: Commit**

```bash
git add src/components/GameScreen.tsx src/components/CombatView.tsx
git commit -m "feat: record run stats during checks and combat"
```

---

## Task 5: Run summary + Share on the EndingScreen

**Files:**
- Modify: `src/components/EndingScreen.tsx`
- Test: `src/components/EndingScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace `src/components/EndingScreen.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EndingScreen } from './EndingScreen';
import { emptyStats } from '../state/gameReducer';

const stats = { ...emptyStats, encountersWon: 2, crits: 1, biggestHit: 12, damageByHero: { 'gronk-skullsplitter': 30 } };

describe('EndingScreen', () => {
  beforeEach(() => localStorage.clear());

  it('single-mode victory shows the run summary and a Share button', async () => {
    const onReturn = vi.fn();
    render(<EndingScreen mode="single" adventureId="brackenmoor" sceneId="ending_victory" difficulty="normal" level={1} stats={stats} onReturn={onReturn} onAdvance={() => {}} />);
    expect(screen.getByText(/The Bell That Sleeps/i)).toBeInTheDocument();
    expect(screen.getByText(/MVP/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /return to the tavern/i }));
    expect(onReturn).toHaveBeenCalled();
  });

  it('an advancing campaign victory hides the run summary (shows level-up instead)', () => {
    render(
      <EndingScreen
        mode="campaign" adventureId="snakewater" sceneId="ending_victory" difficulty="normal" level={1} stats={stats}
        campaign={{ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 0, level: 1 }}
        onReturn={() => {}} onAdvance={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /onward/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- EndingScreen`
Expected: FAIL (props `difficulty`/`level`/`stats` missing; no summary/Share).

- [ ] **Step 3: Replace `src/components/EndingScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { getAdventure, getCharacter } from '../engine/party';
import { getAdventureEntry } from '../content/adventures';
import { getScene } from '../engine/story';
import { recordEnding, recordCampaignWon } from '../state/chronicle';
import { buildShareText, shareOrCopy } from '../ui/share';
import { sfx } from '../ui/sfx';
import type { Difficulty } from '../types';
import type { CampaignState, RunStats } from '../state/gameReducer';

interface Props {
  mode: 'single' | 'campaign';
  adventureId: string;
  sceneId: string;
  difficulty: Difficulty;
  level: number;
  stats: RunStats;
  campaign?: CampaignState;
  onReturn: () => void;
  onAdvance: () => void;
}

function mvp(stats: RunStats): string | undefined {
  const entries = Object.entries(stats.damageByHero);
  if (entries.length === 0) return undefined;
  const [id] = entries.reduce((best, e) => (e[1] > best[1] ? e : best));
  try { return getCharacter(id).name; } catch { return undefined; }
}

export function EndingScreen({ mode, adventureId, sceneId, difficulty, level, stats, campaign, onReturn, onAdvance }: Props) {
  const scene = getScene(getAdventure(adventureId), sceneId);
  const victory = scene.type === 'ending' && scene.endingType === 'victory';
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const inCampaign = mode === 'campaign' && !!campaign;
  const hasNext = inCampaign && campaign!.index < campaign!.order.length - 1;
  const advancing = inCampaign && victory && hasNext;

  // Record the ending in the persistent chronicle (once per mount).
  useEffect(() => {
    if (scene.type !== 'ending') return;
    recordEnding(adventureId, sceneId);
    if (inCampaign && victory && !hasNext) recordCampaignWon();
    if (victory) sfx.victory(); else sfx.defeat();
  }, [scene.type, adventureId, sceneId, inCampaign, victory, hasNext]);

  if (scene.type !== 'ending') return null;

  const nextTitle = hasNext ? getAdventureEntry(campaign!.order[campaign!.index + 1]).title : '';
  const mvpName = mvp(stats);

  async function onShare() {
    const text = buildShareText(stats, {
      title: inCampaign ? 'the Tavern campaign' : getAdventureEntry(adventureId).title,
      difficulty, level, outcome: victory ? 'victory' : 'defeat', isCampaign: inCampaign, mvpName,
    });
    const result = await shareOrCopy(text);
    setShareMsg(result === 'shared' ? 'Shared!' : result === 'copied' ? 'Copied to clipboard!' : 'Could not share');
  }

  const stat = (label: string, value: string | number) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '3px 0' }}>
      <span className="muted">{label}</span><strong>{value}</strong>
    </div>
  );

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
          <p className="muted" style={{ margin: '6px 0 0' }}>+4 max HP, +1 power use, and all wounds are mended.</p>
        </div>
      )}

      {!advancing && (
        <div className="panel panel--framed" style={{ maxWidth: 460, margin: '0 auto 22px', textAlign: 'left' }}>
          <h3 className="display" style={{ marginTop: 0, fontSize: '1.1rem' }}>Run Summary</h3>
          {stat('Party level', level)}
          {mvpName && stat('MVP', mvpName)}
          {stat('Fights won', stats.encountersWon)}
          {stat('Checks passed / failed', `${stats.checksPassed} / ${stats.checksFailed}`)}
          {stat('Heroes downed', stats.heroesDowned)}
          {stat('Critical hits', stats.crits)}
          {stat('Biggest hit', stats.biggestHit)}
          <div className="row" style={{ marginTop: 14, alignItems: 'center', gap: 10 }}>
            <button className="btn" onClick={() => { sfx.click(); onShare(); }}>📋 Share result</button>
            {shareMsg && <span className="accent-text" style={{ fontSize: '0.9rem' }}>{shareMsg}</span>}
          </div>
        </div>
      )}

      {inCampaign && !advancing && (
        <p className="muted" style={{ marginBottom: 22 }}>
          {victory
            ? `The campaign is won — your party stands undefeated at Level ${campaign!.level}.`
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- EndingScreen`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/EndingScreen.tsx src/components/EndingScreen.test.tsx
git commit -m "feat: run summary + share on the ending screen"
```

---

## Task 6: Hall of Tales screen + Home button + App wiring

**Files:**
- Create: `src/components/HallOfTales.tsx`
- Test: `src/components/HallOfTales.test.tsx`
- Modify: `src/components/TavernHome.tsx`, `src/App.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/HallOfTales.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HallOfTales } from './HallOfTales';
import { recordEnding } from '../state/chronicle';

describe('HallOfTales', () => {
  beforeEach(() => localStorage.clear());

  it('shows discovered ending titles and hides undiscovered ones', () => {
    recordEnding('brackenmoor', 'ending_victory');
    render(<HallOfTales onBack={() => {}} />);
    expect(screen.getByText(/The Bell That Sleeps/i)).toBeInTheDocument(); // discovered
    expect(screen.getAllByText('— ???').length).toBeGreaterThan(0);        // undiscovered
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- HallOfTales`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/components/HallOfTales.tsx`**

```tsx
import { useState } from 'react';
import { ADVENTURES } from '../content/adventures';
import { loadChronicle, endingsOf, clearChronicle } from '../state/chronicle';
import { sfx } from '../ui/sfx';

export function HallOfTales({ onBack }: { onBack: () => void }) {
  const [tick, setTick] = useState(0);
  const chron = loadChronicle();
  void tick;

  return (
    <div className="app-shell screen">
      <h2 className="display" style={{ fontSize: '2rem', marginBottom: 2 }}>Hall of Tales</h2>
      <div className="rule-accent" />
      <p className="muted">Every ending you have uncovered across your adventures.</p>

      {chron.campaignWon && (
        <div className="panel panel--framed" style={{ marginBottom: 14 }}>
          <strong className="accent-text">🏆 Campaign complete — you have conquered all four tales.</strong>
        </div>
      )}

      <div className="stack">
        {ADVENTURES.map((a) => {
          const all = endingsOf(a.id);
          const found = chron.endings[a.id] ?? [];
          return (
            <div key={a.id} className="panel">
              <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.6rem' }}>{a.emoji}</span>
                  <strong className="display" style={{ fontSize: '1.15rem' }}>{a.title}</strong>
                </span>
                <span className="tag">{found.length}/{all.length} endings</span>
              </div>
              <div className="stack" style={{ gap: 4, marginTop: 10 }}>
                {all.map((e) => {
                  const got = found.includes(e.id);
                  return (
                    <div key={e.id} style={{ fontSize: '0.92rem', color: got ? 'var(--ink)' : 'var(--ink-faint)' }}>
                      {got ? `✓ ${e.title}` : '— ???'}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 22, justifyContent: 'space-between' }}>
        <button className="btn" onClick={() => { sfx.click(); clearChronicle(); setTick((t) => t + 1); }}>Clear records</button>
        <button className="btn btn-primary" onClick={() => { sfx.click(); onBack(); }}>← Back to the Tavern</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- HallOfTales`
Expected: PASS.

- [ ] **Step 5: Add a Hall button to `TavernHome.tsx`**

In `src/components/TavernHome.tsx`, add `onHall: () => void;` to the `Props`
interface, accept it in the function signature
(`export function TavernHome({ hasSave, onNewGame, onContinue, onHall }: Props) {`),
and add a button after the Continue button (inside the `.row`):

```tsx
          <button className="btn" style={{ padding: '14px 24px' }} onClick={() => { sfx.click(); onHall(); }}>
            Hall of Tales
          </button>
```

- [ ] **Step 6: Wire the Hall + ending props in `App.tsx`**

In `src/App.tsx`:

Add imports:

```ts
import { initialState, emptyStats, type GameState } from './state/gameReducer';
import { HallOfTales } from './components/HallOfTales';
```

(adjust the existing `import { initialState, type GameState } ...` line to include `emptyStats`).

Add `showHall` state inside `Screens` and route the home case. Replace the
`home` case with:

```ts
    case 'home':
      if (showHall) return <HallOfTales onBack={() => setShowHall(false)} />;
      return (
        <TavernHome
          hasSave={loadValidatedGame() !== null}
          onNewGame={() => { clearSave(); dispatch({ type: 'START_GAME' }); }}
          onContinue={() => {
            const saved = loadValidatedGame();
            if (saved) dispatch({ type: 'LOAD', state: saved });
          }}
          onHall={() => setShowHall(true)}
        />
      );
```

and add, at the top of `Screens` (after `const { state, dispatch } = useGame();`):

```ts
  const [showHall, setShowHall] = useState(false);
```

Replace the `ending` case to pass the new props:

```ts
    case 'ending':
      return (
        <EndingScreen
          mode={state.mode}
          adventureId={state.adventureId}
          sceneId={state.sceneId}
          difficulty={state.difficulty}
          level={state.campaign?.level ?? 1}
          stats={state.stats ?? emptyStats}
          campaign={state.campaign}
          onAdvance={() => dispatch({ type: 'ADVANCE_CAMPAIGN' })}
          onReturn={() => { clearSave(); dispatch({ type: 'RESET' }); }}
        />
      );
```

- [ ] **Step 7: Type-check, lint, run full suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc clean, lint clean, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/HallOfTales.tsx src/components/HallOfTales.test.tsx src/components/TavernHome.tsx src/App.tsx
git commit -m "feat: Hall of Tales gallery + Home button + ending props"
```

---

## Task 7: Lenient stats validation in persistence

**Files:**
- Modify: `src/state/persistence.ts`

- [ ] **Step 1: Add the validation**

In `src/state/persistence.ts`, inside `isValid`, after the campaign-fields block
added previously, add:

```ts
  if (g.stats !== undefined && (typeof g.stats !== 'object' || g.stats === null)) return false;
```

> A missing `stats` is tolerated: `initialState.stats = emptyStats` and the
> `LOAD` path returns the saved state as-is, while `App` passes
> `state.stats ?? emptyStats` to the EndingScreen.

- [ ] **Step 2: Type-check and run persistence tests**

Run: `npx tsc --noEmit && npm test -- persistence`
Expected: PASS (existing persistence tests still hold; campaign saves with no
`stats` remain valid).

- [ ] **Step 3: Commit**

```bash
git add src/state/persistence.ts
git commit -m "feat: tolerate optional stats in saved games"
```

---

## Task 8: Full verification + deploy

**Files:** none (verification only)

- [ ] **Step 1: Full CI sequence locally**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json && npm test && npm run build`
Expected: all green (the one pre-existing react-refresh warning is OK).

- [ ] **Step 2: Manual playthrough (run or verify skill)**

Run `npm run dev`. Verify:
- Home shows a **Hall of Tales** button → opens the gallery (all four tales,
  "0/N endings", "— ???" rows) → Back returns to the Tavern.
- Play a single tale to an ending → the **Run Summary** panel shows party level,
  MVP, fights won, checks, crits, biggest hit → **Share result** copies a text
  card (a "Copied to clipboard!" note appears).
- Return to the Tavern, open Hall of Tales → the ending you just reached now
  shows its title and the count incremented.
- A campaign intermediate victory still shows the **level-up** panel and Onward
  (no summary); the campaign's final victory / a defeat shows the summary.

- [ ] **Step 3: Push (auto-deploys) and confirm**

```bash
git push origin main
gh run watch "$(gh run list --workflow='Deploy to GitHub Pages' --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: the deploy run succeeds; the summary, gallery, and share are live at https://gledilami.github.io/tavern/.

---

## Self-Review

- **Spec coverage:** RunStats + RECORD + reset rules (T1) ✓; chronicle persistence + `endingsOf` (T2) ✓; `buildShareText`/`shareOrCopy` (T3) ✓; stat instrumentation for checks + combat damage/crits/downs/wins (T4) ✓; terminal-only run summary + Share + ending recording (T5) ✓; Hall of Tales screen + Home button + App routing + ending props (T6) ✓; lenient stats validation (T7) ✓; verify + deploy (T8) ✓.
- **Placeholder scan:** none — complete code/commands throughout.
- **Type consistency:** `RunStats`/`emptyStats` defined in T1, imported by `share.ts` (T3) and `EndingScreen` (T5) and `App` (T6); `RECORD`/`Partial<RunStats>` action consistent across T1 reducer and T4 dispatch sites; `ShareContext` (T3) matches the `buildShareText` call in `EndingScreen` (T5); `chronicle` API (`loadChronicle`/`recordEnding`/`recordCampaignWon`/`clearChronicle`/`endingsOf`) consistent across T2 def and T5/T6 callers; `EndingScreen` props (`mode/adventureId/sceneId/difficulty/level/stats/campaign/onReturn/onAdvance`) match T6 App wiring; `TavernHome` `onHall` (T6) matches App.
- **Scope:** single cohesive plan; image cards, server leaderboards, and per-run history excluded per spec.
```
