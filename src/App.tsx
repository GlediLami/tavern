import { useState } from 'react';
import { GameProvider, useGame } from './state/GameContext';
import { initialState, emptyStats, type GameState } from './state/gameReducer';
import { clearSave } from './engine/save';
import { loadValidatedGame } from './state/persistence';
import { isMuted, setMuted } from './ui/sfx';
import { TavernHome } from './components/TavernHome';
import { HallOfTales } from './components/HallOfTales';
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
  const [showHall, setShowHall] = useState(false);

  switch (state.phase) {
    case 'home':
      if (showHall) return <HallOfTales onBack={() => setShowHall(false)} />;
      return (
        <TavernHome
          hasSave={loadValidatedGame() !== null}
          onNewGame={() => { clearSave(); dispatch({ type: 'START_GAME' }); }}
          onContinue={() => {
            const saved = loadValidatedGame();
            if (saved) dispatch({ type: 'LOAD', state: saved });
          }}
          onHall={() => setShowHall(true)}
        />
      );
    case 'adventure-select':
      return (
        <AdventureSelect
          onSingle={(adventureId, difficulty) => dispatch({ type: 'SELECT_ADVENTURE', adventureId, difficulty })}
          onCampaign={(difficulty) => dispatch({ type: 'START_CAMPAIGN', difficulty })}
        />
      );
    case 'party-select':
      return <PartySelect onConfirm={(ids, playerNames) => dispatch({ type: 'CONFIRM_PARTY', partyIds: ids, playerNames })} />;
    case 'scene':
      return <GameScreen />;
    case 'combat':
      return <CombatView />;
    case 'ending':
      return (
        <EndingScreen
          mode={state.mode}
          adventureId={state.adventureId}
          sceneId={state.sceneId}
          difficulty={state.difficulty}
          level={state.campaign?.level ?? 1}
          stats={state.stats ?? emptyStats}
          campaign={state.campaign}
          onAdvance={() => dispatch({ type: 'ADVANCE_CAMPAIGN' })}
          onReturn={() => { clearSave(); dispatch({ type: 'RESET' }); }}
        />
      );
    default:
      return null;
  }
}

export default function App() {
  // Seed the provider from a save if one exists, so a reload resumes mid-adventure.
  const [initial] = useState<GameState>(() => loadValidatedGame() ?? initialState);
  return (
    <GameProvider initial={initial}>
      <MuteToggle />
      <Screens />
    </GameProvider>
  );
}
