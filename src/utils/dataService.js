import bcrypt from 'bcryptjs';

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
async function api(method, path, body, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
      return { error: `Richiesta timeout: ${method} ${path}`, detail: `Il server non ha risposto entro ${Math.round(timeoutMs / 1000)} secondi` };
    }
    return { error: `Errore di rete: ${err.message}`, detail: `Impossibile contattare ${API_BASE}${path}` };
  }
}

// ─── SEED ADMIN (locale + remoto) ─────────────────────
// Usa ADMIN_INITIAL_PASSWORD dal server, VITE_ADMIN_INITIAL_PASSWORD dal client (locale).
// L'admin può cambiarla dalla Dashboard dopo il primo login.
async function seedAdminLocally() {
  const list = lsGet('registeredUsers') || [];
  const idx = list.findIndex(u => u.email === 'admin@gmail.com');
  const envPw = import.meta.env.VITE_ADMIN_INITIAL_PASSWORD;
  if (idx === -1) {
    const pw = envPw || `Admin-${crypto.randomUUID ? crypto.randomUUID().slice(0, 18) : Math.random().toString(36).slice(2, 20)}!1`;
    const hashed = await bcrypt.hash(pw, 12);
    list.push({
      email: 'admin@gmail.com', password: hashed, username: 'admin',
      gender: 'male', role: 'admin',
      regDate: new Date().toLocaleDateString('it-IT'),
      tokensUsed: 0, tokenLimit: 999999999,
    });
    lsSet('registeredUsers', list);
    setTimeout(() => {
      alert(`Admin locale creato. Password: ${envPw || 'generata random — cambia dalle Impostazioni'}`);
    }, 500);
  } else if (envPw && list[idx].password && list[idx].password.startsWith('$2')) {
    // Se l'admin esiste già e la password env è cambiata, aggiorna
    const currentHash = list[idx].password;
    const match = await bcrypt.compare(envPw, currentHash).catch(() => false);
    if (!match) {
      list[idx].password = await bcrypt.hash(envPw, 12);
      lsSet('registeredUsers', list);
    }
  } else if (list[idx].password && !list[idx].password.startsWith('$2')) {
    list[idx].password = await bcrypt.hash(list[idx].password, 12);
    lsSet('registeredUsers', list);
  } else if (list[idx].role !== 'admin') {
    list[idx].role = 'admin';
    lsSet('registeredUsers', list);
  }
}

if (IS_LOCAL) {
  seedAdminLocally();
} else {
  // Use dedicated seed endpoint (silent upsert, no 409)
  api('POST', '/admin/seed', {
    email: 'admin@gmail.com', username: 'admin', gender: 'male', tokenLimit: 999999999
  }).catch(() => {});
}

