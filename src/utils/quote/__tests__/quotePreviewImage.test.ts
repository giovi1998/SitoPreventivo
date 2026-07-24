import { describe, it, expect } from 'vitest';
import { buildQuotePreviewSvg, renderQuotePreviewImage } from '../quotePreviewImage';
import type { PremiumQuote } from '../../quoteSchema';

const baseQuote = {
  quoteId: 'PRV-2026-001',
  project: { title: 'Sito web', description: 'Desc' },
  client: { name: 'Mario Rossi' },
  options: [
    {
      id: 'opt1',
      label: 'Opzione 1',
      description: 'Base',
      summary: { totalGross: 122 },
    },
  ],
  uiPreferences: { accentColor: '#01696F' },
  createdAt: '2026-07-23T10:00:00.000Z',
} as unknown as PremiumQuote;

describe('buildQuotePreviewSvg', () => {
  it('generates an SVG with title, client and total', () => {
    const svg = buildQuotePreviewSvg(baseQuote);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Sito web');
    expect(svg).toContain('Mario Rossi');
    expect(svg).toContain('Opzione 1');
    expect(svg).toContain('€122,00');
    expect(svg).toContain('Totale');
  });

  it('escapes XML special characters', () => {
    const quote = {
      ...baseQuote,
      project: { title: 'A & B <test>', description: '' },
      client: { name: 'O\'Neil "Quote"' },
    } as unknown as PremiumQuote;
    const svg = buildQuotePreviewSvg(quote);
    expect(svg).toContain('A &amp; B &lt;test&gt;');
    expect(svg).toContain('O&apos;Neil &quot;Quote&quot;');
  });
});

describe('renderQuotePreviewImage', () => {
  it('returns null in jsdom (canvas not available)', async () => {
    const result = await renderQuotePreviewImage(baseQuote);
    expect(result).toBeNull();
  });
});
