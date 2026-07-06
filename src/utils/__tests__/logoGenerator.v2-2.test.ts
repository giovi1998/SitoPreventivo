import { describe, it, expect } from 'vitest';
import { builderToSvg, fitText, estimateTextWidth } from '../logoGenerator';
import type { LogoBuilder } from '../documentSchemas';

const baseBuilder: LogoBuilder = {
  primaryText: 'Acme',
  tagline: 'Solutions',
  iconType: 'none',
  iconGlyph: '',
  iconShape: 'circle',
  primaryColor: '#01696F',
  secondaryColor: '#1a1a2e',
  fontFamily: 'Inter',
  layout: 'horizontal',
  icons: [],
  backgroundImage: null,
  backgroundColor: null,
  gradientFill: false,
  decorativeElements: [],
  imagePrompt: null,
};

describe('logoGenerator v2.2', () => {
  describe('auto-fit', () => {
    it('keeps default viewBox for short text', () => {
      const svg = builderToSvg(baseBuilder);
      expect(svg).toContain('viewBox="0 0 400 160"');
    });

    it('expands viewBox for long primaryText (Pedagogista Susanna)', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryText: 'Pedagogista Susanna' });
      // viewBox width should be > 400
      const match = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
      expect(match).toBeTruthy();
      expect(Number(match![1])).toBeGreaterThan(400);
    });

    it('clamps viewBox width near 800 for very long text', () => {
      const svg = builderToSvg({ ...baseBuilder, primaryText: 'Supercalifragilistichespiralidoso Studio' });
      const match = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
      expect(match).toBeTruthy();
      expect(Number(match![1])).toBeGreaterThanOrEqual(790);
      expect(Number(match![1])).toBeLessThanOrEqual(800);
    });

    it('fitText returns startSize for short text', () => {
      expect(fitText('Acme', 300)).toBe(36);
    });

    it('fitText shrinks for long text', () => {
      expect(fitText('Pedagogista Susanna', 300)).toBeLessThan(36);
      expect(fitText('Pedagogista Susanna', 300)).toBeGreaterThanOrEqual(14);
    });

    it('estimateTextWidth scales with font size', () => {
      expect(estimateTextWidth('Acme', 36)).toBe(Math.round(4 * 36 * 0.55));
    });
  });

  describe('decorations', () => {
    it('renders underline for decorativeElements=[underline]', () => {
      const svg = builderToSvg({ ...baseBuilder, decorativeElements: ['underline'] });
      expect(svg).toContain('<line');
      expect(svg).toContain('stroke="#01696F"');
    });

    it('renders dotRing with 8 circles', () => {
      const svg = builderToSvg({ ...baseBuilder, iconType: 'shape', decorativeElements: ['dotRing'] });
      const circles = svg.match(/<circle/g) || [];
      // 1 shape circle + 8 dot ring circles
      expect(circles.length).toBeGreaterThanOrEqual(8);
    });

    it('renders topAccent as a rect near the top', () => {
      const svg = builderToSvg({ ...baseBuilder, decorativeElements: ['topAccent'] });
      expect(svg).toContain('y="4"');
      expect(svg).toContain('height="4"');
    });
  });

  describe('gradient', () => {
    it('renders gradient defs when gradientFill=true', () => {
      const svg = builderToSvg({ ...baseBuilder, gradientFill: true });
      expect(svg).toContain('<linearGradient id="textGrad"');
      expect(svg).toContain('fill="url(#textGrad)"');
    });
  });

  describe('backgroundColor', () => {
    it('renders solid background rect when backgroundColor set', () => {
      const svg = builderToSvg({ ...baseBuilder, backgroundColor: '#FFFFFF' });
      expect(svg).toContain('<rect width="400" height="160" fill="#FFFFFF"/>');
    });

    it('renders backgroundColor rect before backgroundImage (z-order)', () => {
      const bg = 'data:image/png;base64,ABC';
      const svg = builderToSvg({ ...baseBuilder, backgroundImage: bg, backgroundColor: '#F5F5F4' });
      const rectIdx = svg.indexOf('fill="#F5F5F4"');
      const imgIdx = svg.indexOf('<image');
      expect(rectIdx).toBeGreaterThan(-1);
      expect(imgIdx).toBeGreaterThan(rectIdx);
    });
  });
});
