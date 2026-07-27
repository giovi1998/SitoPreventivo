import { describe, expect, it, vi } from 'vitest';
import { generateFlyerPdf } from '../pdfExport';
import * as watermark from '../../watermark';
import type { Flyer } from '../../documentSchemas';

const sampleFlyer: Flyer = {
  documentType: 'flyer',
  id: 'test-flyer-pdf-1',
  size: 'A5',
  orientation: 'portrait',
  title: 'Test Flyer PDF',
  content: {
    headline: 'PROMOZIONE',
    subheadline: 'Subheadline promo',
    body: 'Testo promozionale di esempio per la generazione del PDF.',
    cta: { label: 'Scopri di più', url: '' },
    heroImage: null,
    qrPayload: '',
    qrLabel: '',
  },
  style: {
    bgColor: '#ffffff',
    textColor: '#1e293b',
    accentColor: '#2563eb',
    layout: 'classic',
    fontFamily: 'Inter',
    fontScale: 1,
  },
  decorations: { pattern: null, opacity: 0.2, palette: { primary: '#2563eb', secondary: '#1e293b', accent: null }, userLocked: false },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('flyer pdfExport (TB-007)', () => {
  it('generateFlyerPdf generates Uint8Array output without crashing', async () => {
    const bytes = await generateFlyerPdf(sampleFlyer, { tier: 'unlocked' });
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('generateFlyerPdf applies watermark for free tier', async () => {
    const applySpy = vi.spyOn(watermark, 'applyWatermarkToPdf').mockImplementation((doc) => doc as any);
    const bytes = await generateFlyerPdf(sampleFlyer, { tier: 'free' });
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(0);
    expect(applySpy).toHaveBeenCalled();
    const [firstArg, secondArg] = applySpy.mock.calls[0];
    expect(firstArg).toHaveProperty('content');
    expect(secondArg).toBe('free');
    applySpy.mockRestore();
  });
});
