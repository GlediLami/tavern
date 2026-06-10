# Combat depth + party-sheet improvements — Design

Date: 2026-06-10
Status: Approved

Four player-requested changes to Tavern, plus a focused engine extension (save-based
attacks) to support the first. All new data fields are **optional**, so no existing
`GameState` fixture breaks.

---

## 1. Sacred Flame → Dexterity saving throw

Today every hero attack — including Sacred Flame — resolves as `d20 + to-hit vs target AC`
in `applyAttack`. Sacred Flame should instead force the *target* to make a Dexterity save.

### Types
- `Attack` gains optional `save?: Ability`.
- `ResolvedAttack` (in `engine/combat.ts`) gains `save?: Ability`; `makeHeroAttackLookup`
  passes it through from the matched attack.
- `Enemy` and `Combatant` gain optional `dexSave?: number`. When unset, the engine uses a
  default of **+1** (`DEFAULT_ENEMY_DEX_SAVE = 1`) so we don't hand-edit every enemy across
  all four adventures.
- `AttackEvent` gains `save?: Ability` and `saveDC?: number` for the dice readout.

### Content
- Mara Dawnwarden's `Sacred Flame` attack in `characters.json` gets `"save": "dex"`.

### Engine (`applyAttack`)
When `stats.save` is set, take a save path instead of an attack roll:
- Spell save DC = `8 + 2 (proficiency) + abilityMod(stats.abilityScore)` → DC 13 for Mara
  (WIS 17). The `+2` matches the proficiency already hardcoded in `applyAttack`'s to-hit.
- Target rolls `d20 + (target.dexSave ?? DEFAULT_ENEMY_DEX_SAVE)`.
- **Failed save → full damage** (`damageDice + damageBonus`, no crit doubling).
  **Successful save → no damage** (all-or-nothing, true to 5e Sacred Flame).
- The caster's `nextAttack` adv/dis flag is consumed but **not** applied (a save isn't the
  caster's roll).
- Returns an `AttackEvent` with `kind: 'attack'`, `save: 'dex'`, `saveDC`, `hit = !saved`
  (a failed save counts as a "hit" for damage/flash purposes), reusing `d20` (the target's
  save roll), `toHit` (the target's save bonus), and `ac` (= `saveDC`).
- Log: e.g. `Mara invokes Sacred Flame — Goblin must make a DC 13 DEX save... rolls 9, fails! Takes 5 radiant.`
  / `...rolls 16, resists the flame.`

Powers are untouched (none set `save`). The no-lookup default `ResolvedAttack` has no `save`,
so existing combat tests with fake heroes keep the attack-roll path.

### Readout (`CombatDice`)
When `event.save` is set, replace the AC line with a save line:
`DEX save: d20 9 +1 = 10 vs DC 13 → FAILED` (or `→ SAVED`). The damage block still only
renders when `event.hit` (failed save).

---

## 2. Back-line cover (long-range defense)

Mechanic chosen: **ranged heroes are harder to hit while a melee ally screens them.**

### Types / content
- `Attack` gains `ranged?: boolean`.
- In `characters.json`, every ranged/thrown attack is tagged `"ranged": true`
  (Light Crossbow, Shortbow, Longbow, both Fire Bolts, Sacred Flame, Produce Flame,
  Vicious Mockery, Eldritch Blast, Handaxe (thrown), Javelin (thrown)). Melee weapons stay
  untagged.
- A hero is **back-line** when their *primary* attack (`attacks[0]`) is ranged:
  Wizard, Ranger, Bard, Druid, Sorcerer, Warlock. The other six are front-line.
- `Combatant` gains `backLine?: boolean`, set in `startCombat` from `!!hero.attacks[0]?.ranged`.

### Engine (`performEnemyTurn`)
When an enemy makes its weapon attack:
- `frontLineAlive = combatants.some(c => c.isHero && c.hp > 0 && !c.backLine)`.
- `covered = target.backLine && frontLineAlive`.
- Combine with the enemy's existing one-shot flag:
  `hasAdv = nextAttack === 'adv'`; `hasDis = nextAttack === 'dis' || covered`.
  `mode = hasAdv && hasDis ? undefined : hasAdv ? 'adv' : hasDis ? 'dis' : undefined`
  (advantage + cover-disadvantage cancel to a straight roll, per 5e).
- Targeting stays random — cover only lowers the hit chance, and it vanishes once the entire
  front line is down. A brief log note mentions the cover when it applies.

### UI (`CombatView`)
A small `⤢` tag on back-line heroes, marked "covered" while `frontLineAlive`. The existing
`⬇` disadvantage indicator on the enemy's roll already surfaces in `CombatDice`.

---

## 3. Gentle campaign scaling

`scaleEnemies(enemies, difficulty, partySize)` gains a `level` parameter (default 1).
Per level above 1, layered on top of the existing difficulty adjustment:
- **HP** × `(1 + 0.2 * (level - 1))`, rounded.
- **to-hit** + `Math.floor((level - 1) / 2)`.
- **damage bonus** + `Math.round(0.6 * (level - 1))`.

Curve: L1 ×1.0/+0/+0 · L2 ×1.2/+0/+1 · L3 ×1.4/+1/+1 · L4 ×1.6/+1/+2.

`CombatView` passes `state.campaign?.level ?? 1`. Single tales are always level 1 → no-op.

---

## 4. Expandable party cards (stats while delving)

`PartyPanel` becomes interactive. Each hero card is a toggle (caret `▸/▾`, `aria-expanded`):
- **Collapsed** (default): today's portrait / name / class / HP bar.
- **Expanded**: ability mods row (`STR +2 …`), `AC`, attacks (`name dice`, save attacks
  marked `(DEX save)`), and the hero's power name.

Local `useState<Record<string, boolean>>` tracks which cards are open. Shown on the
exploration screen (`GameScreen`). Combat already surfaces HP and stays as-is.

---

## Testing / regression

TDD, colocated tests:
- `combat.test.ts` — save resolution: failed save → damage, successful save → no damage;
  save uses `target.dexSave` and the caster's spell DC.
- `combat.test.ts` — back-line cover: disadvantage when front line alive; straight roll when
  front line down; cancels with enemy advantage.
- `difficulty.test.ts` — `scaleEnemies` level curve at L1–L4 (HP/to-hit/damage).
- `PartyPanel.test.tsx` — expanding a card reveals ability mods / AC / attacks / power.
- `CombatDice.test.tsx` — renders the save line when `event.save` is set.
- `characters.test.ts` — Sacred Flame carries `save: 'dex'`; ranged attacks are tagged.

Then full green: `npm run lint && npx tsc --noEmit && npm test && npm run build`, plus a
Playwright spot-check of an expanded party card and a Sacred Flame cast. Commit and push to
`main` (auto-deploys to Pages).
