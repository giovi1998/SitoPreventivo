import { describe, expect, it, vi, type Mock, beforeEach, afterEach } from 'vitest';

vi.mock('../svgRenderer', async (importActual) => {
  const actual = await importActual<typeof import('../svgRenderer')>();
  return { ...actual, buildFlyerSvg: vi.fn(actual.buildFlyerSvg) };
});

import { generateFlyerPng } from '../pngExport';
import { buildFlyerSvg } from '../svgRenderer';
import type { Flyer } from '../../documentSchemas';

const sampleFlyer: Flyer = {
  documentType: 'flyer',
  id: 'test-flyer-png-1',
  size: 'A5',
  orientation: 'portrait',
  title: 'Test Flyer PNG',
  content: {
    headline: 'PROMOZIONE',
    subheadline: 'Subheadline promo',
    body: 'Testo promozionale di esempio per la generazione del PNG.',
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

// jsdom lacks canvas 2D, Image loading and blob URLs: stub the minimum needed.
class FakeImage {
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('flyer pngExport', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback) {
      cb(new Blob(['png'], { type: 'image/png' }));
      return undefined as any;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the body as native SVG text (no foreignObject) for canvas rasterization', async () => {
    const bytes = await generateFlyerPng(sampleFlyer, { tier: 'unlocked' });
    expect(bytes.length).toBeGreaterThan(0);
    const spy = buildFlyerSvg as unknown as Mock;
    expect(spy).toHaveBeenCalled();
    const [, opts] = spy.mock.calls[spy.mock.calls.length - 1];
    expect(opts).toEqual({ renderBodyAsText: true });
    const svg = spy.mock.results[spy.mock.results.length - 1].value as string;
    expect(svg).not.toContain('foreignObject');
    expect(svg).toContain('Testo promozionale di esempio');
  });
});
