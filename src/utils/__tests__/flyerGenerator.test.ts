import { describe, it, expect, vi } from 'vitest';
import { createEmptyFlyer } from '../documentSchemas';

vi.mock('qrcode', () => ({
  default: {
    create: () => ({ modules: { size: 1, data: [1] } }),
  },
}));

vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    vfs: {},
    createPdf: () => ({
      getBuffer: (cb: any) => cb(new Uint8Array([0x25, 0x50, 0x44, 0x46])), // %PDF
      getBlob: (cb: any) => cb({ arrayBuffer: async () => new ArrayBuffer(8) }),
    }),
  },
}));

vi.mock('pdfmake/build/vfs_fonts', () => ({ default: {} }));

import { generateFlyerPdf, generateFlyerPng } from '../flyerGenerator';

describe('flyerGenerator (phase 3) - smoke tests', () => {
  it('generateFlyerPdf returns a non-empty buffer for unlocked tier', async () => {
    const bytes = await generateFlyerPdf(createEmptyFlyer(), { tier: 'unlocked' });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('generateFlyerPdf returns a non-empty buffer for free tier (with watermark)', async () => {
    const bytes = await generateFlyerPdf(createEmptyFlyer(), { tier: 'free' });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('handles all 4 layouts without throwing', async () => {
    const layouts = ['classic', 'centered', 'split', 'magazine'] as const;
    for (const layout of layouts) {
      const f = { ...createEmptyFlyer(), style: { ...createEmptyFlyer().style, layout } };
      const bytes = await generateFlyerPdf(f, { tier: 'unlocked' });
      expect(bytes.byteLength).toBeGreaterThan(0);
    }
  });

  it('handles all 5 sizes without throwing', async () => {
    const sizes = ['A6', 'A5', 'A4', 'Letter', 'Square'] as const;
    for (const size of sizes) {
      const f = { ...createEmptyFlyer(), size };
      const bytes = await generateFlyerPdf(f, { tier: 'unlocked' });
      expect(bytes.byteLength).toBeGreaterThan(0);
    }
  });

  it('handles a populated flyer (full content + CTA + QR)', async () => {
    const f = {
      ...createEmptyFlyer(),
      content: {
        ...createEmptyFlyer().content,
        headline: 'Sagra della birra',
        subheadline: '15 agosto, ingresso gratis',
        body: 'Cibo tipico, musica dal vivo.\nApertura ore 19:00.',
        cta: { label: 'Prenota', url: 'https://example.com' },
        qrPayload: 'https://example.com',
        qrLabel: 'Scansiona',
      },
    };
    const bytes = await generateFlyerPdf(f, { tier: 'unlocked' });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('generateFlyerPng is exported and returns a function', () => {
    expect(typeof generateFlyerPng).toBe('function');
  });
});
