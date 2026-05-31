# Enemy Abilities + New Encounters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give select enemies a signature ability (buff an ally / debuff a hero) that reuses the existing advantage flag, and add new encounters — four enhanced existing foes plus a new "Proving Pit" arena adventure.

**Architecture:** Data-driven: an optional `ability` on the `Enemy` is copied onto the enemy combatant at `startCombat`; `performEnemyTurn` gains a small AI branch that uses the ability when it has uses and a valid target, else attacks. No new combat mechanics — both ability kinds set the existing one-shot `nextAttack` flag.

**Tech Stack:** React + Vite + TypeScript, Vitest. No new dependencies.

---

## File structure

- `src/types.ts` — add `EnemyAbility`; `Enemy.ability?`; `Combatant.ability?` + `abilityUses?`.
- `src/engine/combat.ts` — `startCombat` copies ability/uses; `performEnemyTurn` gets the use-or-attack branch.
- `src/content/adventure.json`, `snakewater.json`, `chaoticcaves.json` — add abilities to four foes.
- `src/content/arena.json` (new) — the Proving Pit adventure.
- `src/content/adventures.ts` — register the arena.
- `src/content/adventure.test.ts` — validate enemy ability kinds.
- `src/components/CombatView.tsx` — show a `✦ <ability>` tag on enemy cards.

---

## Task 1: Types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add the EnemyAbility type and references**

In `src/types.ts`, add above the `Enemy` interface:

```ts
export interface EnemyAbility {
  name: string;
  kind: 'debuff' | 'buff';   // debuff: 'dis' on a hero; buff: 'adv' on an ally enemy
  uses: number;              // per encounter
  description?: string;      // shown on the enemy card
}
```

Add to the `Enemy` interface:

```ts
  ability?: EnemyAbility;
```

Add to the `Combatant` interface (after `attack?`):

```ts
  abilityUses?: number;     // remaining uses of `ability` this encounter
```

And also add `ability?: EnemyAbility;` to `Combatant` (so the combatant carries it). The `Combatant` interface should now include both:

```ts
  attack?: EnemyAttack;      // present if enemy
  ability?: EnemyAbility;    // present if enemy has a special ability
  abilityUses?: number;      // remaining uses this encounter
  nextAttack?: 'adv' | 'dis';
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add EnemyAbility type"
```

---

## Task 2: Enemy ability AI in combat.ts

**Files:**
- Modify: `src/engine/combat.ts`
- Test: `src/engine/combat.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/combat.test.ts` (before the final closing `});`):

```ts
  const buffer: Enemy = { name: 'Warchanter', maxHp: 8, ac: 12, attack: { name: 'Spear', toHit: 4, damageDice: '1d6', damageBonus: 1 }, ability: { name: 'War Chant', kind: 'buff', uses: 1 } };
  const hexer: Enemy = { name: 'Hexweaver', maxHp: 10, ac: 12, attack: { name: 'Hex Bolt', toHit: 4, damageDice: '1d6', damageBonus: 2 }, ability: { name: 'Hex', kind: 'debuff', uses: 1 } };

  it('startCombat copies ability and seeds uses onto enemy combatants', () => {
    const st = startCombat([makeHero('h1', 10)], [buffer], hit);
    const e = st.combatants.find((c) => c.id === 'enemy-0')!;
    expect(e.ability?.name).toBe('War Chant');
    expect(e.abilityUses).toBe(1);
  });

  it('a buff enemy grants advantage to a living ally and spends a use', () => {
    let st = startCombat([makeHero('h1', 10)], [buffer, goblin], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, hit);
    const ally = st.combatants.find((c) => c.id === 'enemy-1')!;
    expect(ally.nextAttack).toBe('adv');
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.abilityUses).toBe(0);
  });

  it('a buff enemy with no other living ally just attacks', () => {
    let st = startCombat([makeHero('h1', 10)], [buffer], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, hit);
    expect(st.lastAttack?.kind).toBe('attack');               // fell back to attacking
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.abilityUses).toBe(1); // unspent
  });

  it('a debuff enemy imposes disadvantage on a living hero and spends a use', () => {
    let st = startCombat([makeHero('h1', 10)], [hexer], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st = performEnemyTurn(st, hit);
    expect(st.combatants.find((c) => c.id === 'h1')!.nextAttack).toBe('dis');
    expect(st.combatants.find((c) => c.id === 'enemy-0')!.abilityUses).toBe(0);
  });

  it('an enemy with no ability uses left makes a normal attack', () => {
    let st = startCombat([makeHero('h1', 10)], [hexer], hit);
    st = { ...st, turnIndex: st.order.indexOf('enemy-0') };
    st.combatants.find((c) => c.id === 'enemy-0')!.abilityUses = 0;
    st = performEnemyTurn(st, hit);
    expect(st.lastAttack?.kind).toBe('attack');
    expect(st.combatants.find((c) => c.id === 'h1')!.nextAttack).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- combat`
