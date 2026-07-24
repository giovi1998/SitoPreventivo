import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { captureElementAsBase64 } from '../captureElement';

describe('captureElementAsBase64', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let srcSetterSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Mock canvas 2D context (jsdom non supporta il rendering reale).
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
    }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,MOCK');

    // Intercetta il setter di `src` sull'immagine per far scattare
    // `onload` in modo sincrono, evitando il caricamento reale della data URL.
    srcSetterSpy = vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
      this.onload?.(null as unknown as Event);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('returns a base64 data URL for a rendered element', async () => {
    const el = document.createElement('div');
    el.style.width = '100px';
    el.style.height = '100px';
    el.textContent = 'Hello';
    el.getBoundingClientRect = () => ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, x: 0, y: 0 } as DOMRect);
    document.body.appendChild(el);

    const result = await captureElementAsBase64(el);
    expect(result).toBe('data:image/jpeg;base64,MOCK');
  });

  it('returns null when element has zero size', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const result = await captureElementAsBase64(el);
    expect(result).toBeNull();
  });

  it('does NOT use blob URLs anymore (regression: revoke before resolve)', async () => {
    const el = document.createElement('div');
    el.style.width = '100px';
    el.style.height = '100px';
    el.getBoundingClientRect = () => ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, x: 0, y: 0 } as DOMRect);
    document.body.appendChild(el);

    await captureElementAsBase64(el);
    expect(createObjectURLSpy).not.toHaveBeenCalled();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });

  it('fills canvas with white before drawing to avoid black JPEG background (regression)', async () => {
    const el = document.createElement('div');
    el.style.width = '100px';
    el.style.height = '100px';
    el.getBoundingClientRect = () => ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, x: 0, y: 0 } as DOMRect);
    document.body.appendChild(el);

    const fillRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      drawImage: vi.fn(),
      fillRect,
    }) as unknown as CanvasRenderingContext2D);

    await captureElementAsBase64(el);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });
});
