import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HallOfTales } from './HallOfTales';
import { recordEnding } from '../state/chronicle';

describe('HallOfTales', () => {
  beforeEach(() => localStorage.clear());

  it('shows discovered ending titles and hides undiscovered ones', () => {
    recordEnding('brackenmoor', 'ending_victory');
    render(<HallOfTales onBack={() => {}} />);
    expect(screen.getByText(/The Bell That Sleeps/i)).toBeInTheDocument();
    expect(screen.getAllByText('— ???').length).toBeGreaterThan(0);
  });
});
