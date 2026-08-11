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
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      // TB-029: la trace Langfuse (OTLP) non deve sovrascrivere il body
      // dell'upstream catturato dal test.
      if (String(url).includes('/api/public/otel/v1/traces')) {
        return { ok: true, status: 200 };
      }
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

  it('TB-029: trace Langfuse include tool_calls nello stream (output)', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
    process.env.LANGFUSE_SECRET_KEY = 'sk-test';
    process.env.LANGFUSE_BASE_URL = 'https://cloud.langfuse.com';
    delete process.env.VITE_LANGFUSE_PUBLIC_KEY;
    delete process.env.VITE_LANGFUSE_SECRET_KEY;
    delete process.env.VITE_LANGFUSE_BASE_URL;
    const otlpCalls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/otel/v1/traces')) {
        otlpCalls.push({ url, init });
        return { ok: true, status: 200 };
      }
      if (String(url).includes('/api/public/media')) {
        return { ok: false, status: 500 };
      }
      return {
        ok: true,
        headers: new Map([['content-type', 'application/x-ndjson']]),
        body: {
          getReader() {
            const lines = [
              JSON.stringify({ message: { content: '' } }),
              JSON.stringify({ message: { tool_calls: [{ function: { name: 'card_apply_palette', arguments: '{"palette":"premium"}' } }] }, done: true, prompt_eval_count: 10, eval_count: 2 }),
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
      body: { provider: 'ollama', model: 'minimax-m3:cloud', messages: [{ role: 'user', content: 'rendi stampabile' }], kind: 'card' },
    };

    const res: any = await callApiHandler(req);
    expect(res.statusCode).toBe(200);
    await vi.waitFor(() => expect(otlpCalls.length).toBe(1));
    const span = JSON.parse(otlpCalls[0].init.body).resourceSpans[0].scopeSpans[0].spans[0];
    const output = JSON.parse(span.attributes.find((a: any) => a.key === 'langfuse.observation.output').value.stringValue);
    expect(output.toolCalls).toBeDefined();
    expect(output.toolCalls[0].function.name).toBe('card_apply_palette');
    expect(output.toolCalls[0].function.arguments).toContain('premium');
    const tags = span.attributes.find((a: any) => a.key === 'langfuse.trace.tags').value.stringArrayValue;
    expect(tags).toEqual(['feature:card', 'subfeature:chat', 'provider:ollama', 'streaming:true']);
  });
});
