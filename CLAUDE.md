# Tavern — Agent Handoff / Onboarding

> If you're a fresh agent picking this up: read this top-to-bottom once, then you're oriented.
> This is the single source of truth for "how this project works and how we work on it."

## What this is

**Tavern** is a **pass-and-play Dungeons & Dragons dice-storytelling game** that runs entirely
in the browser. No backend, no accounts. Multiple players share one screen; you pick a party of
premade heroes, play a branching adventure of choices + d20 skill checks + turn-based combat, and
reach a victory/defeat ending. There's also a **Campaign** mode that chains four adventures with a
leveling party.

- **Stack:** React 18 + Vite 5 + TypeScript, Vitest for tests, ESLint 9 (flat config). Plain CSS theme.
- **Repo:** https://github.com/GlediLami/tavern (owner `GlediLami`; `gh` CLI is authenticated as that user with `repo`+`workflow` scopes).
- **Live:** https://gledilami.github.io/tavern/ (GitHub Pages, auto-deploys on push to `main`).
- **Owner/dev:** Gledis Lami (`GlediLami`). Likes momentum — says "proceed"/"continue" and expects action; keep the brainstorm→plan→implement→deploy loop tight.

## Commands

```bash
npm install
npm run dev       # vite dev server (add `-- --port 5180 --host` if needed)
npm test          # vitest run — 156 tests currently, all passing
npm run lint      # eslint . (one benign react-refresh warning on GameContext.tsx is expected)
npm run build     # tsc --noEmit -p tsconfig.json && vite build  (NOT `tsc -b` — see gotchas)
npm run preview   # serve the production build (vite preview)
```

CI (`.github/workflows/ci.yml`) runs lint → type-check → test → build on every push/PR.
Deploy (`.github/workflows/deploy.yml`) builds and publishes `dist/` to Pages on push to `main`.

## Architecture (layering — respect it)

```
content (JSON)  ->  engine (pure TS, no React)  ->  state (reducer + context)  ->  components (React)
```

- **The engine never imports React.** It's pure, deterministic (RNG is injected), and unit-tested.
- Components are a thin layer over the engine + reducer. Tests are colocated (`*.test.ts[x]`).
- When you add a `GameState` field, you MUST update the test fixtures that build `GameState`
  literals (see Gotchas).

### Directory map

- `src/types.ts` — all shared domain types (Ability, Skill, Character, Scene, Adventure, Enemy,
  EnemyAbility, Power, Combatant, CombatState, AttackEvent, RunStats lives in the reducer though).
- `src/engine/`
  - `rng.ts` — seedable PRNG (`makeRng(seed)`), `defaultRng` (Math.random). Tests force values.
  - `dice.ts` — `rollDie`, `rollD20`, `rollD20WithMode(rng, 'adv'|'dis')`, `rollDice("2d6+3")`.
  - `skills.ts` — `SKILL_ABILITY` (18 skills), `abilityMod`, `skillModifier`, `skillLabel`.
  - `checks.ts` — `resolveCheck(char, skill, dc, rng)` → d20+mod vs DC, nat-20 crit / nat-1 fail.
  - `story.ts` — `getScene`, `resolveChoice` (branch routing).
  - `combat.ts` — the combat engine. `startCombat`, `currentCombatant`, `performHeroAttack`,
    `performHeroHeal`, `performEnemyTurn`, and shared helpers `applyAttack`/`applyHeal`/`clone`/
    `checkStatus`/`advanceTurn`. Advantage via the one-shot `Combatant.nextAttack` flag. Enemy
    abilities (buff ally / debuff hero) resolved in `performEnemyTurn`.
  - `powers.ts` — class-power registry (`POWERS`) + `applyPower(state, casterId, powerId, targetIds,
    rng, lookup)`. Reuses `applyAttack`/`applyHeal`. Reads `combatant.primaryAttack` (NOT the global
    character registry) so it works with test heroes.
  - `difficulty.ts` — `DIFFICULTIES` (normal/hard), `config`, `effectiveMaxHp(c, diff, level=1)`,
    `levelPowerBonus(level)`, `restHp` (between-fight), `campRestHp` (safe-room rest), `scaleEnemies`
    (difficulty + solo-party thinning), `HP_PER_LEVEL=4`.
  - `party.ts` — `getAllCharacters`, `getCharacter`, `getAdventure(id)`, `toHero`, `makeHeroAttackLookup`.
  - `save.ts` — raw localStorage get/set/clear (`tavern.save.v1`). Try/catch everywhere.
