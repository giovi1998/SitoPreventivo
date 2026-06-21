import type { RouteHandler } from '../lib/types';
import { json, addCorsHeaders } from '../lib/response';
import { log } from '../lib/logger';
import { checkRateLimit } from '../lib/rateLimit';
import { getClientIp } from '../lib/auth';

export const handleAI: RouteHandler = async (path, method, req, res, body) => {
  if (path === '/admin/deepseek-status' && method === 'GET') {
    return json(req, res, 200, { configured: !!process.env.DEEPSEEK_API_KEY });
  }

  if (path === '/ai/chat' && method === 'POST') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      log.error('[DeepSeek] DEEPSEEK_API_KEY env var not set', { path });
      return json(req, res, 503, { error: 'DeepSeek non configurato.' });
    }
    const { model, messages, response_format, temperature } = body;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let apiRes: Response;
    try {
      apiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages,
          response_format: response_format || { type: 'json_object' },
          temperature: temperature ?? 0.7,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        return json(req, res, 504, { error: 'DeepSeek non ha risposto entro 25 secondi. Riprova.' });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    if (!apiRes.ok) {
      const errBody = await apiRes.text().catch(() => 'Unknown error');
      if (apiRes.status === 402) return json(req, res, 402, { error: 'Credito DeepSeek esaurito. Ricarica su platform.deepseek.com' });
      if (apiRes.status === 401) return json(req, res, 401, { error: 'Chiave API DeepSeek non valida' });
      if (apiRes.status === 429) return json(req, res, 429, { error: 'Troppe richieste a DeepSeek. Attendi qualche secondo e riprova.' });
      return json(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` });
    }
    const data = await apiRes.json();
    return json(req, res, 200, data);
  }

  if (path === '/ai/chat/stream' && method === 'POST') {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip, 'aistream', 30, 60 * 1000);
    if (rl.blocked) {
      return json(req, res, 429, { error: 'Troppe richieste AI. Attendi un minuto.' });
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      log.error('[DeepSeek] DEEPSEEK_API_KEY env var not set', { path });
      return json(req, res, 503, { error: 'DeepSeek non configurato.' });
    }
    const { model, messages, tools, temperature, max_tokens } = body as {
      model?: string; messages?: unknown; tools?: unknown; temperature?: number; max_tokens?: number;
    };
    const upBody = {
      model: model || 'deepseek-chat',
      messages,
      stream: true,
      ...(tools ? { tools } : {}),
      ...(temperature !== undefined ? { temperature } : { temperature: 0.7 }),
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
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        return json(req, res, 504, { error: 'DeepSeek non ha risposto entro 60 secondi. Riprova.' });
      }
      log.error('[Stream] Errore di connessione', { msg: (err as Error)?.message });
      return json(req, res, 502, { error: `Connessione fallita: ${(err as Error)?.message || 'unknown'}` });
    }
    if (!apiRes.ok) {
      clearTimeout(timeout);
      const errBody = await apiRes.text().catch(() => 'Unknown');
      if (apiRes.status === 402) return json(req, res, 402, { error: 'Credito DeepSeek esaurito' });
      if (apiRes.status === 401) return json(req, res, 401, { error: 'Chiave API DeepSeek non valida' });
      if (apiRes.status === 429) return json(req, res, 429, { error: 'Troppe richieste. Attendi e riprova.' });
      return json(req, res, apiRes.status, { error: `DeepSeek (${apiRes.status}): ${errBody.substring(0, 200)}` });
    }
    const contentType = apiRes.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      clearTimeout(timeout);
      const data = await apiRes.json();
      return json(req, res, 200, data);
    }
    addCorsHeaders(req, res);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    const reader = apiRes.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      return res.end();
    }
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } catch (err) {
      log.error('[Stream] Errore durante lo streaming', { msg: (err as Error)?.message });
      if (!res.writableEnded) {
        res.end();
      }
    } finally {
      clearTimeout(timeout);
    }
    return res.end();
  }

  return json(req, res, 404, { error: 'Endpoint AI non trovato' });
};
