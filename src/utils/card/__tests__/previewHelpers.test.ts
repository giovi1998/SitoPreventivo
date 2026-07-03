import { describe, it, expect } from 'vitest';
import {
  isGridModeFor,
  gridPlacement,
  clampFontScale,
  qrSizePxFor,
  SIZE_CLASS,
  sideGrid,
} from '../previewHelpers';
import { createEmptyCard, createGiovanniCardTemplate, gridPresetLeft } from '../../documentSchemas';
import type { BusinessCard } from '../../documentSchemas';

describe('previewHelpers', () => {
  describe('isGridModeFor', () => {
    it('returns true only when useGrid and grid elements exist for side', () => {
      const base = createGiovanniCardTemplate();
      expect(isGridModeFor('front', base)).toBe(false); // useGrid false

      const frontGrid: BusinessCard = {
        ...base,
        front: { ...base.front, useGrid: true },
        grid: gridPresetLeft(),
      };
      expect(isGridModeFor('front', frontGrid)).toBe(true);

      const noGrid: BusinessCard = {
        ...base,
        front: { ...base.front, useGrid: true },
        grid: { cols: 4, rows: 4, elements: {} },
      };
      expect(isGridModeFor('front', noGrid)).toBe(false);
    });

    it('respects per-side useGrid independently', () => {
      const base = createGiovanniCardTemplate();
      const onlyBack: BusinessCard = {
        ...base,
        front: { ...base.front, useGrid: false },
        back: { ...base.back, useGrid: true },
      };
      expect(isGridModeFor('front', onlyBack)).toBe(false);
      expect(isGridModeFor('back', onlyBack)).toBe(true);
    });
  });

  describe('gridPlacement', () => {
    it('returns correct gridColumn and gridRow', () => {
      expect(gridPlacement({ x: 0, y: 0, w: 1, h: 1 })).toEqual({
        gridColumn: '1 / span 1',
        gridRow: '1 / span 1',
      });
      expect(gridPlacement({ x: 2, y: 1, w: 2, h: 3 })).toEqual({
        gridColumn: '3 / span 2',
        gridRow: '2 / span 3',
      });
    });

    it('returns undefined for missing element', () => {
      expect(gridPlacement(undefined)).toBeUndefined();
    });
  });

  describe('clampFontScale', () => {
    it('clamps values to [0.7, 1.5]', () => {
      expect(clampFontScale(0.5)).toBe(0.7);
      expect(clampFontScale(2)).toBe(1.5);
      expect(clampFontScale(1)).toBe(1);
      expect(clampFontScale(1.2)).toBe(1.2);
    });

    it('returns 1 for invalid input', () => {
      expect(clampFontScale(NaN)).toBe(1);
      expect(clampFontScale(undefined as any)).toBe(1);
    });
  });

  describe('qrSizePxFor', () => {
    it('returns correct pixel size for each enum', () => {
      const small = { ...createEmptyCard(), back: { ...createEmptyCard().back, qrSize: 'small' as const } };
      expect(qrSizePxFor(small)).toBe(84);
      expect(qrSizePxFor(createEmptyCard())).toBe(120);
      const large = { ...createEmptyCard(), back: { ...createEmptyCard().back, qrSize: 'large' as const } };
      expect(qrSizePxFor(large)).toBe(160);
    });
  });

  describe('sideGrid', () => {
    it('returns front grid for front and backGrid for back', () => {
      const card = createGiovanniCardTemplate();
      expect(sideGrid('front', card)).toBe(card.grid);
      expect(sideGrid('back', card)).toBe(card.backGrid);
    });
  });

  describe('SIZE_CLASS', () => {
    it('maps each preset to expected class name', () => {
      expect(SIZE_CLASS['eu-85x55']).toBe('size-eu-85x55');
      expect(SIZE_CLASS['us-89x51']).toBe('size-us-89x51');
      expect(SIZE_CLASS['square-65x65']).toBe('size-square-65x65');
    });
  });
});
