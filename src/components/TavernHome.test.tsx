import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TavernHome } from './TavernHome';

describe('TavernHome', () => {
  it('shows the title and a New Game button', () => {
    render(<TavernHome hasSave={false} onNewGame={() => {}} onContinue={() => {}} onHall={() => {}} />);
    expect(screen.getByText('Tavern')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
  });

  it('hides Continue when there is no save', () => {
    render(<TavernHome hasSave={false} onNewGame={() => {}} onContinue={() => {}} onHall={() => {}} />);
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
  });

  it('calls onNewGame when clicked', async () => {
    const onNewGame = vi.fn();
    render(<TavernHome hasSave={true} onNewGame={onNewGame} onContinue={() => {}} onHall={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(onNewGame).toHaveBeenCalled();
  });
});
