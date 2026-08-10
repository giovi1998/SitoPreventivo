import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetApiTests, callApiHandler, createInteraction } from './helpers/apiTest';

const RETIRED_MODEL = 'gemini-2.0-flash-preview-image-generation';
const CURRENT_MODEL = 'gemini-3.1-flash-image';

function makeReq(body: any, ip = '1.1.1.1') {
  return {
    method: 'POST',
    url: '/api/ai/image-flash',
    headers: { origin: 'http://localhost', 'x-forwarded-for': ip },
    body,
  };
}

beforeEach(() => {
  resetApiTests();
  process.env.GEMINI_API_KEY = 'test-gemini';
  createInteraction.mockResolvedValue({
    output_image: { data: 'abc', mime_type: 'image/png' },
  });
});

describe('POST /api/ai/image-flash', () => {
  // Regression: il default era gemini-2.0-flash-preview-image-generation,
  // ritirato da Google → 404 upstream → 502 in prod (2026-07-30).
  it('senza imageModel usa il modello corrente (non quello ritirato)', async () => {
    const res = await callApiHandler(makeReq({ prompt: 'icona foglia', kind: 'icon' }));
    expect(res.statusCode).toBe(200);
    expect(createInteraction.mock.calls[0][0].model).toBe(CURRENT_MODEL);
  });

  it('imageModel ritirato dal client (pref stale) → normalizzato al corrente', async () => {
    const res = await callApiHandler(makeReq({ prompt: 'icona foglia', kind: 'icon', imageModel: RETIRED_MODEL }));
    expect(res.statusCode).toBe(200);
    expect(createInteraction.mock.calls[0][0].model).toBe(CURRENT_MODEL);
  });

  it('imageModel valido esplicito passa invariato', async () => {
    const res = await callApiHandler(makeReq({ prompt: 'icona foglia', kind: 'icon', imageModel: CURRENT_MODEL }));
    expect(res.statusCode).toBe(200);
    expect(createInteraction.mock.calls[0][0].model).toBe(CURRENT_MODEL);
  });
});
