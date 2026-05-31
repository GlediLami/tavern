import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EndingScreen } from './EndingScreen';

describe('EndingScreen', () => {
  it('renders a victory ending and a return button', async () => {
    const onReturn = vi.fn();
    render(<EndingScreen sceneId="ending_victory" onReturn={onReturn} />);
    expect(screen.getByText(/The Bell That Sleeps/i)).toBeInTheDocument();
    expect(screen.getByText(/victory/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /return to the tavern/i }));
    expect(onReturn).toHaveBeenCalled();
  });

  it('renders a defeat ending', () => {
    render(<EndingScreen sceneId="ending_pack" onReturn={() => {}} />);
    expect(screen.getByText(/Ridge Wolves Feast/i)).toBeInTheDocument();
    expect(screen.getByText(/defeat/i)).toBeInTheDocument();
  });
});
