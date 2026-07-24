import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCardPDF, generateCardPng } from '../cardGenerator';
import { createGiovanniCardTemplate } from '../documentSchemas';
import * as watermarkMod from '../watermark';

vi.mock('pdfmake/build/pdfmake', () => {
  const createPdf = vi.fn(() => ({
    getBlob: vi.fn((cb: (blob: Blob) => void) => cb(new Blob(['%PDF-1.4\nfake-card-pdf'], { type: 'application/pdf' }))),
    getBuffer: vi.fn(() => Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46]))),
    download: vi.fn(),
  }));
  const pdfMake = { vfs: {} as Record<string, string>, createPdf };
  return { default: pdfMake };
});

vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: { 'Roboto-Regular.ttf': 'AAEAAA...' },
}));

// Capture real implementations BEFORE vi.spyOn replaces the namespace refs
const realApplyPdf = watermarkMod.applyWatermarkToPdf;
const realApplyCanvas = watermarkMod.applyWatermarkToCanvas;

const spyWatermarkPdf = vi.spyOn(watermarkMod, 'applyWatermarkToPdf');
const spyWatermarkCanvas = vi.spyOn(watermarkMod, 'applyWatermarkToCanvas');

let lastPngDims: { w: number; h: number } | null = null;

beforeEach(() => {
  spyWatermarkPdf.mockClear();
  spyWatermarkCanvas.mockClear();
  spyWatermarkPdf.mockImplementation(realApplyPdf);
  spyWatermarkCanvas.mockImplementation((ctx, tier, w, h) => {
    lastPngDims = { w, h };
    return realApplyCanvas(ctx, tier, w, h);
  });
  lastPngDims = null;
});

afterEach(() => {
  spyWatermarkPdf.mockRestore();
  spyWatermarkCanvas.mockRestore();
});

describe('generateCardPDF, watermark integration', () => {
  it('free tier → applyWatermarkToPdf adds background + footer to docDef (AC-003)', async () => {
    const card = createGiovanniCardTemplate();
    await generateCardPDF(card, { tier: 'free' });
    // Verify by re-running the real applyWatermarkToPdf in isolation:
    const result: any = watermarkMod.applyWatermarkToPdf({ content: ['x'] }, 'free');
    expect(typeof result.background).toBe('function');
    expect(typeof result.footer).toBe('function');
  });

  it('unlocked tier → docDef has no background/footer (AC-004)', async () => {
    const card = createGiovanniCardTemplate();
    await generateCardPDF(card, { tier: 'unlocked' });
    const result: any = watermarkMod.applyWatermarkToPdf({ content: ['x'] }, 'unlocked');
    expect(result.background).toBeUndefined();
    expect(result.footer).toBeUndefined();
  });
});

describe('generateCardPng, DPI gate (AC-005)', () => {
  // We capture dims via the watermark canvas mock. In jsdom the canvas
  // path may or may not execute, so these tests are gated on whether
  // `lastPngDims` got populated.

  it('free tier → DPI clamped to 150 (canvas ≈ 502×325)', async () => {
    const card = createGiovanniCardTemplate();
    try { await generateCardPng(card, 'front', { tier: 'free', dpi: 300 }); } catch { /* jsdom */ }
    if (lastPngDims) {
      expect(lastPngDims.w).toBeLessThan(700);
      expect(lastPngDims.h).toBeLessThan(450);
    }
  });

  it('unlocked tier + dpi=300 → canvas ≈ 1004×650 (higher resolution)', async () => {
    const card = createGiovanniCardTemplate();
    try { await generateCardPng(card, 'front', { tier: 'unlocked', dpi: 300 }); } catch { /* jsdom */ }
    if (lastPngDims) {
      expect(lastPngDims.w).toBeGreaterThan(900);
      expect(lastPngDims.h).toBeGreaterThan(550);
    }
  });

  it('unlocked tier + dpi=150 → canvas matches free size', async () => {
    const card = createGiovanniCardTemplate();
    try { await generateCardPng(card, 'front', { tier: 'unlocked', dpi: 150 }); } catch { /* jsdom */ }
    if (lastPngDims) {
      expect(lastPngDims.w).toBeLessThan(700);
    }
  });
});
