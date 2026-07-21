import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureElementAsBase64 } from '../captureElement';

describe('captureElementAsBase64', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when element is null', async () => {
    const result = await captureElementAsBase64(null);
    expect(result).toBeNull();
  });

  it('returns null when element has zero dimensions', async () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ width: 0, height: 0, x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, toJSON: vi.fn() });
    const result = await captureElementAsBase64(el);
    expect(result).toBeNull();
  });

  it('returns null when ctx is null (jsdom)', async () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ width: 200, height: 100, x: 0, y: 0, top: 0, bottom: 100, left: 0, right: 200, toJSON: vi.fn() });
    // jsdom: getContext('2d') returns null, so the function should return null early
    const result = await captureElementAsBase64(el, { maxWidth: 512, quality: 0.8, type: 'image/jpeg' });
    expect(result).toBeNull();
  });
});
