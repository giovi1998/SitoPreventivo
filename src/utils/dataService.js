const API_BASE = '/api';
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// ─── HELPERS ──────────────────────────────────────────
function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── API CALL ─────────────────────────────────────────
async function api(method, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return { error: err.error || `Errore server (${res.status})`, status: res.status, detail: `${method} ${url} → ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { error: `Richiesta timeout: ${method} ${path}`, detail: 'Il server non ha risposto entro 5 secondi' };
    }
    return { error: `Errore di rete: ${err.message}`, detail: `Impossibile contattare ${API_BASE}${path}` };
  }
}

// ─── SEED ADMIN (locale + remoto) ─────────────────────
function seedAdminLocally() {
  const users = lsGet('registeredUsers') || [];
  if (!users.find(u => u.email === 'admin@gmail.com')) {
    users.push({
      email: 'admin@gmail.com', password: 'admin', username: 'admin',
      gender: 'male', role: 'admin',
      regDate: new Date().toLocaleDateString('it-IT'),
      tokensUsed: 0, tokenLimit: 999999999,
    });
    lsSet('registeredUsers', users);
  }
}

if (IS_LOCAL) {
  seedAdminLocally();
} else {
  // Use dedicated seed endpoint (silent upsert, no 409)
  api('POST', '/admin/seed', {
    email: 'admin@gmail.com', password: 'admin', username: 'admin', gender: 'male', tokenLimit: 999999999
  }).catch(() => {});
}

// ─── PUBLIC API ──────────────────────────────────────
const dataService = {
  // ─── REGISTER ────────────────────────────────────
  async register(email, password, username, gender) {
    if (IS_LOCAL) {
      const users = lsGet('registeredUsers') || [];
      if (users.find(u => u.email === email)) {
        return { success: false, error: 'Email già registrata' };
      }
      users.push({
        email, password, username, gender, role: 'user',
        regDate: new Date().toLocaleDateString('it-IT'),
        tokensUsed: 0, tokenLimit: 1000000,
      });
      lsSet('registeredUsers', users);
      return { success: true, user: { email, username, gender, role: 'user', createdAt: new Date().toISOString() } };
    }
    // Production: API only
    const result = await api('POST', '/users/register', { email, password, username, gender, role: 'user' });
    if (result.error) return { success: false, error: result.error };
    return result;
  },

  // ─── LOGIN ────────────────────────────────────────
  async login(email, password) {
    if (IS_LOCAL) {
      if (email === 'admin@gmail.com' && password === 'admin') {
        return { success: true, user: { email, username: 'admin', gender: 'male', role: 'admin' } };
      }
      const users = lsGet('registeredUsers') || [];
      const found = users.find(u => u.email === email && u.password === password);
      if (!found) return { success: false, error: 'Email o password errati' };
      return {
        success: true,
        user: {
          email: found.email, username: found.username, gender: found.gender,
          role: found.role || 'user', createdAt: found.regDate,
          tokensUsed: found.tokensUsed || 0, tokenLimit: found.tokenLimit || 1000000,
        }
      };
    }
    // Production: API only
    const result = await api('POST', '/users/login', { email, password });
    if (result.error) return { success: false, error: result.error };
    return result;
  },

  // ─── GET QUOTES ──────────────────────────────────
  async getQuotes(email) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_quotes') || [];
      return { quotes: all.filter(q => q.owner === email) };
    }
    const result = await api('GET', `/quotes?email=${encodeURIComponent(email)}`);
    if (result.error) return { quotes: [] };
    return { quotes: Array.isArray(result) ? result : [] };
  },

  // ─── SAVE QUOTE ─────────────────────────────────
  async saveQuote(email, quote) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_quotes') || [];
      const existing = all.findIndex(q => q.id === quote.id);
      if (existing >= 0) {
        all[existing] = { ...all[existing], ...quote };
      } else {
        all.push(quote);
      }
      lsSet('precisionQuote_quotes', all);
      return { success: true, ...quote };
    }
    const result = await api('POST', '/quotes', { email, quote });
    if (result.error) return { success: false, error: result.error };
    return { success: true, ...quote };
  },

  // ─── DELETE QUOTE ───────────────────────────────
  async deleteQuote(quoteId) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_quotes') || [];
      lsSet('precisionQuote_quotes', all.filter(q => q.id !== quoteId));
      return { success: true };
    }
    const result = await api('DELETE', `/quotes/${quoteId}`);
    if (result.error) return { success: false, error: result.error };
    return { success: true };
  },

  // ─── ADMIN: LIST USERS ───────────────────────────
  async adminGetUsers() {
    if (IS_LOCAL) {
      return { users: lsGet('registeredUsers') || [] };
    }
    const result = await api('GET', '/users');
    if (result.error) return { users: [] };
    return { users: Array.isArray(result) ? result : [] };
  },

  // ─── ADMIN: LIST ALL QUOTES ─────────────────────
  async adminGetAllQuotes() {
    if (IS_LOCAL) {
      return { quotes: lsGet('precisionQuote_quotes') || [] };
    }
    const result = await api('GET', '/quotes/all');
    if (result.error) return { quotes: [] };
    return { quotes: Array.isArray(result) ? result : [] };
  },

  // ─── ADMIN: UPDATE USER LIMITS ──────────────────
  async adminUpdateLimits(email, tokenLimit) {
    if (IS_LOCAL) {
      const users = lsGet('registeredUsers') || [];
      const idx = users.findIndex(u => u.email === email);
      if (idx >= 0) {
        users[idx].tokenLimit = tokenLimit;
        lsSet('registeredUsers', users);
      }
      return { success: true };
    }
    const result = await api('PATCH', '/users/limits', { email, tokenLimit });
    return result.error ? { success: false, error: result.error } : { success: true };
  },

  // ─── TRACK AI TOKENS ────────────────────────────
  async trackTokens(email, tokens) {
    if (IS_LOCAL) {
      const users = lsGet('registeredUsers') || [];
      const idx = users.findIndex(u => u.email === email);
      if (idx >= 0) {
        users[idx].tokensUsed = (users[idx].tokensUsed || 0) + tokens;
        lsSet('registeredUsers', users);
      }
      return;
    }
    api('POST', '/users/tokens', { email, tokens }).catch(() => {});
  },

  // ─── GET USER PROFILE (with token info) ─────────
  async getUserProfile(email) {
    if (IS_LOCAL) {
      const users = lsGet('registeredUsers') || [];
      const found = users.find(u => u.email === email);
      if (!found) return { error: 'Utente non trovato' };
      return {
        email: found.email, username: found.username, gender: found.gender,
        role: found.role || 'user', tokensUsed: found.tokensUsed || 0,
        tokenLimit: found.tokenLimit || 1000000,
      };
    }
    const result = await api('GET', `/users/${encodeURIComponent(email)}/profile`);
    return result;
  },

  // ─── SHARED DEEPSEEK API KEY ────────────────────
  async getDeepseekKey() {
    if (IS_LOCAL) {
      return lsGet('deepseekApiKey') || '';
    }
    // In production, key is set via Netlify env var (DEEPSEEK_API_KEY)
    // The frontend never reads it — use chatWithAI() instead
    return '';
  },

  async saveDeepseekKey(key) {
    if (IS_LOCAL) {
      lsSet('deepseekApiKey', key);
      return { success: true };
    }
    // In production, key must be set in Netlify UI (DEEPSEEK_API_KEY env var)
    return { success: false, error: 'In produzione, imposta DEEPSEEK_API_KEY nelle variabili d\'ambiente di Netlify.' };
  },

  // ─── AI CHAT (proxy in prod, direct in local) ────
  async chatWithAI({ model, messages, response_format, temperature }) {
    if (IS_LOCAL) {
      const key = lsGet('deepseekApiKey') || '';
      if (!key) return { error: 'Chiave DeepSeek non configurata. Inseriscila nella Dashboard Admin (solo sviluppo locale).' };
      try {
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: model || 'deepseek-chat',
            messages,
            response_format: response_format || { type: 'json_object' },
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
    // Production: use Netlify function proxy (key stays server-side)
    return await api('POST', '/ai/chat', { model, messages, response_format, temperature });
  },
};

export default dataService;
