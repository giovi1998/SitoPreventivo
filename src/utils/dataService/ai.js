// AI chat: stream, chiave DeepSeek condivisa, proxy chat.
// `svc` è la facade dataService (riferimenti cross-modulo a call time).
import { IS_LOCAL, lsGet, lsSet, api, currentUserEmail } from './core.js';

export function createAiMethods(svc) {
  return {
    // ─── AI STREAM CHAT ──────────────────────────────
    async streamChat(params, options = {}) {
      const { requestId } = options;
      const streamHeaders = requestId ? { 'Content-Type': 'application/json', 'X-Request-Id': requestId } : { 'Content-Type': 'application/json' };
      if (IS_LOCAL) {
        const key = import.meta.env.VITE_DEEPSEEK_API_KEY || lsGet('deepseekApiKey') || '';
        if (!key) return { error: 'Chiave DeepSeek non configurata.' };
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { ...streamHeaders, 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({ ...params, stream: true }),
        });
        return res;
      }
      const res = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: streamHeaders,
        body: JSON.stringify(params),
      });
      return res;
    },

    // ─── SHARED DEEPSEEK API KEY ────────────────────
    async getDeepseekKey() {
      if (IS_LOCAL) {
        // Env var has priority over localStorage: if the user updates .env,
        // the new key takes effect immediately (after dev server restart).
        // localStorage is only used as fallback for keys saved via the admin UI.
        return import.meta.env.VITE_DEEPSEEK_API_KEY || lsGet('deepseekApiKey') || '';
      }
      // In production, key is set via Vercel env var (DEEPSEEK_API_KEY)
      // The frontend never reads it — use chatWithAI() instead
      return '';
    },

    async saveDeepseekKey(key) {
      if (IS_LOCAL) {
        lsSet('deepseekApiKey', key);
        return { success: true };
      }
      // In production, key must be set in Vercel dashboard (DEEPSEEK_API_KEY env var)
      return { success: false, error: 'In produzione, imposta DEEPSEEK_API_KEY nelle variabili d\'ambiente su Vercel.' };
    },

    // ─── CHECK DEEPSEEK STATUS (production debug) ────
    async checkDeepSeekStatus() {
      if (IS_LOCAL) {
        const key = import.meta.env.VITE_DEEPSEEK_API_KEY || lsGet('deepseekApiKey') || '';
        return { configured: !!key, envVarSet: false, localKeySet: !!key };
      }
      return await api('GET', '/admin/deepseek-status');
    },

    // ─── AI CHAT (proxy in prod, direct in local) ────
    async chatWithAI({ model, messages, response_format, temperature, requestId } = {}) {
      if (IS_LOCAL) {
        const key = import.meta.env.VITE_DEEPSEEK_API_KEY || lsGet('deepseekApiKey') || '';
        if (!key) return { error: 'Chiave DeepSeek non configurata. Inseriscila nella Dashboard Admin (solo sviluppo locale).' };
        try {
          const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` };
          if (requestId) headers['X-Request-Id'] = requestId;
          const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: model || 'deepseek-v4-flash',
              messages,
              ...(response_format ? { response_format } : {}),
              temperature: temperature ?? 0.7,
            }),
          });
          if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            if (res.status === 402) return { error: 'Credito DeepSeek esaurito. Ricarica su platform.deepseek.com' };
            if (res.status === 401) return { error: 'Chiave API DeepSeek non valida' };
            return { error: `DeepSeek (${res.status}): ${errBody.substring(0, 200)}` };
          }
          return await res.json();
        } catch (err) {
          return { error: `Connessione a DeepSeek fallita: ${err.message}` };
        }
      }
      // Production: use Vercel Serverless Function proxy (key stays server-side)
      return await api('POST', '/ai/chat', {
        model, messages, response_format, temperature,
        // TB-029: attribuzione Langfuse — email utente per user.id
        userEmail: currentUserEmail(),
      }, { timeoutMs: 30000, requestId });
    },
  };
}
