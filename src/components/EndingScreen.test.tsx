import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EndingScreen } from './EndingScreen';
import { emptyStats } from '../state/gameReducer';

const stats = { ...emptyStats, encountersWon: 2, crits: 1, biggestHit: 12, damageByHero: { 'gronk-skullsplitter': 30 } };

describe('EndingScreen', () => {
  beforeEach(() => localStorage.clear());

  it('single-mode victory shows the run summary and a Share button', async () => {
    const onReturn = vi.fn();
    render(<EndingScreen mode="single" adventureId="brackenmoor" sceneId="ending_victory" difficulty="normal" level={1} stats={stats} onReturn={onReturn} onAdvance={() => {}} />);
    expect(screen.getByText(/The Bell That Sleeps/i)).toBeInTheDocument();
    expect(screen.getByText(/MVP/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /return to the tavern/i }));
    expect(onReturn).toHaveBeenCalled();
  });

  it('an advancing campaign victory hides the run summary (shows level-up instead)', () => {
    render(
      <EndingScreen
        mode="campaign" adventureId="snakewater" sceneId="ending_victory" difficulty="normal" level={1} stats={stats}
        campaign={{ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 0, level: 1 }}
        onReturn={() => {}} onAdvance={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /onward/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull();
  });
});
