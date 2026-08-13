import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProProvider } from '../ollamaPro';

// Mock dataService per IS_LOCAL path
vi.mock('../../../utils/dataService', () => ({
  default: {
    getDeepseekKey: vi.fn().mockResolvedValue(''),
    chatWithAI: vi.fn(),
    streamChat: vi.fn(),
  },
}));

// Mock window.location per IS_LOCAL detection
const originalLocation = globalThis.window?.location;
function setWindowLocation(hostname: string) {
  // @ts-expect-error - test override
  if (!globalThis.window) globalThis.window = {};
  // @ts-expect-error - test override
  globalThis.window.location = { hostname, origin: `http://${hostname}`, href: `http://${hostname}/` };
}

describe('OllamaProProvider', () => {
  beforeEach(() => {
    setWindowLocation('localhost');
  });
  afterEach(() => {
    if (originalLocation) {
      // @ts-expect-error - restore
      globalThis.window.location = originalLocation;
    } else {
      // @ts-expect-error - cleanup
      delete globalThis.window;
    }
    vi.restoreAllMocks();
  });

  describe('constructor + metadata', () => {
    it('defaults to minimax-m3:cloud', () => {
      const p = new OllamaProProvider();
      expect(p.model).toBe('minimax-m3:cloud');
      expect(p.name).toBe('Ollama');
      expect(p.supportsStreaming).toBe(true);
      expect(p.supportsTools).toBe(true);
      expect(p.supportsVision).toBe(true);
    });

    it('deepseek-v4-pro:cloud has no vision', () => {
      const p = new OllamaProProvider('deepseek-v4-pro:cloud');
      expect(p.supportsVision).toBe(false);
    });

    it('qwen-3.5 has vision', () => {
      const p = new OllamaProProvider('qwen-3.5');
      expect(p.supportsVision).toBe(true);
    });
  });

  describe('buildOllamaBody (via chat call shape)', () => {
    it('includes model and messages', async () => {
      const p = new OllamaProProvider();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await p.chat([{ role: 'user', content: 'ciao' }]);
      expect(fetchSpy).toHaveBeenCalled();
      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse((call[1] as RequestInit).body as string);
      expect(body.model).toBe('minimax-m3:cloud');
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toBe('ciao');
      expect(body.provider).toBe('ollama');
      expect(body.stream).toBe(false);
      expect(body.think).toBe('max');
    });

    it('includes think:max in body', async () => {
      const p = new OllamaProProvider();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await p.chat([{ role: 'user', content: 'ciao' }]);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.think).toBe('max');
    });

    it('translates responseFormat json_object to format:json', async () => {
      const p = new OllamaProProvider();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await p.chat([{ role: 'user', content: 'x' }], { responseFormat: { type: 'json_object' } });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.format).toBe('json');
    });

    it('passes jsonSchema as structured-outputs format (schema object, non solo "json")', async () => {
      const p = new OllamaProProvider();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      const schema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
      await p.chat([{ role: 'user', content: 'x' }], { jsonSchema: schema });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.format).toEqual(schema);
    });

    it('passes tools when supported', async () => {
      const p = new OllamaProProvider();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      const tools = [{ type: 'function' as const, function: { name: 'x', description: 'd', parameters: {} } }];
      await p.chat([{ role: 'user', content: 'x' }], { tools });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.tools).toBeDefined();
      expect(body.tools[0].function.name).toBe('x');
    });

    it('TB-029: propagates customerId, kind and userEmail in the proxy body', async () => {
      const p = new OllamaProProvider();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      localStorage.setItem('userEmail', JSON.stringify('user@example.com'));
      await p.chat([{ role: 'user', content: 'x' }], { customerId: 'cust_7', kind: 'card' });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.customerId).toBe('cust_7');
      expect(body.kind).toBe('card');
      expect(body.userEmail).toBe('user@example.com');
      localStorage.removeItem('userEmail');
    });

    it('TB-029: omits customerId/kind when not provided', async () => {
      const p = new OllamaProProvider();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await p.chat([{ role: 'user', content: 'x' }]);
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.customerId).toBeUndefined();
      expect(body.kind).toBeUndefined();
    });
  });

  describe('chat - response parsing', () => {
    it('parses normalized (DeepSeek-like) response from proxy', async () => {
      const p = new OllamaProProvider();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Hello!' } }],
            usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      const res = await p.chat([{ role: 'user', content: 'hi' }]);
      expect(res.content).toBe('Hello!');
      expect(res.usage?.promptTokens).toBe(5);
      expect(res.usage?.totalTokens).toBe(7);
    });

    it('parses raw Ollama response (message + prompt_eval_count)', async () => {
      const p = new OllamaProProvider();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            model: 'minimax-m3:cloud',
            message: { role: 'assistant', content: 'Ollama raw' },
            done: true,
            prompt_eval_count: 12,
            eval_count: 8,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      const res = await p.chat([{ role: 'user', content: 'hi' }]);
      expect(res.content).toBe('Ollama raw');
      expect(res.usage?.promptTokens).toBe(12);
      expect(res.usage?.completionTokens).toBe(8);
      expect(res.usage?.totalTokens).toBe(20);
    });

    it('parses tool_calls from raw Ollama response', async () => {
      const p = new OllamaProProvider();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                { function: { name: 'get_weather', arguments: '{"city":"Cagliari"}' } },
              ],
            },
            done: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      const res = await p.chat([{ role: 'user', content: 'meteo' }]);
      expect(res.toolCalls).toBeDefined();
      expect(res.toolCalls![0].function.name).toBe('get_weather');
      expect(res.toolCalls![0].function.arguments).toBe('{"city":"Cagliari"}');
    });
  });

  describe('chat - error handling', () => {
    it('maps 429 to quota-exceeded message', async () => {
      const p = new OllamaProProvider();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'quota exceeded' }), { status: 429 })
      );
      await expect(p.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(/Quota Ollama Pro/);
    });

    it('maps 503 to not-configured message', async () => {
      const p = new OllamaProProvider();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'no key' }), { status: 503 })
      );
      await expect(p.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(/OLLAMA_API_KEY/);
    });

    it('generic error includes status', async () => {
      const p = new OllamaProProvider();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'boom' }), { status: 500 })
      );
      await expect(p.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(/500/);
    });
  });

  describe('chatWithImages (REQ-MM-001)', () => {
    it('enriches last user message with images for vision models', async () => {
      const p = new OllamaProProvider('minimax-m3:cloud');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'cat' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      await p.chatWithImages(
        [
          { role: 'system', content: 'se analista' },
          { role: 'user', content: 'cosa vedi?' },
        ],
        ['base64data']
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      const lastMsg = body.messages[body.messages.length - 1];
      expect(lastMsg.role).toBe('user');
      expect(lastMsg.images).toEqual(['base64data']);
      // System message non ha images
      expect(body.messages[0].images).toBeUndefined();
    });

    it('returns error for non-vision model', async () => {
      const p = new OllamaProProvider('deepseek-v4-pro:cloud');
      const res = await p.chatWithImages(
        [{ role: 'user', content: 'x' }],
        ['img']
      );
      expect(res.content).toBeNull();
      expect((res as any).error).toMatch(/non supporta vision/);
    });
  });

  describe('stream', () => {
    it('parses SSE stream with content chunks', async () => {
      const p = new OllamaProProvider();
      const sseBody = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":" world"}}]}',
        'data: {"usage":{"prompt_tokens":2,"completion_tokens":2,"total_tokens":4}}',
        'data: [DONE]',
        '',
      ].join('\n');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(sseBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
      );
      const chunks: any[] = [];
      for await (const c of p.stream([{ role: 'user', content: 'hi' }])) {
        chunks.push(c);
      }
      const contents = chunks.filter((c) => c.type === 'content').map((c) => c.content);
      expect(contents).toEqual(['Hello', ' world']);
      const done = chunks.find((c) => c.type === 'done');
      expect(done?.usage?.totalTokens).toBe(4);
    });

    it('emits error chunk on non-200 response', async () => {
      const p = new OllamaProProvider();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'nope' }), { status: 500 })
      );
      const chunks: any[] = [];
      for await (const c of p.stream([{ role: 'user', content: 'x' }])) {
        chunks.push(c);
      }
      expect(chunks[0].type).toBe('error');
    });
  });
});