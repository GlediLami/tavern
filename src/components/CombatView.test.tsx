import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameProvider } from '../state/GameContext';
import { CombatView } from './CombatView';
import type { GameState } from '../state/gameReducer';

function renderCombat() {
  const full: GameState = {
    phase: 'combat', adventureId: 'brackenmoor', difficulty: 'normal',
    partyIds: ['gronk-skullsplitter'], hp: { 'gronk-skullsplitter': 14 },
    sceneId: 'ridge_wolves', log: [],
  };
  return render(
    <GameProvider initial={full}>
      <CombatView />
    </GameProvider>,
  );
}

describe('CombatView', () => {
  it('renders the encounter title and enemy names', () => {
    renderCombat();
    expect(screen.getByText(/The Pack Strikes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Wolf/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows the party hero in the initiative/combatant list', () => {
    renderCombat();
    expect(screen.getAllByText(/Gronk Skullsplitter/).length).toBeGreaterThanOrEqual(1);
  });
});
