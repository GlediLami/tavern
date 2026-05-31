import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  beforeEach(() => localStorage.clear());

  it('starts on the Tavern home screen', () => {
    render(<App />);
    expect(screen.getByText('Tavern')).toBeInTheDocument();
  });

  it('New Game leads to party select', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(screen.getByText(/who gathers at the table/i)).toBeInTheDocument();
  });

  it('confirming a party reaches the opening scene', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    await userEvent.click(screen.getByText('Bjorn Ironhelm'));
    await userEvent.click(screen.getByRole('button', { name: /enter the tavern/i }));
    expect(screen.getByText(/Sign of the Drowned Lantern/i)).toBeInTheDocument();
  });
});
