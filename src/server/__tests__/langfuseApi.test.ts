import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetApiTests, callApiHandler } from './helpers/apiTest';

beforeEach(() => {
  resetApiTests();
  process.env.DEEPSEEK_API_KEY = 'test-ds';
  process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
  process.env.LANGFUSE_SECRET_KEY = 'sk-test';
  process.env.LANGFUSE_BASE_URL = 'https://cloud.langfuse.com';
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const globalAny = global as any;

function stubUpstreamAndOtlp() {
  const otlpCalls: any[] = [];
  const upstreamCalls: any[] = [];
  globalAny.fetch = vi.fn(async (url: string, init: any) => {
    if (String(url).includes('/api/public/otel/v1/traces')) {
      otlpCalls.push({ url, init });
      return { ok: true, status: 200 };
    }
    upstreamCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: '{"ok":true}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }),
    };
  });
  return { otlpCalls, upstreamCalls };
}

const baseReq = (body: Record<string, unknown>) => ({
  method: 'POST',
  url: '/api/ai/chat',
  headers: { origin: 'http://localhost', 'x-forwarded-for': '1.1.1.1' },
  body: { model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'ciao' }], ...body },
});

describe('TB-029: Langfuse trace ingestion from /ai/chat', () => {
  it('sends an OTLP trace with sessionId=customerId, feature tag and usage', async () => {
    const { otlpCalls } = stubUpstreamAndOtlp();

    const res: any = await callApiHandler(
      baseReq({ userEmail: 'user@example.com', customerId: 'cust_42', kind: 'quote' })
    );
    expect(res.statusCode).toBe(200);
    await vi.waitFor(() => expect(otlpCalls.length).toBe(1));

    const { init } = otlpCalls[0];
    const body = JSON.parse(init.body);
    const span = body.resourceSpans[0].scopeSpans[0].spans[0];
    const attrs = Object.fromEntries(
      span.attributes.map((a: any) => [a.key, a.value.stringValue ?? a.value.stringArrayValue ?? JSON.parse(a.value.stringValue ?? 'null')])
    );

    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('pk-test:sk-test').toString('base64')}`);
    expect(init.headers['x-langfuse-ingestion-version']).toBe('4');
    expect(attrs['langfuse.session.id']).toBe('cust_42');
    expect(attrs['langfuse.user.id']).toBe('user@example.com');
    expect(attrs['langfuse.trace.metadata.customerId']).toBe('cust_42');
    expect(attrs['langfuse.observation.model.name']).toBe('deepseek-v4-flash');
    expect(JSON.parse(attrs['langfuse.observation.usage_details'])).toEqual({ input: 100, output: 50, total: 150 });
  });

  it('TB-029: nome trace specifico da kind (card-ai-chat) e tags strutturati', async () => {
    const { otlpCalls } = stubUpstreamAndOtlp();
    const res: any = await callApiHandler(
      baseReq({ userEmail: 'user@example.com', customerId: 'cust_42', kind: 'card', sessionId: 'doc_123', costUsd: 0.0123 })
    );
    expect(res.statusCode).toBe(200);
    await vi.waitFor(() => expect(otlpCalls.length).toBe(1));

    const span = JSON.parse(otlpCalls[0].init.body).resourceSpans[0].scopeSpans[0].spans[0];
    const attrs = Object.fromEntries(
      span.attributes.map((a: any) => [a.key, a.value.stringValue ?? a.value.stringArrayValue ?? JSON.parse(a.value.stringValue ?? 'null')])
    );

    // Nome verb-first specifico, non generico generate-response
    expect(span.name).toBe('card-ai-chat');
    // Tags strutturati (chat non-stream → streaming:false)
    expect(attrs['langfuse.trace.tags']).toEqual(['feature:card', 'subfeature:chat', 'provider:deepseek', 'streaming:false']);
    // sessionId=docId (sessione documento)
    expect(attrs['langfuse.session.id']).toBe('doc_123');
    // Costo esplicito dal client
    expect(JSON.parse(attrs['langfuse.observation.cost_details'])).toEqual({ total: 0.0123 });
  });

  it('TB-029: quote-ai-chat nome per kind quote, streaming:false su chat non-stream', async () => {
    const { otlpCalls } = stubUpstreamAndOtlp();
    const res: any = await callApiHandler(baseReq({ kind: 'quote' }));
    expect(res.statusCode).toBe(200);
    await vi.waitFor(() => expect(otlpCalls.length).toBe(1));
    const span = JSON.parse(otlpCalls[0].init.body).resourceSpans[0].scopeSpans[0].spans[0];
    expect(span.name).toBe('quote-ai-chat');
    const attrs = Object.fromEntries(span.attributes.map((a: any) => [a.key, a.value.stringArrayValue ?? a.value.stringValue]));
    expect(attrs['langfuse.trace.tags']).toEqual(['feature:quote', 'subfeature:chat', 'provider:deepseek', 'streaming:false']);
  });

  it('is a no-op (no OTLP call) when LANGFUSE env vars are missing', async () => {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_BASE_URL;
    delete process.env.VITE_LANGFUSE_PUBLIC_KEY;
    delete process.env.VITE_LANGFUSE_SECRET_KEY;
    delete process.env.VITE_LANGFUSE_BASE_URL;
    const { otlpCalls } = stubUpstreamAndOtlp();

    const res: any = await callApiHandler(baseReq({}));
    expect(res.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(otlpCalls.length).toBe(0);
  });

  it('sends an ERROR trace when the upstream call fails', async () => {
    const otlpCalls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/api/public/otel/v1/traces')) {
        otlpCalls.push(url);
        return { ok: true, status: 200 };
      }
      return { ok: false, status: 402, text: async () => 'no credit' };
    });

    const res: any = await callApiHandler(baseReq({ userEmail: 'u@x.com', kind: 'quote' }));
    expect(res.statusCode).toBe(402);
    await vi.waitFor(() => expect(otlpCalls.length).toBe(1));

    const fetchMock = globalAny.fetch;
    const otlpInit = fetchMock.mock.calls.find((c: any[]) => String(c[0]).includes('otel'))?.[1];
    const body = JSON.parse(otlpInit.body);
    const span = body.resourceSpans[0].scopeSpans[0].spans[0];
    const attrs = Object.fromEntries(span.attributes.map((a: any) => [a.key, a.value.stringValue ?? '']));
    expect(span.status.code).toBe(2);
    expect(attrs['langfuse.observation.level']).toBe('ERROR');
    expect(attrs['langfuse.trace.metadata.errorKind']).toBe('quota');
  });

  it('trace "rendi più stampabile" con messaggi interi + tool_calls + immagini placeholder', async () => {
    const otlpCalls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/media')) return { ok: false, status: 500 };
      if (String(url).includes('/api/public/otel/v1/traces')) {
        otlpCalls.push(init);
        return { ok: true, status: 200 };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              role: 'assistant',
              content: '{"style":{"fontScale":1.2}}',
              tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'card_switch_layout', arguments: '{"layout":"compact"}' } }],
            },
          }],
          usage: { prompt_tokens: 90, completion_tokens: 30, total_tokens: 120 },
        }),
      };
    });

    const res: any = await callApiHandler(
      baseReq({
        userEmail: 'user@example.com',
        customerId: 'cust_42',
        kind: 'card',
        messages: [
          { role: 'system', content: 'Sei un assistente card' },
          { role: 'user', content: 'rendi il bigliettino più stampabile', images: ['data:image/png;base64,QUJD'] },
        ],
      })
    );
    expect(res.statusCode).toBe(200);
    await vi.waitFor(() => expect(otlpCalls.length).toBe(1));

    const body = JSON.parse(otlpCalls[0].body);
    const span = body.resourceSpans[0].scopeSpans[0].spans[0];
    const attrs = Object.fromEntries(
      span.attributes.map((a: any) => [a.key, a.value.stringValue ?? a.value.stringArrayValue ?? JSON.parse(a.value.stringValue ?? 'null')])
    );

    // Input: messaggi interi visibili in Langfuse
    const input = JSON.parse(attrs['langfuse.observation.input']);
    expect(input[0].role).toBe('system');
    expect(input[1].content).toContain('più stampabile');
    // Immagine → placeholder (upload media fallito in test)
    expect(input[1].content).toContain('[immagine allegata');

    // Output: tool_calls visibili
    const output = JSON.parse(attrs['langfuse.observation.output']);
    expect(output.choices[0].message.tool_calls[0].function.name).toBe('card_switch_layout');

    // Usage + tag feature
    expect(JSON.parse(attrs['langfuse.observation.usage_details'])).toEqual({ input: 90, output: 30, total: 120 });
    expect(attrs['langfuse.trace.tags']).toEqual(['feature:card', 'subfeature:chat', 'provider:deepseek', 'streaming:false']);
  });

  it('TB-029 vision card: system+prompt+anteprima inline→token media+tool_calls (flusso completo)', async () => {
    const otlpCalls: any[] = [];
    globalAny.fetch = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/media')) {
        return { ok: true, json: async () => ({ mediaId: 'media_vis_1', uploadUrl: 'https://s3.example/u' }) };
      }
      if (String(url).startsWith('https://s3.example/')) return { ok: true, status: 200 };
      if (String(url).includes('/api/public/otel/v1/traces')) {
        otlpCalls.push(init);
        return { ok: true, status: 200 };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              role: 'assistant',
              content: '{"style":{"accentColor":"#01696F"}}',
              tool_calls: [{ id: 'call_2', type: 'function', function: { name: 'card_apply_palette', arguments: '{"palette":"teal"}' } }],
            },
          }],
          usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
        }),
      };
    });

    const RAW_B64 = 'data:image/jpeg;base64,QUJD';
    const res: any = await callApiHandler(
      baseReq({
        userEmail: 'user@example.com',
        customerId: 'cust_42',
        kind: 'card',
        messages: [
          { role: 'system', content: 'Sei un assistente card (system remoto)' },
          { role: 'user', content: `Anteprima card allegata (base64 JPEG): ${RAW_B64}\n\nModifica il template con palette teal e vision` },
        ],
      })
    );
    expect(res.statusCode).toBe(200);
    await vi.waitFor(() => expect(otlpCalls.length).toBe(1));

    const body = JSON.parse(otlpCalls[0].body);
    const span = body.resourceSpans[0].scopeSpans[0].spans[0];
    const attrs = Object.fromEntries(
      span.attributes.map((a: any) => [a.key, a.value.stringValue ?? a.value.stringArrayValue ?? JSON.parse(a.value.stringValue ?? 'null')])
    );

    const input = JSON.parse(attrs['langfuse.observation.input']);
    // system card visibile
    expect(input[0].role).toBe('system');
    expect(input[0].content).toContain('assistente card');
    // anteprima → token media (mai raw base64)
    const userContent = input[1].content;
    expect(userContent).not.toContain('QUJD');
    expect(userContent).toContain('@@@langfuseMedia:type=image/jpeg|id=media_vis_1');
    expect(userContent).toContain('Modifica il template');

    // output tool_calls + usage + tag
    const output = JSON.parse(attrs['langfuse.observation.output']);
    expect(output.choices[0].message.tool_calls[0].function.name).toBe('card_apply_palette');
    expect(JSON.parse(attrs['langfuse.observation.usage_details'])).toEqual({ input: 120, output: 40, total: 160 });
    expect(attrs['langfuse.trace.tags']).toEqual(['feature:card', 'subfeature:chat', 'provider:deepseek', 'streaming:false']);
  });
});
