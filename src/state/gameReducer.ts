import charactersData from '../content/characters.json';
import adventureData from '../content/adventure.json';
import type { Character, Adventure } from '../types';

const characters = charactersData as unknown as Character[];
const adventure = adventureData as unknown as Adventure;

export type Phase = 'home' | 'party-select' | 'scene' | 'combat' | 'ending';

export interface GameState {
  phase: Phase;
  partyIds: string[];
  hp: Record<string, number>;   // heroId -> current hp
  sceneId: string;
  log: string[];                // narration / roll history
}

export const initialState: GameState = {
  phase: 'home',
  partyIds: [],
  hp: {},
  sceneId: adventure.startSceneId,
  log: [],
};

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'CONFIRM_PARTY'; partyIds: string[] }
  | { type: 'GOTO_SCENE'; sceneId: string }
  | { type: 'SET_HP'; hp: Record<string, number> }
  | { type: 'LOG'; entry: string }
  | { type: 'LOAD'; state: GameState }
  | { type: 'RESET' };

function phaseForScene(sceneId: string): Phase {
  const scene = adventure.scenes[sceneId];
  if (!scene) return 'scene';
  if (scene.type === 'combat') return 'combat';
  if (scene.type === 'ending') return 'ending';
  return 'scene';
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return { ...initialState, phase: 'party-select' };

    case 'CONFIRM_PARTY': {
      const hp: Record<string, number> = {};
      for (const id of action.partyIds) {
        const c = characters.find((ch) => ch.id === id);
        if (c) hp[id] = c.maxHp;
      }
      return {
        ...state,
        phase: 'scene',
        partyIds: action.partyIds,
        hp,
        sceneId: adventure.startSceneId,
        log: [],
      };
    }

    case 'GOTO_SCENE':
      return { ...state, sceneId: action.sceneId, phase: phaseForScene(action.sceneId) };

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
