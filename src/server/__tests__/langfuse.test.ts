import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildLangfusePayload, ingestLangfuse, type LangfuseGenerationInput } from '../langfuse.ts';

const baseInput: LangfuseGenerationInput = {
  name: 'generate-card',
  requestId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  model: 'minimax-m3:cloud',
  provider: 'ollama',
  userEmail: 'user@example.com',
  customerId: 'cust_123',
  feature: 'card',
  environment: 'development',
  input: [{ role: 'user', content: 'Crea una card' }],
  output: { content: '{"ok":true}' },
  usage: { promptTokens: 120, completionTokens: 80 },
  costUsd: 0,
};

function firstSpan(payload: any) {
  return payload.resourceSpans[0].scopeSpans[0].spans[0];
}

function attrValue(span: any, key: string) {
  const attr = span.attributes.find((a: any) => a.key === key);
  if (!attr) return undefined;
  const v = attr.value;
  return v.stringValue ?? v.boolValue ?? v.intValue ?? v.doubleValue ?? v.stringArrayValue;
}

describe('buildLangfusePayload (OTLP/HTTP JSON → Langfuse v4)', () => {
  it('builds one root generation span with trace-level attributes', () => {
    const payload = buildLangfusePayload(baseInput) as any;
    const span = firstSpan(payload);

    expect(span.name).toBe('generate-card');
    expect(attrValue(span, 'langfuse.observation.type')).toBe('generation');
    expect(attrValue(span, 'langfuse.observation.model.name')).toBe('minimax-m3:cloud');
    expect(attrValue(span, 'langfuse.user.id')).toBe('user@example.com');
    expect(attrValue(span, 'langfuse.session.id')).toBe('cust_123');
    expect(attrValue(span, 'langfuse.environment')).toBe('development');
    expect(attrValue(span, 'langfuse.trace.name')).toBe('generate-card');
    expect(attrValue(span, 'langfuse.trace.tags')).toEqual(['feature:card', 'subfeature:chat', 'provider:ollama', 'streaming:false']);
    expect(attrValue(span, 'langfuse.trace.metadata.customerId')).toBe('cust_123');
    expect(attrValue(span, 'langfuse.trace.metadata.requestId')).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    expect(span.status.code).toBe(1);
  });

  it('sets deterministic base64 trace id from requestId (uuid → hex → base64)', () => {
    const payload = buildLangfusePayload(baseInput) as any;
    const span = firstSpan(payload);

    const hex = '9b1deb4d3b7d4bad9bdd2b0d7b3dcb6d';
    expect(span.traceId).toBe(Buffer.from(hex, 'hex').toString('base64'));
    expect(span.spanId).toMatch(/^[A-Za-z0-9+/]{10,12}=?$/);
  });

  it('ingests usage and cost details as mutually exclusive buckets', () => {
    const payload = buildLangfusePayload(baseInput) as any;
    const span = firstSpan(payload);

    const usage = JSON.parse(attrValue(span, 'langfuse.observation.usage_details'));
    expect(usage).toEqual({ input: 120, output: 80, total: 200 });
  });

  it('omits cost_details when costUsd is 0 and usage when absent', () => {
    const payload = buildLangfusePayload({ ...baseInput, costUsd: 0, usage: undefined }) as any;
    const span = firstSpan(payload);
    expect(attrValue(span, 'langfuse.observation.cost_details')).toBeUndefined();
    expect(attrValue(span, 'langfuse.observation.usage_details')).toBeUndefined();
  });

  it('sends cost_details when costUsd > 0 (Ollama flat-rate custom pricing)', () => {
    const payload = buildLangfusePayload({ ...baseInput, costUsd: 1.25 }) as any;
    const span = firstSpan(payload);
    expect(JSON.parse(attrValue(span, 'langfuse.observation.cost_details'))).toEqual({ total: 1.25 });
  });

  it('marks the span as ERROR with status message when error is present', () => {
    const payload = buildLangfusePayload({
      ...baseInput,
      error: { kind: 'timeout', message: 'upstream timeout' },
    }) as any;
    const span = firstSpan(payload);
    expect(span.status.code).toBe(2);
    expect(span.status.message).toBe('upstream timeout');
    expect(attrValue(span, 'langfuse.observation.level')).toBe('ERROR');
  });

  it('links prompt name and version when provided', () => {
    const payload = buildLangfusePayload({ ...baseInput, promptName: 'card-system', promptVersion: 3 }) as any;
    const span = firstSpan(payload);
    expect(attrValue(span, 'langfuse.observation.prompt.name')).toBe('card-system');
    expect(Number(attrValue(span, 'langfuse.observation.prompt.version'))).toBe(3);
  });

  it('uses raw requestId as trace id when it is already 32-hex', () => {
    const payload = buildLangfusePayload({ ...baseInput, requestId: 'a'.repeat(32) }) as any;
    expect(firstSpan(payload).traceId).toBe(Buffer.from('a'.repeat(32), 'hex').toString('base64'));
  });

  it('does not leak PII: input images are stripped from observation input', () => {
    const inputWithImage = [
      { role: 'user', content: 'guarda', images: ['base64data'] },
      { role: 'user', content: 'testo normale' },
    ];
    const payload = buildLangfusePayload({ ...baseInput, input: inputWithImage }) as any;
    const rawInput = JSON.parse(attrValue(firstSpan(payload), 'langfuse.observation.input'));
    expect(rawInput[0].images).toBeUndefined();
    expect(rawInput[1].content).toBe('testo normale');
  });

  it('replaces base64 images with media token placeholder when media upload is not available', async () => {
    const payload = buildLangfusePayload({
      ...baseInput,
      input: [{ role: 'user', content: 'guarda', images: ['data:image/png;base64,AAAA'] }],
    }) as any;
    const rawInput = JSON.parse(attrValue(firstSpan(payload), 'langfuse.observation.input'));
    expect(rawInput[0].images).toBeUndefined();
    expect(rawInput[0].content).toContain('[immagine');
  });
});