- `src/content/`
  - `characters.json` — **12 heroes** (all 12 D&D classes), each with SRD-based stats + a `powerId`.
  - `adventure.json` (Brackenmoor), `snakewater.json`, `chaoticcaves.json`, `arena.json` — scene-graph
    adventures (story/combat/ending). Some enemies carry an `ability`. Rest scenes have `"rest": true`.
  - `adventures.ts` — the adventure registry (`ADVENTURES`, `getAdventureEntry`, `getAdventureData`,
    `DEFAULT_ADVENTURE_ID`). Add new adventures here.
  - `*.test.ts` — `characters.test.ts` (validates stats + powerIds), `adventure.test.ts`
    (`describe.each` over ALL adventures: connectivity, reachability, ≥2 combats, both ending types,
    enemy-ability validity).
- `src/state/`
  - `gameReducer.ts` — `GameState`, `initialState`, all actions, `RunStats`/`emptyStats`,
    `CampaignState`, `CAMPAIGN_ORDER`. **This is the heart of game flow.**
  - `GameContext.tsx` — provider + `useGame()`. Persists state on change EXCEPT phases `home` and
    `combat` (combat is ephemeral; home would clobber a save).
  - `persistence.ts` — `loadValidatedGame()`: loads + validates the save, prunes a corrupt/stale one
    (prevents white-screens). Add validation when you add required state fields.
  - `chronicle.ts` — the "Hall of Tales" store (`tavern.chronicle.v1`, SEPARATE from the save, survives
    resets): `loadChronicle`, `recordEnding`, `recordCampaignWon`, `clearChronicle`, `endingsOf`.
- `src/components/` — `TavernHome`, `AdventureSelect` (mode toggle + difficulty + campaign preview),
  `PartySelect`, `GameScreen` (story + check flow), `NarrationLog`, `DiceRoller` (animated d20),
  `CombatView` (the big one: attacks, powers, enemy turns, targeting, badges, stat recording),
  `CombatDice` (per-attack readout), `PartyPanel`, `EndingScreen` (narration + run summary + share +
  campaign level-up routing), `HallOfTales` (endings gallery), `ErrorBoundary`.
- `src/ui/` — `visuals.ts` (`hpColor`, `prefersReducedMotion`), `sfx.ts` (synthesized Web Audio SFX +
  mute, key `tavern.muted.v1`), `share.ts` (`buildShareText`, `shareOrCopy` → native share or clipboard).
- `src/styles/theme.css` — the **"Modern Arcane"** theme: slate-ink bg, crimson accent (`--accent`),
  near-white ink, gold sparingly. Fonts: Marcellus (display) + Inter (body), loaded in `index.html`.
- `src/App.tsx` — screen router by `state.phase`; Hall of Tales is App-local state (`showHall`), not a
  phase. `MuteToggle` lives here. Seeds the provider from a validated save (resume on reload).
- `src/main.tsx` — mounts `<App/>` inside `<ErrorBoundary>`.

## Game flow (phases)

`home → adventure-select → party-select → scene → combat → ending`
- `START_GAME` → adventure-select. There you pick **Single Tale** (→ `SELECT_ADVENTURE`) or
  **Campaign** (→ `START_CAMPAIGN`), plus difficulty.
- `CONFIRM_PARTY` seeds HP (at campaign level) and enters the adventure's start scene.
- `GOTO_SCENE` routes by scene type (combat/ending/story); rest scenes (`rest:true`) heal on arrival.
- `ending` shows `EndingScreen`. In a campaign, a non-final victory shows a level-up panel + "Onward"
  (`ADVANCE_CAMPAIGN`); terminal endings show the **Run Summary** + Share.
- Hall of Tales is opened from Home via `onHall` (App local state), back via `onBack`.

## Key mechanics

