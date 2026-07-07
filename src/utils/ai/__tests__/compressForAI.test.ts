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
