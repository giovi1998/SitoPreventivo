import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestRouter } from '../../test/TestRouter';
import AperturaPage from '../AperturaPage';

describe('AperturaPage (TB-017)', () => {
  it('renders the €349 offer with hero and CTA', () => {
    render(<TestRouter><AperturaPage /></TestRouter>);
    expect(screen.getByRole('heading', { name: /Apri la tua attività/i })).toBeInTheDocument();
    expect(screen.getByText(/€349 una tantum/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Richiedi il pacchetto/i).length).toBeGreaterThan(0);
  });

  it('lists the included items', () => {
    render(<TestRouter><AperturaPage /></TestRouter>);
    expect(screen.getByText('Logo')).toBeInTheDocument();
    expect(screen.getByText('250 volantini stampati')).toBeInTheDocument();
    expect(screen.getByText('Sito 1 pagina')).toBeInTheDocument();
  });

  it('shows the 4 steps and FAQ', () => {
    render(<TestRouter><AperturaPage /></TestRouter>);
    expect(screen.getByText('Come funziona')).toBeInTheDocument();
    expect(screen.getByText('Domande frequenti')).toBeInTheDocument();
    expect(screen.getByText(/In quanto tempo consegnate/i)).toBeInTheDocument();
  });

  it('links to privacy policy', () => {
    render(<TestRouter><AperturaPage /></TestRouter>);
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
  });
});
