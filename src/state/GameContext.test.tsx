import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { GameProvider, useGame } from './GameContext';
import { loadGame, SAVE_KEY } from '../engine/save';

function Probe() {
  const { state, dispatch } = useGame();
  return (
    <div>
      <span data-testid="phase">{state.phase}</span>
      <button onClick={() => dispatch({ type: 'START_GAME' })}>start</button>
    </div>
  );
}

describe('GameContext', () => {
  beforeEach(() => localStorage.clear());

  it('provides state and dispatch, and persists on change', () => {
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(screen.getByTestId('phase').textContent).toBe('home');
    act(() => {
      screen.getByText('start').click();
    });
    expect(screen.getByTestId('phase').textContent).toBe('party-select');
    const saved = loadGame<{ phase: string }>();
    expect(saved?.phase).toBe('party-select');
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
  });
});
