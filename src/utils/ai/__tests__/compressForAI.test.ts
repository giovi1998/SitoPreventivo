import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  stripDataUrlPrefix,
  getDataUrlMimeType,
  dataUrlByteLength,
  base64ByteLength,
  pruneImagesForBodyBudget,
} from '../compressForAI';

describe('compressForAI helpers', () => {
  it('strips data url prefix', () => {
    expect(stripDataUrlPrefix('data:image/png;base64,ABC==')).toBe('ABC==');
    expect(stripDataUrlPrefix('plain')).toBe('plain');
  });

  it('detects mime type from data url', () => {
    expect(getDataUrlMimeType('data:image/png;base64,ABC')).toBe('image/png');
    expect(getDataUrlMimeType('data:image/jpeg;base64,ABC')).toBe('image/jpeg');
    expect(getDataUrlMimeType('notadataurl')).toBe('image/png');
  });

  it('computes base64 byte length', () => {
    // 4 base64 chars = 3 bytes
    expect(base64ByteLength('YWJj')).toBe(3);
  });

  it('computes data url byte length', () => {
    expect(dataUrlByteLength('data:image/png;base64,YWJj')).toBe(3);
  });
});

describe('pruneImagesForBodyBudget', () => {
  it('returns payload unchanged when under budget', () => {
    const payload = { prompt: 'hello', a: 'x', b: 'y' };
    expect(pruneImagesForBodyBudget(payload, ['a', 'b'], 1000)).toEqual(payload);
  });

  it('drops least important image first when over budget', () => {
    const big = 'x'.repeat(600_000);
    const small = 'y'.repeat(100_000);
    const payload = { prompt: 'hello', important: small, extra: big };
    const pruned = pruneImagesForBodyBudget(payload, ['important', 'extra'], 200_000);
    expect(pruned).toEqual({ prompt: 'hello', important: small });
  });

  it('drops all images if necessary', () => {
    const big = 'x'.repeat(600_000);
    const payload = { prompt: 'hello', a: big, b: big };
    const pruned = pruneImagesForBodyBudget(payload, ['a', 'b'], 200_000);
    expect(pruned).toEqual({ prompt: 'hello' });
  });
});

describe('compressForAI', () => {
  beforeEach(() => {
    // Provide a minimal Image mock for jsdom.
    if (typeof (globalThis as { Image?: unknown }).Image === 'undefined') {
      (globalThis as { Image: unknown }).Image = class FakeImage {
        public src = '';
        public naturalWidth = 100;
        public naturalHeight = 100;
        public width = 100;
        public height = 100;
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        constructor() {
          setTimeout(() => this.onload?.(), 0);
        }
      };
    }
  });

  it('returns dataUrl unchanged if under budget', async () => {
    const { compressForAI } = await import('../compressForAI');
    const tiny = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const result = await compressForAI(tiny, 1_000_000, 512);
    expect(result.dataUrl).toBe(tiny);
  });

  it('re-encodes an oversized data URL even when the base64 payload is invalid-looking', async () => {
    const { compressForAI } = await import('../compressForAI');
    // A long invalid base64 string exceeds the tiny budget, so it enters
    // the canvas re-encode path. The fake Image mock resolves immediately,
    // and the absence of a real canvas/document in jsdom causes an error.
    const longInvalid = 'data:image/png;base64,' + 'x'.repeat(1000);
    await expect(compressForAI(longInvalid, 100, 512)).rejects.toThrow();
  });
});

describe('inlineSvgExternalImages (tainted canvas regression)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the SVG unchanged when there are no external images', async () => {
    const { inlineSvgExternalImages } = await import('../compressForAI');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const svg = '<svg><image href="data:image/png;base64,AAAA" width="10" height="10"/></svg>';
    expect(await inlineSvgExternalImages(svg)).toBe(svg);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('inlines http(s) image hrefs as data URLs (canvas stays untainted)', async () => {
    const { inlineSvgExternalImages } = await import('../compressForAI');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['fake'], { type: 'image/png' })),
    }));
    const svg = '<svg><image href="https://example.com/hero.png" width="10" height="10"/><text>hi</text></svg>';
    const result = await inlineSvgExternalImages(svg);
    expect(result).not.toContain('https://example.com/hero.png');
    expect(result).toMatch(/<image href="data:image\/png;base64,/);
    expect(result).toContain('<text>hi</text>');
  });

  it('handles xlink:href external references', async () => {
    const { inlineSvgExternalImages } = await import('../compressForAI');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['fake'], { type: 'image/jpeg' })),
    }));
    const svg = '<svg><image xlink:href="https://example.com/a.jpg" width="5" height="5"/></svg>';
    const result = await inlineSvgExternalImages(svg);
    expect(result).not.toContain('https://example.com/a.jpg');
    expect(result).toContain('data:image/jpeg;base64,');
  });

  it('drops images that cannot be fetched instead of failing', async () => {
    const { inlineSvgExternalImages } = await import('../compressForAI');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS blocked')));
    const svg = '<svg><image href="https://example.com/no-cors.png" width="10" height="10"/><rect width="10" height="10"/></svg>';
    const result = await inlineSvgExternalImages(svg);
    expect(result).not.toContain('<image');
    expect(result).toContain('<rect width="10" height="10"/>');
  });

  it('drops images on non-ok HTTP responses', async () => {
    const { inlineSvgExternalImages } = await import('../compressForAI');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, blob: () => Promise.resolve(new Blob()) }));
    const svg = '<svg><image href="https://example.com/403.png"/></svg>';
    expect(await inlineSvgExternalImages(svg)).toBe('<svg></svg>');
  });
});
