import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../HomePage';

vi.mock('../../components/CardPreview', () => ({
  default: () => <div data-testid="card-preview-mock" />,
}));

function renderHome(props: { user?: any } = {}) {
  return render(
    <MemoryRouter>
      <HomePage user={props.user ?? null} />
    </MemoryRouter>
  );
}

afterEach(() => cleanup());

/**
 * Phase 7, spec REQ-008. HomePage "Perché noi" section: 3 cards
 * with concrete differentiators vs web agency / Canva / Looka.
 */

describe('HomePage, Perché noi (Phase 7, spec REQ-008)', () => {
  it('renders the "Perché Quickbrand" H2 section', () => {
    renderHome();
    const h2 = screen.getByRole('heading', { level: 2, name: /Perché Quickbrand/i });
    expect(h2).toBeInTheDocument();
  });

  it('renders 3 differentiator cards in the .hp-why-grid', () => {
    const { container } = renderHome();
    const grid = container.querySelector('.hp-why-grid');
    expect(grid).not.toBeNull();
    const cards = grid?.querySelectorAll('.hp-why-card') ?? [];
    expect(cards.length).toBe(3);
  });

  it('card 1 mentions "web agency" and a 72h vs 2-4 weeks comparison', () => {
    const { container } = renderHome();
    const cards = container.querySelectorAll('.hp-why-card');
    expect(cards[0]?.textContent ?? '').toMatch(/web agency/i);
    expect(cards[0]?.textContent ?? '').toMatch(/72 ore/i);
    expect(cards[0]?.textContent ?? '').toMatch(/2-4 settimane/i);
  });

  it('card 2 mentions Canva and the "tu non fai niente" angle', () => {
    const { container } = renderHome();
    const cards = container.querySelectorAll('.hp-why-card');
    expect(cards[1]?.textContent ?? '').toMatch(/Canva/i);
    expect(cards[1]?.textContent ?? '').toMatch(/non fai niente/i);
  });

  it('card 3 mentions Looka and the "coordinati" angle', () => {
    const { container } = renderHome();
    const cards = container.querySelectorAll('.hp-why-card');
    expect(cards[2]?.textContent ?? '').toMatch(/Looka/i);
    expect(cards[2]?.textContent ?? '').toMatch(/coordinat/i);
  });

  it('uses the .hp-why-section wrapper for background contrast', () => {
    const { container } = renderHome();
    const section = container.querySelector('.hp-why-section');
    expect(section).not.toBeNull();
  });
});
