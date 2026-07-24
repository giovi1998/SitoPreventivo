import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetApiTests, callApiHandler } from './helpers/apiTest';

beforeEach(() => {
  resetApiTests();
  process.env.OLLAMA_API_KEY = 'test-ollama';
});

const globalAny = global as any;

describe('POST /api/ai/chat/stream Ollama routing', () => {
  it('routes provider=ollama to ollama.com/api/chat and returns SSE', async () => {
    let body: any;
    globalAny.fetch = vi.fn(async (_url: string, init: any) => {
      body = JSON.parse(init.body);
      return {
        ok: true,
        headers: new Map([['content-type', 'application/x-ndjson']]),
        body: {
          getReader() {
            const lines = [
              JSON.stringify({ message: { content: 'Ciao' } }),
              JSON.stringify({ message: { content: '!' }, done: true, prompt_eval_count: 10, eval_count: 2 }),
            ];
            let i = 0;
            return {
              async read() {
                if (i >= lines.length) return { done: true, value: undefined };
                const line = lines[i++];
                return { done: false, value: new TextEncoder().encode(line + '\n') };
              },
            };
          },
        },
      };
    });

    const req = {
      method: 'POST',
      url: '/api/ai/chat/stream',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: { provider: 'ollama', model: 'minimax-m3:cloud', messages: [{ role: 'user', content: 'ciao' }] },
    };

    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/event-stream');
    expect(body.model).toBe('minimax-m3:cloud');
    expect(body.stream).toBe(true);
  });

  it('returns 503 when OLLAMA_API_KEY is missing', async () => {
    delete process.env.OLLAMA_API_KEY;
    const req = {
      method: 'POST',
      url: '/api/ai/chat/stream',
      headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
      body: { provider: 'ollama', messages: [{ role: 'user', content: 'ciao' }] },
    };
    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/Ollama non configurato/i);
  });
});
