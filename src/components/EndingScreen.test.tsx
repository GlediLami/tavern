import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EndingScreen } from './EndingScreen';

describe('EndingScreen', () => {
  it('single-mode victory shows Return to the Tavern', async () => {
    const onReturn = vi.fn();
    render(<EndingScreen mode="single" adventureId="brackenmoor" sceneId="ending_victory" onReturn={onReturn} onAdvance={() => {}} />);
    expect(screen.getByText(/The Bell That Sleeps/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /return to the tavern/i }));
    expect(onReturn).toHaveBeenCalled();
  });

  it('campaign non-final victory shows an Onward button that advances', async () => {
    const onAdvance = vi.fn();
    render(
      <EndingScreen
        mode="campaign"
        adventureId="snakewater"
        sceneId="ending_victory"
        campaign={{ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 0, level: 1 }}
        onReturn={() => {}}
        onAdvance={onAdvance}
      />,
    );
    const onward = screen.getByRole('button', { name: /onward/i });
    expect(onward).toBeInTheDocument();
    await userEvent.click(onward);
    expect(onAdvance).toHaveBeenCalled();
  });

  it('campaign defeat shows a run summary and Return', () => {
    render(
      <EndingScreen
        mode="campaign"
        adventureId="snakewater"
        sceneId="ending_ford_fall"
        campaign={{ order: ['snakewater', 'chaoticcaves', 'brackenmoor', 'arena'], index: 0, level: 1 }}
        onReturn={() => {}}
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByText(/tales completed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to the tavern/i })).toBeInTheDocument();
  });
});
