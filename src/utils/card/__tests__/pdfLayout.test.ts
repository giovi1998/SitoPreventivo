import { describe, it, expect } from 'vitest';
import { computePageCardEntries, getCardDimensionsMm, SIZE_PRESETS_MM } from '../pdfLayout';
import { createEmptyCard } from '../../documentSchemas';

describe('pdfLayout', () => {
  describe('computePageCardEntries', () => {
    it('returns 10 entries for EU standard card', () => {
      const { entries } = computePageCardEntries(85, 55);
      expect(entries).toHaveLength(10);
    });

    it('returns 10 entries for US standard card', () => {
      const { entries } = computePageCardEntries(89, 51);
      expect(entries).toHaveLength(10);
    });

    it('returns 10 entries for square card', () => {
      const { entries } = computePageCardEntries(65, 65);
      expect(entries).toHaveLength(10);
    });

    it('tiles 5 columns × 2 rows', () => {
      const { entries } = computePageCardEntries(85, 55);
      const xs = new Set(entries.map((e) => e.x));
      const ys = new Set(entries.map((e) => e.y));
      expect(xs.size).toBe(5);
      expect(ys.size).toBe(2);
    });

    it('uses landscape orientation for EU preset', () => {
      const { pageOrientation } = computePageCardEntries(85, 55);
      expect(pageOrientation).toBe('landscape');
    });

    it('keeps all entries within A4 landscape bounds', () => {
      const { entries } = computePageCardEntries(85, 55);
      for (const e of entries) {
        expect(e.x + e.w).toBeLessThanOrEqual(297);
        expect(e.y + e.h).toBeLessThanOrEqual(210);
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.y).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getCardDimensionsMm', () => {
    it('matches documented size presets', () => {
      const card = createEmptyCard();
      expect(getCardDimensionsMm(card)).toEqual(SIZE_PRESETS_MM['eu-85x55']);

      const us = { ...card, style: { ...card.style, sizePreset: 'us-89x51' as const } };
      expect(getCardDimensionsMm(us)).toEqual(SIZE_PRESETS_MM['us-89x51']);

      const square = { ...card, style: { ...card.style, sizePreset: 'square-65x65' as const } };
      expect(getCardDimensionsMm(square)).toEqual(SIZE_PRESETS_MM['square-65x65']);
    });
  });
});