- **Skill checks:** d20 + ability modifier (+proficiency if proficient) vs DC. Nat-20 = crit success,
  nat-1 = crit fail. Animated in `DiceRoller` (number-cycle → settle → crit/fumble payoff). The
  DiceRoller MUST lock onto the true roll (a `doneRef` guard stops the cycling timers — past bug).
- **Combat:** initiative, attack roll (d20+toHit vs AC, nat-20 doubles damage dice), damage dice,
  enemy AI targets a random living hero. **Advantage/disadvantage** = `Combatant.nextAttack` one-shot
  flag (`rollD20WithMode`), shown as ⬆/⬇ badges. **Powers:** one signature per class, limited uses/
  encounter, data-driven in `powers.ts`; UI in CombatView (attack buttons + a gold ✦ power button +
  targeting). **Enemy abilities:** optional `ability` on an enemy (`buff` an ally → adv, `debuff` a
  hero → dis), used by AI when uses remain, shown as a ✦ tag.
- **Difficulty (Normal/Hard):** Normal has an HP floor (10), between-fight rest, softer enemies, and
  solo/duo encounter thinning; Hard is raw. Cleric/heal + safe-room rests exist regardless.
- **Campaign + progression:** `CAMPAIGN_ORDER = ['snakewater','chaoticcaves','brackenmoor','arena']`.
  Party level starts 1, +1 per cleared tale → `+4` max HP (full heal) and `+1` power use per level
  (`effectiveMaxHp(c,diff,level)`, `levelPowerBonus(level)`). Stats accumulate across the whole run.
- **Run stats + RECORD:** `RunStats` in game state, updated via `{type:'RECORD', delta}` from check
  resolution (GameScreen) and combat (CombatView: damage/crits/biggest hit/downs/wins). Reset on
  `CONFIRM_PARTY`, kept across `ADVANCE_CAMPAIGN`, cleared on `RESET`. MVP = top `damageByHero`.
- **Sharing:** `buildShareText(stats, ctx)` → a text card; `shareOrCopy` uses `navigator.share` else
  clipboard. Play URL is hardcoded to the Pages URL.

## Content format (scene graph)

Each adventure is `{ title, startSceneId, scenes: { id: Scene } }`. Scene types:
- `story` — `{ id, type:'story', title, narration, choices[], rest? }`. A choice has `next` OR a
  `check {skill, dc}` with `onSuccess`/`onFailure` (`attemptedBy:'any'`).
- `combat` — `{ id, type:'combat', title, narration, enemies[], onVictory, onDefeat }`. Enemy may have
  an `ability {name, kind:'buff'|'debuff', uses, description}`.
- `ending` — `{ id, type:'ending', endingType:'victory'|'defeat', title, narration }`.

`adventure.test.ts` validates connectivity for ALL adventures automatically (it iterates `ADVENTURES`),
so a new adventure added to the registry is tested for free. Keep encounters fair for level-1 parties
(minions 5–9 HP, modest damage; no single hit one-shots a ~10-HP hero; include a rest before a boss).

## Persistence / storage keys

- `tavern.save.v1` — the game save (validated by `persistence.loadValidatedGame`). Home & combat phases
  are not written. Mid-combat reload resumes at the lead-in scene.
- `tavern.chronicle.v1` — the Hall of Tales (discovered endings + campaignWon). Survives `RESET`.
- `tavern.muted.v1` — sound mute flag.

## Licensing (IMPORTANT)

- App **code** is MIT (`LICENSE`).
- `src/content/chaoticcaves.json` is **adapted from "The Chaotic Caves" (Basic Fantasy RPG) and is
  CC BY-SA 4.0** — that adventure's content must keep attribution (shown on its card + in `CREDITS.md`)
  and stays share-alike. The other three adventures are original. Rules content derives from SRD 5.1
  (CC-BY). See `CREDITS.md`. Don't strip the attribution.

## How we work (the workflow)

We use the **superpowers** skills, and the loop has been, for every feature:
1. `superpowers:brainstorming` → ask the user the key scope forks (often via `AskUserQuestion`),
   present a design, get approval. Specs go in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
