import { describe, it, expect } from 'vitest';
import {
  parseCardSvg,
  getTextBounds,
  assertInside,
  type ParsedCardSvg,
} from '../../../../e2e/helpers/cardHarness';

describe('parseCardSvg (cardHarness pure helper)', () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 510 300" width="510" height="300">
      <text x="20" y="40" font-size="24" text-anchor="start">Mario Rossi</text>
      <text x="20" y="70" font-size="14" text-anchor="start">Web Developer</text>
      <image href="data:image/png;base64,ABC" x="10" y="80" width="80" height="80" />
      <rect x="400" y="180" width="90" height="90" fill="#FFFFFF" stroke="#01696F" />
    </svg>
  `;

  it('parses viewBox width/height', () => {
    const parsed = parseCardSvg(svg);
    expect(parsed.width).toBe(510);
    expect(parsed.height).toBe(300);
  });

  it('parses text elements with positions and anchors', () => {
    const parsed = parseCardSvg(svg);
    expect(parsed.texts).toHaveLength(2);
    const name = parsed.texts.find((t) => t.text === 'Mario Rossi');
    expect(name).toEqual({ x: 20, y: 40, fontSize: 24, text: 'Mario Rossi', anchor: 'start' });
  });

  it('parses image elements', () => {
    const parsed = parseCardSvg(svg);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]).toEqual({
      x: 10,
      y: 80,
      width: 80,
      height: 80,
      href: 'data:image/png;base64,ABC',
    });
  });

  it('parses QR-like white/stroke rects', () => {
    const parsed = parseCardSvg(svg);
    expect(parsed.qrRects).toHaveLength(1);
    expect(parsed.qrRects[0]).toEqual({ x: 400, y: 180, width: 90, height: 90 });
  });

  it('returns zero bounds when viewBox is missing', () => {
    const parsed = parseCardSvg('<svg><text x="1" y="2" font-size="10">x</text></svg>');
    expect(parsed.width).toBe(0);
    expect(parsed.height).toBe(0);
  });
});

describe('getTextBounds (cardHarness pure helper)', () => {
  const parsed: ParsedCardSvg = {
    width: 100,
    height: 100,
    texts: [{ x: 5, y: 10, fontSize: 12, text: 'Acme srl', anchor: 'start' }],
    images: [],
    qrRects: [],
  };

  it('finds existing text by substring', () => {
    expect(getTextBounds(parsed, 'Acme')).toEqual(parsed.texts[0]);
  });

  it('returns null for missing text', () => {
    expect(getTextBounds(parsed, 'Missing')).toBeNull();
  });
});

describe('assertInside (cardHarness pure helper)', () => {
  it('does not throw for elements inside bounds', () => {
    const bounds = { width: 300, height: 200 };
    const els = [{ x: 10, y: 10, width: 50, height: 20, text: 'ok' }];
    expect(() => assertInside(bounds, els)).not.toThrow();
  });

  it('throws when element overflows right', () => {
    const bounds = { width: 100, height: 100 };
    const els = [{ x: 80, y: 10, width: 30, height: 10, text: 'right' }];
    expect(() => assertInside(bounds, els)).toThrow('overflows right');
  });

  it('throws when element overflows bottom', () => {
    const bounds = { width: 100, height: 100 };
    const els = [{ x: 10, y: 95, width: 10, height: 10, text: 'bottom' }];
    expect(() => assertInside(bounds, els)).toThrow('overflows bottom');
  });

  it('uses fontSize fallback when width/height missing', () => {
    const bounds = { width: 100, height: 100 };
    const els = [{ x: 10, y: 10, fontSize: 12, text: 'font' }];
    expect(() => assertInside(bounds, els)).not.toThrow();
  });
});
