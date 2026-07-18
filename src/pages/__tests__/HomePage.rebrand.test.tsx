import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TestRouter } from '../../test/TestRouter';
import HomePage from '../HomePage';

vi.mock('../../components/CardPreview', () => ({
  default: () => <div data-testid="card-preview-mock" />,
}));

function renderHome(props: { user?: any } = {}) {
  return render(
    <TestRouter>
      <HomePage user={props.user ?? null} />
    </TestRouter>
  );
}

afterEach(() => cleanup());

function getInlineCss(): string {
  const styleEl = document.querySelector('style');
  return styleEl?.textContent ?? '';
}

describe('HomePage, Quickbrand rebrand', () => {
  // AC-001
  it('does not contain the legacy brand "PrecisionQuote" anywhere in rendered content', () => {
    const { container } = renderHome();
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('precisionquote');
  });

  // AC-007 + REQ-N03
  it('renders the watermark with brand "QUICKBRAND · FREE" (neutral fill, not brand red)', () => {
    const { container } = renderHome();
    const wmText = container.querySelector('.hp-watermark-overlay text');
    expect(wmText?.textContent).toBe('QUICKBRAND · FREE');
    // Watermark is utility, not brand: fill must be neutral (not the red accent)
    expect(wmText?.getAttribute('fill')?.toLowerCase()).not.toBe('#e62020');
  });

  // REQ-N02
  it('footer says "© 2026 Quickbrand · Giovanni Cidu"', () => {
    renderHome();
    expect(screen.getByText(/©\s*2026\s*Quickbrand\s*·\s*Giovanni Cidu/i)).toBeInTheDocument();
  });

  // AC-004 aggiornato Phase 13b/14 (REQ-UX-010 + REQ-AI-008): hero AI-first
  it('H1 is the AI-first headline with accent on "L\'AI costruisce il tuo brand kit."', () => {
    renderHome();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent ?? '').toContain('Descrivi la tua attività.');
    expect(h1.textContent ?? '').toContain("L'AI costruisce il tuo brand kit.");
    const accent = h1.querySelector('.hp-h1-accent');
    expect(accent).not.toBeNull();
    expect(accent?.textContent ?? '').toContain("L'AI costruisce");
  });

  // REQ-M01 aggiornato Phase 13b/14 (AI-first)
  it('hero eyebrow reads "AI brand kit · Pronti per la stampa"', () => {
    renderHome();
    expect(screen.getByText(/AI brand kit\s*·\s*Pronti per la stampa/i)).toBeInTheDocument();
  });

  // REQ-M04
  it('primary CTA for unauthenticated user is "Crea il tuo brand →"', () => {
    renderHome({ user: null });
    // Appears in both hero CTA and final CTA, so check at least one
    const matches = screen.getAllByRole('link', { name: /Crea il tuo brand/i });
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // AC-005 aggiornato Phase 13b/14 (REQ-UX-010): bento 6 strumenti
  it('"Gli strumenti dell\'AI" bento has 6 cards: Biglietti → Logo → Volantini → Social → QR → Preventivi', () => {
    const { container } = renderHome();
    const cards = container.querySelectorAll('.hp-bento .hp-create-item h3');
    expect(cards.length).toBe(6);
    expect(cards[0]?.textContent ?? '').toMatch(/Biglietti da visita AI/i);
    expect(cards[1]?.textContent ?? '').toMatch(/Logo AI/i);
    expect(cards[2]?.textContent ?? '').toMatch(/Volantini AI/i);
    expect(cards[3]?.textContent ?? '').toMatch(/Social AI/i);
    expect(cards[4]?.textContent ?? '').toMatch(/^QR Code$/i);
    expect(cards[5]?.textContent ?? '').toMatch(/Preventivi/i);
  });

  // REQ-UX-010: niente meta-label cheap nella pagina
  it('has no cheap meta-labels ("SECTION 0", "QUESTION 0")', () => {
    const { container } = renderHome();
    expect(container.textContent ?? '').not.toMatch(/SECTION 0/i);
    expect(container.textContent ?? '').not.toMatch(/QUESTION 0/i);
  });

  // REQ-UX-011: sezioni con scroll-reveal
  it('main sections use the reveal class for scroll-reveal motion', () => {
    const { container } = renderHome();
    const revealed = container.querySelectorAll('.hp-section.reveal');
    expect(revealed.length).toBeGreaterThanOrEqual(4);
  });

  // REQ-M08 step 2 mentions collision detection (ora citata anche nel bento)
  it('step 2 of "Come funziona" mentions collision detection', () => {
    renderHome();
    expect(screen.getAllByText(/collision detection/i).length).toBeGreaterThanOrEqual(1);
  });

  // REQ-M08 step 3 mentions PDF 10-up
  it('step 3 of "Come funziona" mentions PDF 10-up', () => {
    renderHome();
    const matches = screen.getAllByText(/PDF 10-up/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // The step 3 paragraph specifically mentions "PDF 10-up A4 con 10 bigliettini"
    expect(screen.getByText(/PDF 10-up A4 con 10 bigliettini/i)).toBeInTheDocument();
  });

  // AC-006
  it('pricing Pro tier is still €9 /mese (unchanged)', () => {
    renderHome();
    const pro = screen.getByText('Pro').closest('.hp-price-card');
    expect(pro?.textContent ?? '').toMatch(/€9/);
    expect(pro?.textContent ?? '').toMatch(/\/mese/);
  });

  // REQ-M10
  it('pricing note compares agency (€2.500-8.000) and 60 secondi anchor', () => {
    renderHome();
    expect(screen.getByText(/€2\.500-8\.000/)).toBeInTheDocument();
    // "60 secondi" appears multiple times (H1, sub, hero-foot, pricing note, final CTA)
    expect(screen.getAllByText(/60 secondi/i).length).toBeGreaterThanOrEqual(3);
  });

  // REQ-M11
  it('final CTA H2 reads "Dall\'idea alla tipografia in 60 secondi."', () => {
    renderHome();
    const finalCta = document.querySelector('.hp-final-cta');
    expect(finalCta?.textContent ?? '').toContain("Dall'idea alla tipografia in 60 secondi.");
  });

  // AC-009 + GUD-M02
  it('does not use exclamation marks in any user-visible copy', () => {
    const { container } = renderHome();
    const text = container.textContent ?? '';
    // strip aria-labels and the flip demo aria-label which contains ":" not "!"
    // and CSS class names containing "!" via "!", we check user-facing text only:
    // use the body of headings, paragraphs, links, buttons
    const userNodes = container.querySelectorAll('h1, h2, h3, p, li, span, a, button');
    for (const node of Array.from(userNodes)) {
      const t = (node.textContent ?? '').trim();
      if (t.length === 0) continue;
      expect(t).not.toMatch(/!/);
    }
  });

  // AC-008 + GUD-C03
  it('inline CSS does not contain legacy blue hex codes', () => {
    renderHome();
    const css = getInlineCss();
    expect(css).not.toMatch(/#0B57D0/i);
    expect(css).not.toMatch(/#4d94ff/i);
    expect(css).not.toMatch(/#4d9/i);
    expect(css).not.toMatch(/#e8f0fe/i);
    expect(css).not.toMatch(/#d2e3fc/i);
  });

  // REQ-C01, light tokens
  it('defines the "The Classic" palette tokens in light mode (--qb-red = #E62020, --qb-ink = #1A1A1A, --qb-paper = #FFFFFF)', () => {
    renderHome();
    const css = getInlineCss();
    expect(css).toMatch(/--qb-red:\s*#E62020/i);
    expect(css).toMatch(/--qb-ink:\s*#1A1A1A/i);
    expect(css).toMatch(/--qb-paper:\s*#FFFFFF/i);
  });

  // REQ-C01, dark tokens
  it('defines the dark-mode palette tokens (--qb-red = #FF3B3B, --qb-paper = #0F1117)', () => {
    renderHome();
    const css = getInlineCss();
    expect(css).toMatch(/\[data-theme="dark"\][\s\S]*?--qb-red:\s*#FF3B3B/i);
    expect(css).toMatch(/\[data-theme="dark"\][\s\S]*?--qb-paper:\s*#0F1117/i);
  });

  // REQ-C06, borders use nero profondo
  it('light-mode card borders reference --qb-border (nero profondo at low alpha)', () => {
    renderHome();
    const css = getInlineCss();
    // The token definition itself or a border rule using it must exist
    expect(css).toMatch(/--qb-border:/i);
    // and at least one .hp-* selector must use it
    expect(css).toMatch(/border[^;]*var\(--qb-border\)/i);
  });

  // REQ-L01
  it('brand mark in the header uses the red token', () => {
    const { container } = renderHome();
    const mark = container.querySelector('.hp-brand svg rect');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('fill')).toMatch(/#E62020/i);
  });
});
