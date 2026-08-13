import { defineConfig, loadEnv, createLogger } from 'vite';
import react from '@vitejs/plugin-react';

const defaultLogger = createLogger();

export default defineConfig(({ mode }) => {
  // Vite only exposes `.env` vars to `import.meta.env` (client bundle)
  // by default. The dev API proxy below runs server-side in this Node
  // process and needs `process.env.GEMINI_API_KEY` /
  // `process.env.VITE_GEMINI_API_KEY` directly, so we load `.env`
  // explicitly with an empty prefix (loads ALL vars, not just VITE_*)
  // and merge them into `process.env`.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    customLogger: {
      ...defaultLogger,
      // Gotcha §23: crm.js usa import dinamici (.ts extensionless) a call
      // time per non rompere il require() CJS dei test. Quei moduli sono già
      // nel main chunk (import statico da AppShell/hook), quindi il dynamic
      // import non può spostarli in un chunk dedicato. Vite emette questo
      // warning informativo via logger.warn (non Rollup onwarn): silenziato
      // selettivamente perché è atteso, non un errore.
      warn(msg, options) {
        const text = typeof msg === 'string' ? msg : msg?.message || '';
        if (text.includes('dynamic import will not move module into another chunk')) {
          return;
        }
        defaultLogger.warn(msg, options);
      },
    },
    plugins: [
      react(),
      {
        name: 'spa-fallback',
        configureServer(server) {
          // SPA fallback per /app e /app/* → /index.html
          server.middlewares.use((req, res, next) => {
            const url = (req.url || '').split('?')[0];
            if (url === '/app' || (url && url.startsWith('/app/'))) {
              req.url = '/index.html';
            }
            next();
          });
          // Dev API proxy: gestisce /api/ai/logo-config e
          // /api/ai/logo-background localmente (STESSI path usati dal
          // client e da api/index.ts in produzione — vedi
          // src/components/LogoAiPanel.tsx e src/ai/logoOrchestrator.ts).
          // In dev Vite gira in Node; process.env viene popolato
          // esplicitamente sopra via loadEnv() per rendere disponibili
          // GEMINI_API_KEY/VITE_GEMINI_API_KEY in questo processo. In
          // prod, Vercel esegue api/index.ts direttamente.
          //
          // Riusa il provider reale (src/ai/providers/gemini.ts) via
          // ssrLoadModule invece di duplicare la chiamata REST a Gemini,
          // per evitare che dev e prod divergano (bug storico: questo
          // proxy chiamava un modello/endpoint diverso da gemini.ts).

          // Helper di risposta JSON condiviso da TUTTI gli handler del dev
          // proxy (middleware + proxyOllamaChat). Deve vivere in questo
          // scope: quando era definita dentro il middleware, il fallback
          // Ollama lanciava `ReferenceError: json is not defined` e il
          // client riceveva un 502 "AI error: json is not defined".
          const json = (res, status, payload) => {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
          };

          // ─── Fallback Ollama chat proxy (SSR-safe) ──────────────────
          // TB-029: il dev proxy sostituisce il server handler in locale →
          // DEVE tracciare su Langfuse (altrimenti in dev zero trace).
          async function proxyOllamaChat(req, res, body, isStream) {
            const ollamaKey = process.env.OLLAMA_API_KEY;
            if (!ollamaKey) return json(res, 503, { error: 'OLLAMA_API_KEY non configurata' });
            const model = body.model || 'minimax-m3:cloud';
            const messages = Array.isArray(body.messages) ? body.messages : [];
            const controller = new AbortController();
            // Ollama con thinking 'max' + output 16k tok: le generazioni CSS
            // lunghe superano i 300s (abort → 502 "This operation was
            // aborted" → sito perso). Alzato a 600s.
            const timeout = setTimeout(() => controller.abort(), 600_000);
            const startedAt = Date.now();
            const trace = async (input) => {
              try {
                const mod = await server.ssrLoadModule('/src/server/langfuse.ts');
                const env = process.env.VERCEL_ENV === 'production' ? 'production' : 'development';
                await mod.ingestLangfuse({ ...input, environment: env });
              } catch {
                // mai rompere la risposta per un errore di tracing
              }
            };
            const baseTrace = {
              requestId: devReqId(req),
              model,
              provider: 'ollama',
              userEmail: body.userEmail,
              customerId: body.customerId,
              sessionId: body.sessionId,
              feature: body.kind || 'chat',
              subfeature: 'chat',
              streaming: isStream,
              costUsd: typeof body.costUsd === 'number' ? body.costUsd : undefined,
              input: messages,
              startTime: startedAt,
              // T7: trace gerarchica agente (opzionali, backward-compatible)
              runId: body.runId,
              runName: body.runName,
              startRun: body.startRun,
              rootSpanId: body.rootSpanId,
              stepName: body.stepName,
              stepSpanId: body.stepSpanId,
            };
            const chatName = `${body.kind && body.kind !== 'chat' ? body.kind : 'chat'}-ai-chat`;
            const ollamaReq = { model, messages, stream: true };
            if (body.format === 'json' || body.response_format?.type === 'json_object') ollamaReq.format = 'json';
            if (body.think || body.reasoning_effort) ollamaReq.think = body.think || body.reasoning_effort;
            if (body.max_tokens) ollamaReq.options = { ...(ollamaReq.options || {}), num_predict: body.max_tokens };
            // Il dev proxy DEVE propagare i tools: i tool_calls precompilati
            // nel body vengono rifiutati da Ollama (400) se tools non è
            // dichiarato nella richiesta.
            if (Array.isArray(body.tools) && body.tools.length > 0) ollamaReq.tools = body.tools;
            let streamStarted = false;
            try {
              const apiRes = await fetch('https://ollama.com/api/chat', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${ollamaKey}`,
                  Accept: 'application/x-ndjson',
                },
                body: JSON.stringify(ollamaReq),
                signal: controller.signal,
              });
              if (!apiRes.ok) {
                const text = await apiRes.text().catch(() => 'Unknown error');
                const errorKind = apiRes.status === 429 ? 'rate_limit' : apiRes.status === 401 ? 'auth' : 'upstream';
                await trace({ ...baseTrace, name: chatName, error: { kind: errorKind, message: text.slice(0, 200) } });
                return json(res, apiRes.status, { error: `Ollama (${apiRes.status}): ${text.slice(0, 200)}` });
              }
              if (isStream) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache, no-transform');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                streamStarted = true;
                const reader = apiRes.body?.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let streamContent = '';
                let finalUsage;
                if (!reader) return res.end();
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
                      if (content) {
                        streamContent += content;
                        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`);
                      }
                      if (parsed.prompt_eval_count != null || parsed.eval_count != null) {
                        finalUsage = {
                          prompt_tokens: parsed.prompt_eval_count ?? 0,
                          completion_tokens: parsed.eval_count ?? 0,
                          total_tokens: (parsed.prompt_eval_count ?? 0) + (parsed.eval_count ?? 0),
                        };
                      }
                      if (parsed.done && finalUsage) {
                        res.write(`data: ${JSON.stringify({ usage: finalUsage })}\n\n`);
                      }
                    } catch {}
                  }
                }
                res.write('data: [DONE]\n\n');
                await trace({
                  ...baseTrace,
                  name: chatName,
                  output: { content: streamContent },
                  usage: finalUsage ? { promptTokens: finalUsage.prompt_tokens, completionTokens: finalUsage.completion_tokens } : undefined,
                });
                return res.end();
              }
              // Non-stream fallback
              const text = await apiRes.text();
              const lines = text.split('\n').filter(Boolean);
              let full = '';
              let promptEval = 0;
              let evalCount = 0;
              for (const line of lines) {
                try {
                  const parsed = JSON.parse(line);
                  full += parsed.message?.content || '';
                  if (parsed.prompt_eval_count != null) promptEval = parsed.prompt_eval_count;
                  if (parsed.eval_count != null) evalCount = parsed.eval_count;
                } catch {}
              }
              await trace({
                ...baseTrace,
                name: chatName,
                output: { content: full },
                usage: promptEval + evalCount > 0 ? { promptTokens: promptEval, completionTokens: evalCount } : undefined,
              });
              return json(res, 200, {
                choices: [{ message: { content: full } }],
                usage: { prompt_tokens: promptEval, completion_tokens: evalCount, total_tokens: promptEval + evalCount },
              });
            } catch (err) {
              const msg = err?.message || 'unknown';
              await trace({ ...baseTrace, name: chatName, error: { kind: err?.name === 'AbortError' ? 'timeout' : 'connection', message: msg.slice(0, 200) } });
              // Se lo stream è già partito, non possiamo fare json()
              // (setHeader → ERR_HTTP_HEADERS_SENT crash del server).
              if (streamStarted) {
                try {
                  res.write(`data: ${JSON.stringify({ error: `Ollama error: ${msg.slice(0, 200)}` })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  res.end();
                } catch { /* client già disconnesso */ }
                return;
              }
              return json(res, 502, { error: `Ollama error: ${msg.slice(0, 200)}` });
            } finally {
              clearTimeout(timeout);
            }
          }

          // ─── Dev API proxy: AI routes ───────────────────────────────
          // In dev Vite does not run the Vercel serverless function, so
          // we proxy /api/ai/* directly to the real providers. We reuse
          // the same provider classes used in production to keep dev/prod
          // behaviour identical.
          //
          // TB-029: ogni endpoint AI gestito qui DEVE tracciare su Langfuse
          // (stesso data model del server handler di prod). Mai base64 raw
          // nei payload: il resolver media di langfuse.ts li converte in
          // token (rendering inline) o placeholder.
          async function traceDev(input) {
            try {
              const mod = await server.ssrLoadModule('/src/server/langfuse.ts');
              const env = process.env.VERCEL_ENV === 'production' ? 'production' : 'development';
              await mod.ingestLangfuse({ ...input, environment: env });
            } catch {
              // mai rompere la risposta per un errore di tracing
            }
          }
          // requestId client arriva nell'header X-Request-Id (come in prod).
          const devReqId = (req) => {
            const h = req.headers?.['x-request-id'];
            return typeof h === 'string' && h ? h : crypto.randomUUID();
          };
          // TB-029 fix: costo Gemini per immagine (stessa tabella del server
          // handler ai.ts — il client non invia costUsd, quindi il proxy lo
          // calcola da solo, altrimenti Gemini risulta gratis in locale).
          const GEMINI_PER_IMAGE = { 'gemini-3.1-flash-image': 0.04, 'gemini-2.0-flash-preview-image-generation': 0.02 };
          const geminiCost = (model) => {
            const perImage = GEMINI_PER_IMAGE[model] ?? GEMINI_PER_IMAGE['gemini-3.1-flash-image'];
            return Math.round(perImage * 1_000_000) / 1_000_000;
          };
          server.middlewares.use(async (req, res, next) => {
            const url = (req.url || '').split('?')[0];
            const handledPaths = [
              '/api/ai/logo-config',
              '/api/ai/logo-background',
              '/api/ai/card-cover',
              '/api/ai/flyer-hero',
              '/api/ai/card-photo',
              '/api/ai/image-flash',
              '/api/ai/design-review',
              '/api/ai/chat',
              '/api/ai/chat/stream',
              '/api/ai/prompt',
              '/api/ai/embeddings',
              '/api/logs',
            ];
            if (!handledPaths.includes(url)) return next();
            if (req.method !== 'GET' && req.method !== 'POST') return next();

            try {
              let body = {};
              if (req.method === 'POST') {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const raw = Buffer.concat(chunks).toString('utf-8');
                if (raw) {
                  try { body = JSON.parse(raw); } catch (e) { body = {}; }
                }
              }

              const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

              // Dev mirror di `POST /api/logs` (api/index.ts): in dev la
              // Vercel function non gira, quindi stampiamo i log client
              // nella console del dev server invece di rispondere 404.
              if (url === '/api/logs') {
                if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
                const { level, msg, meta, url: logUrl, t } = body || {};
                const safeLevel = ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info';
                const text = typeof msg === 'string' ? msg.slice(0, 500) : JSON.stringify(body).slice(0, 500);
                const tag = safeLevel === 'debug' ? 'log' : safeLevel;
                console[tag](`[client] ${text}`, meta && Object.keys(meta).length ? meta : '', logUrl || '', t || '');
                return json(res, 200, { data: { ok: true } });
              }

              if (url === '/api/ai/logo-config' && req.method === 'GET') {
                const enabled = !!apiKey;
                return json(res, 200, { enabled, provider: enabled ? 'gemini' : 'none' });
              }

              if (url === '/api/ai/logo-background' && req.method === 'POST') {
                if (!apiKey) {
                  return json(res, 503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const prompt = typeof body.prompt === 'string' ? body.prompt : '';
                if (!prompt || prompt.length > 1000) {
                  return json(res, 400, { error: 'prompt mancante o troppo lungo' });
                }
                const mod = await server.ssrLoadModule('/src/ai/providers/gemini.ts');
                const provider = new mod.GeminiImageProvider(apiKey);
                const t0 = Date.now();
                try {
                  const result = await provider.generateBackground(prompt, 45_000);
                  const sizeBytes = Math.ceil(result.imageBase64.length * 0.75);
                  if (sizeBytes > 1_000_000) {
                    return json(res, 413, { error: 'Immagine troppo grande (>1MB). Riprova con un prompt più semplice.' });
                  }
                  await traceDev({
                    name: 'logo-background',
                    requestId: devReqId(req),
                    model: 'gemini-3.1-flash-image',
                    provider: 'gemini',
                    userEmail: body.userEmail,
                    customerId: body.customerId,
                    sessionId: body.sessionId,
                    feature: 'logo',
                    subfeature: 'background',
                    costUsd: geminiCost('gemini-3.1-flash-image'),
                    input: { prompt },
                    output: { mimeType: result.mimeType, sizeKB: sizeBytes / 1024, imageBase64: `data:${result.mimeType};base64,${result.imageBase64}` },
                    startTime: t0,
                  });
                  return json(res, 200, { data: result });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  const errorKind = msg.startsWith('GEMINI_401') || msg.startsWith('GEMINI_INVALID_KEY') ? 'auth' : msg.startsWith('GEMINI_429') || msg.startsWith('GEMINI_QUOTA_EXCEEDED') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : 'upstream';
                  await traceDev({ name: 'logo-background', requestId: devReqId(req), model: 'gemini-3.1-flash-image', provider: 'gemini', userEmail: body.userEmail, customerId: body.customerId, sessionId: body.sessionId, feature: 'logo', subfeature: 'background', costUsd: geminiCost('gemini-3.1-flash-image'), input: { prompt }, error: { kind: errorKind, message: msg.slice(0, 200) }, startTime: t0 });
                  if (msg.startsWith('GEMINI_INVALID_KEY')) return json(res, 401, { error: 'Chiave Gemini non valida' });
                  if (msg.startsWith('GEMINI_QUOTA_EXCEEDED')) return json(res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' });
                  if (msg.startsWith('GEMINI_TIMEOUT')) return json(res, 504, { error: 'Gemini non ha risposto entro 30s.' });
                  return json(res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` });
                }
              }

              if (url === '/api/ai/card-cover' && req.method === 'POST') {
                if (!apiKey) {
                  return json(res, 503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const prompt = typeof body.prompt === 'string' ? body.prompt : '';
                if (!prompt || prompt.length > 1000) {
                  return json(res, 400, { error: 'prompt mancante o troppo lungo' });
                }
                const context = typeof body.context === 'string' ? body.context.slice(0, 2000) : '';
                const grounding =
                  'The attached image(s) show the business card layout I am designing a background for. Use them as reference for text placement, colour harmony, and profession. Do NOT reproduce any text, QR code, logo, face, or UI element visible in the reference — generate only the abstract background. If a background is already visible in the reference image, treat it as the previous iteration to improve upon, not as a constraint to copy.';
                const hasImages = !!(body.cardImage || body.logoImage);
                const finalPrompt = hasImages
                  ? `${grounding}\n\n${prompt}${context ? '\n\nCARD CONTEXT:\n' + context : ''}`
                  : `${prompt}${context ? '\n\nCARD CONTEXT:\n' + context : ''}`;
                const mod = await server.ssrLoadModule('/src/ai/providers/gemini.ts');
                const t0 = Date.now();
                const imageModel = typeof body.imageModel === 'string' ? body.imageModel : 'gemini-3.1-flash-image';
                const provider = new mod.GeminiImageProvider(apiKey, imageModel);
                try {
                  const images = [];
                  if (body.cardImage) images.push({ data: String(body.cardImage), mimeType: 'image/jpeg' });
                  if (body.logoImage) images.push({ data: String(body.logoImage), mimeType: 'image/png' });
                  const result = await provider.generateCardCover(finalPrompt, 30_000, images);
                  const sizeBytes = Math.ceil(result.imageBase64.length * 0.75);
                  if (sizeBytes > 1_000_000) {
                    return json(res, 413, { error: 'Immagine troppo grande (>1MB). Riprova con un prompt più semplice.' });
                  }
                  await traceDev({
                    name: 'card-cover',
                    requestId: devReqId(req),
                    model: imageModel,
                    provider: 'gemini',
                    userEmail: body.userEmail,
                    customerId: body.customerId,
                    sessionId: body.sessionId,
                    feature: 'card',
                    subfeature: 'cover',
                    costUsd: geminiCost(imageModel),
                    input: { prompt, context: context || undefined, side: body.side },
                    output: { mimeType: result.mimeType, sizeKB: sizeBytes / 1024, imageBase64: `data:${result.mimeType};base64,${result.imageBase64}` },
                    startTime: t0,
                  });
                  return json(res, 200, { data: result });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  const errorKind = msg.startsWith('GEMINI_401') || msg.startsWith('GEMINI_INVALID_KEY') ? 'auth' : msg.startsWith('GEMINI_429') || msg.startsWith('GEMINI_QUOTA_EXCEEDED') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : 'upstream';
                  await traceDev({ name: 'card-cover', requestId: devReqId(req), model: imageModel, provider: 'gemini', userEmail: body.userEmail, customerId: body.customerId, sessionId: body.sessionId, feature: 'card', subfeature: 'cover', costUsd: geminiCost(imageModel), input: { prompt }, error: { kind: errorKind, message: msg.slice(0, 200) }, startTime: t0 });
                  if (msg.startsWith('GEMINI_INVALID_KEY')) return json(res, 401, { error: 'Chiave Gemini non valida' });
                  if (msg.startsWith('GEMINI_QUOTA_EXCEEDED')) return json(res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' });
                  if (msg.startsWith('GEMINI_TIMEOUT')) return json(res, 504, { error: 'Gemini non ha risposto entro 30s.' });
                  return json(res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` });
                }
              }

              if (url === '/api/ai/flyer-hero' && req.method === 'POST') {
                if (!apiKey) {
                  return json(res, 503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const prompt = typeof body.prompt === 'string' ? body.prompt : '';
                if (!prompt || prompt.length > 1500) {
                  return json(res, 400, { error: 'prompt mancante o troppo lungo' });
                }
                const context = typeof body.context === 'string' ? body.context.slice(0, 1500) : '';
                const grounding =
                  'The attached image shows the flyer layout I am designing a hero image for. Use it as reference for the hero box position, the copy placement, and the overall visual style. Generate only the hero image that fits the hero box area; do NOT reproduce any text, QR code, logo, or UI element visible in the reference.';
                const hasImages = !!body.flyerImage;
                const finalPrompt = hasImages
                  ? `${grounding}\n\n${prompt}${context ? '\n\nFLYER CONTEXT:\n' + context : ''}`
                  : `${prompt}${context ? '\n\nFLYER CONTEXT:\n' + context : ''}`;
                const mod = await server.ssrLoadModule('/src/ai/providers/gemini.ts');
                const t0 = Date.now();
                const imageModel = typeof body.imageModel === 'string' ? body.imageModel : 'gemini-3.1-flash-image';
                const provider = new mod.GeminiImageProvider(apiKey, imageModel);
                try {
                  const images = body.flyerImage ? [{ data: String(body.flyerImage), mimeType: 'image/jpeg' }] : [];
                  const imageConfig = { image_size: '1K', aspect_ratio: body.aspectRatio || '3:2' };
                  const result = await provider.generateImage(finalPrompt, imageConfig, 45_000, images);
                  const sizeBytes = Math.ceil(result.imageBase64.length * 0.75);
                  if (sizeBytes > 1_000_000) {
                    return json(res, 413, { error: 'Immagine troppo grande (>1MB). Riprova con un prompt più semplice.' });
                  }
                  await traceDev({
                    name: 'flyer-hero',
                    requestId: devReqId(req),
                    model: imageModel,
                    provider: 'gemini',
                    userEmail: body.userEmail,
                    customerId: body.customerId,
                    sessionId: body.sessionId,
                    feature: 'flyer',
                    subfeature: 'hero',
                    costUsd: geminiCost(imageModel),
                    input: { prompt, context: context || undefined },
                    output: { mimeType: result.mimeType, sizeKB: sizeBytes / 1024, imageBase64: `data:${result.mimeType};base64,${result.imageBase64}` },
                    startTime: t0,
                  });
                  return json(res, 200, { data: result });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  const errorKind = msg.startsWith('GEMINI_401') || msg.startsWith('GEMINI_INVALID_KEY') ? 'auth' : msg.startsWith('GEMINI_429') || msg.startsWith('GEMINI_QUOTA_EXCEEDED') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : 'upstream';
                  await traceDev({ name: 'flyer-hero', requestId: devReqId(req), model: imageModel, provider: 'gemini', userEmail: body.userEmail, customerId: body.customerId, sessionId: body.sessionId, feature: 'flyer', subfeature: 'hero', costUsd: geminiCost(imageModel), input: { prompt }, error: { kind: errorKind, message: msg.slice(0, 200) }, startTime: t0 });
                  if (msg.startsWith('GEMINI_INVALID_KEY')) return json(res, 401, { error: 'Chiave Gemini non valida' });
                  if (msg.startsWith('GEMINI_QUOTA_EXCEEDED')) return json(res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' });
                  if (msg.startsWith('GEMINI_TIMEOUT')) return json(res, 504, { error: 'Gemini non ha risposto entro 30s.' });
                  return json(res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` });
                }
              }

              // Profession photo for business card (replaces photoUrl).
              // Same path as client/prod: /api/ai/card-photo
              if (url === '/api/ai/card-photo' && req.method === 'POST') {
                if (!apiKey) {
                  return json(res, 503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const prompt = typeof body.prompt === 'string' ? body.prompt : '';
                if (!prompt || prompt.length > 1000) {
                  return json(res, 400, { error: 'prompt mancante o troppo lungo' });
                }
                const context = typeof body.context === 'string' ? body.context.slice(0, 1500) : '';
                const finalPrompt = context
                  ? `${prompt}\n\nCARD PHOTO CONTEXT:\n${context}`
                  : prompt;
                const mod = await server.ssrLoadModule('/src/ai/providers/gemini.ts');
                const t0 = Date.now();
                const imageModel = typeof body.imageModel === 'string' ? body.imageModel : 'gemini-3.1-flash-image';
                const provider = new mod.GeminiImageProvider(apiKey, imageModel);
                try {
                  const result = await provider.generateImage(
                    finalPrompt,
                    { image_size: '1K', aspect_ratio: '3:4' },
                    30_000,
                    [],
                  );
                  const sizeBytes = Math.ceil(result.imageBase64.length * 0.75);
                  if (sizeBytes > 1_000_000) {
                    return json(res, 413, { error: 'Immagine troppo grande (>1MB). Riprova con un prompt più semplice.' });
                  }
                  await traceDev({
                    name: 'card-photo',
                    requestId: devReqId(req),
                    model: imageModel,
                    provider: 'gemini',
                    userEmail: body.userEmail,
                    customerId: body.customerId,
                    sessionId: body.sessionId,
                    feature: 'card',
                    subfeature: 'photo',
                    costUsd: geminiCost(imageModel),
                    input: { prompt, context: context || undefined },
                    output: { mimeType: result.mimeType, sizeKB: sizeBytes / 1024, imageBase64: `data:${result.mimeType};base64,${result.imageBase64}` },
                    startTime: t0,
                  });
                  return json(res, 200, { data: result });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  const errorKind = msg.startsWith('GEMINI_401') || msg.startsWith('GEMINI_INVALID_KEY') ? 'auth' : msg.startsWith('GEMINI_429') || msg.startsWith('GEMINI_QUOTA_EXCEEDED') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : 'upstream';
                  await traceDev({ name: 'card-photo', requestId: devReqId(req), model: imageModel, provider: 'gemini', userEmail: body.userEmail, customerId: body.customerId, sessionId: body.sessionId, feature: 'card', subfeature: 'photo', costUsd: geminiCost(imageModel), input: { prompt }, error: { kind: errorKind, message: msg.slice(0, 200) }, startTime: t0 });
                  if (msg.startsWith('GEMINI_INVALID_KEY')) return json(res, 401, { error: 'Chiave Gemini non valida' });
                  if (msg.startsWith('GEMINI_QUOTA_EXCEEDED')) return json(res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' });
                  if (msg.startsWith('GEMINI_TIMEOUT')) return json(res, 504, { error: 'Gemini non ha risposto entro 30s.' });
                  if (String(msg).toLowerCase().includes('copyright') || String(msg).toLowerCase().includes('recitation')) {
                    return json(res, 400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' });
                  }
                  return json(res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` });
                }
              }
              // TB-023: Gemini 2.0 Flash image-flash (icon/hero/custom)
              if (url === '/api/ai/image-flash' && req.method === 'POST') {
                if (!apiKey) {
                  return json(res, 503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const prompt = typeof body.prompt === 'string' ? body.prompt : '';
                if (!prompt || prompt.length > 1000) {
                  return json(res, 400, { error: 'prompt mancante o troppo lungo' });
                }
                const kind = typeof body.kind === 'string' ? body.kind : 'custom';
                const aspectRatio = typeof body.aspectRatio === 'string' ? body.aspectRatio : (kind === 'hero' ? '16:9' : '1:1');
                const size = typeof body.size === 'string' ? body.size : '1K';
                const primaryColor = typeof body.primaryColor === 'string' ? body.primaryColor : undefined;
                const secondaryColor = typeof body.secondaryColor === 'string' ? body.secondaryColor : undefined;
                const style = typeof body.style === 'string' ? body.style : 'minimalist';
                const finalPrompt = (kind === 'icon' && primaryColor && secondaryColor)
                  ? `Stylized flat illustration of ${prompt}. Two colors only: ${primaryColor} and ${secondaryColor}. Transparent background. No text, no border, no gradients, no shadows. Simple geometric shapes. 256x256 px. Style: ${style}.`
                  : (kind === 'hero' && primaryColor && secondaryColor)
                    ? `Stylized flat hero illustration of ${prompt}. Two colors only: ${primaryColor} and ${secondaryColor}. Transparent background. No text, no border. Simple geometric shapes, editorial style. 1024x576 px (16:9). Style: ${style}.`
                    : prompt;
                const mod = await server.ssrLoadModule('/src/ai/providers/gemini.ts');
                const t0 = Date.now();
                const provider = new mod.GeminiImageProvider(apiKey, typeof body.imageModel === 'string' ? body.imageModel : undefined);
                try {
                  const result = await provider.generateImage(finalPrompt, { image_size: size, aspect_ratio: aspectRatio }, 30_000, []);
                  const sizeBytes = Math.ceil(result.imageBase64.length * 0.75);
                  if (sizeBytes > 1_000_000) {
                    return json(res, 413, { error: 'Immagine troppo grande (>1MB). Riprova con un prompt più semplice.' });
                  }
                  await traceDev({
                    name: 'image-flash',
                    requestId: devReqId(req),
                    model: typeof body.imageModel === 'string' ? body.imageModel : 'gemini-3.1-flash-image',
                    provider: 'gemini',
                    userEmail: body.userEmail,
                    customerId: body.customerId,
                    sessionId: body.sessionId,
                    feature: kind === 'icon' ? 'card' : kind === 'hero' ? 'flyer' : 'image',
                    subfeature: kind === 'icon' ? 'icon' : kind === 'hero' ? 'hero' : 'flash',
                    costUsd: geminiCost(typeof body.imageModel === 'string' ? body.imageModel : 'gemini-3.1-flash-image'),
                    input: { prompt, kind, aspectRatio },
                    output: { mimeType: result.mimeType, sizeKB: sizeBytes / 1024, imageBase64: `data:${result.mimeType};base64,${result.imageBase64}` },
                    startTime: t0,
                  });
                  return json(res, 200, { data: result });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  const errorKind = msg.startsWith('GEMINI_401') || msg.startsWith('GEMINI_INVALID_KEY') ? 'auth' : msg.startsWith('GEMINI_429') || msg.startsWith('GEMINI_QUOTA_EXCEEDED') ? 'rate_limit' : msg.startsWith('GEMINI_TIMEOUT') ? 'timeout' : 'upstream';
                  await traceDev({ name: 'image-flash', requestId: devReqId(req), model: typeof body.imageModel === 'string' ? body.imageModel : 'gemini-3.1-flash-image', provider: 'gemini', userEmail: body.userEmail, customerId: body.customerId, sessionId: body.sessionId, feature: kind === 'icon' ? 'card' : kind === 'hero' ? 'flyer' : 'image', subfeature: kind === 'icon' ? 'icon' : kind === 'hero' ? 'hero' : 'flash', costUsd: geminiCost(typeof body.imageModel === 'string' ? body.imageModel : 'gemini-3.1-flash-image'), input: { prompt }, error: { kind: errorKind, message: msg.slice(0, 200) }, startTime: t0 });
                  if (msg.startsWith('GEMINI_INVALID_KEY')) return json(res, 401, { error: 'Chiave Gemini non valida' });
                  if (msg.startsWith('GEMINI_QUOTA_EXCEEDED')) return json(res, 429, { error: 'Quota Gemini esaurita. Riprova più tardi.' });
                  if (msg.startsWith('GEMINI_TIMEOUT')) return json(res, 504, { error: 'Gemini non ha risposto entro 30s.' });
                  return json(res, 502, { error: `Gemini error: ${msg.slice(0, 200)}` });
                }
              }

              // ─── /api/ai/design-review (vision, MiniMax M3) ────────
              if (url === '/api/ai/design-review' && req.method === 'POST') {
                const ollamaKey = process.env.OLLAMA_API_KEY;
                if (!ollamaKey) return json(res, 503, { error: 'Design review non configurato (OLLAMA_API_KEY mancante)' });
                const docType = typeof body.docType === 'string' ? body.docType : 'card';
                const docJson = typeof body.docJson === 'string' ? body.docJson.slice(0, 50_000) : '';
                const screenshot = typeof body.screenshotBase64 === 'string' ? body.screenshotBase64.replace(/^data:[^;]+;base64,/, '') : '';
                if (!screenshot) return json(res, 400, { error: 'screenshotBase64 mancante' });
                const systemPrompt = `Sei un graphic designer AI esperto. Analizza lo screenshot di un ${docType === 'card' ? 'biglietto da visita' : 'volantino'} e suggerisci 3 miglioramenti concreti. Restituisci SOLO un JSON array di 3 oggetti con shape: {"field": "string (es. style.bgColor, content.headline, decoration.id)", "value": "string (valore suggerito)", "reason": "string (motivazione 1 frase in italiano)"}. Focus su: palette colori, gerarchia visiva, leggibilità, decorazione, allineamento. Evita suggerimenti generici.`;
                const ollamaBody = {
                  model: 'minimax-m3:cloud',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Analizza questo ${docType}. JSON attuale:\n${docJson.slice(0, 8000)}`, images: [screenshot] },
                  ],
                  stream: false,
                  format: 'json',
                  think: 'max',
                };
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 60_000);
                const t0 = Date.now();
                try {
                  const apiRes = await fetch('https://ollama.com/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ollamaKey}` },
                    body: JSON.stringify(ollamaBody),
                    signal: controller.signal,
                  });
                  if (!apiRes.ok) {
                    const text = await apiRes.text().catch(() => 'unknown');
                    const errorKind = apiRes.status === 429 ? 'rate_limit' : apiRes.status === 401 ? 'auth' : 'upstream';
                    await traceDev({ name: 'design-review', requestId: devReqId(req), model: 'minimax-m3:cloud', provider: 'ollama', userEmail: body.userEmail, customerId: body.customerId, sessionId: body.sessionId, feature: 'design-review', subfeature: 'review', costUsd: typeof body.costUsd === 'number' ? body.costUsd : undefined, input: { docType }, error: { kind: errorKind, message: text.slice(0, 200) }, startTime: t0 });
                    return json(res, apiRes.status, { error: `Ollama (${apiRes.status}): ${text.slice(0, 200)}` });
                  }
                  const raw = await apiRes.json();
                  const content = raw?.message?.content || '';
                  const usage = { promptTokens: raw?.prompt_eval_count ?? 0, completionTokens: raw?.eval_count ?? 0 };
                  await traceDev({
                    name: 'design-review',
                    requestId: devReqId(req),
                    model: 'minimax-m3:cloud',
                    provider: 'ollama',
                    userEmail: body.userEmail,
                    customerId: body.customerId,
                    sessionId: body.sessionId,
                    feature: 'design-review',
                    subfeature: 'review',
                    costUsd: typeof body.costUsd === 'number' ? body.costUsd : undefined,
                    input: { docType, prompt: systemPrompt.slice(0, 120) },
                    output: { content },
                    usage,
                    startTime: t0,
                  });
                  return json(res, 200, { data: { suggestions: content } });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  const errorKind = err?.name === 'AbortError' ? 'timeout' : 'connection';
                  await traceDev({ name: 'design-review', requestId: devReqId(req), model: 'minimax-m3:cloud', provider: 'ollama', userEmail: body.userEmail, customerId: body.customerId, sessionId: body.sessionId, feature: 'design-review', subfeature: 'review', costUsd: typeof body.costUsd === 'number' ? body.costUsd : undefined, input: { docType }, error: { kind: errorKind, message: msg.slice(0, 200) }, startTime: t0 });
                  return json(res, 502, { error: `Design review error: ${msg.slice(0, 200)}` });
                } finally {
                  clearTimeout(timeout);
                }
              }

              // ─── /api/ai/chat and /api/ai/chat/stream proxy ───────
              // TB-029 fase 2: Prompt Management — dev mirror di GET /api/ai/prompt.
              // Il client decide la label (staging in locale, production in prod);
              // qui fetchiamo Langfuse con le credenziali di dev.
              if (url === '/api/ai/prompt' && req.method === 'GET') {
                const q = new URL(req.url, 'http://localhost');
                const name = (q.searchParams.get('name') || '').trim();
                const label = (q.searchParams.get('label') || '').trim() || 'production';
                if (!name) return json(res, 400, { error: 'Parametro name mancante' });
                const pk = process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY;
                const sk = process.env.LANGFUSE_SECRET_KEY || process.env.VITE_LANGFUSE_SECRET_KEY;
                const base = process.env.LANGFUSE_BASE_URL || process.env.VITE_LANGFUSE_BASE_URL;
                if (!pk || !sk || !base) {
                  // Senza credenziali → fallback al template locale lato client (404).
                  return json(res, 404, { error: 'Langfuse non configurato (LANGFUSE_* o VITE_LANGFUSE_* in .env)' });
                }
                try {
                  const upstream = await fetch(`${base}/api/public/v2/prompts/${encodeURIComponent(name)}?label=${label}`, {
                    headers: { Authorization: `Basic ${Buffer.from(`${pk}:${sk}`).toString('base64')}` },
                    signal: AbortSignal.timeout(2000),
                  });
                  if (!upstream.ok) return json(res, upstream.status, { error: `Langfuse ${upstream.status}` });
                  const body = await upstream.json();
                  const prompt = Array.isArray(body.prompt)
                    ? body.prompt
                    : typeof body.prompt === 'string'
                      ? [{ role: 'system', content: body.prompt }]
                      : null;
                  if (!prompt) return json(res, 502, { error: 'Prompt vuoto' });
                  return json(res, 200, { data: { name: String(body.name ?? name), version: Number(body.version ?? 0), prompt, fallback: false } });
                } catch (err) {
                  return json(res, 502, { error: `Langfuse error: ${String(err?.message || err).slice(0, 120)}` });
                }
              }

              // ─── /api/ai/embeddings (RAG, gemini-embedding-2) ──────
              if (url === '/api/ai/embeddings' && req.method === 'POST') {
                if (!apiKey) {
                  return json(res, 503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const input = typeof body.input === 'string' ? body.input : '';
                if (!input || input.length > 8000) {
                  return json(res, 400, { error: 'input mancante o troppo lungo' });
                }
                const t0 = Date.now();
                try {
                  const { GoogleGenAI } = await import('@google/genai');
                  const ai = new GoogleGenAI({ apiKey });
                  const result = await ai.models.embedContent({ model: 'models/gemini-embedding-2', contents: input });
                  const values = result?.embedding?.values || [];
                  if (!Array.isArray(values) || values.length === 0) {
                    return json(res, 502, { error: 'Embedding vuoto da Gemini' });
                  }
                  await traceDev({
                    name: 'embed-chunk',
                    requestId: devReqId(req),
                    model: 'gemini-embedding-2',
                    provider: 'gemini',
                    userEmail: body.userEmail,
                    customerId: body.customerId,
                    sessionId: body.customerId,
                    feature: 'crm',
                    subfeature: 'embedding',
                    observationType: 'embedding',
                    input: { text: input.slice(0, 500) },
                    output: { dimensions: values.length },
                    startTime: t0,
                  });
                  return json(res, 200, { data: { embedding: values, model: 'gemini-embedding-2' } });
                } catch (err) {
                  const msg = String(err?.message || err).slice(0, 200);
                  await traceDev({ name: 'embed-chunk', requestId: devReqId(req), model: 'gemini-embedding-2', provider: 'gemini', userEmail: body.userEmail, customerId: body.customerId, feature: 'crm', subfeature: 'embedding', observationType: 'embedding', input: { text: input.slice(0, 500) }, error: { kind: 'upstream', message: msg }, startTime: t0 });
                  return json(res, 502, { error: `Embedding error: ${msg}` });
                }
              }

              if (url === '/api/ai/chat' || url === '/api/ai/chat/stream') {
                const isStream = url === '/api/ai/chat/stream';
                let providerId = body.provider || 'deepseek-v4-flash';
                // Il client (OllamaProProvider) può inviare provider='ollama';
                // il registry registra 'ollama-minimax-m3'. Normalizziamo.
                if (providerId === 'ollama') providerId = 'ollama-minimax-m3';
                const messages = Array.isArray(body.messages) ? body.messages : [];
                const temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;
                const maxTokens = body.max_tokens || body.maxTokens;
                const responseFormat = body.response_format || body.responseFormat;
                const tools = body.tools;
                const reasoningEffort = body.reasoning_effort || body.think || body.reasoningEffort;
                const options = { temperature, maxTokens, responseFormat, tools, reasoningEffort };
                let streamStarted = false;

                try {
                  // Ollama in SSR non può usare fetch relativo: bypassiamo il
                  // provider e chiamiamo l'upstream direttamente, come fa il fallback.
                  if (providerId.startsWith('ollama')) {
                    return await proxyOllamaChat(req, res, body, isStream);
                  }
                  const mod = await server.ssrLoadModule('/src/ai/providers/registry.ts').catch(() => null);
                  if (!mod) {
                    // Fallback: direct Ollama proxy using env key.
                    if (providerId.startsWith('ollama')) {
                      return await proxyOllamaChat(req, res, body, isStream);
                    }
                    return json(res, 503, { error: 'Provider non disponibile in SSR. Riprova con Ollama o riavvia il dev server.' });
                  }
                  const registry = new mod.AIProviderRegistry();
                  // Register all providers (registry constructor already does this).
                  const provider = registry.getProvider(providerId);

                  if (isStream) {
                    if (!provider.supportsStreaming) {
                      return json(res, 400, { error: 'Provider non supporta streaming' });
                    }
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache, no-transform');
                    res.setHeader('Connection', 'keep-alive');
                    res.setHeader('X-Accel-Buffering', 'no');
                    streamStarted = true;
                    for await (const chunk of provider.stream(messages, { ...options, stream: true })) {
                      if (chunk.type === 'content') {
                        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: chunk.content } }] })}\n\n`);
                      } else if (chunk.type === 'tool_call') {
                        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: chunk.toolCall.function }] } }] })}\n\n`);
                      } else if (chunk.type === 'done' && chunk.usage) {
                        res.write(`data: ${JSON.stringify({ usage: { prompt_tokens: chunk.usage.promptTokens, completion_tokens: chunk.usage.completionTokens, total_tokens: chunk.usage.totalTokens } })}\n\n`);
                      } else if (chunk.type === 'error') {
                        res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
                        break;
                      }
                    }
                    res.write('data: [DONE]\n\n');
                    return res.end();
                  }

                  const result = await provider.chat(messages, options);
                  if (result.error) {
                    return json(res, 503, { error: result.error });
                  }
                  return json(res, 200, {
                    choices: [{ message: { content: result.content, tool_calls: result.toolCalls } }],
                    usage: result.usage,
                  });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  // Se lo stream è già partito (header SSE inviati) NON possiamo
                  // fare json() (setHeader → ERR_HTTP_HEADERS_SENT crash server).
                  // Invia l'errore come evento SSE e chiudi.
                  if (streamStarted) {
                    try {
                      res.write(`data: ${JSON.stringify({ error: `AI error: ${msg.slice(0, 200)}` })}\n\n`);
                      res.write('data: [DONE]\n\n');
                      res.end();
                    } catch { /* client già disconnesso */ }
                    return;
                  }
                  return json(res, 502, { error: `AI error: ${msg.slice(0, 200)}` });
                }
              }
            } catch (e) {
              return json(res, 500, { error: e.message || 'unknown' });
            }
            next();
          });
        },
      },
    ],
    server: {
      port: 8000,
      open: true,
    },
    optimizeDeps: {
      include: ['pdfmake'],
    },
    build: {
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
            if (id.includes('/react-router')) return 'router-vendor';
            if (id.includes('/lucide-react/')) return 'lucide';
            if (id.includes('/zod/')) return 'zod';
            if (id.includes('/pdfmake/')) return 'pdfmake';
            if (id.includes('/jspdf/') || id.includes('/svg2pdf.js/')) return 'pdf-libs';
            if (id.includes('/docx/')) return 'docx';
            if (id.includes('/tesseract.js/')) return 'tesseract';
            if (id.includes('/html2canvas/')) return 'html2canvas';
            if (id.includes('/@dnd-kit/')) return 'dnd-kit';
            if (id.includes('/qrcode/')) return 'qrcode';
            if (id.includes('/@codemirror/') || id.includes('/codemirror/') || id.includes('/@lezer/') || id.includes('/@codemirror/') || id.includes('/@codemirror/language/')) return 'codemirror';
          },
        },
      },
    },
  };
});
