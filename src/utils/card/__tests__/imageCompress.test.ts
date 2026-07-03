import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compressImage, loadImage } from '../imageCompress';

describe('imageCompress', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockImage(width: number, height: number) {
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      _src = '';
      width = width;
      height = height;
      set src(v: string) {
        this._src = v;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    } as any);
  }

  function mockCanvasAlwaysFails() {
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement');
    createSpy.mockImplementation((tag: string, opts?: any) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => null,
          toDataURL: () => '',
        } as any;
      }
      return origCreate(tag, opts);
    });
  }

  it('loadImage resolves when image loads', async () => {
    mockImage(10, 10);
    const file = new File([new Uint8Array(8)], 'a.png', { type: 'image/png' });
    const img = await loadImage(file);
    expect(img.width).toBe(10);
    expect(img.height).toBe(10);
  });

  it('loadImage rejects when image fails', async () => {
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.());
      }
    } as any);
    const file = new File([new Uint8Array(8)], 'a.png', { type: 'image/png' });
    await expect(loadImage(file)).rejects.toThrow(/Immagine non leggibile/i);
  });

  it('throws when canvas 2d context is unavailable', async () => {
    mockImage(50, 50);
    mockCanvasAlwaysFails();
    const file = new File([new Uint8Array(8)], 'a.png', { type: 'image/png' });
    await expect(compressImage(file)).rejects.toThrow(/Canvas 2D non disponibile/i);
  });
});
