import type { CombatState, Item, Difficulty } from '../types';
import type { Rng } from './rng';
import { defaultRng } from './rng';
import { rollDice } from './dice';
import { clone, checkStatus, advanceTurn, applyHeal } from './combat';

export const ITEMS: Record<string, Item> = {
  'potion-healing': { id: 'potion-healing', name: 'Potion of Healing', description: 'Restore 2d4+2 HP to a hero.', rarity: 'common', kind: 'heal', targeting: 'ally', healDice: '2d4', healBonus: 2 },
  'greater-healing-draught': { id: 'greater-healing-draught', name: 'Greater Healing Draught', description: 'Restore 4d4+4 HP to a hero.', rarity: 'rare', kind: 'heal', targeting: 'ally', healDice: '4d4', healBonus: 4 },
  'alchemists-fire': { id: 'alchemists-fire', name: "Alchemist's Fire", description: 'Hurl fire at one foe for 2d6 damage.', rarity: 'uncommon', kind: 'damage', targeting: 'enemy', damageDice: '2d6' },
  'elixir-heroism': { id: 'elixir-heroism', name: 'Elixir of Heroism', description: "An ally's next attack has advantage.", rarity: 'uncommon', kind: 'grant-advantage', targeting: 'ally' },
  'smoke-bomb': { id: 'smoke-bomb', name: 'Smoke Bomb', description: 'Every foe attacks with disadvantage next.', rarity: 'uncommon', kind: 'mass-disadvantage', targeting: 'all-enemies' },
};

export function getItem(id: string): Item {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item: "${id}"`);
  return it;
}

function livingEnemyIds(state: CombatState): string[] {
  return state.combatants.filter((c) => !c.isHero && c.hp > 0).map((c) => c.id);
}

// Resolve an item, returning a new CombatState. Using an item costs the hero's turn.
export function applyItem(
  state: CombatState,
  userId: string,
  itemId: string,
  targetIds: string[],
  rng: Rng = defaultRng,
): CombatState {
  const next = clone(state);
  const item = getItem(itemId);
  const user = next.combatants.find((c) => c.id === userId)!;

  switch (item.kind) {
    case 'heal':
      next.lastAttack = applyHeal(next, userId, targetIds[0], item.healDice!, item.healBonus ?? 0, item.name, rng);
      break;

    case 'damage': {
      const roll = rollDice(item.damageDice!, rng);
      const t = next.combatants.find((c) => c.id === targetIds[0])!;
      t.hp = Math.max(0, t.hp - roll.total);
      next.log.push(`${user.name} uses ${item.name} — ${t.name} takes ${roll.total} damage.`);
      if (t.hp === 0) next.log.push(`${t.name} falls!`);
      next.lastAttack = {
        kind: 'attack', attackerName: user.name, targetName: t.name, actionName: item.name,
        targetId: t.id, hit: true, crit: false,
        damageDice: item.damageDice!, damageRolls: roll.rolls, damageBonus: 0, amount: roll.total,
      };
      break;
    }

    case 'grant-advantage': {
      const t = next.combatants.find((c) => c.id === targetIds[0])!;
      t.nextAttack = 'adv';
      next.log.push(`${user.name} uses ${item.name} — ${t.name}'s next attack has advantage.`);
      next.lastAttack = undefined;
      break;
    }

    case 'mass-disadvantage': {
      for (const id of livingEnemyIds(next)) {
        next.combatants.find((c) => c.id === id)!.nextAttack = 'dis';
      }
      next.log.push(`${user.name} uses ${item.name} — every foe attacks with disadvantage.`);
      next.lastAttack = undefined;
      break;
    }
  }

  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
}

// Loot dropped after a won encounter: a drop-chance gate, then a rarity-weighted pick.
const LOOT_TABLE: { id: string; weight: number }[] = [
  { id: 'potion-healing', weight: 45 },
  { id: 'alchemists-fire', weight: 20 },
  { id: 'elixir-heroism', weight: 18 },
  { id: 'smoke-bomb', weight: 12 },
  { id: 'greater-healing-draught', weight: 5 },
];
const DROP_CHANCE: Record<Difficulty, number> = { normal: 0.6, hard: 0.45 };

export function rollLoot(rng: Rng, difficulty: Difficulty): string | null {
  if (rng() >= DROP_CHANCE[difficulty]) return null;
  const total = LOOT_TABLE.reduce((sum, e) => sum + e.weight, 0);
  let r = rng() * total;
  for (const entry of LOOT_TABLE) {
    if (r < entry.weight) return entry.id;
    r -= entry.weight;
  }
  return LOOT_TABLE[LOOT_TABLE.length - 1].id;
}
