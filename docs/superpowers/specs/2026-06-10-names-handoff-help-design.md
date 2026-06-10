# Player Names + Pass-the-Device Handoff + Help (QoL batch) — Design

Date: 2026-06-10
Status: Approved

Three small pass-and-play quality-of-life features shipped together:
1. **Custom player names** mapped to heroes, surfaced "everywhere" (combat log, dice readout,
   check rolls, turn banner, prompts) while cards stay hero-anchored.
2. **Pass-the-device handoff** — an opt-in (default off) gate before each hero's combat turn.
3. **Onboarding help** — a "How to Play" overlay reachable from a persistent **?** button.

---

## 1. Custom player names

### State & persistence (`gameReducer.ts`, `persistence.ts`)
- New **required** `GameState.playerNames: Record<string, string>` (heroId → typed name).
- `CONFIRM_PARTY` gains an optional `playerNames` payload and stores `action.playerNames ?? {}`.
- `initialState`: `{}`. Carried across the campaign via `ADVANCE_CAMPAIGN` (`...state`).
- Persistence: validate as optional, normalize on load (`playerNames: raw.playerNames ?? {}`).
- Add `playerNames: {}` to the three `GameState` fixtures.

### Display helper (`engine/party.ts`)
```ts
export function heroDisplayName(heroId: string, playerNames: Record<string, string> = {}): string {
  return playerNames[heroId]?.trim() || getCharacter(heroId).name;
}
```

### Input (`PartySelect.tsx`)
Each selected hero gets an optional text field ("player name"). Local `names` state; "Enter the
Tavern" calls `onConfirm(selectedIds, names)`. `App` dispatches `CONFIRM_PARTY { partyIds, playerNames }`.

### Surfacing
- **Combat (`CombatView.tsx`):** before `startCombat`, set each built hero's `name` to
  `heroDisplayName(id, state.playerNames)`. That flows the display name into every engine log
  line, the dice readout (`attackerName`/`targetName`), and the turn banner (`{actor.name}`).
  The combat **hero card** keeps the hero name + badges as its title (from
  `getCharacter(h.heroId!).name`) and adds a muted "Played by {name}" line when a name is set.
- **Skill checks (`GameScreen.tsx`):** the roll-log entry, the "who attempts" buttons, the
  relic-draft "give to" buttons, and the `DiceRoller` `heroName` all use `heroDisplayName`.
- **Party panel (`PartyPanel.tsx`):** new optional `playerNames` prop; show a small
  "Played by {name}" under the hero name when set. Hero name/class stay primary.
- **Ending / Hall:** unchanged (hero-named — it records the tale, not the run's players).

---

## 2. Pass-the-device handoff (combat-only, opt-in)

### Setting (`ui/handoff.ts`, new)
Mirrors the mute pattern: `isHandoffOn()` / `setHandoffOn(on)` backed by `tavern.handoff.v1`.
**Default off** (absent key ⇒ off).

### Toggle (`App.tsx`)
A 🤝 button in a top-right control cluster next to mute; shows on/off state.

### Gate (`CombatView.tsx`)
- `const handoffNeeded = isHandoffOn() && actor.isHero && handoffDoneFor !== actor.id;`
  (local `handoffDoneFor: string | null`).
- When `handoffNeeded`, the action panel renders the gate instead of the hero's buttons:
  *"Pass the device to {actor.name} — {hero name}'s turn"* + a **Ready** button that sets
  `handoffDoneFor = actor.id`. The next hero turn (new `actor.id`) re-shows the gate.
- Enemy turns are unaffected. Toggling off mid-combat removes the gate on the next render.

---

## 3. Onboarding help

### `HelpOverlay.tsx` (new)
A modal (fixed, dimmed backdrop, centered `.panel`, close button + backdrop click) titled
"How to Play", with concise sections: **Skill checks** (d20 + ability modifier + proficiency vs
DC; nat-20 crit / nat-1 fumble), **Advantage & Disadvantage** (roll two d20s, keep the
higher/lower; ⬆/⬇), **Combat** (initiative, attack roll vs AC, damage dice, crits), **Saving
throws** (the target rolls to resist, e.g. Sacred Flame), and **Powers, Items & Relics** (one
signature power per class; potions in the turn; drafted relics). Pure presentational; takes
`onClose`.

### Entry (`App.tsx`)
A **?** button in the control cluster toggles an App-local `showHelp`. Available on every screen.

### Inline hint
Add a `title` attribute to the check "DC" pill in `GameScreen` explaining the check (desktop
hover). Deeper per-term popovers are deferred.

### Styling (`styles/theme.css`)
A `.top-controls` flex container (fixed top-right) holding `.top-control` round buttons
(restyled from `.mute-toggle`, with an `.on` accent state for the handoff toggle), plus a
`.help-overlay` modal style.

---

## 4. Testing (TDD)

- `gameReducer.test.ts`: `CONFIRM_PARTY` stores `playerNames`; they carry across `ADVANCE_CAMPAIGN`.
- `persistence.test.ts`: `valid` carries `playerNames`; a save missing it normalizes to `{}`.
- `party.test.ts`: `heroDisplayName` returns the typed name, falls back to the hero name, and
  ignores whitespace-only names.
- `ui/handoff.test.ts`: defaults off; `setHandoffOn(true)` persists.
- `PartySelect.test.tsx`: typing a name and confirming passes `playerNames` to `onConfirm`.
- `CombatView.test.tsx`: with `playerNames`, the turn banner shows the player's name; with
  handoff on, the gate shows and **Ready** reveals the actions.
- `GameScreen.test.tsx`: the "who attempts" prompt shows the player's name.
- `HelpOverlay.test.tsx`: renders the key terms (DC, advantage, saving throw).

Then `npm run lint && npx tsc --noEmit && npm test && npm run build` green, a Playwright
spot-check (name a hero, see it in the turn banner/log; toggle handoff and see the gate; open
Help), commit, and push to `main`.

## Out of scope (later)
- Full-screen handoff curtain that hides the board; per-term inline popovers; player names in
  the Ending/Hall; handoff for skill-check scenes.
