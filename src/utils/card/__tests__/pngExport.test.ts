import { describe, it, expect, vi } from 'vitest';
import { buildMinimalPng, resolveToBase64DataUrl } from '../pngExport';

describe('pngExport', () => {
  describe('buildMinimalPng', () => {
    it('produces a valid PNG with correct signature', () => {
      const png = buildMinimalPng(16, 16, '#ff0000');
      expect(png[0]).toBe(0x89);
      expect(png[1]).toBe(0x50);
      expect(png[2]).toBe(0x4e);
      expect(png[3]).toBe(0x47);
      expect(png[4]).toBe(0x0d);
      expect(png[5]).toBe(0x0a);
      expect(png[6]).toBe(0x1a);
      expect(png[7]).toBe(0x0a);
    });

    it('includes IHDR chunk with correct dimensions', () => {
      const png = buildMinimalPng(32, 16, '#00ff00');
      // IHDR length (4 bytes) + type 'IHDR' (4 bytes) + data (13 bytes) + crc (4 bytes)
      expect(Array.from(png.subarray(12, 16)).map((b) => String.fromCharCode(b)).join('')).toBe('IHDR');
      const width = ((png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19]) >>> 0;
      const height = ((png[20] << 24) | (png[21] << 16) | (png[22] << 8) | png[23]) >>> 0;
      expect(width).toBe(32);
      expect(height).toBe(16);
      expect(png[24]).toBe(8); // bit depth
      expect(png[25]).toBe(2); // color type RGB
    });

    it('returns a PNG longer than the header', () => {
      const png = buildMinimalPng(8, 8, '#0000ff');
      expect(png.length).toBeGreaterThan(100);
    });
  });

  describe('resolveToBase64DataUrl', () => {
    it('passes through existing data URLs', async () => {
      const dataUrl = 'data:image/png;base64,AAAA';
      expect(await resolveToBase64DataUrl(dataUrl)).toBe(dataUrl);
    });

    it('passes through empty string', async () => {
      expect(await resolveToBase64DataUrl('')).toBe('');
    });

    it('fetches and converts an http URL when fetch succeeds', async () => {
      const fetchSpy = vi.fn(async () =>
        new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), { headers: { 'Content-Type': 'image/jpeg' } }),
      );
      const origFileReader = (globalThis as any).FileReader;
      (globalThis as any).FileReader = class {
        result = 'data:image/jpeg;base64,/9j/4AAQ';
        onload: ((ev: any) => void) | null = null;
        onerror: ((ev: any) => void) | null = null;
        readAsDataURL() {
          queueMicrotask(() => this.onload?.({} as any));
        }
      };
      vi.stubGlobal('fetch', fetchSpy);
      try {
        const resolved = await resolveToBase64DataUrl('/photo.jpg');
        expect(fetchSpy).toHaveBeenCalledWith('/photo.jpg', { credentials: 'same-origin' });
        expect(resolved).toMatch(/^data:/);
      } finally {
        vi.unstubAllGlobals();
        (globalThis as any).FileReader = origFileReader;
      }
    });
  });
});
