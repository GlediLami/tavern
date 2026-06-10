import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpOverlay } from './HelpOverlay';

describe('HelpOverlay', () => {
  it('renders the core rules and closes', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    expect(screen.getByText(/How to Play/i)).toBeInTheDocument();
    expect(screen.getByText(/Difficulty Class/i)).toBeInTheDocument();
    expect(screen.getByText(/Advantage & disadvantage/i)).toBeInTheDocument();
    expect(screen.getByText(/saving throw/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
