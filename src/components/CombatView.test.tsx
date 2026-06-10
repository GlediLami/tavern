import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameProvider } from '../state/GameContext';
import { CombatView } from './CombatView';
import { emptyStats, type GameState } from '../state/gameReducer';

function renderCombat(overrides: Partial<GameState> = {}) {
  const full: GameState = {
    phase: 'combat', mode: 'single', adventureId: 'brackenmoor', difficulty: 'normal',
    partyIds: ['gronk-skullsplitter'], hp: { 'gronk-skullsplitter': 14 },
    sceneId: 'ridge_wolves', log: [], stats: emptyStats, inventory: {}, relics: {}, draftsAvailable: 0, ...overrides,
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

  it("shows the active hero's power button", () => {
    // Pin RNG high so the lone hero (Gronk) wins initiative and it's his turn,
    // making his "✦ Reckless Strike (2 left)" power button render.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      renderCombat();
      expect(screen.getByText(/left\)/i)).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it('shows a Use Item button and item picker when the stash is stocked', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // Gronk wins initiative
    try {
      renderCombat({ inventory: { 'potion-healing': 2 } });
      const useBtn = screen.getByRole('button', { name: /Use Item \(2\)/i });
      expect(useBtn).toBeInTheDocument();
      fireEvent.click(useBtn);
      expect(screen.getByRole('button', { name: /Potion of Healing ×2/i })).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});
