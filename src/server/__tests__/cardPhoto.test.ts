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
    url: '/api/ai/card-photo',
    headers: { origin: 'http://localhost', 'x-forwarded-for': ip },
    body,
  };
}

beforeEach(() => {
  resetApiTests();
});

describe('POST /api/ai/card-photo', () => {
  it('returns 200 with base64 JPEG for valid prompt', async () => {
    mockGeminiOk('photodata');
    const res = await callApiHandler(makeReq({ prompt: 'test', context: 'ctx' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.imageBase64).toBe('photodata');
    expect(res.body.data.mimeType).toBe('image/jpeg');
    const cfg = createInteraction.mock.calls[0][0].generation_config.image_config;
    expect(cfg).toEqual({
      image_size: '1K',
      aspect_ratio: '3:4',
    });
  });

  it('concatenates context into prompt', async () => {
    mockGeminiOk('ok');
    await callApiHandler(makeReq({ prompt: 'p', context: 'c' }));
    const input = createInteraction.mock.calls[0][0].input;
    expect(input).toContain('p');
    expect(input).toContain('CARD PHOTO CONTEXT');
  });

  it('returns 413 when image exceeds 1MB', async () => {
    mockGeminiOk('x'.repeat(1_400_000)); // ~1.05MB raw
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(413);
  });

  it('returns 429 after 5 calls/min', async () => {
    mockGeminiOk('ok');
    const ip = '3.3.3.3';
    for (let i = 0; i < 5; i++) {
      expect((await callApiHandler(makeReq({ prompt: 'p' }, ip))).statusCode).toBe(200);
    }
    const blocked = await callApiHandler(makeReq({ prompt: 'p' }, ip));
    expect(blocked.statusCode).toBe(429);
  });

  it('maps copyright filter error to 400', async () => {
    mockGeminiError(new Error('Image generation blocked due to copyright/recitation'));
    const res = await callApiHandler(makeReq({ prompt: 'p' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/sicurezza/i);
  });

  it('returns 400 for prompt exceeding 1000 chars', async () => {
    const res = await callApiHandler(makeReq({ prompt: 'x'.repeat(1001) }));
    expect(res.statusCode).toBe(400);
  });
});
