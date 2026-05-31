# Enemy Abilities + New Encounters — Design Spec

**Date:** 2026-05-31
**Status:** Approved for planning

## Goal

Make combat less repetitive by giving select enemies a signature ability, and add
new encounters that showcase them — including a new short "arena" adventure.
Reuse the existing advantage/disadvantage flag so no new combat mechanics are
introduced.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Ability model | Data on the `Enemy` + simple AI in `performEnemyTurn` (decoupled from the hero Power registry) |
| Ability kinds | **debuff** (impose disadvantage on a hero) and **buff** (grant advantage to an ally enemy) only |
| AI trigger | Use the ability when it has uses left and a valid target; otherwise make a normal attack |
| New content | **Both** — add abilities to existing foes AND add a new short arena adventure |
| Out of scope | AoE/heavy-hit specials, self-heal, summons |

## Mechanic

Both ability kinds set the existing one-shot `Combatant.nextAttack: 'adv' | 'dis'`
flag (consumed on the next attack, already rendered as ⬆/⬇ badges). No damage,
no new state types beyond tracking the ability and its remaining uses on the
combatant.

### Data shape

```ts
export interface EnemyAbility {
  name: string;
  kind: 'debuff' | 'buff';   // debuff: 'dis' on a hero; buff: 'adv' on an ally enemy
  uses: number;              // per encounter
  description?: string;      // shown on the enemy card
}
```

- `Enemy` gains `ability?: EnemyAbility`.
- `Combatant` gains `ability?: EnemyAbility` and `abilityUses?: number`.

## Engine

### `combat.ts` — `startCombat`
When building enemy combatants, copy the ability and seed uses:

```ts
ability: e.ability,
abilityUses: e.ability?.uses,
```

### `combat.ts` — `performEnemyTurn` (new AI branch)
Before the existing attack logic, attempt to use the ability:

- If `enemy.ability` and `(enemy.abilityUses ?? 0) > 0`:
  - **buff:** find other living enemies whose `nextAttack` is not already `'adv'`.
    If any, pick one via `rng`, set its `nextAttack = 'adv'`, decrement
    `abilityUses`, push a log line (e.g. `"<enemy> lets out a war-cry — <ally>
    attacks with advantage."`), set `lastAttack = undefined`, run
    `checkStatus` + `advanceTurn`, and return. If none, fall through to attack.
  - **debuff:** find living heroes whose `nextAttack` is not already `'dis'`.
    If any, pick one via `rng`, set its `nextAttack = 'dis'`, decrement
    `abilityUses`, push a log line (e.g. `"<enemy> hexes <hero> — they attack
    with disadvantage."`), set `lastAttack = undefined`, run `checkStatus` +
    `advanceTurn`, and return. If none, fall through to attack.
- Otherwise: the existing normal-attack code runs unchanged.

The ability turn deals no damage and clears `lastAttack` (the dice readout hides;
the log line conveys it), consistent with how hero buff/debuff powers behave.

### `difficulty.ts` — `scaleEnemies`
No change needed: the existing `{ ...e, attack: {...} }` spread preserves
`ability`. Ability uses are the same on Normal and Hard.

## Content

### Enhance existing adventures
Add an `ability` to these enemies (stat blocks otherwise unchanged):

- `src/content/adventure.json` (Brackenmoor):
  - `marsh_spider` → Giant Spider: `{ name: "Web", kind: "debuff", uses: 1, description: "Snares a hero — disadvantage on their next attack." }`
  - `tower_guardians` → the `Bell-Warden` skeleton: `{ name: "Dirge", kind: "debuff", uses: 1, description: "A chilling dirge — a hero attacks with disadvantage." }`
- `src/content/snakewater.json`:
  - `fight_captain` → Garran the Scarred: `{ name: "Rally", kind: "buff", uses: 1, description: "Rallies an ally — advantage on its next attack." }`
