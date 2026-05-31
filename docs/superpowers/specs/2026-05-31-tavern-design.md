# Tavern — Design Spec

**Date:** 2026-05-31
**Status:** Approved for planning

## Concept

A party of heroes gathers in a tavern, then embarks on a branching Dungeons &
Dragons adventure. Tavern is a **pass-and-play** game website: multiple players
share one screen, each controlling a hero. The story unfolds scene by scene, and
**d20 dice rolls** decide outcomes. Fully client-side — no server, no accounts,
runs in any modern browser.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Multiplayer model | Pass-and-play, single screen, fully client-side |
| Storytelling | Scripted branching storylines; dice rolls pick branches |
| Dice mechanic | D&D 5e d20 checks: `d20 + ability modifier` vs Difficulty Class (DC), with nat-20 crit success / nat-1 crit fail |
| Characters | Pick from a premade roster (~6 heroes) |
| Content scope (v1) | One complete branching adventure + 6 premade characters |
| Combat | Yes — light turn-based combat in v1 |
| Tech stack | React + Vite (TypeScript), Vitest for tests. No backend. |

## Architecture

- **React + Vite SPA** (TypeScript). All logic runs client-side.
- **Persistence:** game state saved to `localStorage`. The Tavern home offers
  "New Game" and "Continue" (when a save exists).
- **Content as data**, separate from code:
  - `src/content/characters.json` — 6 premade heroes.
  - `src/content/adventure.json` — the storyline as a graph of scenes.
- **Pure game engine** (`src/engine/`, no React imports) — unit-tested with
  Vitest. The UI is a thin layer over the engine.

### Layering

```
content (JSON)  ->  engine (pure TS)  ->  React state/hooks  ->  components
```

The engine never imports React; components never reimplement game rules.

## Data Models

### Character (`characters.json`)

```jsonc
{
  "id": "thorin-ironfist",
  "name": "Thorin Ironfist",
  "race": "Mountain Dwarf",
  "class": "Fighter",
  "level": 1,
  "portrait": "thorin.png",          // asset in public/portraits
  "abilities": { "str": 16, "dex": 12, "con": 15, "int": 8, "wis": 10, "cha": 11 },
  "maxHp": 13,
  "ac": 18,
  "proficiencyBonus": 2,
  "skillProficiencies": ["athletics", "intimidation"],  // skill keys
  "attacks": [
    { "name": "Battleaxe", "ability": "str", "damageDice": "1d8", "damageBonus": 3 }
  ],
  "backstory": "..."
}
```

- Ability modifier is derived: `floor((score - 10) / 2)`.
- A skill check modifier = ability modifier (+ proficiency bonus if proficient).
- Each skill maps to a governing ability (e.g. `athletics -> str`,
  `perception -> wis`) in an engine lookup table.

### Adventure (`adventure.json`)

A graph of scenes. The adventure has a `startSceneId` and a map of scenes.

```jsonc
{
  "title": "The Gloomwood Hollow",
  "startSceneId": "intro",
  "scenes": {
    "intro": {
      "id": "intro",
      "type": "story",                 // "story" | "combat" | "ending"
      "title": "A Storm Over Gloomwood",
      "narration": "Rain hammers the tavern roof...",
      "choices": [
        {
          "id": "investigate",
          "text": "Search the cellar for the smugglers' map",
          "check": { "skill": "investigation", "dc": 13 },  // optional
          "attemptedBy": "any",        // "any" = party picks who rolls
          "onSuccess": "cellar-found",
          "onFailure": "cellar-trap"
        },
        {
          "id": "leave",
          "text": "Head straight into the woods",
          "next": "forest-path"        // no check -> direct link
        }
      ]
    },
    "goblin-ambush": {
      "id": "goblin-ambush",
      "type": "combat",
      "title": "Ambush!",
      "narration": "Goblins spring from the brush!",
      "enemies": [
        { "name": "Goblin", "maxHp": 7, "ac": 13,
          "attack": { "name": "Scimitar", "toHit": 4, "damageDice": "1d6", "damageBonus": 2 } }
      ],
      "onVictory": "after-battle",
      "onDefeat": "party-wipe"
    },
    "party-wipe": {
      "id": "party-wipe", "type": "ending", "endingType": "defeat",
      "title": "Darkness Takes the Hollow", "narration": "..."
    }
  }
}
```

