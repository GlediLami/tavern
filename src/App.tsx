import { useState } from 'react';
import { GameProvider, useGame } from './state/GameContext';
import { initialState, emptyStats, type GameState } from './state/gameReducer';
import { clearSave } from './engine/save';
import { loadValidatedGame } from './state/persistence';
import { isMuted, setMuted } from './ui/sfx';
import { isHandoffOn, setHandoffOn } from './ui/handoff';
import { HelpOverlay } from './components/HelpOverlay';
import { TavernHome } from './components/TavernHome';
import { HallOfTales } from './components/HallOfTales';
import { AdventureSelect } from './components/AdventureSelect';
import { PartySelect } from './components/PartySelect';
import { GameScreen } from './components/GameScreen';
import { CombatView } from './components/CombatView';
import { EndingScreen } from './components/EndingScreen';

function TopControls() {
  const [muted, setMutedState] = useState<boolean>(isMuted());
  const [handoff, setHandoffState] = useState<boolean>(isHandoffOn());
  const [showHelp, setShowHelp] = useState(false);
  return (
    <>
      <div className="top-controls">
        <button
          className={`top-control${handoff ? ' on' : ''}`}
          title={handoff ? 'Pass-the-device handoff on' : 'Pass-the-device handoff off'}
          aria-label="Toggle pass-the-device handoff"
          onClick={() => { const next = !handoff; setHandoffOn(next); setHandoffState(next); }}
        >🤝</button>
        <button
          className="top-control"
          title={muted ? 'Unmute sound' : 'Mute sound'}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          onClick={() => { const next = !muted; setMuted(next); setMutedState(next); }}
        >{muted ? '🔇' : '🔊'}</button>
        <button className="top-control" title="How to play" aria-label="How to play" onClick={() => setShowHelp(true)}>?</button>
      </div>
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </>
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
          flags={state.flags}
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
      <TopControls />
      <Screens />
    </GameProvider>
  );
}
