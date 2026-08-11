// Langfuse observability: ingest OTLP/HTTP JSON traces → Langfuse v4.
// Zero dipendenze: costruiamo il payload OTLP a mano (docs
// /docs/integrations/native/opentelemetry, attribute mapping v4) e lo
// mandiamo via fetch fire-and-forget. Fallimento = silenzioso: Langfuse
// non deve mai rallentare o rompere le chiamate AI.

export type LangfuseMessage = {
  role: string;
  content: string;
  images?: string[];
};

export interface LangfuseUsage {
  promptTokens: number;
  completionTokens: number;
}

export type LangfuseGenerationInput = {
  name: string;
  requestId: string;
  model: string;
  provider: 'deepseek' | 'ollama' | 'gemini';
  userEmail?: string;
  customerId?: string;
  sessionId?: string;
  feature: string;
  /** TB-029: subfeature (chat/cover/photo/background/hero/flash/copy/review). */
  subfeature?: string;
  /** TB-029: true per chat streaming (tag streaming:true). */
  streaming?: boolean;
  environment?: string;
  input?: unknown;
  output?: unknown;
  usage?: LangfuseUsage;
  costUsd?: number;
  error?: { kind?: string; message?: string };
  promptName?: string;
  promptVersion?: number;
  startTime?: number;
  endTime?: number;
};

// Il trace ID Langfuse segue W3C: 16 byte hex → in OTLP/JSON è base64.
// requestId è già un uuid → hex senza trattini → 32 char. Se non è uuid
// (es. 32-hex già), si usa tale e quale; altrimenti hash md5 (16 byte).
function toTraceId(requestId: string): string {
  const clean = requestId.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/.test(clean)) return Buffer.from(clean, 'hex').toString('base64');
  return Buffer.from(cryptoMd5(requestId), 'hex').toString('base64');
}

function cryptoMd5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

function toSpanId(): string {
  return Buffer.from(crypto.randomBytes(8)).toString('base64');
}

function toIso(ms?: number): string {
  return new Date(ms ?? Date.now()).toISOString();
}

// PII guard: le immagini base64 dei messaggi non devono finire raw in
// Langfuse. Senza upload → placeholder leggibile nel content.
function sanitizeInput(input: unknown): unknown {
  if (!Array.isArray(input)) return input;
  return input.map((m: unknown) => {
    if (!m || typeof m !== 'object' || !('images' in m)) return m;
    const { images, ...rest } = m as Record<string, unknown>;
    const first = Array.isArray(images) ? String(images[0] ?? '') : '';
    const mime = first.match(/^data:([^;]+);base64,/)?.[1] ?? 'image/png';
    const content = String(rest.content ?? '');
    return {
      ...rest,
      content: content ? `${content}\n[immagine allegata (${mime})]` : `[immagine allegata (${mime})]`,
    };
  });
}

// Regex data URI base64 inline (anteprime vision passano nel content string,
// es. "Anteprima card allegata (base64 JPEG): data:image/jpeg;base64,...").
const DATA_URI_RE = /data:([^;,]+);base64,([A-Za-z0-9+/=]+)/g;

// Dedup per contenuto: stessa immagine in più messaggi = un solo upload.
// Key = mime + b64: lo stesso payload base64 con mime diverso è un media
// diverso (token e rendering dipendono dal content type).
const mediaIdCache = new Map<string, string>();

