import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

  it('offers a reroll when luck is available', async () => {
    const onReroll = vi.fn();
    render(<DiceRoller heroName="Bjorn" skillLabel="Athletics" result={success} onContinue={() => {}} onReroll={onReroll} rerollsLeft={2} />);
    const btn = screen.getByRole('button', { name: /reroll/i });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onReroll).toHaveBeenCalled();
  });

  describe('animated roll (motion enabled)', () => {
    afterEach(() => {
      vi.useRealTimers();
      // restore the reduced-motion default from setupTests
      window.matchMedia = (q: string) => ({ matches: /prefers-reduced-motion/.test(q), media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as unknown as MediaQueryList;
    });

    it('settles on the true roll after the cycling animation (no flicker past settle)', () => {
      // Force motion ON so the animation path runs.
      window.matchMedia = (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as unknown as MediaQueryList;
      vi.useFakeTimers();

      render(<DiceRoller heroName="Bjorn" skillLabel="Athletics" result={success} onContinue={() => {}} />);
      // advance well past the settle (820ms) plus any trailing cycle ticks
      act(() => { vi.advanceTimersByTime(3000); });

      // die must show the real roll (14), not a random cycled value
      expect(screen.getByLabelText(/d20 rolled 14/)).toBeInTheDocument();
    });
  });
});
