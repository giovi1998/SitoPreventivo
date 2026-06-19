import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(<ErrorBoundary><span>Contenuto</span></ErrorBoundary>);
    expect(screen.getByText('Contenuto')).toBeInTheDocument();
  });

  it('catches error and shows fallback', () => {
    const Bomb = () => { throw new Error('Test crash'); };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText('Qualcosa è andato storto')).toBeInTheDocument();
    expect(screen.getByText('Test crash')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('shows reload button on error', () => {
    const Bomb = () => { throw new Error('Boom'); };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText('Ricarica')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
