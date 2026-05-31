export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type Skill =
  | 'acrobatics' | 'animalHandling' | 'arcana' | 'athletics' | 'deception'
  | 'history' | 'insight' | 'intimidation' | 'investigation' | 'medicine'
  | 'nature' | 'perception' | 'performance' | 'persuasion' | 'religion'
  | 'sleightOfHand' | 'stealth' | 'survival';

export interface Attack {
  name: string;
  ability: Ability;
  damageDice: string;   // e.g. "1d8"
  damageBonus: number;
}

export interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  portrait: string;     // emoji or asset filename
  abilities: Record<Ability, number>;
  maxHp: number;
  ac: number;
  proficiencyBonus: number;
  skillProficiencies: Skill[];
  attacks: Attack[];
  backstory: string;
}

export interface CheckSpec { skill: Skill; dc: number; }

export interface Choice {
  id: string;
  text: string;
  check?: CheckSpec;
  attemptedBy?: 'any';
  onSuccess?: string;
  onFailure?: string;
  next?: string;
}

export interface EnemyAttack {
  name: string;
  toHit: number;
  damageDice: string;
  damageBonus: number;
}

export interface Enemy {
  name: string;
  maxHp: number;
  ac: number;
  attack: EnemyAttack;
}

export type Scene =
  | { id: string; type: 'story'; title: string; narration: string; choices: Choice[] }
  | { id: string; type: 'combat'; title: string; narration: string; enemies: Enemy[]; onVictory: string; onDefeat: string }
  | { id: string; type: 'ending'; endingType: 'victory' | 'defeat'; title: string; narration: string };

export interface Adventure {
  title: string;
  startSceneId: string;
  scenes: Record<string, Scene>;
}

// Runtime party member (current hp tracked separately from maxHp)
export interface Hero extends Character { hp: number; }

export interface CheckResult {
  roll: number;          // raw d20
  modifier: number;      // skill modifier applied
  total: number;
  dc: number;
  success: boolean;
  crit: 'success' | 'fail' | null;
}

export interface Combatant {
  id: string;            // hero id or enemy instance id e.g. "enemy-0"
  name: string;
  isHero: boolean;
  maxHp: number;
  hp: number;
  ac: number;
  initiative: number;
  heroId?: string;       // present if isHero
  attack?: EnemyAttack;  // present if enemy
}

export interface CombatState {
  combatants: Combatant[];
  order: string[];       // combatant ids in initiative order
  turnIndex: number;
  round: number;
  log: string[];
  status: 'active' | 'victory' | 'defeat';
}
