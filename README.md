# 🍺 Tavern

A pass-and-play **Dungeons & Dragons** dice-storytelling game for the web. Gather a
party of heroes by the hearth, then play through a branching adventure where **d20
skill checks** and **turn-based combat** decide your fate. Fully client-side — no
server, no accounts, runs in any modern browser.

## Features

- **Pass-and-play multiplayer** — multiple players share one screen, each controlling a hero.
- **6 premade heroes** — Fighter, Rogue, Cleric, Wizard, Ranger, Barbarian, built on D&D 5e SRD rules (ability scores, AC, HP, skills, attacks).
- **Three branching adventures** — *The Hollow Bell of Brackenmoor* (a haunted bell-tower) and *The Snakewater Raid* (a daylight kobold-cave rescue), both original, plus *The Chaotic Caves*, adapted from the Basic Fantasy RPG one-shot under CC BY-SA 4.0 (see [CREDITS.md](CREDITS.md)). Each has meaningful choices, multiple paths, safe-room rests, and several endings.
- **Two difficulty modes** — **Normal** (HP floor, between-fight recovery, in-combat Cleric heal, thinned foes for small parties) and **Hard** (real stat blocks, little recovery). Tuned to be tense-but-fair, not a one-hit-kill slog.
- **Authentic d20 checks** — roll `d20 + ability modifier` vs a Difficulty Class, with natural-20 critical successes and natural-1 critical failures, shown with an animated die.
- **Light turn-based combat** — initiative, attack rolls vs AC, damage dice, HP tracking, simple enemy AI, and a **visible dice readout** (every attack shows the d20, the math vs AC, and the damage dice rolled).
- **Save & resume** — progress persists to `localStorage`.

## Tech

React + Vite + TypeScript. A framework-free, fully unit-tested game engine
(`src/engine/`) holds all the rules; content lives as JSON (`src/content/`); React
components are a thin layer over the engine.

## Develop

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite (Vitest)
npm run build    # production build
```

## Project layout

```
src/
  engine/     # pure game rules: dice, checks, story nav, combat, save, party helpers
  content/    # characters.json + adventure.json (with validation tests)
  state/      # game reducer + React context (persistence)
  components/  # screens: Home, PartySelect, GameScreen, CombatView, EndingScreen, ...
  styles/     # tavern theme
```

## Content & licensing

Character stats and rules are modeled on the **D&D 5.1 SRD** (OGL / CC-BY-4.0). All
character names, the adventure, and its prose are original and contain no Product
Identity.
