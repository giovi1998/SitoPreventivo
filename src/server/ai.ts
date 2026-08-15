// AI endpoints server-side (chat, streaming, immagini Gemini, tools).
// Estratto da handler.ts: unico handler dedicato, ~1300 righe.
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  json, getRequestId, logAI, jsonWithRequestId, getClientIp,
  consumeRateLimit, validate, addCorsHeaders, requireAdmin,
  buildGeminiMultimodalInput, normalizeGeminiImageModel,
  resolveGeminiImageSize, GEMINI_IMG_CLAMP_BYTES,
} from './core.ts';
import { getDb, customersTable } from './db.ts';
import { fetchFirecrawlPage } from './crm.ts';
import { ingestLangfuse } from './langfuse.ts';
import { fetchRemotePrompt } from './langfusePrompts.ts';
import type { RouteHandler } from './types.ts';

const LF_ENV = process.env.VERCEL_ENV === 'production' ? 'production' : 'development';

// TB-029: trace unifomata per tutti gli endpoint AI (best-effort, mai throw).
function traceGeneration(input: Parameters<typeof ingestLangfuse>[0]) {
  void ingestLangfuse({ ...input, environment: input.environment ?? LF_ENV });
}

// TB-029: nome trace verb-first specifico per feature (mai generico).
// kind = feature orchestrator (quote/card/flyer/logo/social/onboarding/website).
function chatTraceName(kind?: string): string {
  const feature = kind && kind !== 'chat' ? kind : 'chat';
  return `${feature}-ai-chat`;
}

// TB-029: tags strutturati filtrabili in Langfuse (definiti in
// langfuse.ts buildLangfusePayload — niente duplicazione client/server).

// TB-029: costo USD calcolato server-side (tabella inline, gotcha §1.1:
// providerPricing.ts è client-side e non importabile qui). Il body costUsd
// del client è un override opzionale (vince se presente).
const DEEPSEEK_PRICES: Record<string, { input: number; output: number }> = {
  'deepseek-v4-flash': { input: 0.14, output: 0.28 },
  'deepseek-v4-pro': { input: 0.55, output: 2.19 },
};
const GEMINI_PER_IMAGE: Record<string, number> = {
  'gemini-3.1-flash-image': 0.04,
  'gemini-2.0-flash-preview-image-generation': 0.02,
};

function computeCostUsd(
  provider: string,
  model: string,
  usage?: { promptTokens: number; completionTokens: number },
  imageCount = 0
): number {
  if (provider === 'gemini') {
    const perImage = GEMINI_PER_IMAGE[model] ?? GEMINI_PER_IMAGE['gemini-3.1-flash-image'];
    return Math.round(imageCount * perImage * 1_000_000) / 1_000_000;
  }
  if (provider === 'deepseek' && usage) {
    const p = DEEPSEEK_PRICES[model] ?? DEEPSEEK_PRICES['deepseek-v4-flash'];
    const cost = (usage.promptTokens / 1_000_000) * p.input + (usage.completionTokens / 1_000_000) * p.output;
    return Math.round(cost * 1_000_000) / 1_000_000;
  }
  // Ollama Pro flat $20/mo → 0 per chiamata
  return 0;
}

