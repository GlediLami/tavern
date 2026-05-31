import { useState } from 'react';
import { GameProvider, useGame } from './state/GameContext';
import { initialState, type GameState } from './state/gameReducer';
import { loadGame, clearSave } from './engine/save';
import { isMuted, setMuted } from './ui/sfx';
import { TavernHome } from './components/TavernHome';
import { AdventureSelect } from './components/AdventureSelect';
import { PartySelect } from './components/PartySelect';
import { GameScreen } from './components/GameScreen';
import { CombatView } from './components/CombatView';
import { EndingScreen } from './components/EndingScreen';

function MuteToggle() {
  const [muted, setMutedState] = useState<boolean>(isMuted());
  return (
    <button
      className="mute-toggle"
      title={muted ? 'Unmute sound' : 'Mute sound'}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      onClick={() => { const next = !muted; setMuted(next); setMutedState(next); }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

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
    case 'adventure-select':
      return <AdventureSelect onConfirm={(adventureId, difficulty) => dispatch({ type: 'SELECT_ADVENTURE', adventureId, difficulty })} />;
    case 'party-select':
      return <PartySelect onConfirm={(ids) => dispatch({ type: 'CONFIRM_PARTY', partyIds: ids })} />;
    case 'scene':
      return <GameScreen />;
    case 'combat':
      return <CombatView />;
    case 'ending':
      return (
        <EndingScreen
          adventureId={state.adventureId}
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
      <MuteToggle />
      <Screens />
    </GameProvider>
  );
}
