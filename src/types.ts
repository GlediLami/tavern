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
  save?: Ability;       // if set, target makes this saving throw instead of being attacked
  ranged?: boolean;     // ranged/thrown attack (used for back-line cover)
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
  powerId?: string;     // references a Power in the powers registry
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
  setFlags?: string[];     // flags set when this choice is committed
  requiresFlag?: string;   // choice only shown when this flag is set
}

export interface EnemyAttack {
  name: string;
  toHit: number;
  damageDice: string;
  damageBonus: number;
}

export interface EnemyAbility {
  name: string;
  kind: 'debuff' | 'buff';   // debuff: 'dis' on a hero; buff: 'adv' on an ally enemy
  uses: number;              // per encounter
  description?: string;      // shown on the enemy card
}

export interface Enemy {
  name: string;
  maxHp: number;
  ac: number;
  attack: EnemyAttack;
  ability?: EnemyAbility;
  dexSave?: number;     // bonus to Dexterity saving throws (default +1 in the engine)
}

export type Scene =
  | { id: string; type: 'story'; title: string; narration: string; choices: Choice[]; rest?: boolean; setFlags?: string[] }
  | { id: string; type: 'combat'; title: string; narration: string; enemies: Enemy[]; onVictory: string; onDefeat: string; setFlags?: string[] }
  | { id: string; type: 'ending'; endingType: 'victory' | 'defeat'; title: string; narration: string; setFlags?: string[]; epilogues?: { flag: string; text: string }[] };

export interface Adventure {
  title: string;
  startSceneId: string;
  scenes: Record<string, Scene>;
}

// Runtime party member (current hp tracked separately from maxHp)
export interface Hero extends Character { hp: number; relics?: string[]; }

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
  primaryAttack?: string; // hero's main weapon attack name (for powers)
  attack?: EnemyAttack;  // present if enemy
  ability?: EnemyAbility; // present if enemy has a special ability
  abilityUses?: number;   // remaining uses of `ability` this encounter
  nextAttack?: 'adv' | 'dis';  // one-shot advantage/disadvantage on this combatant's next attack
  backLine?: boolean;          // hero whose primary attack is ranged (eligible for cover)
  dexSave?: number;            // enemy Dexterity save bonus
  relicDamage?: number;        // flat bonus damage from relics
  relicToHit?: number;         // bonus to-hit from relics
  bloodiedDamage?: number;     // extra flat damage while at <= half HP
  critHeal?: number;           // self-heal on a crit
  damageReduction?: number;    // reduce each incoming hit by this
}

// A resolved attack/heal, surfaced so the UI can show the actual dice.
export interface AttackEvent {
  kind: 'attack' | 'heal';
  attackerName: string;
  targetName: string;
  actionName: string;    // weapon/spell name
  targetId: string;
  d20?: number;          // attack roll (omitted for heals)
  toHit?: number;        // attacker's to-hit modifier
  ac?: number;           // target AC
  hit: boolean;
  crit: boolean;
  mode?: 'adv' | 'dis';  // advantage/disadvantage applied to the attack roll, if any
  d20Rolls?: number[];   // both raw d20s when rolled with advantage/disadvantage
  save?: Ability;        // set when this was a saving-throw spell (d20 is the target's save roll)
  saveDC?: number;       // the spell save DC the target rolled against
  damageDice: string;    // e.g. "1d8"
  damageRolls: number[]; // individual die faces rolled (incl. crit dice / heal dice)
  damageBonus: number;
  amount: number;        // total damage dealt or HP healed
}

export interface CombatState {
  combatants: Combatant[];
  order: string[];       // combatant ids in initiative order
  turnIndex: number;
  round: number;
  log: string[];
  status: 'active' | 'victory' | 'defeat';
  lastAttack?: AttackEvent;
}

export type Difficulty = 'normal' | 'hard';

export type AdvMode = 'adv' | 'dis';

export type PowerTargeting = 'self' | 'ally' | 'enemy' | 'all-enemies';

export type PowerKind =
  | 'bonus-attack'         // a weapon attack with extra damage dice / flat / advantage
  | 'multi-attack'         // N weapon attacks against the chosen target this turn
  | 'aoe-attack'           // a weapon attack roll against every living enemy
  | 'aoe-damage'           // fixed rolled damage to every living enemy (auto-hit)
  | 'single-damage'        // fixed rolled damage to one enemy (auto-hit)
  | 'heal'                 // restore HP to one ally/self
  | 'grant-advantage'      // set nextAttack='adv' on self or an ally
  | 'impose-disadvantage'; // set nextAttack='dis' on a target or all enemies

export interface Power {
  id: string;
  name: string;
  description: string;
  kind: PowerKind;
  targeting: PowerTargeting;
  uses: number;
  bonusDice?: string;        // bonus-attack extra damage dice, e.g. "2d6"
  bonusDamageFlat?: number;  // bonus-attack flat extra damage
  withAdvantage?: boolean;   // bonus-attack rolls with advantage
  attacks?: number;          // multi-attack count (default 2)
  damageDice?: string;       // aoe-damage / single-damage dice, e.g. "2d6"
  alsoDisadvantage?: boolean;// aoe-damage also imposes disadvantage on all enemies
  healDice?: string;         // heal dice, e.g. "1d8"
  healBonus?: number;        // heal flat bonus
}

export type ItemRarity = 'common' | 'uncommon' | 'rare';
export type ItemKind = 'heal' | 'damage' | 'grant-advantage' | 'mass-disadvantage';
export type ItemTargeting = 'ally' | 'enemy' | 'all-enemies';

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  kind: ItemKind;
  targeting: ItemTargeting;
  healDice?: string;     // heal kind, e.g. "2d4"
  healBonus?: number;    // heal flat bonus
  damageDice?: string;   // damage kind, e.g. "2d6"
}

export interface RelicEffect {
  acBonus?: number;            // +AC (folded in at combat start)
  damageBonus?: number;        // flat +damage on every hero attack
  attackBonus?: number;        // +to-hit
  bloodiedDamage?: number;     // extra flat damage while the hero is at <= half HP
  critHeal?: number;           // heal self this much on a crit
  damageReduction?: number;    // reduce each incoming hit by this much
  firstStrikeAdvantage?: boolean; // advantage on the hero's first attack each fight
}

export interface Relic {
  id: string;
  name: string;
  description: string;
  synergy?: string;
  effect: RelicEffect;
}
