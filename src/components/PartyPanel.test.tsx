import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PartyPanel } from './PartyPanel';

describe('PartyPanel', () => {
  it('shows each party member with current/max hp', () => {
    render(<PartyPanel partyIds={['bjorn-ironhelm', 'mara-dawnwarden']} hp={{ 'bjorn-ironhelm': 7, 'mara-dawnwarden': 0 }} difficulty="normal" />);
    expect(screen.getByText('Bjorn Ironhelm')).toBeInTheDocument();
    expect(screen.getByText('7 / 13')).toBeInTheDocument();
    expect(screen.getByText(/down/i)).toBeInTheDocument();
  });
});