// ─── PUBLIC API ──────────────────────────────────────
const dataService = {
  // ─── REGISTER ────────────────────────────────────
  async register(email, password, username, gender) {
    if (email === 'admin@gmail.com') {
      return { success: false, error: 'Email non disponibile' };
    }
    if (IS_LOCAL) {
      const users = lsGet('registeredUsers') || [];
      if (users.find(u => u.email === email)) {
        return { success: false, error: 'Email già registrata' };
      }
      const hashed = await bcrypt.hash(password, 12);
      users.push({
        email, password: hashed, username, gender, role: 'user',
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
      const users = lsGet('registeredUsers') || [];
      const found = users.find(u => u.email === email);
      const validPassword = found?.password?.startsWith('$2')
        ? await bcrypt.compare(password, found.password)
        : found?.password === password;
      if (!found) return { success: false, error: 'Email o password errati' };
      if (!validPassword) return { success: false, error: 'Email o password errati' };
      if (!found.password.startsWith('$2')) {
        found.password = await bcrypt.hash(password, 12);
        lsSet('registeredUsers', users);
      }
      return {
        success: true,
        user: {
          email: found.email, username: found.username, gender: found.gender,
          role: found.email === 'admin@gmail.com' ? 'admin' : (found.role || 'user'),
          createdAt: found.regDate,
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
  async deleteQuote(quoteId, email) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_quotes') || [];
      lsSet('precisionQuote_quotes', all.filter(q => q.id !== quoteId));
      return { success: true };
    }
    const result = await api('DELETE', `/quotes/${quoteId}`, { email });
    if (result.error) return { success: false, error: result.error };
    return { success: true };
  },

  // ─── CHANGE PASSWORD ────────────────────────────
  async changePassword(email, oldPassword, newPassword) {
    if (IS_LOCAL) {
      const users = lsGet('registeredUsers') || [];
      const idx = users.findIndex(u => u.email === email);
      if (idx === -1) return { success: false, error: 'Utente non trovato' };
      const validPassword = users[idx].password?.startsWith('$2')
        ? await bcrypt.compare(oldPassword, users[idx].password)
        : users[idx].password === oldPassword;
      if (!validPassword) return { success: false, error: 'Password attuale errata' };
      users[idx].password = await bcrypt.hash(newPassword, 12);
      lsSet('registeredUsers', users);
      return { success: true };
    }
    const result = await api('POST', '/users/change-password', { email, oldPassword, newPassword });
    return result.error ? { success: false, error: result.error } : { success: true };
  },

  // ─── ADMIN: LIST USERS ───────────────────────────
  async adminGetUsers() {
    if (IS_LOCAL) {
      const users = (lsGet('registeredUsers') || []).map(({ password, ...user }) => user);
      return { users };
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
      return lsGet('deepseekApiKey') || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
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

  // ─── CHECK DEEPSEEK STATUS (production debug) ────
  async checkDeepSeekStatus() {
    if (IS_LOCAL) {
      const key = lsGet('deepseekApiKey') || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
      return { configured: !!key, envVarSet: false, localKeySet: !!key };
    }
    return await api('GET', '/admin/deepseek-status');
  },

  // ─── AI CHAT (proxy in prod, direct in local) ────
  async chatWithAI({ model, messages, response_format, temperature }) {
    if (IS_LOCAL) {
      const key = lsGet('deepseekApiKey') || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
      if (!key) return { error: 'Chiave DeepSeek non configurata. Inseriscila nella Dashboard Admin (solo sviluppo locale).' };
      try {
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: model || 'deepseek-chat',
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
    // Production: use Netlify function proxy (key stays server-side)
    return await api('POST', '/ai/chat', { model, messages, response_format, temperature }, { timeoutMs: 30000 });
  },

  // ─── TEMPLATES ──────────────────────────────────
  async getTemplates(email) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_quotes') || [];
      return { quotes: all.filter(q => q.userEmail === email && q.isTemplate) };
    }
    const result = await api('GET', `/quotes/templates?email=${encodeURIComponent(email)}`);
    if (result.error) return { quotes: [] };
    return { quotes: Array.isArray(result) ? result : [] };
  },

  // ─── PUBLIC QUOTE (no auth) ─────────────────────
  async getPublicQuote(shareToken) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_quotes') || [];
      const found = all.find(q => q.shareToken === shareToken && q.isShared);
      if (!found) return { error: 'Preventivo non trovato o non condiviso' };
      return { quote: found };
    }
    const result = await api('GET', `/quotes/public/${shareToken}`);
    if (result.error) return { error: result.error };
    return { quote: result };
  },

  // ─── USER SETTINGS ──────────────────────────────
  async getUserSettings(email) {
    if (IS_LOCAL) {
      return lsGet(`userSettings_${email}`) || { userEmail: email, onboardingDone: false };
    }
    const result = await api('GET', `/user-settings?email=${encodeURIComponent(email)}`);
    if (result.error) return { userEmail: email, onboardingDone: false };
    return result;
  },

  async saveUserSettings(email, settings) {
    if (IS_LOCAL) {
      const current = lsGet(`userSettings_${email}`) || {};
      const merged = { ...current, ...settings, userEmail: email };
      lsSet(`userSettings_${email}`, merged);
      return { success: true, ...merged };
    }
    const result = await api('POST', '/user-settings', { email, ...settings });
    if (result.error) return { success: false, error: result.error };
    return { success: true, ...result };
  },
};

export default dataService;
