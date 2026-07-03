import { describe, it, expect } from 'vitest';
import { buildCardSvg, buildFrontSvg, buildBackSvg } from '../svgRenderer';
import { createEmptyCard, createGiovanniCardTemplate } from '../../documentSchemas';

describe('svgRenderer', () => {
  describe('font-size attributes', () => {
    it('does not include pt/mm/px units in font-size attributes', () => {
      const card = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, name: 'MARIO ROSSI', title: 'CEO', company: 'Acme' },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      const fontSizeMatches = svg.match(/font-size="([^"]+)"/g) || [];
      expect(fontSizeMatches.length).toBeGreaterThan(0);
      for (const m of fontSizeMatches) {
        const value = m.replace(/font-size="/, '').replace(/"$/, '');
        expect(value).not.toMatch(/pt$/i);
        expect(value).not.toMatch(/mm$/i);
        expect(value).not.toMatch(/px$/i);
        expect(Number(value)).not.toBeNaN();
      }
    });
  });

  describe('logo rendering', () => {
    it('includes logo image in centered layout when photo+logo are set', () => {
      const card = {
        ...createEmptyCard(),
        front: {
          ...createEmptyCard().front,
          name: 'MARIO',
          photoUrl: 'data:image/png;base64,PHOTO',
          logoUrl: 'data:image/png;base64,LOGO',
          layout: 'centered' as const,
        },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      expect(svg).toContain('data:image/png;base64,LOGO');
      expect((svg.match(/<image /g) || []).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('hostname deduplication', () => {
    it('does not duplicate hostname on front when QR is present on back', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, website: 'https://webdeveloperca.netlify.app' },
        front: { ...createEmptyCard().front, photoUrl: 'data:image/png;base64,PHOTO', layout: 'left' as const },
      };
      const svg = buildFrontSvg(card, 1024, 663);
      expect(svg).not.toContain('webdeveloperca.netlify.app');
    });
  });

  describe('buildCardSvg wrapper', () => {
    it('produces valid SVG wrapper for front', () => {
      const svg = buildCardSvg(createEmptyCard(), 'front', 500, 300);
      expect(svg).toMatch(/^<svg[^>]*>/);
      expect(svg).toMatch(/<\/svg>$/);
      expect(svg).toContain('viewBox="0 0 500 300"');
    });

    it('produces valid SVG wrapper for back with website', () => {
      const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'https://example.com' } };
      const svg = buildCardSvg(card, 'back', 500, 300);
      expect(svg).toContain('CONTATTI');
      expect(svg).toContain('example.com');
    });
  });
});
