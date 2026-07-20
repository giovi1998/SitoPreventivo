import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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

          // ─── Fallback Ollama chat proxy (SSR-safe) ──────────────────
          async function proxyOllamaChat(res, body, isStream) {
            const ollamaKey = process.env.OLLAMA_API_KEY;
            if (!ollamaKey) return json(503, { error: 'OLLAMA_API_KEY non configurata' });
            const model = body.model || 'minimax-m3:cloud';
            const messages = Array.isArray(body.messages) ? body.messages : [];
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60_000);
            try {
              const apiRes = await fetch('https://ollama.com/api/chat', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${ollamaKey}`,
                  Accept: 'application/x-ndjson',
                },
                body: JSON.stringify({ model, messages, stream: true }),
                signal: controller.signal,
              });
              if (!apiRes.ok) {
                const text = await apiRes.text().catch(() => 'Unknown error');
                return json(apiRes.status, { error: `Ollama (${apiRes.status}): ${text.slice(0, 200)}` });
              }
              if (isStream) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache, no-transform');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                const reader = apiRes.body?.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
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
                        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`);
                      }
                      if (parsed.done) {
                        if (parsed.prompt_eval_count != null || parsed.eval_count != null) {
                          res.write(`data: ${JSON.stringify({ usage: { prompt_tokens: parsed.prompt_eval_count ?? 0, completion_tokens: parsed.eval_count ?? 0, total_tokens: (parsed.prompt_eval_count ?? 0) + (parsed.eval_count ?? 0) } })}\n\n`);
                        }
                      }
                    } catch {}
                  }
                }
                res.write('data: [DONE]\n\n');
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
              return json(200, {
                choices: [{ message: { content: full } }],
                usage: { prompt_tokens: promptEval, completion_tokens: evalCount, total_tokens: promptEval + evalCount },
              });
            } catch (err) {
              const msg = err?.message || 'unknown';
              return json(502, { error: `Ollama error: ${msg.slice(0, 200)}` });
            } finally {
              clearTimeout(timeout);
            }
          }

          // ─── Dev API proxy: AI routes ───────────────────────────────
          // In dev Vite does not run the Vercel serverless function, so
          // we proxy /api/ai/* directly to the real providers. We reuse
          // the same provider classes used in production to keep dev/prod
          // behaviour identical.
          server.middlewares.use(async (req, res, next) => {
            const url = (req.url || '').split('?')[0];
            const handledPaths = [
              '/api/ai/logo-config',
              '/api/ai/logo-background',
              '/api/ai/card-cover',
              '/api/ai/flyer-hero',
              '/api/ai/card-photo',
              '/api/ai/chat',
              '/api/ai/chat/stream',
            ];
            if (!handledPaths.includes(url)) return next();
            if (req.method !== 'GET' && req.method !== 'POST') return next();

            const json = (status, payload) => {
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(payload));
            };

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

              if (url === '/api/ai/logo-config' && req.method === 'GET') {
                const enabled = !!apiKey;
                return json(200, { enabled, provider: enabled ? 'gemini' : 'none' });
              }

              if (url === '/api/ai/logo-background' && req.method === 'POST') {
                if (!apiKey) {
                  return json(503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const prompt = typeof body.prompt === 'string' ? body.prompt : '';
                if (!prompt || prompt.length > 1000) {
                  return json(400, { error: 'prompt mancante o troppo lungo' });
                }
                const mod = await server.ssrLoadModule('/src/ai/providers/gemini.ts');
                const provider = new mod.GeminiImageProvider(apiKey);
                try {
                  const result = await provider.generateBackground(prompt, 30_000);
                  const sizeBytes = Math.ceil(result.imageBase64.length * 0.75);
                  if (sizeBytes > 500_000) {
                    return json(413, { error: 'Immagine troppo grande (>500KB). Riprova con un prompt più semplice.' });
                  }
                  return json(200, { data: result });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  if (msg.startsWith('GEMINI_INVALID_KEY')) return json(401, { error: 'Chiave Gemini non valida' });
                  if (msg.startsWith('GEMINI_QUOTA_EXCEEDED')) return json(429, { error: 'Quota Gemini esaurita. Riprova più tardi.' });
                  if (msg.startsWith('GEMINI_TIMEOUT')) return json(504, { error: 'Gemini non ha risposto entro 30s.' });
                  return json(502, { error: `Gemini error: ${msg.slice(0, 200)}` });
                }
              }

              if (url === '/api/ai/card-cover' && req.method === 'POST') {
                if (!apiKey) {
                  return json(503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const prompt = typeof body.prompt === 'string' ? body.prompt : '';
                if (!prompt || prompt.length > 1000) {
                  return json(400, { error: 'prompt mancante o troppo lungo' });
                }
                const context = typeof body.context === 'string' ? body.context.slice(0, 2000) : '';
                const grounding =
                  'The attached image(s) show the business card layout I am designing a background for. Use them as reference for text placement, colour harmony, and profession. Do NOT reproduce any text, QR code, logo, face, or UI element visible in the reference — generate only the abstract background. If a background is already visible in the reference image, treat it as the previous iteration to improve upon, not as a constraint to copy.';
                const hasImages = !!(body.cardImage || body.logoImage);
                const finalPrompt = hasImages
                  ? `${grounding}\n\n${prompt}${context ? '\n\nCARD CONTEXT:\n' + context : ''}`
                  : `${prompt}${context ? '\n\nCARD CONTEXT:\n' + context : ''}`;
                const mod = await server.ssrLoadModule('/src/ai/providers/gemini.ts');
                const provider = new mod.GeminiImageProvider(apiKey);
                try {
                  const images = [];
                  if (body.cardImage) images.push({ data: String(body.cardImage), mimeType: 'image/jpeg' });
                  if (body.logoImage) images.push({ data: String(body.logoImage), mimeType: 'image/png' });
                  const result = await provider.generateCardCover(finalPrompt, 30_000, images);
                  const sizeBytes = Math.ceil(result.imageBase64.length * 0.75);
                  if (sizeBytes > 500_000) {
                    return json(413, { error: 'Immagine troppo grande (>500KB). Riprova con un prompt più semplice.' });
                  }
                  return json(200, { data: result });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  if (msg.startsWith('GEMINI_INVALID_KEY')) return json(401, { error: 'Chiave Gemini non valida' });
                  if (msg.startsWith('GEMINI_QUOTA_EXCEEDED')) return json(429, { error: 'Quota Gemini esaurita. Riprova più tardi.' });
                  if (msg.startsWith('GEMINI_TIMEOUT')) return json(504, { error: 'Gemini non ha risposto entro 30s.' });
                  return json(502, { error: `Gemini error: ${msg.slice(0, 200)}` });
                }
              }

              if (url === '/api/ai/flyer-hero' && req.method === 'POST') {
                if (!apiKey) {
                  return json(503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const prompt = typeof body.prompt === 'string' ? body.prompt : '';
                if (!prompt || prompt.length > 1500) {
                  return json(400, { error: 'prompt mancante o troppo lungo' });
                }
                const context = typeof body.context === 'string' ? body.context.slice(0, 1500) : '';
                const grounding =
                  'The attached image shows the flyer layout I am designing a hero image for. Use it as reference for the hero box position, the copy placement, and the overall visual style. Generate only the hero image that fits the hero box area; do NOT reproduce any text, QR code, logo, or UI element visible in the reference.';
                const hasImages = !!body.flyerImage;
                const finalPrompt = hasImages
                  ? `${grounding}\n\n${prompt}${context ? '\n\nFLYER CONTEXT:\n' + context : ''}`
                  : `${prompt}${context ? '\n\nFLYER CONTEXT:\n' + context : ''}`;
                const mod = await server.ssrLoadModule('/src/ai/providers/gemini.ts');
                const provider = new mod.GeminiImageProvider(apiKey);
                try {
                  const images = body.flyerImage ? [{ data: String(body.flyerImage), mimeType: 'image/jpeg' }] : [];
                  const imageConfig = { image_size: '512', aspect_ratio: body.aspectRatio || '3:2' };
                  const result = await provider.generateImage(finalPrompt, imageConfig, 30_000, images);
                  const sizeBytes = Math.ceil(result.imageBase64.length * 0.75);
                  if (sizeBytes > 500_000) {
                    return json(413, { error: 'Immagine troppo grande (>500KB). Riprova con un prompt più semplice.' });
                  }
                  return json(200, { data: result });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  if (msg.startsWith('GEMINI_INVALID_KEY')) return json(401, { error: 'Chiave Gemini non valida' });
                  if (msg.startsWith('GEMINI_QUOTA_EXCEEDED')) return json(429, { error: 'Quota Gemini esaurita. Riprova più tardi.' });
                  if (msg.startsWith('GEMINI_TIMEOUT')) return json(504, { error: 'Gemini non ha risposto entro 30s.' });
                  return json(502, { error: `Gemini error: ${msg.slice(0, 200)}` });
                }
              }

              // Profession photo for business card (replaces photoUrl).
              // Same path as client/prod: /api/ai/card-photo
              if (url === '/api/ai/card-photo' && req.method === 'POST') {
                if (!apiKey) {
                  return json(503, { error: 'GEMINI_API_KEY non configurata (metti VITE_GEMINI_API_KEY in .env)' });
                }
                const prompt = typeof body.prompt === 'string' ? body.prompt : '';
                if (!prompt || prompt.length > 1000) {
                  return json(400, { error: 'prompt mancante o troppo lungo' });
                }
                const context = typeof body.context === 'string' ? body.context.slice(0, 1500) : '';
                const finalPrompt = context
                  ? `${prompt}\n\nCARD PHOTO CONTEXT:\n${context}`
                  : prompt;
                const mod = await server.ssrLoadModule('/src/ai/providers/gemini.ts');
                const provider = new mod.GeminiImageProvider(apiKey);
                try {
                  const result = await provider.generateImage(
                    finalPrompt,
                    { image_size: '512', aspect_ratio: '1:1' },
                    30_000,
                    [],
                  );
                  const sizeBytes = Math.ceil(result.imageBase64.length * 0.75);
                  if (sizeBytes > 500_000) {
                    return json(413, { error: 'Immagine troppo grande (>500KB). Riprova con un prompt più semplice.' });
                  }
                  return json(200, { data: result });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  if (msg.startsWith('GEMINI_INVALID_KEY')) return json(401, { error: 'Chiave Gemini non valida' });
                  if (msg.startsWith('GEMINI_QUOTA_EXCEEDED')) return json(429, { error: 'Quota Gemini esaurita. Riprova più tardi.' });
                  if (msg.startsWith('GEMINI_TIMEOUT')) return json(504, { error: 'Gemini non ha risposto entro 30s.' });
                  if (String(msg).toLowerCase().includes('copyright') || String(msg).toLowerCase().includes('recitation')) {
                    return json(400, { error: 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.' });
                  }
                  return json(502, { error: `Gemini error: ${msg.slice(0, 200)}` });
                }
              }
              // ─── /api/ai/chat and /api/ai/chat/stream proxy ───────
              if (url === '/api/ai/chat' || url === '/api/ai/chat/stream') {
                const isStream = url === '/api/ai/chat/stream';
                const providerId = body.provider || 'deepseek-chat';
                const messages = Array.isArray(body.messages) ? body.messages : [];
                const temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;
                const maxTokens = body.max_tokens || body.maxTokens;
                const responseFormat = body.response_format || body.responseFormat;
                const tools = body.tools;
                const options = { temperature, maxTokens, responseFormat, tools };

                try {
                  // Provider registry import may fail in SSR because
                  // dataService.js touches `window`. We guard it below.
                  const mod = await server.ssrLoadModule('/src/ai/providers/registry.ts').catch(() => null);
                  if (!mod) {
                    // Fallback: direct Ollama proxy using env key.
                    if (providerId.startsWith('ollama')) {
                      return await proxyOllamaChat(res, body, isStream);
                    }
                    return json(503, { error: 'Provider non disponibile in SSR. Riprova con Ollama o riavvia il dev server.' });
                  }
                  const registry = new mod.AIProviderRegistry();
                  // Register all providers (registry constructor already does this).
                  const provider = registry.getProvider(providerId);

                  if (isStream) {
                    if (!provider.supportsStreaming) {
                      return json(400, { error: 'Provider non supporta streaming' });
                    }
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache, no-transform');
                    res.setHeader('Connection', 'keep-alive');
                    res.setHeader('X-Accel-Buffering', 'no');
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
                    return json(503, { error: result.error });
                  }
                  return json(200, {
                    choices: [{ message: { content: result.content, tool_calls: result.toolCalls } }],
                    usage: result.usage,
                  });
                } catch (err) {
                  const msg = err?.message || 'unknown';
                  return json(502, { error: `AI error: ${msg.slice(0, 200)}` });
                }
              }
            } catch (e) {
              return json(500, { error: e.message || 'unknown' });
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
  };
});
