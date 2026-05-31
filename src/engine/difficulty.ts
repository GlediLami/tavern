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

// Effective max HP after applying the difficulty's HP floor.
export function effectiveMaxHp(character: Character, difficulty: Difficulty): number {
  return Math.max(character.maxHp, config(difficulty).hpFloor);
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
