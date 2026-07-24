import { describe, expect, it } from 'vitest';
import { FLYER_BLEED_MM, getFlyerDimensions } from '../../documentSchemas';

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
});
