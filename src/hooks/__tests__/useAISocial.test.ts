import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAISocial } from '../useAISocial';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('useAISocial.generatePostImage (immagini social)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('chiama /api/ai/image-flash 1:1 e memorizza la data URL per piattaforma', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { imageBase64: 'QUJD', mimeType: 'image/jpeg' } }),
    });
    const { result } = renderHook(() => useAISocial('t@e.com'));

    let dataUrl: string | undefined;
    await act(async () => {
      dataUrl = await result.current.generatePostImage('instagram', 'flat lay pastries');
    });

    expect(dataUrl).toBe('data:image/jpeg;base64,QUJD');
    expect(result.current.postImages.instagram).toBe(dataUrl);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/ai/image-flash');
    const body = JSON.parse(init.body);
    expect(body.kind).toBe('custom');
    expect(body.aspectRatio).toBe('1:1');
    expect(body.prompt).toContain('pastries');
  });

  it('su errore endpoint lancia e non memorizza immagine', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'down' }),
    });
    const { result } = renderHook(() => useAISocial('t@e.com'));

    await expect(
      act(async () => { await result.current.generatePostImage('facebook', 'x'); }),
    ).rejects.toThrow();
    expect(result.current.postImages.facebook).toBeUndefined();
  });
});
