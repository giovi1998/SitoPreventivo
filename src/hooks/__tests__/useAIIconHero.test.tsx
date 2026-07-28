import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIIconHero } from '../useAIIconHero';

describe('useAIIconHero', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('returns a data URL from /api/ai/image-flash', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { imageBase64: 'iconB64', mimeType: 'image/png' } }),
    });

    const { result } = renderHook(() => useAIIconHero('user@test.com'));
    let url = '';
    await act(async () => {
      const r = await result.current.generate('mela', 'icon', { primaryColor: '#E62020', secondaryColor: '#1A1A1A' });
      url = r.dataUrl;
    });
    expect(url).toBe('data:image/png;base64,iconB64');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/image-flash',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"kind":"icon"'),
      }),
    );
  });

  it('forwards imageModel and background options to the API', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { imageBase64: 'x', mimeType: 'image/png' } }),
    });

    const { result } = renderHook(() => useAIIconHero('user@test.com'));
    await act(async () => {
      await result.current.generate('casa', 'icon', {
        primaryColor: '#01696F',
        secondaryColor: '#1A1A1A',
        imageModel: 'gemini-3.1-flash-image',
        background: 'card',
      });
    });
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.imageModel).toBe('gemini-3.1-flash-image');
    expect(body.background).toBe('card');
  });

  it('throws on non-ok response', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: 'Troppe generazioni' }) });

    const { result } = renderHook(() => useAIIconHero('user@test.com'));
    await expect(
      act(async () => result.current.generate('x', 'icon')),
    ).rejects.toThrow();
  });

  it('returns a user-friendly hint on 404', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Not Found' }) });

    const { result } = renderHook(() => useAIIconHero('user@test.com'));
    await expect(
      act(async () => result.current.generate('x', 'icon')),
    ).rejects.toThrow(/riavvia npm run dev|deploy/);
  });

  it('isProcessing is true while generating and false after', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    let resolveFetch: (v: any) => void;
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => { resolveFetch = resolve; }));

    const { result } = renderHook(() => useAIIconHero('user@test.com'));
    act(() => { result.current.generate('x', 'icon'); });
    await waitFor(() => expect(result.current.isProcessing).toBe(true));
    resolveFetch!({ ok: true, json: async () => ({ data: { imageBase64: 'a', mimeType: 'image/png' } }) });
    await waitFor(() => expect(result.current.isProcessing).toBe(false));
  });
});