2. `superpowers:writing-plans` → a TDD plan with complete copy-pasteable code, in
   `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.
3. **Execute inline** (the user prefers this over subagent-driven): implement task-by-task, TDD,
   `npm test` as you go.
4. **Verify in a real browser** with Playwright (see below), then commit, push, and watch the deploy.

When the user asks "what features should I implement now," give a short, honest, prioritized
recommendation (with effort/impact) and end with an `AskUserQuestion` to pick one.

### Feature history (all shipped + deployed)
1. Core game (engine, 6 heroes, Brackenmoor, combat, save).
2. Visual redesign #1 (candlelit), then **Modern Arcane** redesign (current theme).
3. 2nd & 3rd adventures (Snakewater, Chaotic Caves CC BY-SA), difficulty modes, combat dice readout.
4. Readability fixes + lengthened Brackenmoor; production hardening (save validation, ErrorBoundary,
   meta/SEO, MIT license, a11y); ESLint + CI; GitHub Pages deploy.
5. Expanded roster to **12 classes**.
6. **Class powers** + advantage/disadvantage.
7. **Enemy abilities** + the **Proving Pit** arena (4th adventure).
8. **Campaign mode** + party progression.
9. **Run summary + Hall of Tales gallery + share** (latest).

Specs/plans for each are in `docs/superpowers/`.

## Verifying changes in a browser (Playwright)

Playwright is **not** in `package.json` (kept out of deps). Install ad-hoc for verification:
```bash
npm install --no-save playwright@1.60.0
```
Run drive scripts FROM THE REPO ROOT (module resolution uses the script's dir). Pattern: start
`npm run dev -- --port <p>` in the background, then a `.mjs` that `chromium.launch()`, drives the UI,
and screenshots. To jump straight into a state, seed `localStorage['tavern.save.v1']` with a GameState
and reload. After deploy, verify the LIVE url the same way. Read screenshots with the Read tool.

## Gotchas (things that have bitten us)

- **Build must use `tsc --noEmit -p tsconfig.json`** (the `build` script does). `tsc -b` emits a stray
  `vite.config.js` that Vite may load over the `.ts` source — it's gitignored, don't commit it.
- **Vite `base: './'`** (in `vite.config.ts`) is required so assets resolve under the `/tavern/` Pages
  subpath. Don't remove it.
- **Adding a required `GameState` field** breaks test fixtures that build `GameState` literals:
  `persistence.test.ts` (`valid`), `CombatView.test.tsx` (`full`), `GameScreen.test.tsx` (`full`).
  Update them (and the reducer's `initialState` + resets).
- **Background dev servers get terminated between turns** (you'll see exit 143). Just restart. And a
  `pkill` chained with `&&` to another command can abort that command (exit 144) — run `pkill` on its
  own line.
- **Emoji render as empty boxes in headless screenshots** (no emoji font in the CI/screenshot Chromium)
  — they're fine in real browsers. Don't "fix" this.
- **Pages was enabled via API** (`gh api -X POST repos/GlediLami/tavern/pages -f build_type=workflow`)
  because the workflow token can't self-enable. The deploy workflow's `configure-pages` no longer uses
  `enablement: true`.
- **GitHub Actions emits a Node-20 deprecation warning** on the deploy run — informational, not a failure.
- **`powers.ts` must not import the global character registry for the attack name** — it reads
  `combatant.primaryAttack` (set in `startCombat`) so unit tests with fake heroes work.

## What's next (roadmap, not yet built)

- **Items, loot & usable potions** (reward economy; potions slot into the combat turn system).
- **AI Dungeon Master narration** (Claude-generated flavor over scripted scenes; the standout
  differentiator — needs an API key + a tiny serverless proxy so the key isn't exposed; per-use cost).
- **Reach polish:** PWA (installable/offline), onboarding/tutorial, privacy-friendly analytics.
- It may also be worth pausing to **play-test and gather feedback** — the game is feature-complete.

## Quick sanity check before you start changing things

```bash
npm install && npm run lint && npx tsc --noEmit && npm test && npm run build
```
All green = you're good. Then: brainstorm → plan → implement (TDD) → verify in browser → commit →
push (auto-deploys) → `gh run watch <deploy-run-id> --exit-status`.
