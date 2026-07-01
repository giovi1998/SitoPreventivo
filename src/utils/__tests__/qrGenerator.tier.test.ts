import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateQrPng } from '../qrGenerator';
import { createGiovanniQrTemplate } from '../documentSchemas';
import * as watermarkMod from '../watermark';

const spyWatermarkCanvas = vi.spyOn(watermarkMod, 'applyWatermarkToCanvas');

let lastToBufferOpts: any = null;
let lastToCanvasOpts: any = null;

vi.mock('qrcode', () => {
  const mockQrCode = {
    toBuffer: async (_payload: any, opts: any) => {
      lastToBufferOpts = opts;
      return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) as any;
    },
    toCanvas: async (_canvas: any, _payload: any, opts: any) => {
      lastToCanvasOpts = opts;
    },
    create: () => ({ modules: { data: [], size: 1 } }),
  };
  return {
    default: mockQrCode,
    ...mockQrCode,
  };
});

beforeEach(() => {
  spyWatermarkCanvas.mockClear();
  spyWatermarkCanvas.mockImplementation(() => {});
  lastToBufferOpts = null;
  lastToCanvasOpts = null;
});

afterEach(() => {
  spyWatermarkCanvas.mockRestore();
});

describe('generateQrPng, tier integration', () => {
  it('free tier → output is a non-empty Uint8Array', async () => {
    const qr = createGiovanniQrTemplate();
    qr.style.size = 1024;
    const bytes = await generateQrPng(qr, { tier: 'free' });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('unlocked tier → output is a non-empty Uint8Array (no watermark)', async () => {
    const qr = createGiovanniQrTemplate();
    qr.style.size = 1024;
    const bytes = await generateQrPng(qr, { tier: 'unlocked' });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('default (no opts) → behaves as unlocked', async () => {
    const qr = createGiovanniQrTemplate();
    const bytes = await generateQrPng(qr);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it('free tier with size > 1200 → request is clamped to 1200 (via real getMaxPngSideForTier)', async () => {
    const qr = createGiovanniQrTemplate();
    qr.style.size = 2048;
    await generateQrPng(qr, { tier: 'free' });
    expect(lastToBufferOpts).toBeTruthy();
    expect(lastToBufferOpts.width).toBeLessThanOrEqual(1200);
  });

  it('unlocked tier with size = 2048 → request is 2048 (no clamp)', async () => {
    const qr = createGiovanniQrTemplate();
    qr.style.size = 2048;
    await generateQrPng(qr, { tier: 'unlocked' });
    expect(lastToBufferOpts.width).toBe(2048);
  });

  it('free tier clamps size to at most 1200 even when user requests 4096', async () => {
    const qr = createGiovanniQrTemplate();
    qr.style.size = 4096;
    await generateQrPng(qr, { tier: 'free' });
    expect(lastToBufferOpts.width).toBe(1200);
  });

  it('unlocked tier with size = 4096 → request is 4096 (full resolution)', async () => {
    const qr = createGiovanniQrTemplate();
    qr.style.size = 4096;
    await generateQrPng(qr, { tier: 'unlocked' });
    expect(lastToBufferOpts.width).toBe(4096);
  });
});