export const handleAI: RouteHandler = async (path, method, req, res, body) => {
  if (path === '/ai/chat' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aichat', 30, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste AI. Attendi un minuto.' }, requestId);
    }
    const v = validate(
      z.object({
        model: z.string().optional(),
        messages: z
          .array(
            z.object({
              role: z.enum(['system', 'user', 'assistant', 'tool']),
              content: z.string(),
              tool_call_id: z.string().optional(),
              name: z.string().optional(),
              // TB-023: Ollama multimodal messages may include images
              images: z.array(z.string()).optional(),
              reasoning_content: z.string().optional(),
              tool_calls: z
                .array(
                  z.object({
                    function: z.object({
                      name: z.string(),
                      arguments: z.string(),
                    }),
                  }),
                )
                .optional(),
            }),
          )
          .min(1)
          .max(50),
        response_format: z.object({ type: z.literal('json_object') }).optional(),
        reasoning_effort: z.enum(['low', 'high', 'max']).optional(),
        max_tokens: z.number().int().positive().max(16384).optional(),
        userEmail: z.string().email().optional(),
        // TB-029: identità per Langfuse tracing (vista costi per cliente)
        customerId: z.string().min(1).max(100).optional(),
        sessionId: z.string().min(1).max(200).optional(),
        // TB-029: feature orchestrator per tag Langfuse (quote/card/flyer/...)
        kind: z.string().min(1).max(50).optional(),
        // T7: trace gerarchica agente (runId 32-hex, rootSpanId/stepSpanId 16-hex)
        runId: z.string().regex(/^[0-9a-f]{32}$/).optional(),
        runName: z.string().min(1).max(50).optional(),
        startRun: z.boolean().optional(),
        rootSpanId: z.string().regex(/^[0-9a-f]{16}$/).optional(),
        stepName: z.string().min(1).max(50).optional(),
        stepSpanId: z.string().regex(/^[0-9a-f]{16}$/).optional(),
        // TB-029: costo USD calcolato dal client (providerPricing) per cost_details
        costUsd: z.number().min(0).max(1000).optional(),
        // TB-023: provider routing (default deepseek)
        provider: z.enum(['deepseek', 'ollama']).optional(),
        // Ollama-only fields
        tools: z
          .array(
            z.object({
              type: z.literal('function'),
              function: z.object({
                name: z.string(),
                description: z.string().optional(),
                parameters: z.record(z.string(), z.unknown()).optional(),
              }),
            }),
          )
          .optional(),
        format: z.union([z.literal('json'), z.record(z.string(), z.unknown())]).optional(),
        stream: z.boolean().optional(),
        options: z.record(z.string(), z.unknown()).optional(),
      }),
      body
    );
    if (v.error) {
      logAI({ tag: 'ai_chat', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const customerId = v.data.customerId;
    const sessionId = v.data.sessionId;
    const kind = v.data.kind;
    const costUsd = v.data.costUsd;
    const provider = v.data.provider || 'deepseek';
    // T7: trace gerarchica agente (opzionali, backward-compatible)
    const runId = v.data.runId;
    const runName = v.data.runName;
    const startRun = v.data.startRun;
    const rootSpanId = v.data.rootSpanId;
    const stepName = v.data.stepName;
    const stepSpanId = v.data.stepSpanId;

    // ─── TB-023: Ollama Pro Cloud routing ─────────────────────────
    if (provider === 'ollama') {
      const ollamaKey = process.env.OLLAMA_API_KEY;
      if (!ollamaKey) {
        logAI({ tag: 'ai_chat', requestId, email: userEmail, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
        return jsonWithRequestId(req, res, 503, { error: 'Ollama non configurato. Configura OLLAMA_API_KEY su Vercel.' }, requestId);
      }
      const { model, messages, max_tokens, tools, format, options: ollamaOptions, reasoning_effort } = v.data;
      const ollamaModel = model || 'minimax-m3:cloud';
      const controller = new AbortController();
      // Ollama con thinking 'max' + output 16k tok: le generazioni website
      // (CSS/JS lunghi) superano i 60s — timeout alzato a 600s (gotcha
      // §26.20: a 60s il CSS da 100-130s falliva sempre → sito mai generato).
      const timeout = setTimeout(() => controller.abort(), 600000); // Ollama Cloud più lento di DeepSeek
      const startedAt = Date.now();
      let apiRes: Response;
      try {
        const ollamaBody: Record<string, unknown> = {
          model: ollamaModel,
          messages: messages.map((m) => {
            const msg: Record<string, unknown> = { role: m.role, content: m.content };
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
            if (m.name) msg.name = m.name;
            if (m.reasoning_content) msg.thinking = m.reasoning_content;
            if (m.images && m.images.length > 0) msg.images = m.images;
            if (m.tool_calls && m.tool_calls.length > 0) {
              msg.tool_calls = m.tool_calls.map((tc) => ({
                function: { name: tc.function.name, arguments: tc.function.arguments },
              }));
            }
            return msg;
          }),
          stream: false,
          think: reasoning_effort ?? 'max',
        };
        if (max_tokens !== undefined) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), num_predict: max_tokens };
        }
        if (ollamaOptions) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), ...ollamaOptions };
        }
        if (v.data.response_format?.type === 'json_object' || format === 'json') {
          ollamaBody.format = 'json';
        } else if (format) {
          ollamaBody.format = format;
        }
        if (tools && tools.length > 0) ollamaBody.tools = tools;

        apiRes = await fetch('https://ollama.com/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ollamaKey}`,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify(ollamaBody),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
          logAI({ tag: 'ai_chat', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'timeout' });
          return jsonWithRequestId(req, res, 504, { error: 'Ollama non ha risposto entro 60 secondi. Riprova.' }, requestId);
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
      if (!apiRes.ok) {
        const errBody = await apiRes.text().catch(() => 'Unknown error');
        const errorKind = apiRes.status === 429 ? 'rate_limit' : apiRes.status === 401 ? 'auth' : 'upstream';
        logAI({ tag: 'ai_chat', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
        if (apiRes.status === 429) {
          return jsonWithRequestId(req, res, 429, { error: 'Quota Ollama Pro superato. Riprova tra qualche ora o passa a DeepSeek.' }, requestId);
        }
        if (apiRes.status === 401) {
          return jsonWithRequestId(req, res, 401, { error: 'Chiave API Ollama non valida' }, requestId);
        }
        return jsonWithRequestId(req, res, apiRes.status, { error: `Ollama (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
      }
      const raw = await apiRes.json();
      // Normalizza risposta Ollama → formato DeepSeek-like per il client
      const ollamaRaw = raw as {
        message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string | object } }> };
        prompt_eval_count?: number;
        eval_count?: number;
      };
      const toolCalls = ollamaRaw.message?.tool_calls?.map((tc, i) => ({
        id: `call_${Date.now()}_${i}`,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments:
            typeof tc.function.arguments === 'string'
              ? tc.function.arguments
              : JSON.stringify(tc.function.arguments ?? {}),
        },
      }));
      const normalized = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: ollamaRaw.message?.content || '',
              ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: ollamaRaw.prompt_eval_count ?? 0,
          completion_tokens: ollamaRaw.eval_count ?? 0,
          total_tokens: (ollamaRaw.prompt_eval_count ?? 0) + (ollamaRaw.eval_count ?? 0),
        },
        requestId,
      };
      logAI({
        tag: 'ai_chat',
        requestId,
        email: userEmail,
        model: ollamaModel,
        durationMs: Date.now() - startedAt,
        outcome: 'ok',
        tokens: normalized.usage.total_tokens || undefined,
        provider: 'ollama',
      });
      traceGeneration({
        name: chatTraceName(kind),
        requestId,
        model: ollamaModel,
        provider: 'ollama',
        userEmail,
        customerId,
        feature: kind ?? 'chat',
        subfeature: 'chat',
        streaming: false,
        input: messages,
        output: normalized,
        usage: { promptTokens: normalized.usage.prompt_tokens, completionTokens: normalized.usage.completion_tokens },
        costUsd: costUsd ?? computeCostUsd('ollama', ollamaModel),
        startTime: startedAt,
        sessionId,
        runId,
        runName,
        startRun,
        rootSpanId,
        stepName,
        stepSpanId,
      });
      return json(req, res, 200, normalized);
    }

    // ─── DeepSeek (default, preesistente) ─────────────────────────
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_chat', requestId, email: userEmail, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'DeepSeek non configurato.' }, requestId);
    }
    const { model, messages, response_format, reasoning_effort, max_tokens } = v.data;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const startedAt = Date.now();
    let apiRes: Response;
    try {
      apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'deepseek-v4-flash',
          messages,
          response_format: response_format || { type: 'json_object' },
          reasoning_effort: reasoning_effort ?? 'max',
          extra_body: { thinking: { type: 'enabled' } },
          ...(max_tokens ? { max_tokens } : {}),
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        logAI({ tag: 'ai_chat', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'timeout' });
        return jsonWithRequestId(req, res, 504, { error: 'DeepSeek non ha risposto entro 25 secondi. Riprova.' }, requestId);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => 'Unknown error');
      const errorKind = apiRes.status === 402 ? 'quota' : apiRes.status === 401 ? 'auth' : apiRes.status === 429 ? 'rate_limit' : 'upstream';
      logAI({ tag: 'ai_chat', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      traceGeneration({
        name: chatTraceName(kind),
        requestId,
        model: model || 'deepseek-v4-flash',
        provider: 'deepseek',
        userEmail,
        customerId,
        feature: kind ?? 'chat',
        subfeature: 'chat',
        streaming: false,
        input: messages,
        error: { kind: errorKind, message: errBody.slice(0, 200) },
        startTime: startedAt,
        sessionId,
        runId,
        runName,
        startRun,
        rootSpanId,
        stepName,
        stepSpanId,
      });
      if (apiRes.status === 402) return jsonWithRequestId(req, res, 402, { error: 'Credito DeepSeek esaurito. Ricarica su platform.deepseek.com' }, requestId);
      if (apiRes.status === 401) return jsonWithRequestId(req, res, 401, { error: 'Chiave API DeepSeek non valida' }, requestId);
      if (apiRes.status === 429) return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste a DeepSeek. Attendi qualche secondo e riprova.' }, requestId);
      return jsonWithRequestId(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
    }
    const data = await apiRes.json();
    const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
    logAI({
      tag: 'ai_chat',
      requestId,
      email: userEmail,
      model: model || 'deepseek-v4-flash',
      durationMs: Date.now() - startedAt,
      outcome: 'ok',
      tokens: usage?.total_tokens,
      provider: 'deepseek',
    });
    traceGeneration({
      name: chatTraceName(kind),
      requestId,
      model: model || 'deepseek-v4-flash',
      provider: 'deepseek',
      userEmail,
      customerId,
      feature: kind ?? 'chat',
      subfeature: 'chat',
      streaming: false,
      input: messages,
      output: data,
      usage: usage ? { promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0 } : undefined,
      costUsd: costUsd ?? computeCostUsd('deepseek', model || 'deepseek-v4-flash', usage ? { promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0 } : undefined),
      startTime: startedAt,
      sessionId,
      runId,
      runName,
      startRun,
      rootSpanId,
      stepName,
      stepSpanId,
    });
    return json(req, res, 200, { ...data, requestId });
  }

  // Phase 3: dedicated copy endpoint for flyers. Same DeepSeek upstream
  // as /ai/chat, but with a tighter rate limit (10/min per IP) since
  // copy generation is more expensive (full prompt + system instructions)
  // and not interactive like chat. Auth: same as /ai/chat (serverless
  // function is auth-gated at the route level: a valid session cookie or
  // Vercel-Auth is required; the actual authorization check happens in
  // dataService.chatWithAI client side). The endpoint trusts the client
  // to have a valid session.
  if (path === '/ai/copy-flyer' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'flyerCopy', 10, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni di copy. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_copy_flyer', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'DeepSeek non configurato.' }, requestId);
    }
    const v = validate(
      z.object({
        brief: z.string().max(1000),
        tone: z.enum(['formale', 'giovanile', 'tecnico']),
        layout: z.enum(['classic', 'centered', 'split', 'magazine']).optional(),
        size: z.enum(['A6', 'A5', 'A4', 'Letter', 'Square']).optional(),
        model: z.string().optional(),
        // TB-029: identità per Langfuse tracing (vista costi per cliente)
        userEmail: z.string().email().optional(),
        customerId: z.string().min(1).max(100).optional(),
        sessionId: z.string().min(1).max(200).optional(),
      }),
      body
    );
    if (v.error) {
      logAI({ tag: 'ai_copy_flyer', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { errors: v.errors }, requestId);
    }
    const { brief, tone, layout, size, model, userEmail, customerId, sessionId } = v.data;
    const startedAt = Date.now();
    // Brief is sanitized server-side: strip HTML tags and control
    // characters before it hits the LLM prompt. This is a defense in
    // depth: the client sanitizes too (see sanitizeFlyerBrief in
    // src/ai/prompts/flyerSystem.ts), but we never trust a client.
    const sanitizedBrief = String(brief || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    if (!sanitizedBrief) return json(req, res, 400, { error: 'Brief vuoto' });
    // Build the prompt server-side: the public API surface doesn't
    // expose the prompt template (proprietary copy framework). Same
    // template as the client's flyerCopy.ts so behavior is consistent
    // regardless of where the call originates.
    const systemMsg = `Sei un copywriter italiano esperto in volantini pubblicitari. Rispondi SOLO con JSON valido.`;
    const toneLine =
      tone === 'formale'
        ? 'tono formale e professionale'
        : tone === 'giovanile'
          ? 'tono fresco e giovanile, contrazioni ammesse'
          : 'tono tecnico e preciso, includi numeri e specifiche';
    const bodyBudget = size === 'A4' || size === 'Letter' ? 800 : size === 'Square' ? 600 : size === 'A6' ? 300 : 500;
    const userMsg = `Brief: "${sanitizedBrief}"
Tono: ${toneLine}
${layout ? `Layout: ${layout}` : ''}
${size ? `Formato: ${size}` : ''}

Restituisci SOLO un oggetto JSON valido con questa struttura:
{
  "headline": "titolo principale, max 60 caratteri",
  "subheadline": "sottotitolo, max 100 caratteri",
  "body": "corpo del testo, max ${bodyBudget} caratteri, usa \\\\n per paragrafi",
  "cta": { "label": "call to action, max 30 caratteri" }
}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let apiRes: Response;
    try {
      apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: userMsg },
          ],
          response_format: { type: 'json_object' },
          reasoning_effort: 'max',
          extra_body: { thinking: { type: 'enabled' } },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        logAI({ tag: 'ai_copy_flyer', requestId, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'timeout' });
        return jsonWithRequestId(req, res, 504, { error: 'DeepSeek non ha risposto entro 25 secondi. Riprova.' }, requestId);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => 'Unknown error');
      const errorKind = apiRes.status === 402 ? 'quota' : apiRes.status === 401 ? 'auth' : apiRes.status === 429 ? 'rate_limit' : 'upstream';
      logAI({ tag: 'ai_copy_flyer', requestId, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (apiRes.status === 402) return jsonWithRequestId(req, res, 402, { error: 'Credito DeepSeek esaurito.' }, requestId);
      if (apiRes.status === 401) return jsonWithRequestId(req, res, 401, { error: 'Chiave API DeepSeek non valida' }, requestId);
      if (apiRes.status === 429) return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste a DeepSeek. Attendi qualche secondo e riprova.' }, requestId);
      return jsonWithRequestId(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
    }
    const data = await apiRes.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      logAI({ tag: 'ai_copy_flyer', requestId, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_response' });
      return jsonWithRequestId(req, res, 502, { error: 'Risposta AI vuota o malformata' }, requestId);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      logAI({ tag: 'ai_copy_flyer', requestId, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'not_json' });
      return jsonWithRequestId(req, res, 502, { error: 'AI non ha restituito JSON valido', raw: content.slice(0, 500) }, requestId);
    }
    const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
    logAI({ tag: 'ai_copy_flyer', requestId, model: model || 'deepseek-v4-flash', durationMs: Date.now() - startedAt, outcome: 'ok', tokens: usage?.total_tokens });
    traceGeneration({
      name: 'generate-flyer-copy',
      requestId,
      model: model || 'deepseek-v4-flash',
      provider: 'deepseek',
      userEmail,
      customerId,
      sessionId,
      feature: 'flyer',
      input: { brief, tone, layout, size },
      output: parsed,
      usage:
        usage?.prompt_tokens != null || usage?.completion_tokens != null
          ? {
              promptTokens: usage.prompt_tokens ?? 0,
              completionTokens: usage.completion_tokens ?? 0,
            }
          : undefined,
      startTime: startedAt,
    });
    return json(req, res, 200, { data: parsed, raw: content, requestId });
  }

  // POST /ai/embeddings → Gemini gemini-embedding-2 (RAG customer knowledge)
  if (path === '/ai/embeddings' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'embeddings', 30, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return json(req, res, 429, { error: 'Troppe richieste embeddings. Attendi un minuto.' });
    }
    const v = validate(
      z.object({
        input: z.string().max(8000),
        model: z.enum(['gemini-embedding-2']).optional(),
      }),
      body
    );
    if (v.error) return json(req, res, 400, { errors: v.errors });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(req, res, 503, { error: 'Gemini non configurato. Configura GEMINI_API_KEY su Vercel.' });
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.embedContent({
        model: 'models/gemini-embedding-2',
        contents: v.data.input,
      });
      // SDK ritorna `embeddings: [{values}]` (plurale); fallback singolare.
      const r = result as unknown as { embeddings?: Array<{ values?: number[] }>; embedding?: { values?: number[] } };
      const embedding = r?.embeddings?.[0]?.values ?? r?.embedding?.values ?? [];
      if (!Array.isArray(embedding) || embedding.length === 0) {
        return json(req, res, 502, { error: 'Embedding vuoto da Gemini' });
      }
      return json(req, res, 200, { data: { embedding, model: v.data.model || 'gemini-embedding-2' } });
    } catch (err) {
      console.error('[embeddings] Gemini error', (err as Error)?.message);
      return json(req, res, 502, { error: 'Errore embedding Gemini' });
    }
  }

  if (path === '/ai/chat/stream' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aistream', 30, 60 * 1000);
    if (rl.blocked) {
      return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste AI. Attendi un minuto.' }, requestId);
    }
    const v = validate(
      z.object({
        model: z.string().optional(),
        messages: z
          .array(
            z.object({
              role: z.enum(['system', 'user', 'assistant', 'tool']),
              content: z.string(),
              tool_call_id: z.string().optional(),
              name: z.string().optional(),
              // TB-023: Ollama multimodal messages may include images
              images: z.array(z.string()).optional(),
              reasoning_content: z.string().optional(),
            }),
          )
          .min(1)
          .max(50),
        tools: z.array(z.any()).optional(),
        reasoning_effort: z.enum(['low', 'high', 'max']).optional(),
        max_tokens: z.number().int().positive().max(16384).optional(),
        userEmail: z.string().email().optional(),
        // TB-029: identità per Langfuse tracing (vista costi per cliente)
        customerId: z.string().min(1).max(100).optional(),
        sessionId: z.string().min(1).max(200).optional(),
        // TB-029: feature orchestrator per tag Langfuse (quote/card/flyer/...)
        kind: z.string().min(1).max(50).optional(),
        // T7: trace gerarchica agente (runId 32-hex, rootSpanId/stepSpanId 16-hex)
        runId: z.string().regex(/^[0-9a-f]{32}$/).optional(),
        runName: z.string().min(1).max(50).optional(),
        startRun: z.boolean().optional(),
        rootSpanId: z.string().regex(/^[0-9a-f]{16}$/).optional(),
        stepName: z.string().min(1).max(50).optional(),
        stepSpanId: z.string().regex(/^[0-9a-f]{16}$/).optional(),
        // TB-029: costo USD calcolato dal client (providerPricing) per cost_details
        costUsd: z.number().min(0).max(1000).optional(),
        // TB-023: provider routing (default deepseek)
        provider: z.enum(['deepseek', 'ollama']).optional(),
        // Ollama-only options
        options: z.record(z.string(), z.unknown()).optional(),
        format: z.union([z.literal('json'), z.record(z.string(), z.unknown())]).optional(),
      }),
      body
    );
    if (v.error) {
      logAI({ tag: 'ai_chat_stream', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const customerId = v.data.customerId;
    const sessionId = v.data.sessionId;
    const kind = v.data.kind;
    const costUsd = v.data.costUsd;
    const provider = v.data.provider || 'deepseek';
    // T7: trace gerarchica agente (opzionali, backward-compatible)
    const runId = v.data.runId;
    const runName = v.data.runName;
    const startRun = v.data.startRun;
    const rootSpanId = v.data.rootSpanId;
    const stepName = v.data.stepName;
    const stepSpanId = v.data.stepSpanId;
    const startedAt = Date.now();

    // ─── TB-023: Ollama Pro Cloud streaming ─────────────────────────
    if (provider === 'ollama') {
      const ollamaKey = process.env.OLLAMA_API_KEY;
      if (!ollamaKey) {
        logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
        return jsonWithRequestId(req, res, 503, { error: 'Ollama non configurato. Configura OLLAMA_API_KEY su Vercel.' }, requestId);
      }
      const { model, messages, max_tokens, tools, options: ollamaOptions, format } = v.data;
      const ollamaModel = model || 'minimax-m3:cloud';
      const controller = new AbortController();
      // Ollama con thinking 'max' + output 16k tok: le generazioni website
      // (CSS/JS lunghi) superano i 60s — timeout allineato al path non-stream
      // (600s, gotcha §26.20). A 60s l'abort troncava lo stream → JSON
      // incompleto → not_json → sito fallback (regressione prod 2026-08-13).
      const timeout = setTimeout(() => controller.abort(), 600000);
      let apiRes: Response;
      try {
        const ollamaBody: Record<string, unknown> = {
          model: ollamaModel,
          messages: messages.map((m) => {
            const msg: Record<string, unknown> = { role: m.role, content: m.content };
            if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
            if (m.name) msg.name = m.name;
            if (m.reasoning_content) msg.thinking = m.reasoning_content;
            if (m.images && m.images.length > 0) msg.images = m.images;
            return msg;
          }),
          stream: true,
          think: 'max',
        };
        if (max_tokens !== undefined) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), num_predict: max_tokens };
        }
        if (ollamaOptions) {
          ollamaBody.options = { ...(ollamaBody.options as object | undefined), ...ollamaOptions };
        }
        if (tools && tools.length > 0) ollamaBody.tools = tools;
        if (format) ollamaBody.format = format;

        apiRes = await fetch('https://ollama.com/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ollamaKey}`,
            'X-Request-Id': requestId,
            Accept: 'application/x-ndjson',
          },
          body: JSON.stringify(ollamaBody),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        const errorKind = err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError' ? 'timeout' : 'connection';
        logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model: model || ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
        if (errorKind === 'timeout') {
          return jsonWithRequestId(req, res, 504, { error: 'Ollama non ha risposto entro 60 secondi. Riprova.' }, requestId);
        }
        return jsonWithRequestId(req, res, 502, { error: `Connessione Ollama fallita: ${(err as Error)?.message || 'unknown'}` }, requestId);
      }
      if (!apiRes.ok) {
        clearTimeout(timeout);
        const errBody = await apiRes.text().catch(() => 'Unknown error');
        const errorKind = apiRes.status === 429 ? 'rate_limit' : apiRes.status === 401 ? 'auth' : 'upstream';
        logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
        if (apiRes.status === 429) return jsonWithRequestId(req, res, 429, { error: 'Quota Ollama Pro superato. Riprova tra qualche ora o passa a DeepSeek.' }, requestId);
        if (apiRes.status === 401) return jsonWithRequestId(req, res, 401, { error: 'Chiave API Ollama non valida' }, requestId);
        return jsonWithRequestId(req, res, apiRes.status, { error: `Ollama (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
      }

      addCorsHeaders(req, res);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('X-Request-Id', requestId);
      res.setHeader('X-Provider', 'ollama');

      const reader = apiRes.body?.getReader();
      if (!reader) {
        clearTimeout(timeout);
        logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_body' });
        return res.end();
      }
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model: ollamaModel, durationMs: Date.now() - startedAt, outcome: 'ok', provider: 'ollama' });

      const decoder = new TextDecoder();
      let buffer = '';
      let streamContent = '';
      const streamToolCalls: Array<{ function: { name: string; arguments: string } }> = [];
      let finalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              const content = parsed.message?.content || '';
              if (content) streamContent += content;
              if (parsed.prompt_eval_count !== undefined || parsed.eval_count !== undefined) {
                finalUsage = {
                  prompt_tokens: parsed.prompt_eval_count ?? finalUsage?.prompt_tokens ?? 0,
                  completion_tokens: parsed.eval_count ?? finalUsage?.completion_tokens ?? 0,
                  total_tokens: (parsed.prompt_eval_count ?? finalUsage?.prompt_tokens ?? 0) + (parsed.eval_count ?? finalUsage?.completion_tokens ?? 0),
                };
              }
              const ssePayload: Record<string, unknown> = {
                choices: [{ index: 0, delta: { content } }],
              };
              if (parsed.message?.thinking) {
                (ssePayload.choices as any)[0].delta.reasoning_content = parsed.message.thinking;
              }
              if (parsed.message?.tool_calls) {
                // TB-029: accumula per la trace (il client vede i tool_calls
                // già nello stream SSE, ma Langfuse deve averli nell'output).
                for (const tc of parsed.message.tool_calls as any[]) {
                  if (tc?.function?.name) {
                    streamToolCalls.push({
                      function: {
                        name: tc.function.name,
                        arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? {}),
                      },
                    });
                  }
                }
                (ssePayload.choices as any)[0].delta.tool_calls = parsed.message.tool_calls.map((tc: any, i: number) => ({
                  index: i,
                  function: { name: tc.function?.name, arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments ?? {}) },
                }));
              }
              if (parsed.done && finalUsage) {
                ssePayload.usage = finalUsage;
              }
              res.write(`data: ${JSON.stringify(ssePayload)}\n\n`);
            } catch {
              // skip malformed NDJSON line
            }
          }
        }
        res.write('data: [DONE]\n\n');
      } catch (err) {
        console.error('[Stream Ollama] Errore durante lo streaming', { msg: (err as Error)?.message, requestId });
      } finally {
        clearTimeout(timeout);
        traceGeneration({
          name: chatTraceName(kind),
          requestId,
          model: ollamaModel,
          provider: 'ollama',
          userEmail,
          customerId,
          feature: kind ?? 'chat',
          subfeature: 'chat',
          streaming: true,
          input: messages,
          output: {
            content: streamContent,
            ...(streamToolCalls.length > 0 ? { toolCalls: streamToolCalls } : {}),
          },
          usage: finalUsage ? { promptTokens: finalUsage.prompt_tokens, completionTokens: finalUsage.completion_tokens } : undefined,
          costUsd: costUsd ?? computeCostUsd('ollama', ollamaModel),
          startTime: startedAt,
          sessionId,
          runId,
          runName,
          startRun,
          rootSpanId,
          stepName,
          stepSpanId,
        });
        if (!res.writableEnded) res.end();
      }
      return;
    }

    // ─── DeepSeek streaming (default, preesistente) ─────────────────────────
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'DeepSeek non configurato.' }, requestId);
    }
    const { model, messages, tools, reasoning_effort, max_tokens } = v.data;
    const upBody = {
      model: model || 'deepseek-v4-flash',
      messages,
      stream: true,
      ...(tools ? { tools } : {}),
      reasoning_effort: reasoning_effort ?? 'max',
      extra_body: { thinking: { type: 'enabled' } },
      ...(max_tokens ? { max_tokens } : {}),
    };
    let apiRes: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(upBody),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const errorKind = err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError' ? 'timeout' : 'connection';
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (errorKind === 'timeout') {
        return jsonWithRequestId(req, res, 504, { error: 'DeepSeek non ha risposto entro 60 secondi. Riprova.' }, requestId);
      }
      return jsonWithRequestId(req, res, 502, { error: `Connessione fallita: ${(err as Error)?.message || 'unknown'}` }, requestId);
    }
    if (!apiRes.ok) {
      clearTimeout(timeout);
      const errBody = await apiRes.text().catch(() => 'Unknown');
      const errorKind = apiRes.status === 402 ? 'quota' : apiRes.status === 401 ? 'auth' : apiRes.status === 429 ? 'rate_limit' : 'upstream';
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (apiRes.status === 402) return jsonWithRequestId(req, res, 402, { error: 'Credito DeepSeek esaurito' }, requestId);
      if (apiRes.status === 401) return jsonWithRequestId(req, res, 401, { error: 'Chiave API DeepSeek non valida' }, requestId);
      if (apiRes.status === 429) return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste. Attendi e riprova.' }, requestId);
      return jsonWithRequestId(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
    }
    const contentType = apiRes.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      clearTimeout(timeout);
      const data = await apiRes.json();
      return json(req, res, 200, { ...data, requestId });
    }
    addCorsHeaders(req, res);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Request-Id', requestId);
    const reader = apiRes.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_body' });
      return res.end();
    }
    logAI({ tag: 'ai_chat_stream', requestId, email: userEmail, model, durationMs: Date.now() - startedAt, outcome: 'ok' });
    const decoder = new TextDecoder();
    let streamContent = '';
    let streamUsage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const streamToolCalls: Array<{ function: { name: string; arguments: string } }> = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // TB-029: accumula contenuto+usage+tool_calls (SSE `data: {...}` lines)
        // per la trace (il client consuma il pass-through, qui copiamo i dati).
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const json = trimmed.slice(5).trim();
          if (!json || json === '[DONE]') continue;
          try {
            const evt = JSON.parse(json);
            const delta = evt.choices?.[0]?.delta;
            if (delta?.content) streamContent += delta.content;
            if (evt.usage) streamUsage = evt.usage;
            // tool_calls arrivano frammentati (delta per delta): buffer per
            // indice, ricostruisci alla fine.
            if (Array.isArray(delta?.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const entry = (streamToolCalls[idx] ??= { function: { name: '', arguments: '' } });
                if (tc.function?.name) entry.function.name += tc.function.name;
                if (tc.function?.arguments) entry.function.arguments += tc.function.arguments;
              }
            }
          } catch {
            // skip malformed SSE line
          }
        }
        res.write(chunk);
      }
    } catch (err) {
      console.error('[Stream] Errore durante lo streaming', { msg: (err as Error)?.message, requestId });
      if (!res.writableEnded) {
        res.end();
      }
    } finally {
      clearTimeout(timeout);
      traceGeneration({
        name: chatTraceName(kind),
        requestId,
        model: model || 'deepseek-v4-flash',
        provider: 'deepseek',
        userEmail,
        customerId,
        feature: kind ?? 'chat',
        subfeature: 'chat',
        streaming: true,
        input: messages,
        output: {
          content: streamContent,
          ...(streamToolCalls.length > 0 ? { toolCalls: streamToolCalls } : {}),
        },
        usage: streamUsage ? { promptTokens: streamUsage.prompt_tokens ?? 0, completionTokens: streamUsage.completion_tokens ?? 0 } : undefined,
        costUsd: costUsd ?? computeCostUsd('deepseek', model || 'deepseek-v4-flash', streamUsage ? { promptTokens: streamUsage.prompt_tokens ?? 0, completionTokens: streamUsage.completion_tokens ?? 0 } : undefined),
        startTime: startedAt,
        sessionId,
        runId,
        runName,
        startRun,
        rootSpanId,
        stepName,
        stepSpanId,
      });
    }
    return res.end();
  }

  // TB-029 fase 2: Prompt Management — fetch prompt da Langfuse per label
  // (production in prod, staging in locale). Fallback ai builder locali.
  // TB-029 fase 3: customerId → promptLabels del cliente fa override label
  // (A/B testing per cliente, es. {"card-system": "experiment"}).
  if (path === '/ai/prompt' && method === 'GET') {
    const url = new URL(req.url || '/', 'http://localhost');
    const name = (url.searchParams.get('name') || '').trim();
    const label = (url.searchParams.get('label') || '').trim() || 'production';
    const customerId = (url.searchParams.get('customerId') || '').trim() || undefined;
    if (!name) return json(req, res, 400, { error: 'Parametro name mancante' });
    try {
      let effectiveLabel = label;
      if (customerId) {
        // Best-effort: DB non raggiungibile → label richiesta, mai bloccare
        // il prompt (il fallback builder locale resta l'ultimo muro).
        try {
          const [cust] = await (await getDb()).select().from(customersTable).where(eq(customersTable.id, customerId));
          const labels = (cust?.promptLabels ?? {}) as Record<string, string> | null;
          if (labels?.[name]) effectiveLabel = labels[name];
        } catch {
          // DB down → label default
        }
      }
      const data = await fetchRemotePrompt(name, effectiveLabel);
      return json(req, res, 200, { data });
    } catch (err) {
      return json(req, res, 404, { error: (err as Error)?.message || 'Prompt non trovato' });
    }
  }

  // TB-029 fase 2: admin prompt CRUD — carica/cancella/lista prompt su
  // Langfuse. Admin-only (adminEmail body per POST/DELETE, query GET).
  if (path === '/ai/prompts' && method === 'POST') {
    if (!requireAdmin(req, res, body)) return;
    const pk = process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY;
    const sk = process.env.LANGFUSE_SECRET_KEY || process.env.VITE_LANGFUSE_SECRET_KEY;
    const base = process.env.LANGFUSE_BASE_URL || process.env.VITE_LANGFUSE_BASE_URL;
    if (!pk || !sk || !base) return json(req, res, 503, { error: 'Langfuse non configurato' });
    const v = validate(
      z.object({
        name: z.string().min(1).max(100),
        prompt: z
          .array(z.object({ role: z.string(), content: z.string() }))
          .min(1)
          .max(20),
        label: z.string().min(1).max(50).optional(),
      }),
      body
    );
    if (v.error) return json(req, res, 400, { errors: v.errors });
    try {
      const up = await fetch(`${base}/api/public/v2/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${pk}:${sk}`).toString('base64')}` },
        body: JSON.stringify({
          name: v.data.name,
          type: 'chat',
          prompt: v.data.prompt,
          ...(v.data.label ? { labels: [v.data.label] } : {}),
        }),
      });
      if (!up.ok) return json(req, res, up.status, { error: `Langfuse ${up.status}` });
      const data = await up.json();
      return json(req, res, 200, { data });
    } catch (err) {
      return json(req, res, 502, { error: `Langfuse error: ${String((err as Error)?.message ?? err).slice(0, 200)}` });
    }
  }

  if (path === '/ai/prompts' && method === 'GET') {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.searchParams.get('adminEmail') !== 'admin@gmail.com') {
      return json(req, res, 403, { error: "Accesso riservato all'amministratore" });
    }
    const pk = process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY;
    const sk = process.env.LANGFUSE_SECRET_KEY || process.env.VITE_LANGFUSE_SECRET_KEY;
    const base = process.env.LANGFUSE_BASE_URL || process.env.VITE_LANGFUSE_BASE_URL;
    if (!pk || !sk || !base) return json(req, res, 503, { error: 'Langfuse non configurato' });
    try {
      const up = await fetch(`${base}/api/public/v2/prompts`, {
        headers: { Authorization: `Basic ${Buffer.from(`${pk}:${sk}`).toString('base64')}` },
      });
      if (!up.ok) return json(req, res, up.status, { error: `Langfuse ${up.status}` });
      const data = await up.json();
      // Langfuse risponde paginato ({data: [...]}) → normalizza a array.
      return json(req, res, 200, { data: Array.isArray((data as { data?: unknown }).data) ? (data as { data: unknown[] }).data : data });
    } catch (err) {
      return json(req, res, 502, { error: `Langfuse error: ${String((err as Error)?.message ?? err).slice(0, 200)}` });
    }
  }

  if (path.startsWith('/ai/prompts/') && method === 'DELETE') {
    if (!requireAdmin(req, res, body)) return;
    const name = path.replace('/ai/prompts/', '');
    if (!name || name.includes('/')) return json(req, res, 400, { error: 'Nome non valido' });
    const pk = process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY;
    const sk = process.env.LANGFUSE_SECRET_KEY || process.env.VITE_LANGFUSE_SECRET_KEY;
    const base = process.env.LANGFUSE_BASE_URL || process.env.VITE_LANGFUSE_BASE_URL;
    if (!pk || !sk || !base) return json(req, res, 503, { error: 'Langfuse non configurato' });
    try {
      const up = await fetch(`${base}/api/public/v2/prompts/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${Buffer.from(`${pk}:${sk}`).toString('base64')}` },
      });
      if (!up.ok) return json(req, res, up.status, { error: `Langfuse ${up.status}` });
      const data = await up.json();
      return json(req, res, 200, { data });
    } catch (err) {
      return json(req, res, 502, { error: `Langfuse error: ${String((err as Error)?.message ?? err).slice(0, 200)}` });
    }
  }

  // Spec 13: Onboarding AI suggest (rate-limit 5/min/IP, opt-in).
  if (path === '/ai/onboarding-suggest' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiOnboarding', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return json(req, res, 429, { error: 'Troppe richieste onboarding. Attendi un minuto.' });
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return json(req, res, 503, { error: 'Onboarding AI non configurato (DEEPSEEK_API_KEY mancante)' });
    }
    const v = validate(
      z.object({
        name: z.string().max(50),
        sector: z.string().optional(),
        model: z.string().optional(),
        userEmail: z.string().email().optional(),
      }),
      body,
    );
    if (v.error) return json(req, res, 400, { error: 'Invalid body', details: v.errors });
    if (v.data.userEmail) {
      console.info('[ai_onboarding_suggest] user', { email: v.data.userEmail, ts: Date.now() });
    }
    // Placeholder: the production caller uses the client-side
    // useAIOnboarding hook (DeepSeek via /api/ai/chat proxy). This
    // endpoint exists for parity with /ai/logo-config and future
    // server-side onboarding flows (e.g. registration funnel). The
    // contract (Zod, rate-limit, 503 fallback) is in place and tested.
    return json(req, res, 202, {
      data: { status: 'queued' },
      message: 'Onboarding AI endpoint is staged; client-side useAIOnboarding is the v1 path.',
    });
  }

  // Spec 11: Logo AI v2 — config (no rate-limit) + generate (rate-limit aiLogo 10/min/IP).
  if (path === '/ai/logo-config' && method === 'GET') {
    const geminiKey = !!process.env.GEMINI_API_KEY || !!process.env.VITE_GEMINI_API_KEY;
    const enabled = !!process.env.REPLICATE_API_TOKEN || geminiKey;
    const provider = geminiKey ? 'gemini' : process.env.REPLICATE_API_TOKEN ? 'replicate' : 'none';
    return json(req, res, 200, { enabled, provider });
  }

  if (path === '/ai/card-cover' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiCardCover', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni di cover. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_card_cover', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Cover AI non configurata (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1000),
        context: z.string().max(2000).optional(),
        cardImage: z.string().max(600_000).optional(),
        logoImage: z.string().max(150_000).optional(),
        side: z.enum(['front', 'back']).optional(),
        userEmail: z.string().email().optional(),
        // TB-029: sessione Langfuse = docId (raggruppa chat+immagini del documento)
        sessionId: z.string().min(1).max(200).optional(),
        // TB-023: modello immagine Gemini selezionabile
        imageModel: z.enum(['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-2.0-flash-preview-image-generation']).optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_card_cover', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const sessionId = v.data.sessionId;
    const startedAt = Date.now();
    try {
      // Dynamic import of @google/genai (node_modules, always bundled).
      // Avoids the ESM/CJS interop issue with static import and the
      // "Cannot find module src/..." issue with importing from src/.
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const basePrompt = v.data.context
        ? `${v.data.prompt}\n\nCARD CONTEXT:\n${v.data.context.slice(0, 2000)}`
        : v.data.prompt;
      const hasImages = !!(v.data.cardImage || v.data.logoImage);
      const grounding =
        'The attached image(s) show the business card layout I am designing a background for. Use them as reference for text placement, colour harmony, and profession. Do NOT reproduce any text, QR code, logo, face, or UI element visible in the reference — generate only the abstract background. If a background is already visible in the reference image, treat it as the previous iteration to improve upon, not as a constraint to copy.';
      const finalPrompt = hasImages ? `${grounding}\n\n${basePrompt}` : basePrompt;
      const extractMime = (dataUrl: string, fallback: string) => {
        const match = dataUrl.match(/^data:([^;]+);base64,/);
        return match ? match[1] : fallback;
      };

      const input = buildGeminiMultimodalInput(finalPrompt, [
        v.data.cardImage ? { data: v.data.cardImage, mimeType: extractMime(v.data.cardImage, 'image/jpeg') } : null,
        v.data.logoImage ? { data: v.data.logoImage, mimeType: extractMime(v.data.logoImage, 'image/jpeg') } : null,
      ]);
      const interaction = await ai.interactions.create(
        {
          model: normalizeGeminiImageModel(v.data.imageModel),
          input,
          generation_config: {
            image_config: { image_size: '1K', aspect_ratio: '1:1' },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 30_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_card_cover', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > GEMINI_IMG_CLAMP_BYTES) {
        logAI({ tag: 'ai_card_cover', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>1.2MB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_card_cover', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB });
      traceGeneration({
        name: 'card-cover',
        requestId,
        model: normalizeGeminiImageModel(v.data.imageModel),
        provider: 'gemini',
        userEmail,
        sessionId,
        feature: 'card',
        subfeature: 'cover',
        costUsd: computeCostUsd('gemini', normalizeGeminiImageModel(v.data.imageModel), undefined, 1),
        input: { prompt: v.data.prompt },
        output: { mimeType, sizeKB, imageBase64: `data:${mimeType};base64,${imageBase64}` },
        startTime: startedAt,
      });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_card_cover', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini non ha risposto entro 30s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  if (path === '/ai/logo-background' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiLogoBg', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni background. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_logo_background', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Logo AI background non configurato (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1000),
        logoImage: z.string().max(600_000).optional(),
        previousBackground: z.string().max(300_000).optional(),
        userEmail: z.string().email().optional(),
        // TB-029: sessione Langfuse = docId
        sessionId: z.string().min(1).max(200).optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_logo_background', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const sessionId = v.data.sessionId;
    const startedAt = Date.now();
    try {
      // Dynamic import of @google/genai (node_modules, always bundled).
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const hasImages = !!(v.data.logoImage || v.data.previousBackground);
      const grounding =
        'The first attached image shows the logo layout I am designing a background for (title, tagline, icon). Use it as reference for text placement and colour harmony. Do NOT reproduce any text, icon, or shape visible in the reference — generate only the abstract decorative background that sits behind it. The second attached image (if present) is the previous background iteration to improve upon, not a constraint to copy.';
      const finalPrompt = hasImages ? `${grounding}\n\n${v.data.prompt}` : v.data.prompt;
      const extractMime = (dataUrl: string, fallback: string) => {
        const match = dataUrl.match(/^data:([^;]+);base64,/);
        return match ? match[1] : fallback;
      };

      const input = buildGeminiMultimodalInput(finalPrompt, [
        v.data.logoImage ? { data: v.data.logoImage, mimeType: extractMime(v.data.logoImage, 'image/jpeg') } : null,
        v.data.previousBackground ? { data: v.data.previousBackground, mimeType: extractMime(v.data.previousBackground, 'image/jpeg') } : null,
      ]);
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-3.1-flash-image',
          input,
          generation_config: {
            image_config: { image_size: '1K', aspect_ratio: '16:9' },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 45_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_logo_background', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > GEMINI_IMG_CLAMP_BYTES) {
        logAI({ tag: 'ai_logo_background', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>1.2MB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_logo_background', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB });
      traceGeneration({
        name: 'logo-background',
        requestId,
        model: 'gemini-3.1-flash-image',
        provider: 'gemini',
        userEmail,
        sessionId,
        feature: 'logo',
        subfeature: 'background',
        costUsd: computeCostUsd('gemini', 'gemini-3.1-flash-image', undefined, 1),
        input: { prompt: v.data.prompt },
        output: { mimeType, sizeKB, imageBase64: `data:${mimeType};base64,${imageBase64}` },
        startTime: startedAt,
      });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_logo_background', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini non ha risposto entro 45s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  if (path === '/ai/flyer-hero' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiFlyerHero', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni hero. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_flyer_hero', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Hero AI non configurata (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1500),
        context: z.string().max(1500).optional(),
        flyerImage: z.string().max(600_000).optional(),
        aspectRatio: z.enum(['16:9', '1:1', '3:2', '2:3', '3:4']).optional(),
        userEmail: z.string().email().optional(),
        // TB-029: sessione Langfuse = docId
        sessionId: z.string().min(1).max(200).optional(),
        // TB-023: modello immagine Gemini selezionabile
        imageModel: z.enum(['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-2.0-flash-preview-image-generation']).optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_flyer_hero', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const sessionId = v.data.sessionId;
    const startedAt = Date.now();
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const basePrompt = v.data.context
        ? `${v.data.prompt}\n\nFLYER CONTEXT:\n${v.data.context.slice(0, 1500)}`
        : v.data.prompt;
      const hasImages = !!v.data.flyerImage;
      const grounding =
        'The attached image shows the flyer layout I am designing a hero image for. Use it as reference for the hero box position, the copy placement, and the overall visual style. Generate only the hero image that fits the hero box area; do NOT reproduce any text, QR code, logo, or UI element visible in the reference.';
      const finalPrompt = hasImages ? `${grounding}\n\n${basePrompt}` : basePrompt;
      const input = buildGeminiMultimodalInput(finalPrompt, [
        v.data.flyerImage ? { data: v.data.flyerImage, mimeType: 'image/jpeg' } : null,
      ]);
      const modelId = normalizeGeminiImageModel(v.data.imageModel);
      const interaction = await ai.interactions.create(
        {
          model: modelId,
          input,
          generation_config: {
            image_config: {
              image_size: resolveGeminiImageSize(modelId, '1K'),
              aspect_ratio: v.data.aspectRatio ?? '3:2',
            },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 45_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_flyer_hero', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > GEMINI_IMG_CLAMP_BYTES) {
        logAI({ tag: 'ai_flyer_hero', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>1.2MB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_flyer_hero', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB });
      traceGeneration({
        name: 'flyer-hero',
        requestId,
        model: normalizeGeminiImageModel(v.data.imageModel),
        provider: 'gemini',
        userEmail,
        sessionId,
        feature: 'flyer',
        subfeature: 'hero',
        costUsd: computeCostUsd('gemini', normalizeGeminiImageModel(v.data.imageModel), undefined, 1),
        input: { prompt: v.data.prompt },
        output: { mimeType, sizeKB, imageBase64: `data:${mimeType};base64,${imageBase64}` },
        startTime: startedAt,
      });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_flyer_hero', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini non ha risposto entro 45s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  // Profession-style photo for business card portrait slot (replaces photoUrl).
  // Same Gemini stack as card-cover / flyer-hero; all logic stays in this monolith.
  if (path === '/ai/card-photo' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiCardPhoto', 5, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni foto. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_card_photo', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Foto AI non configurata (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1000),
        context: z.string().max(1500).optional(),
        userEmail: z.string().email().optional(),
        // TB-029: sessione Langfuse = docId
        sessionId: z.string().min(1).max(200).optional(),
        // TB-023: modello immagine Gemini selezionabile
        imageModel: z.enum(['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-2.0-flash-preview-image-generation']).optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_card_photo', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const sessionId = v.data.sessionId;
    const startedAt = Date.now();
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const finalPrompt = v.data.context
        ? `${v.data.prompt}\n\nCARD PHOTO CONTEXT:\n${v.data.context.slice(0, 1500)}`
        : v.data.prompt;
      const interaction = await ai.interactions.create(
        {
          model: normalizeGeminiImageModel(v.data.imageModel),
          input: finalPrompt,
          generation_config: {
            image_config: { image_size: '1K', aspect_ratio: '3:4' },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 30_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_card_photo', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > GEMINI_IMG_CLAMP_BYTES) {
        logAI({ tag: 'ai_card_photo', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>1.2MB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_card_photo', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB });
      traceGeneration({
        name: 'card-photo',
        requestId,
        model: normalizeGeminiImageModel(v.data.imageModel),
        provider: 'gemini',
        userEmail,
        sessionId,
        feature: 'card',
        subfeature: 'photo',
        costUsd: computeCostUsd('gemini', normalizeGeminiImageModel(v.data.imageModel), undefined, 1),
        input: { prompt: v.data.prompt },
        output: { mimeType, sizeKB, imageBase64: `data:${mimeType};base64,${imageBase64}` },
        startTime: startedAt,
      });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_card_photo', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini non ha risposto entro 30s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  // TB-023: Gemini 2.0 Flash image generation — icone stilizzate ed
  // hero illustrations per card+flyer. Modello economico (~$0.02/img)
  // alternativo a Nano Banana 3.1. Stesso pattern degli altri endpoint
  // Gemini (dynamic import, 1MB clamp, rate limit 10/min).
  if (path === '/ai/image-flash' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiImageFlash', 10, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe generazioni. Attendi un minuto.' }, requestId);
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      logAI({ tag: 'ai_image_flash', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Gemini Flash non configurato (GEMINI_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        prompt: z.string().max(1000),
        aspectRatio: z.enum(['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).optional(),
        size: z.enum(['512', '1K']).optional(),
        kind: z.enum(['icon', 'hero', 'custom']).optional(),
        primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        style: z.string().max(50).optional(),
        imageModel: z.enum(['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-2.0-flash-preview-image-generation']).optional(),
        background: z.enum(['white', 'card', 'accent']).optional(),
        userEmail: z.string().email().optional(),
        // TB-029: sessione Langfuse = docId
        sessionId: z.string().min(1).max(200).optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_image_flash', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const sessionId = v.data.sessionId;
    const startedAt = Date.now();
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const kind = v.data.kind || 'custom';
      const aspectRatio = v.data.aspectRatio || (kind === 'hero' ? '16:9' : '1:1');
      const size = v.data.size || '1K';
      // TB-023: sfondo icona configurabile. Gemini non produce alpha reale,
      // quindi "white" è il default prevedibile (l'icona viene poi mostrata
      // su card chiare). 'card'/'accent' usano i colori brand come tinta piena.
      const bg = v.data.background || 'white';
      const bgPrompt =
        bg === 'card' && v.data.primaryColor
          ? `Solid flat background color ${v.data.primaryColor}, icon in ${v.data.secondaryColor || '#FFFFFF'}.`
          : bg === 'accent' && v.data.primaryColor
            ? `Solid flat background color ${v.data.primaryColor}.`
            : 'Isolated on a plain solid white background (#FFFFFF). DO NOT draw a checkerboard or transparency grid. MUST use a solid #FFFFFF white background.';
      // Build prompt based on kind
      let finalPrompt = v.data.prompt;
      if (kind === 'icon' && v.data.primaryColor && v.data.secondaryColor) {
        const styleHint = v.data.style || 'minimalist';
        finalPrompt = `Stylized flat vector icon of ${v.data.prompt}. Two colors only: ${v.data.primaryColor} and ${v.data.secondaryColor}. ${bgPrompt} No text, no border, no gradients, no shadows. Simple geometric shapes. Style: ${styleHint}.`;
      } else if (kind === 'hero' && v.data.primaryColor && v.data.secondaryColor) {
        const styleHint = v.data.style || 'minimalist';
        finalPrompt = `Stylized flat hero illustration of ${v.data.prompt}. Two colors only: ${v.data.primaryColor} and ${v.data.secondaryColor}. ${bgPrompt} No text, no border. Simple geometric shapes, editorial style. 16:9 composition. Style: ${styleHint}.`;
      }
      const modelId = normalizeGeminiImageModel(v.data.imageModel);
      const interaction = await ai.interactions.create(
        {
          model: modelId,
          input: finalPrompt,
          generation_config: {
            image_config: {
              image_size: resolveGeminiImageSize(modelId, size),
              aspect_ratio: aspectRatio,
            },
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: 30_000 },
      );
      const image = interaction.output_image;
      if (!image || !image.data) {
        logAI({ tag: 'ai_image_flash', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'empty_image' });
        return jsonWithRequestId(req, res, 502, { error: 'Gemini Flash non ha restituito un\'immagine' }, requestId);
      }
      const imageBase64 = image.data;
      const mimeType = image.mime_type || 'image/png';
      const sizeBytes = Math.ceil(imageBase64.length * 0.75);
      if (sizeBytes > GEMINI_IMG_CLAMP_BYTES) {
        logAI({ tag: 'ai_image_flash', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind: 'clamp_413' });
        return jsonWithRequestId(req, res, 413, { error: 'Immagine troppo grande (>1.2MB). Riprova con un prompt più semplice.' }, requestId);
      }
      const sizeKB = sizeBytes / 1024;
      logAI({ tag: 'ai_image_flash', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', sizeKB, provider: 'gemini-flash' });
      traceGeneration({
        name: 'image-flash',
        requestId,
        model: modelId,
        provider: 'gemini',
        userEmail,
        sessionId,
        feature: kind === 'icon' ? 'card' : kind === 'hero' ? 'flyer' : 'image',
        subfeature: kind === 'icon' ? 'icon' : kind === 'hero' ? 'hero' : 'flash',
        costUsd: computeCostUsd('gemini', modelId, undefined, 1),
        input: { prompt: v.data.prompt },
        output: { mimeType, sizeKB, imageBase64: `data:${mimeType};base64,${imageBase64}` },
        startTime: startedAt,
      });
      return json(req, res, 200, { data: { imageBase64, mimeType }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.startsWith('GEMINI_401') ? 'auth' : msg.startsWith('GEMINI_429') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : msg.toLowerCase().includes('copyright') || msg.toLowerCase().includes('recitation') ? 'copyright' : 'upstream';
      logAI({ tag: 'ai_image_flash', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind });
      if (msg.startsWith('GEMINI_401')) return jsonWithRequestId(req, res, 401, { error: 'Chiave Gemini non valida' }, requestId);
      if (msg.startsWith('GEMINI_429')) return jsonWithRequestId(req, res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' }, requestId);
      if (msg.startsWith('GEMINI_TIMEOUT')) return jsonWithRequestId(req, res, 504, { error: 'Gemini Flash non ha risposto entro 30s.' }, requestId);
      if (errorKind === 'copyright') return jsonWithRequestId(req, res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Gemini Flash error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  // TB-023: Design review endpoint — MiniMax M3 (Ollama) analizza uno
  // screenshot della preview card/flyer + JSON e suggerisce 3 miglioramenti.
  // Vision-grounded feedback (REQ-MM-004).
  if (path === '/ai/design-review' && method === 'POST') {
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiDesignReview', 10, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return jsonWithRequestId(req, res, 429, { error: 'Troppe richieste. Attendi un minuto.' }, requestId);
    }
    const ollamaKey = process.env.OLLAMA_API_KEY;
    if (!ollamaKey) {
      logAI({ tag: 'ai_design_review', requestId, outcome: 'error', durationMs: 0, errorKind: 'missing_api_key' });
      return jsonWithRequestId(req, res, 503, { error: 'Design review non configurato (OLLAMA_API_KEY mancante)' }, requestId);
    }
    const v = validate(
      z.object({
        docType: z.enum(['card', 'flyer']),
        docJson: z.string().max(50_000),
        screenshotBase64: z.string().max(600_000),
        userEmail: z.string().email().optional(),
        // TB-029: sessione Langfuse = docId
        sessionId: z.string().min(1).max(200).optional(),
      }),
      body,
    );
    if (v.error) {
      logAI({ tag: 'ai_design_review', requestId, outcome: 'error', durationMs: 0, errorKind: 'validation' });
      return jsonWithRequestId(req, res, 400, { error: 'Invalid body', details: v.errors }, requestId);
    }
    const userEmail = v.data.userEmail;
    const sessionId = v.data.sessionId;
    const startedAt = Date.now();
    try {
      // Strip data URL prefix if present
      const b64 = v.data.screenshotBase64.replace(/^data:[^;]+;base64,/, '');
      const systemPrompt = `Sei un graphic designer AI esperto. Analizza lo screenshot di un ${v.data.docType === 'card' ? 'biglietto da visita' : 'volantino'} e suggerisci 3 miglioramenti concreti. Restituisci SOLO un JSON array di 3 oggetti con shape: {"field": "string (es. style.bgColor, content.headline, decoration.id)", "value": "string (valore suggerito)", "reason": "string (motivazione 1 frase in italiano)"}. Focus su: palette colori, gerarchia visiva, leggibilità, decorazione, allineamento. Evita suggerimenti generici.`;
      const ollamaBody = {
        model: 'minimax-m3:cloud',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analizza questo ${v.data.docType}. JSON attuale:\n${v.data.docJson.slice(0, 8000)}`, images: [b64] },
        ],
        stream: false,
        format: 'json',
        think: 'max',
      };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      let apiRes: Response;
      try {
        apiRes = await fetch('https://ollama.com/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ollamaKey}`,
            'X-Request-Id': requestId,
          },
          body: JSON.stringify(ollamaBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!apiRes.ok) {
        const errBody = await apiRes.text().catch(() => 'unknown');
        const errorKind = apiRes.status === 429 ? 'rate_limit' : apiRes.status === 401 ? 'auth' : 'upstream';
        logAI({ tag: 'ai_design_review', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind, provider: 'ollama' });
        if (apiRes.status === 429) {
          return jsonWithRequestId(req, res, 429, { error: 'Quota Ollama Pro superato. Riprova tra qualche ora.' }, requestId);
        }
        return jsonWithRequestId(req, res, apiRes.status, { error: `Ollama (${apiRes.status}): ${errBody.substring(0, 200)}` }, requestId);
      }
      const raw = (await apiRes.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
      const content = raw.message?.content || '';
      const tokens = (raw.prompt_eval_count ?? 0) + (raw.eval_count ?? 0);
      logAI({ tag: 'ai_design_review', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'ok', tokens: tokens || undefined, provider: 'ollama' });
      traceGeneration({
        name: 'design-review',
        requestId,
        model: 'minimax-m3:cloud',
        provider: 'ollama',
        userEmail,
        sessionId,
        feature: 'design-review',
        subfeature: 'review',
        input: { docType: v.data.docType },
        output: { content },
        usage: { promptTokens: raw.prompt_eval_count ?? 0, completionTokens: raw.eval_count ?? 0 },
        startTime: startedAt,
      });
      return json(req, res, 200, { data: { suggestions: content }, requestId });
    } catch (err) {
      const msg = (err as Error)?.message || 'unknown';
      const errorKind = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('abort') ? 'timeout' : 'upstream';
      logAI({ tag: 'ai_design_review', requestId, email: userEmail, durationMs: Date.now() - startedAt, outcome: 'error', errorKind, provider: 'ollama' });
      if (errorKind === 'timeout') return jsonWithRequestId(req, res, 504, { error: 'Ollama non ha risposto entro 60s.' }, requestId);
      return jsonWithRequestId(req, res, 502, { error: `Design review error: ${msg.slice(0, 200)}` }, requestId);
    }
  }

  // TB-028: Website builder scrape reference — Firecrawl fetch per stile sito esistente.
  if (path === '/ai/scrape' && method === 'GET') {
    const requestId = getRequestId(req);
    const url = typeof req.url === 'string' ? new URL(req.url, 'http://localhost').searchParams.get('url') : null;
    if (!url) return jsonWithRequestId(req, res, 400, { error: 'Parametro url mancante' }, requestId);
    const result = await fetchFirecrawlPage(url);
    if (result.status !== 'ok') return jsonWithRequestId(req, res, 200, { text: '' }, requestId);
    return jsonWithRequestId(req, res, 200, { text: result.markdown || '' }, requestId);
  }

  if (path === '/ai/logo-generate' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = consumeRateLimit(ip, 'aiLogo', 10, 60 * 1000);
    if (rl.blocked) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60_000) / 1000)));
      return json(req, res, 429, { error: 'Troppe generazioni logo AI. Attendi un minuto.' });
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      return json(req, res, 503, { error: 'Logo AI non configurato (REPLICATE_API_TOKEN mancante)' });
    }
    const v = validate(
      z.object({
        brief: z.string().max(500),
        sector: z.string().optional(),
        model: z.string().optional(),
        userEmail: z.string().email().optional(),
      }),
      body,
    );
    if (v.error) return json(req, res, 400, { error: 'Invalid body', details: v.errors });
    if (v.data.userEmail) {
      console.info('[ai_logo_generate] user', { email: v.data.userEmail, ts: Date.now() });
    }
    // For now this proxy is a placeholder: when a Replicate-backed
    // generator lands in v2, the call below will be replaced with the
    // upstream invocation. The endpoint contract (Zod, rate-limit, token
    // guard, 503 fallback) is in place and tested.
    return json(req, res, 202, {
      data: { status: 'queued' },
      message: 'Logo AI v2 backend is staged; Replicate call lands in v2.',
    });
  }

  return json(req, res, 404, { error: 'Endpoint AI non trovato' });
};

// --- TB-027 CRM: customers ---
// Spec: spec-architecture-crm-auto-build.md. Admin-only CRUD + research +
// ai-fill + auto-build pipeline. lean-code: best-effort research (Places fail
// non blocca), AI fill riusa DeepSeek copy, auto-build crea draft (no gen AI
// di default).