Expected: FAIL (ability not copied; buff/debuff not applied).

- [ ] **Step 3: Update `startCombat` to copy the ability**

In `src/engine/combat.ts`, in the `enemies.forEach(...)` block inside `startCombat`, change the pushed object to include the ability fields:

```ts
  enemies.forEach((e, i) => {
    combatants.push({
      id: `enemy-${i}`, name: e.name, isHero: false,
      maxHp: e.maxHp, hp: e.maxHp, ac: e.ac,
      initiative: rollD20(rng) + 1,
      attack: e.attack,
      ability: e.ability,
      abilityUses: e.ability?.uses,
    });
  });
```

- [ ] **Step 4: Add the ability AI branch at the top of `performEnemyTurn`**

In `src/engine/combat.ts`, replace the start of `performEnemyTurn` — from its `const next = clone(state);` line down to (but not including) the line `const targets = livingHeroes(next);` — with:

```ts
export function performEnemyTurn(state: CombatState, rng: Rng = defaultRng): CombatState {
  const next = clone(state);
  const enemy = next.combatants.find((c) => c.id === next.order[next.turnIndex])!;

  // Special ability: use it when available and a valid target exists; else attack.
  if (enemy.ability && (enemy.abilityUses ?? 0) > 0) {
    if (enemy.ability.kind === 'buff') {
      const allies = next.combatants.filter((c) => !c.isHero && c.hp > 0 && c.id !== enemy.id && c.nextAttack !== 'adv');
      if (allies.length > 0) {
        const ally = allies[Math.floor(rng() * allies.length)];
        ally.nextAttack = 'adv';
        enemy.abilityUses = (enemy.abilityUses ?? 0) - 1;
        next.log.push(`${enemy.name} uses ${enemy.ability.name} — ${ally.name} attacks with advantage.`);
        next.lastAttack = undefined;
        checkStatus(next);
        if (next.status === 'active') advanceTurn(next);
        return next;
      }
    } else {
      const heroes = next.combatants.filter((c) => c.isHero && c.hp > 0 && c.nextAttack !== 'dis');
      if (heroes.length > 0) {
        const hero = heroes[Math.floor(rng() * heroes.length)];
        hero.nextAttack = 'dis';
        enemy.abilityUses = (enemy.abilityUses ?? 0) - 1;
        next.log.push(`${enemy.name} uses ${enemy.ability.name} — ${hero.name} attacks with disadvantage.`);
        next.lastAttack = undefined;
        checkStatus(next);
        if (next.status === 'active') advanceTurn(next);
        return next;
      }
    }
  }

  const targets = livingHeroes(next);
```

