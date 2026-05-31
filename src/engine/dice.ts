import type { Rng } from './rng';
import { defaultRng } from './rng';

export function rollDie(sides: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollD20(rng: Rng = defaultRng): number {
  return rollDie(20, rng);
}

// Roll a d20 with optional advantage ('adv' = higher of two) or disadvantage
// ('dis' = lower of two). Returns the chosen value and the raw dice rolled.
export function rollD20WithMode(rng: Rng = defaultRng, mode?: 'adv' | 'dis'): { value: number; rolls: number[] } {
  if (!mode) {
    const v = rollDie(20, rng);
    return { value: v, rolls: [v] };
  }
  const a = rollDie(20, rng);
  const b = rollDie(20, rng);
  const value = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
  return { value, rolls: [a, b] };
}

export interface DiceResult {
  rolls: number[];
  bonus: number;   // flat bonus from the expression plus extraBonus
  total: number;
}

// Parses "NdM" or "NdM+K". `extraBonus` is added on top (e.g. ability mod for damage).
export function rollDice(expr: string, rng: Rng = defaultRng, extraBonus = 0): DiceResult {
  const match = /^\s*(\d+)d(\d+)\s*(?:\+\s*(\d+))?\s*$/i.exec(expr);
  if (!match) throw new Error(`Invalid dice expression: "${expr}"`);
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const exprBonus = match[3] ? parseInt(match[3], 10) : 0;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides, rng));
  const bonus = exprBonus + extraBonus;
  const total = rolls.reduce((a, b) => a + b, 0) + bonus;
  return { rolls, bonus, total };
}
