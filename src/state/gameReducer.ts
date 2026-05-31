import charactersData from '../content/characters.json';
import { getAdventureData, DEFAULT_ADVENTURE_ID } from '../content/adventures';
import { effectiveMaxHp, campRestHp } from '../engine/difficulty';
import type { Character, Difficulty } from '../types';

const characters = charactersData as unknown as Character[];

export type Phase = 'home' | 'adventure-select' | 'party-select' | 'scene' | 'combat' | 'ending';

export interface GameState {
  phase: Phase;
  adventureId: string;
  difficulty: Difficulty;
  partyIds: string[];
  hp: Record<string, number>;   // heroId -> current hp
  sceneId: string;
  log: string[];                // narration / roll history
}

export const initialState: GameState = {
  phase: 'home',
  adventureId: DEFAULT_ADVENTURE_ID,
  difficulty: 'normal',
  partyIds: [],
  hp: {},
  sceneId: getAdventureData(DEFAULT_ADVENTURE_ID).startSceneId,
  log: [],
};

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'SELECT_ADVENTURE'; adventureId: string; difficulty: Difficulty }
  | { type: 'CONFIRM_PARTY'; partyIds: string[] }
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

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return { ...initialState, phase: 'adventure-select' };

    case 'SELECT_ADVENTURE':
      return {
        ...state,
        phase: 'party-select',
        adventureId: action.adventureId,
        difficulty: action.difficulty,
      };

    case 'CONFIRM_PARTY': {
      const hp: Record<string, number> = {};
      for (const id of action.partyIds) {
        const c = characters.find((ch) => ch.id === id);
        if (c) hp[id] = effectiveMaxHp(c, state.difficulty);
      }
      return {
        ...state,
        phase: 'scene',
        partyIds: action.partyIds,
        hp,
        sceneId: getAdventureData(state.adventureId).startSceneId,
        log: [],
      };
    }

    case 'GOTO_SCENE': {
      const scene = getAdventureData(state.adventureId).scenes[action.sceneId];
      const base = { ...state, sceneId: action.sceneId, phase: phaseForScene(state.adventureId, action.sceneId) };
      // A safe-room rest scene restores the party on arrival.
      if (scene && scene.type === 'story' && scene.rest) {
        const hp = { ...state.hp };
        for (const id of state.partyIds) {
          const c = characters.find((ch) => ch.id === id);
          if (c) hp[id] = campRestHp(state.hp[id] ?? 0, effectiveMaxHp(c, state.difficulty), state.difficulty);
        }
        return { ...base, hp, log: [...state.log, 'You make camp in safety and recover your strength.'] };
      }
      return base;
    }

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
