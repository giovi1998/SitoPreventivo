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
    url: '/api/ai/logo-background',
    headers: { origin: 'http://localhost', 'x-forwarded-for': ip },
    body,
  };
}

beforeEach(() => {
  resetApiTests();
});

describe('POST /api/ai/logo-background', () => {
  it('text-only: input is a string', async () => {
    mockGeminiOk('ok');
    const res = await callApiHandler(makeReq({ prompt: 'test' }));
    expect(res.statusCode).toBe(200);
    expect(typeof createInteraction.mock.calls[0][0].input).toBe('string');
  });

  it('with logoImage: input array with 2 parts, grounding prepended', async () => {
    mockGeminiOk('img');
    const logoImage = 'data:image/png;base64,logoxyz';
    await callApiHandler(makeReq({ prompt: 'p', logoImage }));
    const input = createInteraction.mock.calls[0][0].input;
    expect(input).toHaveLength(2);
    expect(input[0].text).toContain('logo layout');
    expect(input[1]).toMatchObject({ type: 'image', data: 'logoxyz', mime_type: 'image/png' });
  });

  it('with logoImage + previousBackground: input array with 3 parts', async () => {
    mockGeminiOk('img');
    const logoImage = 'data:image/png;base64,logo';
    const previousBackground = 'data:image/jpeg;base64,prev';
    await callApiHandler(makeReq({ prompt: 'p', logoImage, previousBackground }));
    const input = createInteraction.mock.calls[0][0].input;
    expect(input).toHaveLength(3);
    expect(input[2]).toMatchObject({ type: 'image', data: 'prev', mime_type: 'image/jpeg' });
  });

  it('uses image_size 1K + aspect_ratio 16:9, no output options (rifiutate da Gemini)', async () => {
    mockGeminiOk('img');
    await callApiHandler(makeReq({ prompt: 'p' }));
    const call = createInteraction.mock.calls[0][0];
    expect(call.generation_config.image_config).toEqual({
      image_size: '1K',
      aspect_ratio: '16:9',
    });
    expect(createInteraction.mock.calls[0][1]).toEqual({ timeout: 45_000 });
  });

  it('accepts a 900KB image (clamp 1MB)', async () => {
    mockGeminiOk('x'.repeat(1_200_000)); // ~900KB raw
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(200);
  });

  it('returns 413 when image exceeds 1MB', async () => {
    mockGeminiOk('x'.repeat(1_400_000)); // ~1.05MB raw
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(413);
  });

  it('returns 429 after 5 calls/min from same IP', async () => {
    mockGeminiOk('ok');
    const ip = '2.2.2.2';
    for (let i = 0; i < 5; i++) {
      expect((await callApiHandler(makeReq({ prompt: 'p' }, ip))).statusCode).toBe(200);
    }
    const blocked = await callApiHandler(makeReq({ prompt: 'p' }, ip));
    expect(blocked.statusCode).toBe(429);
  });

  it('returns 401 for invalid Gemini key', async () => {
    mockGeminiError(new Error('GEMINI_401'));
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(401);
  });
});
