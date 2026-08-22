import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postAiImage } from '../imageCall';

vi.mock('../../dataService', () => ({
  default: { trackTokens: vi.fn().mockResolvedValue({ success: true }) },
}));

import dataService from '../../dataService';

describe('postAiImage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseOpts = {
    endpoint: '/api/ai/card-cover',
    payload: { prompt: 'test' },
    requestId: 'r1',
    imageModel: 'gemini-3.1-flash-image',
    fallbackError: 'Errore generazione',
  };

  it('POST con requestId e ritorna dataUrl + costo', async () => {
    const b64 = 'A'.repeat(3000);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { imageBase64: b64, mimeType: 'image/jpeg' } }),
    });
    const res = await postAiImage({ ...baseOpts, userEmail: 'u@t.com' });
    expect(res.dataUrl).toBe(`data:image/jpeg;base64,${b64}`);
    expect(res.costUsd).toBeGreaterThan(0);
    expect(res.mimeType).toBe('image/jpeg');
    expect(res.sizeKB).toBeGreaterThan(0);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/api/ai/card-cover');
    expect(init.headers['X-Request-Id']).toBe('r1');
    expect(dataService.trackTokens).toHaveBeenCalledWith('u@t.com', expect.any(Number), expect.any(Number));
  });

  it('admin non traccia token', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { imageBase64: 'QUJD', mimeType: 'image/png' } }),
    });
    await postAiImage({ ...baseOpts, userEmail: 'admin@gmail.com' });
    expect(dataService.trackTokens).not.toHaveBeenCalled();
  });

  it('errore non-ok → throw con messaggio dal server', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Troppe richieste' }),
    });
    await expect(postAiImage(baseOpts)).rejects.toThrow('Troppe richieste');
  });

  it('404 con notFoundHint → messaggio custom', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'not found' }),
    });
    await expect(postAiImage({ ...baseOpts, notFoundHint: 'Endpoint mancante, riavvia dev' })).rejects.toThrow(
      'Endpoint mancante, riavvia dev',
    );
  });
});
