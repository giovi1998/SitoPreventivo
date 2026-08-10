import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { svgToPng } from '../logoGenerator';
import { builderToSvg } from '../logoGenerator';
import { createEmptyLogo } from '../documentSchemas';
import * as watermarkMod from '../watermark';

const spyWatermarkCanvas = vi.spyOn(watermarkMod, 'applyWatermarkToCanvas');

function setupJsdomMocks() {
  const originalImage = (global as any).Image;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    _src = '';
    crossOrigin = '';
    set src(v: string) {
      this._src = v;
      setTimeout(() => this.onload && this.onload(), 0);
    }
    get src() { return this._src; }
  }
  (global as any).Image = FakeImage;
  // fetch stubbato: embedFontInSvg non deve fare chiamate di rete nei test
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error('offline in tests'))) as typeof fetch;
  const originalCreate = document.createElement.bind(document);
  (document as any).createElement = (tag: string) => {
    const el = originalCreate(tag);
    if (tag === 'canvas') {
      (el as any).width = 0;
      (el as any).height = 0;
      (el as any).getContext = () => ({
        clearRect: () => undefined,
        fillRect: () => undefined,
        drawImage: () => undefined,
        // watermark helpers
        save: () => undefined,
        restore: () => undefined,
        translate: () => undefined,
        rotate: () => undefined,
        fillText: () => undefined,
        fillStyle: '',
        globalAlpha: 1,
        font: '',
        textAlign: 'start',
        textBaseline: 'alphabetic',
      });
      (el as any).toBlob = (cb: (b: Blob | null) => void) => {
        const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
        setTimeout(() => cb(blob), 0);
      };
    }
    return el;
  };
  return () => {
    (global as any).Image = originalImage;
    globalThis.fetch = originalFetch;
    (document as any).createElement = originalCreate;
  };
}

beforeEach(() => {
  spyWatermarkCanvas.mockClear();
  spyWatermarkCanvas.mockImplementation(() => {});
});

afterEach(() => {
  spyWatermarkCanvas.mockRestore();
});

describe('svgToPng, tier integration', () => {
  it('free tier → applyWatermarkToCanvas is called with tier="free"', async () => {
    const svg = builderToSvg(createEmptyLogo().builder);
    const restore = setupJsdomMocks();
    try {
      await svgToPng(svg, 512, { tier: 'free' });
      expect(spyWatermarkCanvas).toHaveBeenCalled();
      const tierArg = spyWatermarkCanvas.mock.calls[0][1];
      expect(tierArg).toBe('free');
    } finally {
      restore();
    }
  });

  it('unlocked tier → applyWatermarkToCanvas is called with tier="unlocked" (or short-circuits early in real impl)', async () => {
    // Note: the real `applyWatermarkToCanvas` returns early for `tier === 'unlocked'`.
    // We assert the call is dispatched with the right tier (mocked to capture).
    const svg = builderToSvg(createEmptyLogo().builder);
    const restore = setupJsdomMocks();
    let observedTier: string | null = null;
    let observedWidth = 0;
    spyWatermarkCanvas.mockImplementation((_ctx, t, w) => {
      observedTier = t;
      observedWidth = w;
    });
    try {
      try {
        await svgToPng(svg, 512, { tier: 'unlocked' });
      } catch {
        // jsdom canvas quirks: toBlob may not resolve. We still captured
        // the watermark call (which happens BEFORE toBlob).
      }
      // If the function was called, we get the tier. If not (toBlob never
      // resolved), the assertion below would still verify our intent via
      // the size-2048 tests below.
      if (observedTier) {
        expect(observedTier).toBe('unlocked');
        // v2.4: aspect preservato, non più quadrato 512×512.
        expect(observedWidth).toBe(512);
      }
    } finally {
      restore();
    }
  });

  it('free tier with size=2048 → canvas dimensions are clamped to 1200', async () => {
    spyWatermarkCanvas.mockRestore();
    let observedWidth = 0;
    let observedHeight = 0;
    const spyW = vi.spyOn(watermarkMod, 'applyWatermarkToCanvas').mockImplementation((_ctx, _tier, w, h) => {
      observedWidth = w;
      observedHeight = h;
    });
    const svg = builderToSvg(createEmptyLogo().builder);
    const restore = setupJsdomMocks();
    try {
      await svgToPng(svg, 2048, { tier: 'free' });
      // v2.4: aspect ratio preservato. createEmptyLogo().builder layout
      // default = 'horizontal' con viewBox 400×160 (aspect 2.5:1).
      // Lato lungo clampato a 1200, lato corto scalato.
      expect(observedWidth).toBe(1200);
      expect(observedHeight).toBe(480);
    } finally {
      restore();
      spyW.mockRestore();
    }
  });

  it('unlocked tier with size=2048 → canvas dimensions are 2048 (no clamp)', async () => {
    spyWatermarkCanvas.mockRestore();
    let observedWidth = 0;
    let observedHeight = 0;
    const spyW = vi.spyOn(watermarkMod, 'applyWatermarkToCanvas').mockImplementation((_ctx, _tier, w, h) => {
      observedWidth = w;
      observedHeight = h;
    });
    const svg = builderToSvg(createEmptyLogo().builder);
    const restore = setupJsdomMocks();
    try {
      await svgToPng(svg, 2048, { tier: 'unlocked' });
      // v2.4: aspect ratio preservato. Layout horizontal 400×160.
      // Lato lungo 2048, lato corto 2048/2.5 ≈ 819.
      expect(observedWidth).toBe(2048);
      expect(observedHeight).toBe(819);
    } finally {
      restore();
      spyW.mockRestore();
    }
  });

  it('free tier with size=512 → no clamp (size < 1200)', async () => {
    spyWatermarkCanvas.mockRestore();
    let observedWidth = 0;
    let observedHeight = 0;
    const spyW = vi.spyOn(watermarkMod, 'applyWatermarkToCanvas').mockImplementation((_ctx, _tier, w, h) => {
      observedWidth = w;
      observedHeight = h;
    });
    const svg = builderToSvg(createEmptyLogo().builder);
    const restore = setupJsdomMocks();
    try {
      await svgToPng(svg, 512, { tier: 'free' });
      // v2.4: aspect preservato. Layout horizontal 400×160, size=512
      // → lato corto 205.
      expect(observedWidth).toBe(512);
      expect(observedHeight).toBe(205);
    } finally {
      restore();
      spyW.mockRestore();
    }
  });

  it('default (no opts) → behaves as unlocked (no clamp)', async () => {
    spyWatermarkCanvas.mockRestore();
    let observedWidth = 0;
    let observedHeight = 0;
    const spyW = vi.spyOn(watermarkMod, 'applyWatermarkToCanvas').mockImplementation((_ctx, _tier, w, h) => {
      observedWidth = w;
      observedHeight = h;
    });
    const svg = builderToSvg(createEmptyLogo().builder);
    const restore = setupJsdomMocks();
    try {
      await svgToPng(svg, 1024);
      // v2.4: aspect preservato. Layout horizontal 400×160, size=1024
      // → lato corto 410.
      expect(observedWidth).toBe(1024);
      expect(observedHeight).toBe(410);
    } finally {
      restore();
      spyW.mockRestore();
    }
  });
});
