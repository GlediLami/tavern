import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CombatDice } from './CombatDice';
import type { AttackEvent } from '../types';

const base: AttackEvent = {
  kind: 'attack', attackerName: 'Mara', targetName: 'Goblin', actionName: 'Sacred Flame',
  targetId: 'enemy-0', d20: 9, toHit: 1, ac: 13, hit: true, crit: false,
  save: 'dex', saveDC: 13, damageDice: '1d8', damageRolls: [5], damageBonus: 0, amount: 5,
};

describe('CombatDice', () => {
  it('renders a saving-throw line for save spells', () => {
    render(<CombatDice event={base} />);
    expect(screen.getByText(/DEX save/i)).toBeInTheDocument();
    expect(screen.getByText(/FAILED/)).toBeInTheDocument();
  });

  it('shows SAVED and no damage when the target saves', () => {
    render(<CombatDice event={{ ...base, hit: false, amount: 0, damageRolls: [] }} />);
    expect(screen.getByText(/SAVED/)).toBeInTheDocument();
  });
});
