import type { CombatState, AttackEvent, Power } from '../types';
import type { Rng } from './rng';
import { defaultRng } from './rng';
import { rollDice } from './dice';
import { clone, checkStatus, advanceTurn, applyAttack, applyHeal, type HeroAttackLookup } from './combat';

export const POWERS: Record<string, Power> = {
  'action-surge': { id: 'action-surge', name: 'Action Surge', description: 'Make two weapon attacks against one foe.', kind: 'multi-attack', targeting: 'enemy', uses: 1, attacks: 2 },
  'reckless-strike': { id: 'reckless-strike', name: 'Reckless Strike', description: 'A furious attack with advantage and +2 damage.', kind: 'bonus-attack', targeting: 'enemy', uses: 2, withAdvantage: true, bonusDamageFlat: 2 },
  'sneak-attack': { id: 'sneak-attack', name: 'Sneak Attack', description: 'A precise strike dealing +2d6 damage.', kind: 'bonus-attack', targeting: 'enemy', uses: 2, bonusDice: '2d6' },
  'flurry-of-blows': { id: 'flurry-of-blows', name: 'Flurry of Blows', description: 'Two rapid unarmed strikes against one foe.', kind: 'multi-attack', targeting: 'enemy', uses: 2, attacks: 2 },
  'divine-smite': { id: 'divine-smite', name: 'Divine Smite', description: 'A radiant strike dealing +2d8 damage.', kind: 'bonus-attack', targeting: 'enemy', uses: 2, bonusDice: '2d8' },
  'volley': { id: 'volley', name: 'Volley', description: 'Loose an arrow at every enemy.', kind: 'aoe-attack', targeting: 'all-enemies', uses: 1 },
  'cure-wounds': { id: 'cure-wounds', name: 'Cure Wounds', description: 'Heal an ally for 1d8+3.', kind: 'heal', targeting: 'ally', uses: 2, healDice: '1d8', healBonus: 3 },
  'entangle': { id: 'entangle', name: 'Entangle', description: 'Vines grip all enemies — they attack with disadvantage next.', kind: 'impose-disadvantage', targeting: 'all-enemies', uses: 1 },
  'burning-hands': { id: 'burning-hands', name: 'Burning Hands', description: 'A fan of flame: every enemy takes 2d6 fire.', kind: 'aoe-damage', targeting: 'all-enemies', uses: 1, damageDice: '2d6' },
  'chaos-bolt': { id: 'chaos-bolt', name: 'Chaos Bolt', description: 'Hurl raw chaos at one foe for 3d6.', kind: 'single-damage', targeting: 'enemy', uses: 2, damageDice: '3d6' },
  'arms-of-hadar': { id: 'arms-of-hadar', name: 'Arms of Hadar', description: 'Dark tendrils: all enemies take 2d6 and attack with disadvantage.', kind: 'aoe-damage', targeting: 'all-enemies', uses: 1, damageDice: '2d6', alsoDisadvantage: true },
  'bardic-inspiration': { id: 'bardic-inspiration', name: 'Bardic Inspiration', description: "Inspire an ally — their next attack has advantage.", kind: 'grant-advantage', targeting: 'ally', uses: 3 },
};

export function getPower(id: string): Power {
  const p = POWERS[id];
  if (!p) throw new Error(`Unknown power: "${id}"`);
  return p;
}

function livingEnemyIds(state: CombatState): string[] {
  return state.combatants.filter((c) => !c.isHero && c.hp > 0).map((c) => c.id);
}

// Resolve a power, returning a new CombatState. UI tracks per-power uses.
export function applyPower(
  state: CombatState,
  casterId: string,
  powerId: string,
  targetIds: string[],
  rng: Rng = defaultRng,
  lookup?: HeroAttackLookup,
): CombatState {
  const next = clone(state);
  const power = getPower(powerId);
  const caster = next.combatants.find((c) => c.id === casterId)!;
  const atkName = caster.primaryAttack ?? 'Attack';

  switch (power.kind) {
    case 'bonus-attack':
      next.lastAttack = applyAttack(next, casterId, atkName, targetIds[0], rng, lookup, {
        mode: power.withAdvantage ? 'adv' : undefined,
        bonusDice: power.bonusDice,
        bonusFlat: power.bonusDamageFlat,
      });
      break;

    case 'multi-attack': {
      const n = power.attacks ?? 2;
      let last: AttackEvent | undefined;
      for (let i = 0; i < n; i++) {
        const t = next.combatants.find((c) => c.id === targetIds[0]);
        if (t && t.hp > 0) last = applyAttack(next, casterId, atkName, targetIds[0], rng, lookup);
      }
      next.lastAttack = last;
      break;
    }

    case 'aoe-attack': {
      let last: AttackEvent | undefined;
      for (const id of livingEnemyIds(next)) last = applyAttack(next, casterId, atkName, id, rng, lookup);
      next.lastAttack = last;
      break;
    }

    case 'aoe-damage': {
      const roll = rollDice(power.damageDice!, rng);
      const ids = livingEnemyIds(next);
      for (const id of ids) {
        const e = next.combatants.find((c) => c.id === id)!;
        e.hp = Math.max(0, e.hp - roll.total);
        if (power.alsoDisadvantage) e.nextAttack = 'dis';
      }
      next.log.push(`${caster.name} unleashes ${power.name} — every foe takes ${roll.total} damage${power.alsoDisadvantage ? ' and reels (disadvantage)' : ''}.`);
      next.lastAttack = {
        kind: 'attack', attackerName: caster.name, targetName: 'all foes', actionName: power.name,
        targetId: ids[0] ?? casterId, hit: true, crit: false,
        damageDice: power.damageDice!, damageRolls: roll.rolls, damageBonus: 0, amount: roll.total,
      };
      break;
    }

    case 'single-damage': {
      const roll = rollDice(power.damageDice!, rng);
      const t = next.combatants.find((c) => c.id === targetIds[0])!;
      t.hp = Math.max(0, t.hp - roll.total);
      next.log.push(`${caster.name} blasts ${t.name} with ${power.name} for ${roll.total} damage.`);
      if (t.hp === 0) next.log.push(`${t.name} falls!`);
      next.lastAttack = {
        kind: 'attack', attackerName: caster.name, targetName: t.name, actionName: power.name,
        targetId: t.id, hit: true, crit: false,
        damageDice: power.damageDice!, damageRolls: roll.rolls, damageBonus: 0, amount: roll.total,
      };
      break;
    }

    case 'heal':
      next.lastAttack = applyHeal(next, casterId, targetIds[0], power.healDice!, power.healBonus ?? 0, power.name, rng);
      break;

    case 'grant-advantage': {
      const t = next.combatants.find((c) => c.id === targetIds[0])!;
      t.nextAttack = 'adv';
      next.log.push(`${caster.name} uses ${power.name} — ${t.name}'s next attack has advantage.`);
      next.lastAttack = undefined;
      break;
    }

    case 'impose-disadvantage': {
      const ids = power.targeting === 'all-enemies' ? livingEnemyIds(next) : [targetIds[0]];
      for (const id of ids) {
        const c = next.combatants.find((x) => x.id === id)!;
        c.nextAttack = 'dis';
      }
      next.log.push(`${caster.name} uses ${power.name} — ${ids.length > 1 ? 'all foes' : 'the target'} attack with disadvantage.`);
      next.lastAttack = undefined;
      break;
    }
  }

  checkStatus(next);
  if (next.status === 'active') advanceTurn(next);
  return next;
}
