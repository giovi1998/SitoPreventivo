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

  it('default size è 1K senza output options (rifiutate da Gemini)', async () => {
    const res = await callApiHandler(makeReq({ prompt: 'icona foglia', kind: 'icon' }));
    expect(res.statusCode).toBe(200);
    const cfg = createInteraction.mock.calls[0][0].generation_config.image_config;
    expect(cfg.image_size).toBe('1K');
    expect(cfg.image_output_options).toBeUndefined();
  });

  it("size '256' → 400 (non è un image_size valido)", async () => {
    const res = await callApiHandler(makeReq({ prompt: 'p', size: '256' }));
    expect(res.statusCode).toBe(400);
  });

  it("aspectRatio '3:1' → 400 (non supportato da Gemini 3.1)", async () => {
    const res = await callApiHandler(makeReq({ prompt: 'p', aspectRatio: '3:1' }));
    expect(res.statusCode).toBe(400);
  });

  it('imageModel fuori enum → 400', async () => {
    const res = await callApiHandler(makeReq({ prompt: 'p', imageModel: 'some-other-model' }));
    expect(res.statusCode).toBe(400);
  });

  it('Lite passa invariato e forza image_size 1K anche se richiesto 512', async () => {
    const res = await callApiHandler(makeReq({
      prompt: 'icona foglia',
      kind: 'icon',
      imageModel: 'gemini-3.1-flash-lite-image',
      size: '512',
    }));
    expect(res.statusCode).toBe(200);
    const call = createInteraction.mock.calls[0][0];
    expect(call.model).toBe('gemini-3.1-flash-lite-image');
    expect(call.generation_config.image_config.image_size).toBe('1K');
  });
});
