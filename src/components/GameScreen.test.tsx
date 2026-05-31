import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameProvider } from '../state/GameContext';
import { GameScreen } from './GameScreen';
import { emptyStats, type GameState } from '../state/gameReducer';

function renderAt(state: Partial<GameState>) {
  const full: GameState = {
    phase: 'scene', mode: 'single', adventureId: 'brackenmoor', difficulty: 'normal',
    partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 },
    sceneId: 'tavern_start', log: [], stats: emptyStats, ...state,
  } as GameState;
  return render(
    <GameProvider initial={full}>
      <GameScreen />
    </GameProvider>,
  );
}

describe('GameScreen', () => {
  it('renders the current scene narration and choices', () => {
    renderAt({ sceneId: 'route_choice' });
    expect(screen.getByText(/the road splits/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /marsh path/i })).toBeInTheDocument();
  });

  it('a no-check choice advances the scene immediately', async () => {
    renderAt({ sceneId: 'route_choice' });
    await userEvent.click(screen.getByRole('button', { name: /marsh path/i }));
    expect(await screen.findByText(/marsh path is a ribbon of mud/i)).toBeInTheDocument();
  });

  it('a check choice prompts for who attempts it', async () => {
    renderAt({ sceneId: 'tavern_start' });
    await userEvent.click(screen.getByRole('button', { name: /muttering locals/i }));
    expect(await screen.findByText(/who attempts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bjorn Ironhelm/ })).toBeInTheDocument();
  });
});
