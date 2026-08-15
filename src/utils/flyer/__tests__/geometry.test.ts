import { describe, expect, it } from 'vitest';
import { FLYER_BLEED_MM, FLYER_SIZES, getFlyerDimensions } from '../../documentSchemas';
import { FONT_SIZE_BOUNDS, scaledFontBounds, PRINT_FONT_MIN_PT } from '../geometry';

describe('flyer geometry helpers (TB-007)', () => {
  it('getFlyerDimensions computes correct dimensions for A4 portrait and landscape', () => {
    const portrait = getFlyerDimensions({
      documentType: 'flyer',
      size: 'A4',
      orientation: 'portrait',
    } as any);
    expect(portrait.w).toBe(210);
    expect(portrait.h).toBe(297);

    const landscape = getFlyerDimensions({
      documentType: 'flyer',
      size: 'A4',
      orientation: 'landscape',
    } as any);
    expect(landscape.w).toBe(297);
    expect(landscape.h).toBe(210);
  });

  it('getFlyerDimensions respects FLYER_BLEED_MM constant', () => {
    expect(FLYER_BLEED_MM).toBe(3);
  });

  it('computes correct dimensions for standard A6 and A5 sizes', () => {
    const a6 = getFlyerDimensions({
      documentType: 'flyer',
      size: 'A6',
      orientation: 'portrait',
    } as any);
    expect(a6.w).toBe(105);
    expect(a6.h).toBe(148);

    const a5 = getFlyerDimensions({
      documentType: 'flyer',
      size: 'A5',
      orientation: 'portrait',
    } as any);
    expect(a5.w).toBe(148);
    expect(a5.h).toBe(210);
  });

  it('FONT_SIZE_BOUNDS respects print legibility floors on every size', () => {
    // docs/design-criteria.md: body >= ~10pt, headline >= ~24pt.
    for (const size of FLYER_SIZES) {
      const b = FONT_SIZE_BOUNDS[size];
      expect(b.headline.min, `${size} headline min`).toBeGreaterThanOrEqual(24);
      expect(b.subheadline.min, `${size} subheadline min`).toBeGreaterThanOrEqual(12);
      expect(b.body.min, `${size} body min`).toBeGreaterThanOrEqual(10);
      expect(b.cta.min, `${size} cta min`).toBeGreaterThanOrEqual(10);
      expect(b.headline.max).toBeGreaterThanOrEqual(b.headline.min);
      expect(b.subheadline.max).toBeGreaterThanOrEqual(b.subheadline.min);
      expect(b.body.max).toBeGreaterThanOrEqual(b.body.min);
      expect(b.cta.max).toBeGreaterThanOrEqual(b.cta.min);
    }
  });

  it('A6 maxes stay above the raised minimums', () => {
    const a6 = FONT_SIZE_BOUNDS.A6;
    expect(a6.headline.max).toBe(28);
    expect(a6.subheadline.max).toBe(14);
    expect(a6.body.max).toBe(11);
    expect(a6.cta.max).toBe(11);
  });

  it('scaledFontBounds clamps scaled minimums to the print floors at fontScale 0.7', () => {
    const b = scaledFontBounds('A4', 0.7);
    expect(b.headline.min).toBe(PRINT_FONT_MIN_PT.headline);
    expect(b.subheadline.min).toBe(PRINT_FONT_MIN_PT.subheadline);
    expect(b.body.min).toBe(PRINT_FONT_MIN_PT.body);
    expect(b.cta.min).toBe(PRINT_FONT_MIN_PT.cta);
    // max never drops below the floored min
    for (const size of FLYER_SIZES) {
      const s = scaledFontBounds(size, 0.7);
      expect(s.headline.max).toBeGreaterThanOrEqual(s.headline.min);
      expect(s.body.max).toBeGreaterThanOrEqual(s.body.min);
    }
  });

  it('scaledFontBounds scales minimums up at fontScale 1.5', () => {
    const b = scaledFontBounds('A4', 1.5);
    expect(b.body.min).toBeCloseTo(15, 5);
    expect(b.headline.min).toBeCloseTo(36, 5);
  });

  it('scaledFontBounds defaults to scale 1', () => {
    expect(scaledFontBounds('A5', undefined)).toEqual(FONT_SIZE_BOUNDS.A5);
  });
});
