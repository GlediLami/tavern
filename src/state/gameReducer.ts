import charactersData from '../content/characters.json';
import { getAdventureData, DEFAULT_ADVENTURE_ID } from '../content/adventures';
import { effectiveMaxHp, campRestHp } from '../engine/difficulty';
import type { Character, Difficulty } from '../types';

const characters = charactersData as unknown as Character[];

export type Phase = 'home' | 'adventure-select' | 'party-select' | 'scene' | 'combat' | 'ending';

// Curated campaign sequence, easy -> hard, ending on the arena gauntlet.
export const CAMPAIGN_ORDER = ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'];

// Party-wide Luck tokens granted at the start of each adventure (and refilled at rests).
export const LUCK_PER_ADVENTURE = 2;

export interface CampaignState {
  order: string[];
  index: number;
  level: number;
}

export interface RunStats {
  encountersWon: number;
  checksPassed: number;
  checksFailed: number;
  heroesDowned: number;
  crits: number;
  biggestHit: number;
  damageByHero: Record<string, number>;
}

export const emptyStats: RunStats = {
  encountersWon: 0, checksPassed: 0, checksFailed: 0,
  heroesDowned: 0, crits: 0, biggestHit: 0, damageByHero: {},
};

function mergeStats(a: RunStats, d: Partial<RunStats>): RunStats {
  const damageByHero = { ...a.damageByHero };
  if (d.damageByHero) for (const [id, n] of Object.entries(d.damageByHero)) damageByHero[id] = (damageByHero[id] ?? 0) + n;
  return {
    encountersWon: a.encountersWon + (d.encountersWon ?? 0),
    checksPassed: a.checksPassed + (d.checksPassed ?? 0),
    checksFailed: a.checksFailed + (d.checksFailed ?? 0),
    heroesDowned: a.heroesDowned + (d.heroesDowned ?? 0),
    crits: a.crits + (d.crits ?? 0),
    biggestHit: Math.max(a.biggestHit, d.biggestHit ?? 0),
    damageByHero,
  };
}

export interface GameState {
  phase: Phase;
  mode: 'single' | 'campaign';
  campaign?: CampaignState;
  adventureId: string;
  difficulty: Difficulty;
  partyIds: string[];
  hp: Record<string, number>;   // heroId -> current hp
  sceneId: string;
  log: string[];                // narration / roll history
  stats: RunStats;              // accumulated stats for the current run
  inventory: Record<string, number>;  // shared party stash: itemId -> count
  relics: Record<string, string[]>;   // heroId -> granted relic ids
  draftsAvailable: number;            // relic drafts the party can still take
  playerNames: Record<string, string>; // heroId -> the human player's name
  luck: number;                       // party-wide reroll/advantage tokens
}

export const initialState: GameState = {
  phase: 'home',
  mode: 'single',
  campaign: undefined,
  adventureId: DEFAULT_ADVENTURE_ID,
  difficulty: 'normal',
  partyIds: [],
  hp: {},
  sceneId: getAdventureData(DEFAULT_ADVENTURE_ID).startSceneId,
  log: [],
  stats: emptyStats,
  inventory: {},
  relics: {},
  draftsAvailable: 0,
  playerNames: {},
  luck: 0,
};

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'SELECT_ADVENTURE'; adventureId: string; difficulty: Difficulty }
  | { type: 'START_CAMPAIGN'; difficulty: Difficulty }
  | { type: 'CONFIRM_PARTY'; partyIds: string[]; playerNames?: Record<string, string> }
  | { type: 'ADVANCE_CAMPAIGN' }
  | { type: 'RECORD'; delta: Partial<RunStats> }
  | { type: 'ADD_ITEM'; itemId: string; delta: number }
  | { type: 'GRANT_RELIC'; heroId: string; relicId: string }
  | { type: 'SKIP_DRAFT' }
  | { type: 'SPEND_LUCK' }
  | { type: 'GOTO_SCENE'; sceneId: string }
  | { type: 'SET_HP'; hp: Record<string, number> }
  | { type: 'LOG'; entry: string }
  | { type: 'LOAD'; state: GameState }
  | { type: 'RESET' };

function phaseForScene(adventureId: string, sceneId: string): Phase {
  const scene = getAdventureData(adventureId).scenes[sceneId];
  if (!scene) return 'scene';
  if (scene.type === 'combat') return 'combat';
  if (scene.type === 'ending') return 'ending';
  return 'scene';
}

