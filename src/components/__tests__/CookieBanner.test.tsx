import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TestRouter } from '../../test/TestRouter';
import CookieBanner from '../CookieBanner';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('CookieBanner (TB-022)', () => {
  it('renders when no consent stored', () => {
    render(<TestRouter><CookieBanner /></TestRouter>);
    expect(screen.getByRole('region', { name: /consenso cookie/i })).toBeInTheDocument();
    expect(screen.getByText(/Privacy Policy/i)).toBeInTheDocument();
  });

  it('hides after accept and persists consent', () => {
    render(<TestRouter><CookieBanner /></TestRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Accetta' }));
    expect(screen.queryByRole('region', { name: /consenso cookie/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('pq_cookie_consent:v1')).toBe('accepted');
  });

  it('hides after decline and persists consent', () => {
    render(<TestRouter><CookieBanner /></TestRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Rifiuta' }));
    expect(screen.queryByRole('region', { name: /consenso cookie/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('pq_cookie_consent:v1')).toBe('declined');
  });

  it('does not render when consent already stored', () => {
    localStorage.setItem('pq_cookie_consent:v1', 'accepted');
    render(<TestRouter><CookieBanner /></TestRouter>);
    expect(screen.queryByRole('region', { name: /consenso cookie/i })).not.toBeInTheDocument();
  });
});
