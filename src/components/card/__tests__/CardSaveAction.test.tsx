import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardSaveAction from '../CardSaveAction';

describe('CardSaveAction', () => {
  it('desktop variant triggers onClick', () => {
    const onClick = vi.fn();
    render(<CardSaveAction variant="desktop" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Salva/i }));
    expect(onClick).toHaveBeenCalled();
  });

  it('mobile variant renders with testid', () => {
    const onClick = vi.fn();
    render(<CardSaveAction variant="mobile" onClick={onClick} />);
    const btn = screen.getByTestId('mobile-save-btn');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('respects disabled state', () => {
    const onClick = vi.fn();
    render(<CardSaveAction variant="desktop" onClick={onClick} disabled />);
    const btn = screen.getByRole('button', { name: /Salva/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows saved state', () => {
    const onClick = vi.fn();
    const { rerender } = render(<CardSaveAction variant="desktop" onClick={onClick} />);
    expect(screen.getByRole('button', { name: /Salva/i })).toBeInTheDocument();
    rerender(<CardSaveAction variant="desktop" onClick={onClick} isSaved />);
    expect(screen.getByRole('button', { name: /Salvato/i })).toBeInTheDocument();
  });
});
