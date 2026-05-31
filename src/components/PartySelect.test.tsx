import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PartySelect } from './PartySelect';

describe('PartySelect', () => {
  it('renders all 6 heroes', () => {
    render(<PartySelect onConfirm={() => {}} />);
    expect(screen.getByText('Bjorn Ironhelm')).toBeInTheDocument();
    expect(screen.getByText('Gronk Skullsplitter')).toBeInTheDocument();
  });

  it('confirm is disabled until at least one hero is chosen, then calls onConfirm with ids', async () => {
    const onConfirm = vi.fn();
    render(<PartySelect onConfirm={onConfirm} />);
    const confirm = screen.getByRole('button', { name: /enter the tavern/i });
    expect(confirm).toBeDisabled();
    await userEvent.click(screen.getByText('Bjorn Ironhelm'));
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(['bjorn-ironhelm']);
  });

  it('does not allow more than 4 heroes', async () => {
    render(<PartySelect onConfirm={() => {}} />);
    for (const name of ['Bjorn Ironhelm', 'Sable Quickfinger', 'Mara Dawnwarden', 'Alaric Vance', 'Thornwick Greenstride']) {
      await userEvent.click(screen.getByText(name));
    }
    const selectedCount = screen.getAllByText(/✓ in party/i).length;
    expect(selectedCount).toBe(4);
  });
});
