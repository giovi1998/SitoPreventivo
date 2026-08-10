import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetApiTests, callApiHandler, createInteraction } from './helpers/apiTest';

function mockGeminiOk(imageBase64: string, mimeType = 'image/png') {
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
    url: '/api/ai/card-cover',
    headers: { origin: 'http://localhost', 'x-forwarded-for': ip },
    body,
  };
}

beforeEach(() => {
  resetApiTests();
});

describe('POST /api/ai/card-cover', () => {
  it('text-only: input is a string (zero regression)', async () => {
    mockGeminiOk('abc');
    const res = await callApiHandler(makeReq({ prompt: 'test', context: 'ctx' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.imageBase64).toBe('abc');
    expect(createInteraction).toHaveBeenCalledTimes(1);
    const input = createInteraction.mock.calls[0][0].input;
    expect(typeof input).toBe('string');
    expect(input).not.toContain('attached image');
  });

  it('with cardImage: input array with text + image, grounding prepended', async () => {
    mockGeminiOk('img');
    const cardImage = 'data:image/jpeg;base64,/9j/card';
    const res = await callApiHandler(makeReq({ prompt: 'p', context: 'c', cardImage, side: 'front' }));
    expect(res.statusCode).toBe(200);
    const input = createInteraction.mock.calls[0][0].input;
    expect(Array.isArray(input)).toBe(true);
    expect(input).toHaveLength(2);
    expect(input[0]).toEqual({ type: 'text', text: expect.stringContaining('attached image') });
    expect(input[1]).toMatchObject({ type: 'image', data: '/9j/card', mime_type: 'image/jpeg' });
  });

  it('with cardImage + logoImage: input array with 3 parts', async () => {
    mockGeminiOk('img');
    const cardImage = 'data:image/jpeg;base64,card';
    const logoImage = 'data:image/png;base64,logo';
    const res = await callApiHandler(makeReq({ prompt: 'p', context: 'c', cardImage, logoImage, side: 'front' }));
    expect(res.statusCode).toBe(200);
    const input = createInteraction.mock.calls[0][0].input;
    expect(input).toHaveLength(3);
    expect(input[2]).toMatchObject({ type: 'image', data: 'logo', mime_type: 'image/png' });
  });

  it('returns 413 when Gemini image exceeds 500KB', async () => {
    const big = 'x'.repeat(700_000);
    mockGeminiOk(big);
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(413);
    expect(res.body.error).toMatch(/500KB/i);
  });

  it('returns 429 after exceeding 5 req/min/IP', async () => {
    mockGeminiOk('ok');
    const ip = '5.5.5.5';
    for (let i = 0; i < 5; i++) {
      const r = await callApiHandler(makeReq({ prompt: 'p' }, ip));
      expect(r.statusCode).toBe(200);
    }
    const blocked = await callApiHandler(makeReq({ prompt: 'p' }, ip));
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBeDefined();
  });

  it('returns 504 when Gemini times out', async () => {
    mockGeminiError(new Error('GEMINI_TIMEOUT'));
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(504);
  });

  it('returns 401 when Gemini key invalid', async () => {
    mockGeminiError(new Error('GEMINI_401'));
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    const res = await callApiHandler(makeReq({ prompt: 'p'.repeat(1200) }));
    expect(res.statusCode).toBe(400);
  });
});