// Full HP for every party member at the given campaign level.
function fullPartyHp(partyIds: string[], difficulty: Difficulty, level: number): Record<string, number> {
  const hp: Record<string, number> = {};
  for (const id of partyIds) {
    const c = characters.find((ch) => ch.id === id);
    if (c) hp[id] = effectiveMaxHp(c, difficulty, level);
  }
  return hp;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return { ...initialState, phase: 'adventure-select' };

    case 'SELECT_ADVENTURE':
      return {
        ...state,
        mode: 'single',
        campaign: undefined,
        phase: 'party-select',
        adventureId: action.adventureId,
        difficulty: action.difficulty,
      };

    case 'START_CAMPAIGN':
      return {
        ...state,
        mode: 'campaign',
        campaign: { order: [...CAMPAIGN_ORDER], index: 0, level: 1 },
        adventureId: CAMPAIGN_ORDER[0],
        difficulty: action.difficulty,
        phase: 'party-select',
      };

    case 'CONFIRM_PARTY': {
      const level = state.campaign?.level ?? 1;
      return {
        ...state,
        phase: 'scene',
        partyIds: action.partyIds,
        hp: fullPartyHp(action.partyIds, state.difficulty, level),
        sceneId: getAdventureData(state.adventureId).startSceneId,
        log: [],
        stats: emptyStats,
        inventory: {},
        relics: {},
        draftsAvailable: 0,
        playerNames: action.playerNames ?? {},
        luck: LUCK_PER_ADVENTURE,
      };
    }

    case 'ADVANCE_CAMPAIGN': {
      if (!state.campaign) return state;
      const index = state.campaign.index + 1;
      if (index >= state.campaign.order.length) return state; // no next adventure
      const level = state.campaign.level + 1;
      const adventureId = state.campaign.order[index];
      return {
        ...state,
        campaign: { ...state.campaign, index, level },
        adventureId,
        hp: fullPartyHp(state.partyIds, state.difficulty, level),
        sceneId: getAdventureData(adventureId).startSceneId,
        log: [],
        phase: 'scene',
        draftsAvailable: state.draftsAvailable + 1,
        luck: LUCK_PER_ADVENTURE,
      };
    }

    case 'GOTO_SCENE': {
      const scene = getAdventureData(state.adventureId).scenes[action.sceneId];
      const base = { ...state, sceneId: action.sceneId, phase: phaseForScene(state.adventureId, action.sceneId) };
      // A safe-room rest scene restores the party on arrival (capped at leveled max).
      if (scene && scene.type === 'story' && scene.rest) {
        const level = state.campaign?.level ?? 1;
        const hp = { ...state.hp };
        for (const id of state.partyIds) {
          const c = characters.find((ch) => ch.id === id);
          if (c) hp[id] = campRestHp(state.hp[id] ?? 0, effectiveMaxHp(c, state.difficulty, level), state.difficulty);
        }
        return { ...base, hp, log: [...state.log, 'You make camp in safety and recover your strength.'], draftsAvailable: state.draftsAvailable + 1, luck: LUCK_PER_ADVENTURE };
      }
      return base;
    }

    case 'RECORD':
      return { ...state, stats: mergeStats(state.stats, action.delta) };

    case 'ADD_ITEM': {
      const n = (state.inventory[action.itemId] ?? 0) + action.delta;
      const inventory = { ...state.inventory };
      if (n > 0) inventory[action.itemId] = n; else delete inventory[action.itemId];
      return { ...state, inventory };
    }

    case 'GRANT_RELIC': {
      const list = [...(state.relics[action.heroId] ?? []), action.relicId];
      return { ...state, relics: { ...state.relics, [action.heroId]: list }, draftsAvailable: Math.max(0, state.draftsAvailable - 1) };
    }

    case 'SKIP_DRAFT':
      return { ...state, draftsAvailable: Math.max(0, state.draftsAvailable - 1) };

    case 'SPEND_LUCK':
      return { ...state, luck: Math.max(0, state.luck - 1) };

    case 'SET_HP':
      return { ...state, hp: { ...state.hp, ...action.hp } };

    case 'LOG':
      return { ...state, log: [...state.log, action.entry] };

    case 'LOAD':
      return action.state;

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}
