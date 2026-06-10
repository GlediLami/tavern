import type { Relic, RelicEffect } from '../types';
import type { Rng } from './rng';

export const RELICS: Record<string, Relic> = {
  'ironhide-charm': { id: 'ironhide-charm', name: 'Ironhide Charm', description: '+2 AC.', synergy: 'Defenders', effect: { acBonus: 2 } },
  'stoneward-totem': { id: 'stoneward-totem', name: 'Stoneward Totem', description: 'Reduce each incoming hit by 2.', synergy: 'Defenders', effect: { damageReduction: 2 } },
  'whetstone': { id: 'whetstone', name: 'Whetstone', description: '+2 damage on your attacks.', synergy: 'Strikers', effect: { damageBonus: 2 } },
  'keen-sight': { id: 'keen-sight', name: 'Keen Sight', description: '+1 to hit.', synergy: 'Anyone', effect: { attackBonus: 1 } },
  'berserkers-pact': { id: 'berserkers-pact', name: "Berserker's Pact", description: '+3 damage while bloodied (at or below half HP).', synergy: 'Bruisers', effect: { bloodiedDamage: 3 } },
  'oathkeepers-light': { id: 'oathkeepers-light', name: "Oathkeeper's Light", description: 'Heal 3 HP whenever you land a critical hit.', synergy: 'Anyone', effect: { critHeal: 3 } },
  'hunters-focus': { id: 'hunters-focus', name: "Hunter's Focus", description: 'Advantage on your first attack each fight.', synergy: 'Archers/Rogues', effect: { firstStrikeAdvantage: true } },
  'guardian-sigil': { id: 'guardian-sigil', name: 'Guardian Sigil', description: '+1 AC and reduce each incoming hit by 1.', synergy: 'Defenders', effect: { acBonus: 1, damageReduction: 1 } },
};

export function getRelic(id: string): Relic {
  const r = RELICS[id];
  if (!r) throw new Error(`Unknown relic: "${id}"`);
  return r;
}

const NUMERIC_KEYS = ['acBonus', 'damageBonus', 'attackBonus', 'bloodiedDamage', 'critHeal', 'damageReduction'] as const;

export function sumRelicEffects(ids: string[]): RelicEffect {
  const out: RelicEffect = {};
  for (const id of ids) {
    const e = RELICS[id]?.effect;
    if (!e) continue;
    for (const k of NUMERIC_KEYS) {
      if (e[k] !== undefined) out[k] = (out[k] ?? 0) + (e[k] as number);
    }
    if (e.firstStrikeAdvantage) out.firstStrikeAdvantage = true;
  }
  return out;
}

// Offer `count` distinct relic ids (a draft). Fisher–Yates over the registry.
export function rollRelicChoices(rng: Rng, count = 3): string[] {
  const ids = Object.keys(RELICS);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}
