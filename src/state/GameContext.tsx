import { createContext, useContext, useEffect, useReducer, type ReactNode, type Dispatch } from 'react';
import { gameReducer, initialState, type GameState, type GameAction } from './gameReducer';
import { saveGame } from '../engine/save';

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children, initial }: { children: ReactNode; initial?: GameState }) {
  const [state, dispatch] = useReducer(gameReducer, initial ?? initialState);

  useEffect(() => {
    // Persist meaningful progress, but skip the home screen (don't clobber a
    // save just by mounting) and skip the transient 'combat' phase — combat
    // state isn't serialized, so a mid-fight reload cleanly resumes at the
    // scene that led into the fight rather than restarting it with full-HP foes.
    if (state.phase !== 'home' && state.phase !== 'combat') saveGame(state);
  }, [state]);

  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