describe('ingestLangfuse (OTLP HTTP/JSON ingestion)', () => {
  beforeEach(() => {
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-test');
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-test');
    vi.stubEnv('LANGFUSE_BASE_URL', 'https://cloud.langfuse.com');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('posts an OTLP JSON batch to /api/public/otel/v1/traces with basic auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await ingestLangfuse(baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://cloud.langfuse.com/api/public/otel/v1/traces');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('pk-test:sk-test').toString('base64')}`);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['x-langfuse-ingestion-version']).toBe('4');
    const body = JSON.parse(init.body);
    expect(body.resourceSpans[0].scopeSpans[0].spans[0].name).toBe('generate-card');
  });

  it('is a no-op when credentials are missing', async () => {
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', '');
    vi.stubEnv('LANGFUSE_SECRET_KEY', '');
    vi.stubEnv('LANGFUSE_BASE_URL', '');
    vi.stubEnv('VITE_LANGFUSE_PUBLIC_KEY', '');
    vi.stubEnv('VITE_LANGFUSE_SECRET_KEY', '');
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await ingestLangfuse(baseInput);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads base64 images to Langfuse media and embeds media token in input', async () => {
    const mediaBodies: any[] = [];
    const fetchMock = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/media')) {
        mediaBodies.push(JSON.parse(init.body));
        return {
          ok: true,
          json: async () => ({ mediaId: 'media_123', uploadUrl: 'https://s3.example/presigned' }),
        };
      }
      if (String(url).startsWith('https://s3.example/')) {
        return { ok: true, status: 200 };
      }
      return { ok: true, status: 200 };
    });
    vi.stubGlobal('fetch', fetchMock);

    await ingestLangfuse({
      ...baseInput,
      input: [
        { role: 'user', content: 'guarda', images: ['data:image/png;base64,QUJD'] },
        { role: 'user', content: 'testo' },
      ],
    });

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain('https://cloud.langfuse.com/api/public/media');
    expect(urls.some((u) => u.startsWith('https://s3.example/'))).toBe(true);

    // L'API media richiede sha256Hash + field + traceId (400 senza: l'upload
    // fallisce e l'immagine resta placeholder).
    expect(mediaBodies.length).toBe(1);
    expect(mediaBodies[0].contentType).toBe('image/png');
    expect(mediaBodies[0].field).toBe('input');
    expect(mediaBodies[0].sha256Hash).toMatch(/^[0-9a-f]{64}$/);
    expect(mediaBodies[0].traceId).toBe(
      Buffer.from('9b1deb4d3b7d4bad9bdd2b0d7b3dcb6d', 'hex').toString('base64')
    );

    const otlp = fetchMock.mock.calls.find((c) => String(c[0]).includes('/otel/v1/traces'));
    const span = JSON.parse(otlp![1].body).resourceSpans[0].scopeSpans[0].spans[0];
    const rawInput = JSON.parse(
      span.attributes.find((a: any) => a.key === 'langfuse.observation.input').value.stringValue
    );
    expect(rawInput[0].content).toContain('@@@langfuseMedia:type=image/png|id=media_123');
    expect(rawInput[1].content).toBe('testo');
  });

  it('never throws when media upload fails (falls back to placeholder)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));

    await expect(
      ingestLangfuse({
        ...baseInput,
        input: [{ role: 'user', content: 'x', images: ['data:image/jpeg;base64,QUJD'] }],
      })
    ).resolves.toBeUndefined();
  });

  it('PII: base64 inline nel content string (anteprima vision) → token media, mai raw', async () => {
    const fetchMock = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/media')) {
        return { ok: true, json: async () => ({ mediaId: 'media_vis', uploadUrl: 'https://s3.example/u' }) };
      }
      if (String(url).startsWith('https://s3.example/')) return { ok: true, status: 200 };
      return { ok: true, status: 200 };
    });
    vi.stubGlobal('fetch', fetchMock);

    const RAW_B64 = 'data:image/jpeg;base64,QUJD';
    await ingestLangfuse({
      ...baseInput,
      input: [
        { role: 'system', content: 'Sei un assistente card' },
        { role: 'user', content: `Anteprima card allegata (base64 JPEG): ${RAW_B64}\n\nRendi più stampabile` },
      ],
    });

    const otlp = fetchMock.mock.calls.find((c) => String(c[0]).includes('/otel/v1/traces'));
    const span = JSON.parse(otlp![1].body).resourceSpans[0].scopeSpans[0].spans[0];
    const rawInput = JSON.parse(
      span.attributes.find((a: any) => a.key === 'langfuse.observation.input').value.stringValue
    );
    const userContent = rawInput[1].content;
    expect(userContent).not.toContain('QUJD');
    expect(userContent).not.toContain('base64,');
    expect(userContent).toContain('@@@langfuseMedia:type=image/jpeg|id=media_vis');
    expect(userContent).toContain('Rendi più stampabile');
  });

  it('uploads output imageBase64 (Gemini) and embeds media token in output', async () => {
    const fetchMock = vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/api/public/media')) {
        return { ok: true, json: async () => ({ mediaId: 'media_img_1', uploadUrl: 'https://s3.example/u' }) };
      }
      if (String(url).startsWith('https://s3.example/')) return { ok: true, status: 200 };
      return { ok: true, status: 200 };
    });
    vi.stubGlobal('fetch', fetchMock);

    await ingestLangfuse({
      ...baseInput,
      name: 'generate-flyer-hero',
      provider: 'gemini',
      output: { mimeType: 'image/png', sizeKB: 12, imageBase64: 'data:image/png;base64,SU1H' },
    });

    const otlp = fetchMock.mock.calls.find((c) => String(c[0]).includes('/otel/v1/traces'));
    const span = JSON.parse(otlp![1].body).resourceSpans[0].scopeSpans[0].spans[0];
    const rawOutput = JSON.parse(
      span.attributes.find((a: any) => a.key === 'langfuse.observation.output').value.stringValue
    );
    expect(rawOutput.imageBase64).toBeUndefined();
    expect(rawOutput.image).toContain('@@@langfuseMedia:type=image/png|id=media_img_1');
    expect(rawOutput.mimeType).toBe('image/png');
  });

  it('output imageBase64 senza upload → placeholder (mai base64 raw)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    await ingestLangfuse({
      ...baseInput,
      name: 'generate-card-cover',
      provider: 'gemini',
      output: { mimeType: 'image/jpeg', sizeKB: 5, imageBase64: 'data:image/jpeg;base64,RVRIRS1ESUZGRVJFTlQ=' },
    });
    const fetchMock = vi.mocked(global.fetch);
    const otlp = fetchMock.mock.calls.find((c) => String(c[0]).includes('/otel/v1/traces'));
    const body = otlp![1] as { body?: string };
    const span = JSON.parse(String(body.body)).resourceSpans[0].scopeSpans[0].spans[0];
    const rawOutput = JSON.parse(
      span.attributes.find((a: any) => a.key === 'langfuse.observation.output').value.stringValue
    );
    expect(rawOutput.imageBase64).toBeUndefined();
    expect(String(rawOutput.image)).toContain('[immagine allegata');
  });

  it('never throws when the upstream fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(ingestLangfuse(baseInput)).resolves.toBeUndefined();
  });

  it('never throws on non-ok upstream responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(ingestLangfuse(baseInput)).resolves.toBeUndefined();
  });

  it('falls back to VITE_LANGFUSE_* vars (dev proxy exposes client vars)', async () => {
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', '');
    vi.stubEnv('LANGFUSE_SECRET_KEY', '');
    vi.stubEnv('LANGFUSE_BASE_URL', '');
    vi.stubEnv('VITE_LANGFUSE_PUBLIC_KEY', 'pk-vite');
    vi.stubEnv('VITE_LANGFUSE_SECRET_KEY', 'sk-vite');
    vi.stubEnv('VITE_LANGFUSE_BASE_URL', 'https://cloud.langfuse.com');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await ingestLangfuse(baseInput);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('pk-vite:sk-vite').toString('base64')}`);
  });
});
