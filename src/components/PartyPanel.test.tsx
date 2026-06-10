import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PartyPanel } from './PartyPanel';

describe('PartyPanel', () => {
  it('shows each party member with current/max hp', () => {
    render(<PartyPanel partyIds={['bjorn-ironhelm', 'mara-dawnwarden']} hp={{ 'bjorn-ironhelm': 7, 'mara-dawnwarden': 0 }} difficulty="normal" />);
    expect(screen.getByText('Bjorn Ironhelm')).toBeInTheDocument();
    expect(screen.getByText('7 / 13')).toBeInTheDocument();
    expect(screen.getByText(/down/i)).toBeInTheDocument();
  });

  it('expands a card to reveal abilities, AC, attacks, and power', () => {
    render(<PartyPanel partyIds={['mara-dawnwarden']} hp={{ 'mara-dawnwarden': 8 }} difficulty="normal" />);
    expect(screen.queryByText('WIS +3')).toBeNull();        // collapsed by default
    fireEvent.click(screen.getByRole('button', { name: /Mara Dawnwarden/i }));
    expect(screen.getByText('WIS +3')).toBeInTheDocument();
    expect(screen.getByText('AC 18')).toBeInTheDocument();
    expect(screen.getByText(/Sacred Flame 1d8 \(DEX save\)/)).toBeInTheDocument();
    expect(screen.getByText(/Cure Wounds/)).toBeInTheDocument();
  });
});
