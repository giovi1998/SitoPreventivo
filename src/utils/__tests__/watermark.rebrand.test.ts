import { describe, it, expect } from 'vitest';
import {
  WATERMARK_TEXT,
  WATERMARK_FOOTER,
  applyWatermarkToCanvas,
} from '../watermark';

describe('watermark — Quickbrand rebrand', () => {
  it('WATERMARK_TEXT no longer contains the legacy brand', () => {
    expect(WATERMARK_TEXT.toLowerCase()).not.toContain('precisionquote');
  });

  it('WATERMARK_TEXT is "QUICKBRAND" (all uppercase, watermark convention)', () => {
    expect(WATERMARK_TEXT).toBe('QUICKBRAND');
  });

  it('WATERMARK_FOOTER no longer contains the legacy brand or dead domain', () => {
    expect(WATERMARK_FOOTER.toLowerCase()).not.toContain('precisionquote');
    expect(WATERMARK_FOOTER).not.toMatch(/precisionquote\.vercel\.app/);
  });

  it('WATERMARK_FOOTER mentions Quickbrand', () => {
    expect(WATERMARK_FOOTER).toMatch(/Quickbrand/);
  });

  it('applyWatermarkToCanvas does not throw and uses new WATERMARK_TEXT', () => {
    const ctx = {
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      fillText: () => {},
      text: () => {},
      textAlign: '',
      textBaseline: '',
      font: '',
      fillStyle: '',
      globalAlpha: 1,
    } as any;
    expect(() => applyWatermarkToCanvas(ctx, 'free', 200, 100)).not.toThrow();
  });
});