(The remainder of `performEnemyTurn` — the `if (enemy.attack && targets.length > 0) { ... }` block and the trailing `checkStatus`/`advanceTurn` — stays exactly as it is.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- combat`
Expected: PASS (existing combat tests plus the 5 new ability tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/combat.ts src/engine/combat.test.ts
git commit -m "feat: enemy ability AI (buff ally / debuff hero)"
```

---

## Task 3: Content — enhance foes + add the arena adventure

**Files:**
- Modify: `src/content/adventure.json`, `src/content/snakewater.json`, `src/content/chaoticcaves.json`
- Create: `src/content/arena.json`
- Modify: `src/content/adventures.ts`, `src/content/adventure.test.ts`

- [ ] **Step 1: Add abilities to four existing foes (via a one-off script)**

Run this from the repo root (idempotent — re-running just re-sets the same fields):

```bash
node -e '
const fs=require("fs");
function patch(file, sceneId, enemyName, ability){
  const d=JSON.parse(fs.readFileSync(file,"utf8"));
  const e=d.scenes[sceneId].enemies.find(x=>x.name===enemyName);
  if(!e) throw new Error("not found: "+enemyName+" in "+sceneId);
  e.ability=ability;
  fs.writeFileSync(file, JSON.stringify(d,null,2)+"\n");
  console.log("patched", enemyName);
}
patch("src/content/adventure.json","marsh_spider","Giant Spider",{name:"Web",kind:"debuff",uses:1,description:"Snares a hero — disadvantage on their next attack."});
patch("src/content/adventure.json","tower_guardians","Bell-Warden",{name:"Dirge",kind:"debuff",uses:1,description:"A chilling dirge — a hero attacks with disadvantage."});
patch("src/content/snakewater.json","fight_captain","Garran the Scarred",{name:"Rally",kind:"buff",uses:1,description:"Rallies an ally — advantage on its next attack."});
patch("src/content/chaoticcaves.json","fight_boss","The Cave Lord",{name:"War Cry",kind:"buff",uses:1,description:"A war-cry — an ally attacks with advantage."});
'
```

Expected output: four "patched ..." lines.

- [ ] **Step 2: Create `src/content/arena.json`**

```json
{
  "title": "The Proving Pit",
  "startSceneId": "pit_intro",
  "scenes": {
    "pit_intro": {
      "id": "pit_intro", "type": "story", "title": "The Proving Pit",
      "narration": "Torchlight and roaring crowds fill the old fighting pit of Karth. The scarred pitmaster offers a heavy purse to any band that survives three bouts against his champions. Sand and old blood crunch underfoot as the first gate begins to grind open.",
      "choices": [
        { "id": "pit_begin", "text": "Signal that you are ready.", "next": "fight_warband" },
        { "id": "pit_study", "text": "Study the fighters waiting beyond the gates.", "check": { "skill": "insight", "dc": 12 }, "attemptedBy": "any", "onSuccess": "pit_intel", "onFailure": "fight_warband" }
      ]
    },
    "pit_intel": {
      "id": "pit_intel", "type": "story", "title": "Reading the Champions",
      "narration": "You watch how they move: the goblin warchanter whips his kin into a frenzy, the bog-witch hexes from the shadows, and the pit champion fights for the crowd's roar. Forewarned, you steel yourselves as the first gate opens.",
      "choices": [
        { "id": "intel_begin", "text": "Step into the sand.", "next": "fight_warband" }
      ]
    },
    "fight_warband": {
      "id": "fight_warband", "type": "combat", "title": "First Bout: The Warband",
      "narration": "A goblin warchanter struts in beating a bone drum, a scarred cutter snarling at his side. The crowd howls for blood.",
      "enemies": [
        { "name": "Goblin Warchanter", "maxHp": 8, "ac": 12, "attack": { "name": "Spear", "toHit": 4, "damageDice": "1d6", "damageBonus": 1 }, "ability": { "name": "War Chant", "kind": "buff", "uses": 1, "description": "A driving chant — an ally attacks with advantage." } },
        { "name": "Goblin Cutter", "maxHp": 7, "ac": 12, "attack": { "name": "Cleaver", "toHit": 4, "damageDice": "1d6", "damageBonus": 1 } }
      ],
      "onVictory": "pit_rest", "onDefeat": "ending_pit_fall"
    },
    "pit_rest": {
      "id": "pit_rest", "type": "story", "title": "Between Bouts", "rest": true,
      "narration": "The gate clangs shut and a water-boy tosses you a skin and a roll of bandages. You bind your wounds in the brief lull while the crowd chants for the next bout — your strength returns.",
      "choices": [
        { "id": "rest_next", "text": "Ready yourselves for the second bout.", "next": "fight_hexweaver" }
      ]
    },
    "fight_hexweaver": {
      "id": "fight_hexweaver", "type": "combat", "title": "Second Bout: The Hexweaver",
      "narration": "A hunched bog-witch shuffles in trailing marsh-stink, a slick lurking thing coiling at her heels. She points a crooked finger and mutters.",
      "enemies": [
        { "name": "Bog Hexweaver", "maxHp": 12, "ac": 12, "attack": { "name": "Hex Bolt", "toHit": 4, "damageDice": "1d6", "damageBonus": 2 }, "ability": { "name": "Hex", "kind": "debuff", "uses": 2, "description": "A muttered hex — a hero attacks with disadvantage." } },
        { "name": "Bog Lurker", "maxHp": 8, "ac": 12, "attack": { "name": "Claw", "toHit": 3, "damageDice": "1d6", "damageBonus": 1 } }
      ],
      "onVictory": "pit_final", "onDefeat": "ending_pit_fall"
    },
    "pit_final": {
      "id": "pit_final", "type": "story", "title": "The Champion's Gate",
      "narration": "The crowd falls silent, then erupts: the Pit Champion strides out, a slab of muscle dragging a greatclub, a scarred war-hound straining at his side. He points the club at you and grins.",
      "choices": [
        { "id": "final_fight", "text": "Meet the champion head-on.", "next": "fight_champion" },
        { "id": "final_taunt", "text": "Roar back to turn the crowd against him.", "check": { "skill": "intimidation", "dc": 14 }, "attemptedBy": "any", "onSuccess": "fight_champion", "onFailure": "fight_champion" }
      ]
    },
    "fight_champion": {
      "id": "fight_champion", "type": "combat", "title": "Final Bout: The Pit Champion",
      "narration": "The greatclub whistles through the torchlit air as the champion bellows for his hound to tear into your flank. This is the bout the whole pit came to see.",
      "enemies": [
        { "name": "The Pit Champion", "maxHp": 26, "ac": 14, "attack": { "name": "Greatclub", "toHit": 5, "damageDice": "1d10", "damageBonus": 3 }, "ability": { "name": "Rally Roar", "kind": "buff", "uses": 1, "description": "A bellowing roar — an ally attacks with advantage." } },
        { "name": "Pit Hound", "maxHp": 9, "ac": 13, "attack": { "name": "Bite", "toHit": 4, "damageDice": "1d6", "damageBonus": 2 } }
      ],
      "onVictory": "pit_victory", "onDefeat": "ending_pit_fall_boss"
    },
    "pit_victory": {
      "id": "pit_victory", "type": "story", "title": "Champions of the Pit",
      "narration": "The champion crashes into the sand and the crowd's roar shakes the timbers. The pitmaster, scowling and impressed, counts the heavy purse into your hands.",
      "choices": [
        { "id": "claim_prize", "text": "Take your winnings and your glory.", "next": "ending_pit_win" }
      ]
    },
    "ending_pit_win": {
      "id": "ending_pit_win", "type": "ending", "endingType": "victory", "title": "Undefeated",
      "narration": "You leave the Proving Pit of Karth with full purses and a name that will draw nods in every tavern from here to the coast. The crowd is already chanting for your return."
    },
    "ending_pit_fall": {
      "id": "ending_pit_fall", "type": "ending", "endingType": "defeat", "title": "Dragged from the Sand",
      "narration": "You fall in an early bout, and the hooks come out to drag you from the sand while the crowd jeers. The pitmaster keeps his purse, and the pit keeps its reputation."
    },
    "ending_pit_fall_boss": {
      "id": "ending_pit_fall_boss", "type": "ending", "endingType": "defeat", "title": "So Close",
      "narration": "Two bouts won, and the champion's greatclub ends the third. The crowd salutes a good fight even as you are carried out — but a good fight pays nothing."
    }
  }
}
```

- [ ] **Step 3: Register the arena in `src/content/adventures.ts`**

Add the import at the top (with the other adventure imports):

```ts
import arenaData from './arena.json';
```

Add a fourth entry to the `ADVENTURES` array (after the `chaoticcaves` entry):

```ts
  {
    id: 'arena',
    title: (arenaData as unknown as Adventure).title,
    tagline: 'A gauntlet of three bouts against the champions of Karth’s fighting pit. Survive all three for the purse.',
    mood: 'Gauntlet · Arena · Boss',
    emoji: '🏟️',
    data: arenaData as unknown as Adventure,
  },
```

- [ ] **Step 4: Add an enemy-ability content validation test**

In `src/content/adventure.test.ts`, inside the `describe.each(...)` block (before its closing `});`), add:

```ts
  it('every enemy ability has a valid kind and at least one use', () => {
    for (const scene of Object.values(adventure.scenes)) {
      if (scene.type !== 'combat') continue;
      for (const e of scene.enemies) {
        if (!e.ability) continue;
        expect(['debuff', 'buff']).toContain(e.ability.kind);
        expect(e.ability.uses).toBeGreaterThanOrEqual(1);
      }
    }
  });
```

- [ ] **Step 5: Run the content tests**

Run: `npm test -- adventure characters`
Expected: PASS — the arena passes connectivity (reachable, ≥2 combats, both ending types) and all enemy abilities are valid.

- [ ] **Step 6: Commit**

```bash
git add src/content/adventure.json src/content/snakewater.json src/content/chaoticcaves.json src/content/arena.json src/content/adventures.ts src/content/adventure.test.ts
git commit -m "feat: enemy abilities on existing foes + new Proving Pit arena"
```

---

## Task 4: Show the ability on enemy cards

**Files:**
- Modify: `src/components/CombatView.tsx`

- [ ] **Step 1: Add the ability tag to the foe card**

In `src/components/CombatView.tsx`, find the foe card's stat row:

```tsx
                  <div className="row" style={{ gap: 8, marginTop: 5, fontSize: '0.82rem' }}>
                    <span className="muted">{e.hp}/{e.maxHp} HP</span>
                    <span className="tag">AC {e.ac}</span>
                  </div>
```

Replace it with (adds the ability tag when present):

```tsx
                  <div className="row" style={{ gap: 8, marginTop: 5, fontSize: '0.82rem' }}>
                    <span className="muted">{e.hp}/{e.maxHp} HP</span>
                    <span className="tag">AC {e.ac}</span>
                    {e.ability && <span className="tag" title={e.ability.description}>✦ {e.ability.name}</span>}
                  </div>
```

- [ ] **Step 2: Type-check and run the combat view test**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test -- CombatView`
Expected: PASS (existing smoke tests still hold).

- [ ] **Step 3: Commit**

```bash
git add src/components/CombatView.tsx
git commit -m "feat: show enemy ability tag on combat cards"
```

---

## Task 5: Full verification + deploy

**Files:** none (verification only)

- [ ] **Step 1: Full CI sequence locally**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json && npm test && npm run build`
Expected: lint clean (one pre-existing react-refresh warning OK), tsc clean, all tests pass, build succeeds.

- [ ] **Step 2: Manual playthrough (run or verify skill)**

Run `npm run dev`, pick **The Proving Pit** (now a 4th tale) with a 2–3 hero party, and verify:
- An enemy card shows a `✦ <ability>` tag (e.g. "✦ War Chant").
- On its turn, the Goblin Warchanter buffs its ally (a ⬆ badge appears on the Goblin Cutter; the log reads "...War Chant — Goblin Cutter attacks with advantage").
- The Bog Hexweaver debuffs a hero (⬇ badge + log).
- The buffed/debuffed combatant's next attack rolls with advantage/disadvantage (visible in the dice readout), and the flag clears after.
- Enemy ability uses are limited (it reverts to normal attacks after).
- Existing adventures still work (e.g. the Giant Spider's Web debuff fires).

- [ ] **Step 3: Push (auto-deploys) and confirm**

```bash
git push origin main
gh run watch "$(gh run list --workflow='Deploy to GitHub Pages' --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

Expected: the deploy run completes successfully; the four-adventure roster and enemy abilities are live at https://gledilami.github.io/tavern/.

---

## Self-Review

- **Spec coverage:** `EnemyAbility`/`Enemy.ability`/`Combatant.ability`+`abilityUses` (T1) ✓; `startCombat` copy + `performEnemyTurn` buff/debuff AI with use limits and attack fallback (T2) ✓; four enhanced foes (T3 S1) ✓; Proving Pit arena + registration (T3 S2–3) ✓; ability content validation + arena connectivity (T3 S4–5, existing test) ✓; `✦ ability` tag UI (T4) ✓; engine unit tests for buff/debuff/uses/copy (T2) ✓; verify + deploy (T5) ✓.
- **Placeholder scan:** none — every step has complete code/commands.
- **Type consistency:** `EnemyAbility` (kind `'debuff'|'buff'`, `uses`, `description?`) used identically in T1 type, T2 AI, T3 JSON, T4 UI; `Combatant.ability`/`abilityUses` set in `startCombat` (T2) and read in `performEnemyTurn` (T2) and `CombatView` (T4); `nextAttack` flag values `'adv'|'dis'` match the existing engine.
- **Scope:** single cohesive plan; AoE/heal/summon abilities excluded per spec.
```
