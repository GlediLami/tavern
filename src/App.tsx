import { useState } from 'react';
import { GameProvider, useGame } from './state/GameContext';
import { initialState, type GameState } from './state/gameReducer';
import { loadGame, clearSave } from './engine/save';
import { TavernHome } from './components/TavernHome';
import { PartySelect } from './components/PartySelect';
import { GameScreen } from './components/GameScreen';
import { CombatView } from './components/CombatView';
import { EndingScreen } from './components/EndingScreen';

function Screens() {
  const { state, dispatch } = useGame();

  switch (state.phase) {
    case 'home':
      return (
        <TavernHome
          hasSave={loadGame<GameState>() !== null}
          onNewGame={() => { clearSave(); dispatch({ type: 'START_GAME' }); }}
          onContinue={() => {
            const saved = loadGame<GameState>();
            if (saved) dispatch({ type: 'LOAD', state: saved });
          }}
        />
      );
    case 'party-select':
      return <PartySelect onConfirm={(ids) => dispatch({ type: 'CONFIRM_PARTY', partyIds: ids })} />;
    case 'scene':
      return <GameScreen />;
    case 'combat':
      return <CombatView />;
    case 'ending':
      return (
        <EndingScreen
          sceneId={state.sceneId}
          onReturn={() => { clearSave(); dispatch({ type: 'RESET' }); }}
        />
      );
    default:
      return null;
  }
}

export default function App() {
  // Seed the provider from a save if one exists, so a reload resumes mid-adventure.
  const [initial] = useState<GameState>(() => loadGame<GameState>() ?? initialState);
  return (
    <GameProvider initial={initial}>
      <Screens />
    </GameProvider>
  );
}