Scene types:
- **story** — narration + choices. A choice with `check` rolls a d20; the
  result routes to `onSuccess`/`onFailure`. A choice without a check uses `next`.
- **combat** — a combat encounter (see below); routes to `onVictory`/`onDefeat`.
- **ending** — terminal node with `endingType` (`"victory" | "defeat" | ...`).

## Game Engine (pure, unit-tested)

- **dice** — `rollDie(sides)`, `rollD20()`, parse-and-roll dice expressions like
  `"1d8"`/`"2d6+3"`. Randomness injected (seedable RNG) so tests are
  deterministic.
- **modifiers** — `abilityMod(score)`, `skillModifier(character, skill)`.
- **checks** — `resolveCheck(character, skill, dc, rng)` → `{ roll, total,
  success, crit: "success"|"fail"|null }`. Nat 20 = crit success, nat 1 = crit
  fail (auto fail/success regardless of total).
- **story** — `getScene(adventure, id)`, `resolveChoice(...)` → next scene id
  given a choice + (optional) check result.
- **combat** — initiative (d20 + dex mod), turn order over party + enemies,
  `attackRoll` (d20 + toHit vs AC; nat 20 doubles damage dice), damage
  application, HP/down-state tracking, simple enemy AI (attack a random
  conscious hero), win/lose detection.
- **save** — serialize/deserialize game state to/from `localStorage`.

## UI Components

- `TavernHome` — title, atmosphere, New Game / Continue.
- `PartySelect` — roster grid; pick the party that "meets in the tavern".
- `GameScreen` — scrolling narration log + current scene + choice buttons +
  `PartyPanel`.
- `PartyPanel` — each hero: portrait, HP bar, key stats, downed indicator.
- `DiceRoller` — animated d20; shows roll, modifier, total, DC, success/crit.
- `CombatView` — initiative tracker, enemy cards (HP/AC), attack actions,
  round/turn indicator.
- `EndingScreen` — victory/defeat narration + "Return to the Tavern".

When a choice requires a check with `attemptedBy: "any"`, the UI prompts the
party to choose which conscious hero attempts it, then that player rolls.

## Content via Research

Use the research/web tools to gather **SRD / open-license (OGL/CC)** D&D 5e
material:
- Authentic ability scores, classes, races, and skill lists for the 6 premade
  heroes (modeled on SRD-permitted content).
- A published-style adventure *structure* for pacing/encounter design, then
  write an **original** branching adventure (original names, places, plot) so we
  stay clear of copyrighted material while feeling authentically D&D.

## Testing Strategy

- **TDD for the engine:** dice (with seeded RNG), ability/skill modifiers, check
  resolution + crit rules, scene branching, combat rounds (attack/damage/AI/win
  conditions), save round-trip.
- **Component tests** (lighter) for key flows: party select → game, a check
  resolving and branching, a combat encounter ending.
- Manual verification: play the adventure end-to-end (victory and a defeat
  path).

## Out of Scope (v1 — YAGNI)

- Networked/online multiplayer (pass-and-play only).
- AI-generated narration.
- Custom character creation / level-up progression beyond level 1.
- Spellcasting system (heroes use weapon attacks + checks; a caster's "spells"
  are represented as attacks/checks for v1).
- Accounts, cloud saves, multiple concurrent save slots (single local save).

## Success Criteria

A player can open the website, start a new game, pick a party from 6 premade
heroes, play one complete branching adventure — making choices, rolling d20
checks that branch the story, and fighting at least one combat encounter — and
reach a victory or defeat ending, with progress saved to `localStorage`.