// Upload singola immagine base64 → token Langfuse (o placeholder).
// L'API media richiede: contentType, contentLength, sha256Hash, traceId,
// field (400 senza — l'immagine resterebbe placeholder).
async function resolveImageToToken(
  dataUrl: string,
  baseUrl: string,
  auth: string,
  field: 'input' | 'output' | 'metadata',
  traceId: string
): Promise<string> {
  const mime = dataUrl.match(/^data:([^;]+);base64,/)?.[1] ?? 'image/png';
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const cacheKey = `${mime}:${b64}`;
  let mediaId = mediaIdCache.get(cacheKey);
  if (!mediaId) {
    try {
      const sha256Hash = crypto.createHash('sha256').update(b64, 'utf8').digest('hex');
      const res = await fetch(`${baseUrl}/api/public/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          contentType: mime,
          contentLength: Math.ceil(b64.length * 0.75),
          sha256Hash,
          field,
          traceId,
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { mediaId?: string; uploadUrl?: string };
        if (body.uploadUrl) {
          await fetch(body.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mime },
            body: Buffer.from(b64, 'base64'),
          });
        }
        mediaId = body.mediaId;
        if (mediaId) mediaIdCache.set(cacheKey, mediaId);
      }
    } catch {
      // fallback placeholder
    }
  }
  return mediaId
    ? `@@@langfuseMedia:type=${mime}|id=${mediaId}|source=base64_data_uri@@@`
    : `[immagine allegata (${mime})]`;
}

// Upload immagini base64 → Langfuse media, sostituite con token
// `@@@langfuseMedia:...@@@` (rendering inline nella UI). Best-effort:
// fallimento upload = placeholder. PII: mai base64 raw nel payload — vale
// anche per i data URI inline nel content string, non solo `images[]`.
// NOTA: String.replace non supporta callback async → risolviamo i token
// prima (Promise.all) e poi facciamo un replace sincrono.
async function resolveMediaRefs(input: unknown, baseUrl: string, auth: string, traceId: string): Promise<unknown> {
  if (!Array.isArray(input)) return input;
  return Promise.all(
    input.map(async (m: unknown) => {
      if (!m || typeof m !== 'object') return m;
      const msg = m as { images?: string[]; content?: string };
      let content = String(msg.content ?? '');
      // 1. immagini in `images[]` → token, appesi al content
      const imageTokens: string[] = [];
      for (const img of msg.images ?? []) {
        imageTokens.push(await resolveImageToToken(img, baseUrl, auth, 'input', traceId));
      }
      if (imageTokens.length > 0) {
        content = content ? `${content}\n${imageTokens.join('\n')}` : imageTokens.join('\n');
      }
      // 2. data URI base64 inline nel content string (anteprime vision):
      //    raccogli i data URI, risolvi i token, replace sincrono
      const matches = Array.from(content.matchAll(DATA_URI_RE));
      if (matches.length > 0) {
        const tokens = await Promise.all(
          matches.map(async (match) => {
            const full = match[0];
            const mime = match[1];
            const b64 = match[2];
            return { full, token: await resolveImageToToken(`data:${mime};base64,${b64}`, baseUrl, auth, 'input', traceId) };
          })
        );
        for (const { full, token } of tokens) {
          content = content.replace(full, token);
        }
      }
      return { ...msg, content };
    })
  );
}

// Output generazione immagini Gemini: imageBase64 → token media (o
// placeholder). Mai base64 raw nel payload (PII + dimensione).
async function resolveMediaOutput(output: unknown, baseUrl: string, auth: string, traceId: string): Promise<unknown> {
  if (!output || typeof output !== 'object') return output;
  const o = output as Record<string, unknown>;
  if (typeof o.imageBase64 !== 'string' || !o.imageBase64) return output;
  const { imageBase64, ...rest } = o;
  const token = await resolveImageToToken(imageBase64, baseUrl, auth, 'output', traceId);
  return { ...rest, image: token };
}

function strAttr(key: string, value: string) {
  return { key, value: { stringValue: value } };
}
function intAttr(key: string, value: number) {
  return { key, value: { intValue: String(value) } };
}
function jsonAttr(key: string, value: unknown) {
  return strAttr(key, JSON.stringify(value));
}

export function buildLangfusePayload(input: LangfuseGenerationInput) {
  const { name, requestId, model, userEmail, customerId, feature, environment } = input;
  const startTime = input.startTime ?? Date.now();
  const endTime = input.endTime ?? startTime;
  const isError = !!input.error;

  // TB-029: tags strutturati filtrabili (feature/subfeature/provider/streaming).
  const tags = [
    `feature:${feature}`,
    `subfeature:${input.subfeature ?? 'chat'}`,
    `provider:${input.provider}`,
    `streaming:${input.streaming === true}`,
  ];

  const attributes: Array<{ key: string; value: any }> = [
    strAttr('langfuse.observation.type', 'generation'),
    strAttr('langfuse.observation.model.name', model),
    strAttr('langfuse.trace.name', name),
    { key: 'langfuse.trace.tags', value: { stringArrayValue: tags } },
    strAttr('langfuse.trace.metadata.requestId', requestId),
    strAttr('langfuse.trace.metadata.provider', input.provider),
  ];
  if (userEmail) attributes.push(strAttr('langfuse.user.id', userEmail));
  // Sessione Langfuse = sessionId (docId: raggruppa chat+immagini del
  // documento). customerId è fallback (auto-build CRM) e sempre in metadata.
  const session = input.sessionId ?? customerId;
  if (session) attributes.push(strAttr('langfuse.session.id', session));
  if (customerId) attributes.push(strAttr('langfuse.trace.metadata.customerId', customerId));
  if (environment) attributes.push(strAttr('langfuse.environment', environment));
  if (input.input !== undefined) attributes.push(jsonAttr('langfuse.observation.input', sanitizeInput(input.input)));
  if (input.output !== undefined) attributes.push(jsonAttr('langfuse.observation.output', input.output));
  if (input.usage) {
    const { promptTokens, completionTokens } = input.usage;
    attributes.push(jsonAttr('langfuse.observation.usage_details', { input: promptTokens, output: completionTokens, total: promptTokens + completionTokens }));
  }
  // Costo esplicito solo se > 0: Ollama Pro è flat $20/mo (pricing custom),
  // DeepSeek/Gemini usano l'inferenza da model definition di Langfuse.
  if (input.costUsd && input.costUsd > 0) {
    attributes.push(jsonAttr('langfuse.observation.cost_details', { total: input.costUsd }));
  }
  if (input.promptName) {
    attributes.push(strAttr('langfuse.observation.prompt.name', input.promptName));
    if (input.promptVersion !== undefined) attributes.push(intAttr('langfuse.observation.prompt.version', input.promptVersion));
  }
  if (isError) {
    attributes.push(strAttr('langfuse.observation.level', 'ERROR'));
    if (input.error?.kind) attributes.push(strAttr('langfuse.trace.metadata.errorKind', input.error.kind));
  }

  const span = {
    traceId: toTraceId(requestId),
    spanId: toSpanId(),
    name,
    kind: 1,
    startTimeUnixNano: String(startTime * 1_000_000),
    endTimeUnixNano: String(endTime * 1_000_000),
    attributes,
    status: isError
      ? { code: 2, message: input.error?.message || 'error' }
      : { code: 1 },
  };

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [strAttr('service.name', 'precisionquote-api')],
        },
        scopeSpans: [
          {
            scope: { name: 'precisionquote' },
            spans: [span],
          },
        ],
      },
    ],
  };
}

let flushPromise: Promise<void> | null = null;

export async function ingestLangfuse(input: LangfuseGenerationInput): Promise<void> {
  // Fallback VITE_*: il dev proxy Vite espone le var client (gotcha: in
  // locale l'utente può averle come VITE_LANGFUSE_*). In prod si usano
  // solo LANGFUSE_* (server-side).
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY || process.env.VITE_LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || process.env.VITE_LANGFUSE_BASE_URL;
  if (!publicKey || !secretKey || !baseUrl) return;

  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
  // Media: upload base64 → token Langfuse (placeholder se fallisce).
  // traceId (base64, formato OTLP) serve all'API media per linkare il file.
  const traceId = toTraceId(input.requestId);
  const resolvedInput = await resolveMediaRefs(input.input, baseUrl, auth, traceId);
  const resolvedOutput = await resolveMediaOutput(input.output, baseUrl, auth, traceId);
  const payload = buildLangfusePayload({ ...input, input: resolvedInput, output: resolvedOutput });

  try {
    flushPromise = fetch(`${baseUrl}/api/public/otel/v1/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'x-langfuse-ingestion-version': '4',
      },
      body: JSON.stringify(payload),
    }).then((res) => {
      if (!res.ok) void res.text().catch(() => '');
      return undefined;
    });
    // Timeout 2s: Langfuse non deve mai aggiungere latenza alla risposta.
    await Promise.race([flushPromise, new Promise((r) => setTimeout(r, 2000))]);
  } catch {
    // Best-effort: nessun throw verso il chiamante.
  }
}

import crypto from 'node:crypto';
