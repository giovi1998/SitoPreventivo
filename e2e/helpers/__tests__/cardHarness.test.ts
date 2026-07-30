import { describe, it, expect } from 'vitest';
import { parseCardSvg, getTextBounds, assertInside } from '../cardHarness';

describe('parseCardSvg (TB-010 robustness)', () => {
  it('parses SVG with standard attribute ordering', () => {
    const svg = `
      <svg viewBox="0 0 1050 600" xmlns="http://www.w3.org/2000/svg">
        <text x="100" y="200" font-size="24" text-anchor="middle">Mario Rossi</text>
        <image href="data:image/png;base64,123" x="10" y="20" width="100" height="100" />
        <rect x="50" y="50" width="80" height="80" fill="#FFFFFF" stroke="#01696F" />
      </svg>
    `;
    const parsed = parseCardSvg(svg);
    expect(parsed.width).toBe(1050);
    expect(parsed.height).toBe(600);
    expect(parsed.texts).toHaveLength(1);
    expect(parsed.texts[0]).toEqual({
      x: 100,
      y: 200,
      fontSize: 24,
      text: 'Mario Rossi',
      anchor: 'middle',
    });
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0].href).toBe('data:image/png;base64,123');
    expect(parsed.qrRects).toHaveLength(1);
  });

  it('parses SVG with different attribute ordering and tspan tags', () => {
    const svg = `
      <svg viewBox="0 0 1050 600">
        <text font-size="32" text-anchor="start" y="150" x="80">
          <tspan x="80" dy="0">Giovanni Cidu</tspan>
        </text>
        <image x="500" y="100" height="200" width="200" href="https://example.com/logo.png" />
      </svg>
    `;
    const parsed = parseCardSvg(svg);
    expect(parsed.texts).toHaveLength(1);
    expect(parsed.texts[0].text).toBe('Giovanni Cidu');
    expect(parsed.texts[0].x).toBe(80);
    expect(parsed.texts[0].y).toBe(150);
    expect(parsed.texts[0].fontSize).toBe(32);
    expect(parsed.texts[0].anchor).toBe('start');

    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0].x).toBe(500);
    expect(parsed.images[0].y).toBe(100);
    expect(parsed.images[0].width).toBe(200);
    expect(parsed.images[0].height).toBe(200);
  });

  it('getTextBounds returns correct node for text search', () => {
    const svg = `
      <svg viewBox="0 0 1050 600">
        <text x="50" y="50" font-size="16">Web Developer</text>
        <text x="50" y="100" font-size="20">Acme Corp</text>
      </svg>
    `;
    const parsed = parseCardSvg(svg);
    const bounds = getTextBounds(parsed, 'Developer');
    expect(bounds).not.toBeNull();
    expect(bounds?.text).toBe('Web Developer');
  });

  it('assertInside passes when elements are within bounds', () => {
    const bounds = { width: 1050, height: 600 };
    const elements = [
      { x: 10, y: 10, width: 100, height: 50 },
      { x: 900, y: 500, fontSize: 20 },
    ];
    expect(() => assertInside(bounds, elements)).not.toThrow();
  });
});
