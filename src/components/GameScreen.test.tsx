import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameProvider } from '../state/GameContext';
import { GameScreen } from './GameScreen';
import { emptyStats, type GameState } from '../state/gameReducer';

function renderAt(state: Partial<GameState>) {
  const full: GameState = {
    phase: 'scene', mode: 'single', adventureId: 'brackenmoor', difficulty: 'normal',
    partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 },
    sceneId: 'tavern_start', log: [], stats: emptyStats, inventory: {}, relics: {}, draftsAvailable: 0, playerNames: {}, ...state,
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

  it('a pending draft grants a relic to a chosen hero', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // deterministic trio (registry order)
    try {
      renderAt({ draftsAvailable: 1, partyIds: ['bjorn-ironhelm'], hp: { 'bjorn-ironhelm': 13 } });
      expect(screen.getByText(/Choose a Boon/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Ironhide Charm/i }));
      const give = screen.getAllByRole('button', { name: /Bjorn Ironhelm/i }).find((b) => !/Fighter/.test(b.textContent ?? ''));
      fireEvent.click(give!);
      expect(screen.queryByText(/Choose a Boon/i)).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('shows the Satchel with carried items', () => {
    renderAt({ inventory: { 'potion-healing': 2 } });
    expect(screen.getByText(/Satchel/i)).toBeInTheDocument();
    expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
  });

  it('a check choice prompts for who attempts it', async () => {
    renderAt({ sceneId: 'tavern_start' });
    await userEvent.click(screen.getByRole('button', { name: /muttering locals/i }));
    expect(await screen.findByText(/who attempts/i)).toBeInTheDocument();
    // Two buttons carry the hero name now: the party-sheet toggle (which also shows
    // the class) and the check-attempt button. Pick the attempt button specifically.
    const attempt = screen
      .getAllByRole('button', { name: /Bjorn Ironhelm/ })
      .find((b) => !/Fighter/.test(b.textContent ?? ''));
    expect(attempt).toBeDefined();
  });
});
