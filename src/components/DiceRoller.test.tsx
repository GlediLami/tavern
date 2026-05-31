import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiceRoller } from './DiceRoller';
import type { CheckResult } from '../types';

const success: CheckResult = { roll: 14, modifier: 5, total: 19, dc: 13, success: true, crit: null };

describe('DiceRoller', () => {
  it('shows the roll, modifier, total, DC and outcome', () => {
    render(<DiceRoller heroName="Bjorn Ironhelm" skillLabel="Athletics" result={success} onContinue={() => {}} />);
    expect(screen.getByLabelText(/d20 rolled 14/)).toBeInTheDocument();
    expect(screen.getByText(/DC 13/)).toBeInTheDocument();
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it('continue button fires onContinue', async () => {
    const onContinue = vi.fn();
    render(<DiceRoller heroName="Bjorn Ironhelm" skillLabel="Athletics" result={success} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalled();
  });
});
