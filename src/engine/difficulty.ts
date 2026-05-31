import type { Character, Enemy, Difficulty } from '../types';

export interface DifficultyConfig {
  label: string;
  blurb: string;
  hpFloor: number;        // minimum effective max HP per hero
  restHealPct: number;    // fraction of max HP restored to survivors after a won fight
  revivePct: number;      // fraction of max HP a downed hero returns with at rest (0 = stays down)
  enemyDamageMult: number; // scales enemy damage bonus
  enemyToHitDelta: number; // added to enemy to-hit (negative = easier)
  soloScaling: boolean;    // thin encounters for parties of <= 2
  clericHeal: boolean;     // Cleric gains an in-combat Cure Wounds action
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  normal: {
    label: 'Normal',
    blurb: 'Tense but fair. Heroes have a HP floor, recover between fights, and the Cleric can heal. Small parties face thinned foes.',
    hpFloor: 10,
    restHealPct: 0.6,
    revivePct: 0.25,
    enemyDamageMult: 0.85,
    enemyToHitDelta: -1,
    soloScaling: true,
    clericHeal: true,
  },
  hard: {
    label: 'Hard',
    blurb: 'For veterans. Real stat blocks, little recovery, no HP floor, no thinning. Every hit matters — but still beatable with smart play.',
    hpFloor: 0,
    restHealPct: 0.25,
    revivePct: 0,
    enemyDamageMult: 1,
    enemyToHitDelta: 0,
    soloScaling: false,
    clericHeal: true,
  },
};

export function config(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTIES[difficulty];
}

export const HP_PER_LEVEL = 4;

// Effective max HP after the difficulty's HP floor, plus the campaign level bonus.
export function effectiveMaxHp(character: Character, difficulty: Difficulty, level = 1): number {
  return Math.max(character.maxHp, config(difficulty).hpFloor) + (level - 1) * HP_PER_LEVEL;
}

// Extra per-encounter power uses granted by campaign level.
export function levelPowerBonus(level: number): number {
  return Math.max(0, level - 1);
}

// HP restored to a hero after a won encounter (survivors heal, the downed may revive).
export function restHp(current: number, max: number, difficulty: Difficulty): number {
  const cfg = config(difficulty);
  if (current <= 0) {
    if (cfg.revivePct <= 0) return 0;
    return Math.min(max, Math.ceil(max * cfg.revivePct));
  }
  return Math.min(max, current + Math.ceil(max * cfg.restHealPct));
}

// A dedicated "safe room" rest, more generous than a between-fight breather.
// Normal: living heroes fully recover, the downed revive at half. Hard: +50% / revive at 25%.
export function campRestHp(current: number, max: number, difficulty: Difficulty): number {
  if (current > 0) {
    return difficulty === 'normal' ? max : Math.min(max, current + Math.ceil(max * 0.5));
  }
  return difficulty === 'normal' ? Math.ceil(max * 0.5) : Math.ceil(max * 0.25);
}

// Adjust an encounter's enemies for difficulty and party size.
export function scaleEnemies(enemies: Enemy[], difficulty: Difficulty, partySize: number): Enemy[] {
  const cfg = config(difficulty);
  let list = enemies;

  // Solo/duo scaling: drop the weakest extra so small parties aren't swamped.
  if (cfg.soloScaling && partySize <= 2 && list.length > 1) {
    const sorted = [...list].sort((a, b) => a.maxHp - b.maxHp);
    const dropId = sorted[0];
    let dropped = false;
    list = list.filter((e) => {
      if (!dropped && e === dropId) { dropped = true; return false; }
      return true;
    });
  }

  return list.map((e) => ({
    ...e,
    attack: {
      ...e.attack,
      toHit: e.attack.toHit + cfg.enemyToHitDelta,
      damageBonus: Math.max(0, Math.round(e.attack.damageBonus * cfg.enemyDamageMult)),
    },
  }));
}
