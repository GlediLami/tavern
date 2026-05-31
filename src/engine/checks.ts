import type { Character, Skill, CheckResult } from '../types';
import type { Rng } from './rng';
import { defaultRng } from './rng';
import { rollD20 } from './dice';
import { skillModifier } from './skills';

export function resolveCheck(
  character: Character,
  skill: Skill,
  dc: number,
  rng: Rng = defaultRng,
): CheckResult {
  const roll = rollD20(rng);
  const modifier = skillModifier(character, skill);
  const total = roll + modifier;

  let crit: 'success' | 'fail' | null = null;
  let success: boolean;
  if (roll === 20) { crit = 'success'; success = true; }
  else if (roll === 1) { crit = 'fail'; success = false; }
  else { success = total >= dc; }

  return { roll, modifier, total, dc, success, crit };
}