- `src/content/chaoticcaves.json`:
  - `fight_boss` → The Cave Lord: `{ name: "War Cry", kind: "buff", uses: 1, description: "A war-cry — an ally attacks with advantage." }`

### New adventure — "The Proving Pit" (`src/content/arena.json`)
A compact trial-of-champions gauntlet (~10 scenes) showcasing the abilities.
Registered in `adventures.ts` as a 4th selectable tale (original content, no
attribution needed). Balanced for level 1.

Scene outline (story / combat / ending; all ids resolved, every path reaches an
ending, with a rest before the boss):

- `pit_intro` (story) — the pitmaster offers coin to last three bouts. Choices:
  begin → `fight_warband`; or *Insight* check (DC 12) → `pit_intel` (success) /
  `fight_warband` (failure).
- `pit_intel` (story) — learn the champions' tricks. → `fight_warband`.
- `fight_warband` (combat) — **Goblin Warchanter** (8 HP, AC 12, Spear +4 1d6+1,
  ability *War Chant* buff 1) + Goblin Cutter (7 HP, AC 12, +4 1d6+1).
  onVictory `pit_rest`, onDefeat `ending_pit_fall`.
- `pit_rest` (story, `rest: true`) — patched up between bouts. → `fight_hexweaver`.
- `fight_hexweaver` (combat) — **Bog Hexweaver** (12 HP, AC 12, Hex Bolt +4
  1d6+2, ability *Hex* debuff 2) + Bog Lurker (8 HP, AC 12, +3 1d6+1).
  onVictory `pit_final`, onDefeat `ending_pit_fall`.
- `pit_final` (story) — the champion enters. Choices: fight → `fight_champion`;
  or *Intimidation* check (DC 14) → `fight_champion` either way (flavor only,
  both branches go to the fight).
- `fight_champion` (combat) — **The Pit Champion** (26 HP, AC 14, Greatclub +5
  1d10+3, ability *Rally Roar* buff 1) + Pit Hound (9 HP, AC 13, Bite +4 1d6+2).
  onVictory `pit_victory`, onDefeat `ending_pit_fall_boss`.
- `pit_victory` (story) — claim the prize. → `ending_pit_win`.
- `ending_pit_win` (ending, victory).
- `ending_pit_fall` (ending, defeat) — fall in an early bout.
- `ending_pit_fall_boss` (ending, defeat) — fall to the champion.

## UI

- The ⬆/⬇ adv/dis badges and the combat log already surface ability use — no new
  flow needed.
- Small addition in `CombatView.tsx`: on an enemy card that has an `ability`,
  show a `✦ <ability name>` tag (styled like the existing `.tag`), with the
  description as a tooltip, so players can anticipate it.

## Testing

- **combat.ts** unit tests (seeded RNG):
  - buff: an enemy with a buff ability grants `adv` to a living ally and
    decrements uses; with no other living ally it attacks instead.
  - debuff: an enemy with a debuff ability imposes `dis` on a living hero and
    decrements uses.
  - uses exhausted: once `abilityUses` hits 0 the enemy makes a normal attack.
  - `startCombat` copies `ability`/`abilityUses` onto enemy combatants.
- **adventure connectivity** (existing `adventure.test.ts`, which iterates
  `ADVENTURES`) automatically validates the new `arena` adventure: every
  transition target exists, every scene reachable, ≥2 combats, both ending types.
- **content validation**: any enemy `ability.kind` is `'debuff'` or `'buff'`
  and `uses >= 1` (new test over all adventures' combat scenes).
- **CombatView**: existing smoke tests still pass; the ability tag renders for an
  enemy that has one.

## Success Criteria

In combat, enemies with abilities use them (buff an ally → ⬆ badge + that ally's
next attack rolls with advantage; debuff a hero → ⬇ badge + disadvantage),
respecting their use limits and falling back to attacks otherwise; the four
existing signature foes and the new arena fights demonstrate it; all engine logic
is covered by passing unit tests; and the arena adventure is selectable and
completable.
