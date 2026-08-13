import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetApiTests, callApiHandler, createInteraction } from './helpers/apiTest';

function mockGeminiOk(imageBase64: string, mimeType = 'image/jpeg') {
  createInteraction.mockResolvedValue({
    output_image: { data: imageBase64, mime_type: mimeType },
  });
}

function mockGeminiError(err: Error) {
  createInteraction.mockRejectedValue(err);
}

function makeReq(body: any, ip = '1.1.1.1') {
  return {
    method: 'POST',
    url: '/api/ai/flyer-hero',
    headers: { origin: 'http://localhost', 'x-forwarded-for': ip },
    body,
  };
}

beforeEach(() => {
  resetApiTests();
});

describe('POST /api/ai/flyer-hero', () => {
  it('text-only: input is a string', async () => {
    mockGeminiOk('hero');
    const res = await callApiHandler(makeReq({ prompt: 'p', context: 'c' }));
    expect(res.statusCode).toBe(200);
    const input = createInteraction.mock.calls[0][0].input;
    expect(typeof input).toBe('string');
  });

  it('with flyerImage: input array with text + image + grounding', async () => {
    mockGeminiOk('hero');
    const flyerImage = 'data:image/jpeg;base64,flyerabc';
    await callApiHandler(makeReq({ prompt: 'p', context: 'c', flyerImage, aspectRatio: '3:2' }));
    const input = createInteraction.mock.calls[0][0].input;
    expect(Array.isArray(input)).toBe(true);
    expect(input).toHaveLength(2);
    expect(input[0].text).toContain('flyer layout');
    expect(input[1]).toMatchObject({ type: 'image', data: 'flyerabc', mime_type: 'image/jpeg' });
  });

  it('passes aspectRatio from request to image_config (default 3:2)', async () => {
    mockGeminiOk('hero');
    await callApiHandler(makeReq({ prompt: 'p', context: 'c', aspectRatio: '16:9' }));
    const cfg = createInteraction.mock.calls[0][0].generation_config.image_config;
    expect(cfg.aspect_ratio).toBe('16:9');
  });

  it('requests 2K JPEG q85 with 45s timeout (spec ai-image-quality)', async () => {
    mockGeminiOk('hero');
    await callApiHandler(makeReq({ prompt: 'p' }));
    const call = createInteraction.mock.calls[0][0];
    // 1K: 2K JPEG ≈3.2MB non passa il limite risposta Vercel 4.5MB (probe
    // live 2026-08-07); nessun output control nelle interactions API.
    expect(call.generation_config.image_config.image_size).toBe('1K');
    expect(call.generation_config.image_config.image_output_options).toBeUndefined();
    expect(createInteraction.mock.calls[0][1]).toEqual({ timeout: 45_000 });
  });

  it('Lite model is forced to 1K and passes through unmodified', async () => {
    mockGeminiOk('hero');
    const res = await callApiHandler(makeReq({ prompt: 'p', imageModel: 'gemini-3.1-flash-lite-image' }));
    expect(res.statusCode).toBe(200);
    const call = createInteraction.mock.calls[0][0];
    expect(call.model).toBe('gemini-3.1-flash-lite-image');
    expect(call.generation_config.image_config.image_size).toBe('1K');
  });

  it('accepts a 900KB image (clamp 1MB: 1K JPEG misurato ~850KB)', async () => {
    mockGeminiOk('x'.repeat(1_200_000)); // ~900KB raw
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(200);
  });

  it('returns 413 when image exceeds 1MB', async () => {
    mockGeminiOk('x'.repeat(1_400_000)); // ~1.05MB raw
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(413);
  });

  it('returns 429 after 5 calls/min', async () => {
    mockGeminiOk('hero');
    const ip = '4.4.4.4';
    for (let i = 0; i < 5; i++) {
      expect((await callApiHandler(makeReq({ prompt: 'p' }, ip))).statusCode).toBe(200);
    }
    const blocked = await callApiHandler(makeReq({ prompt: 'p' }, ip));
    expect(blocked.statusCode).toBe(429);
  });

  it('returns 504 on timeout', async () => {
    mockGeminiError(new Error('GEMINI_TIMEOUT'));
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(504);
  });

  it('T9: non invia trace Langfuse al cloud nei test (credenziali azzerate da resetApiTests)', async () => {
    const fetchMock = vi.fn((_url: string, _init?: any) => Promise.resolve({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    mockGeminiOk('hero');
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(200);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/public/otel/v1/traces'))).toBe(false);
    expect(urls.some((u) => u.includes('/api/public/media'))).toBe(false);
    vi.unstubAllGlobals();
  });
});
