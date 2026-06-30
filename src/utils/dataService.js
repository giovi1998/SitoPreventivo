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

// ─── SIMPLE CACHE (30s TTL) ─────────────────────────
const cache = new Map();
function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > 30000) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

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
      if (email === 'admin@gmail.com') {
        const adminPw = import.meta.env.VITE_ADMIN_PASSWORD;
        if (!adminPw || password !== adminPw) {
          return { success: false, error: 'Email o password errati' };
        }
        return {
          success: true,
          user: {
            email: 'admin@gmail.com', username: 'admin', gender: 'male',
            role: 'admin', createdAt: new Date().toISOString(),
            tokensUsed: 0, tokenLimit: 999999999,
          }
        };
      }
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
          role: found.role || 'user',
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
  async getQuotes(email, page = 1, limit = 50) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_quotes') || [];
      const filtered = all.filter(q => q.owner === email);
      const start = (page - 1) * limit;
      return { quotes: filtered.slice(start, start + limit), total: filtered.length, page, limit };
    }
    const result = await api('GET', `/quotes?email=${encodeURIComponent(email)}&page=${page}&limit=${limit}`);
    if (result.error) return { quotes: [], total: 0, page, limit };
    return { quotes: Array.isArray(result) ? result : (result.data || []), total: result.total || 0, page, limit };
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

  // ─── DOCUMENTS (QR, card, flyer, logo) ───────
  async saveDocument(email, document) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_documents:v1') || [];
      const ownerEmail = email || document.userEmail;
      const isNew = !all.some(d => d.id === document.id);
      const owned = all.filter(d => d.userEmail === ownerEmail);
      const others = all.filter(d => d.userEmail !== ownerEmail);
      const updated = [document, ...owned.filter(d => d.id !== document.id), ...others];
      lsSet('precisionQuote_documents:v1', updated);
      if (isNew) {
        // fire-and-forget; failure here is non-fatal (best-effort counting)
        dataService.incrementDocumentCount(ownerEmail).catch(() => {});
      }
      return { success: true, data: document };
    }
    const result = await api('POST', '/documents', { email, document });
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data || result };
  },

  async getDocuments(email, documentType) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_documents:v1') || [];
      let filtered = all.filter(d => d.userEmail === email);
      if (documentType) {
        filtered = filtered.filter(d => d.documentType === documentType);
      }
      return { documents: filtered };
    }
    const qs = new URLSearchParams({ email });
    if (documentType) qs.set('type', documentType);
    const result = await api('GET', `/documents?${qs.toString()}`);
    if (result.error) return { documents: [] };
    return { documents: Array.isArray(result) ? result : (result.data || []) };
  },

  // ─── MIGRATION (phase 6) ───────────────────────
  // Copy legacy quotes from `precisionQuote_quotes` to the unified
  // `precisionQuote_documents:v1` storage with `documentType='quote'`.
  // Idempotent: uses stable `migrate_<oldid>` IDs (no timestamp) so
  // re-runs never duplicate. Flag `pq_migration_v1_done_<email>` skips
  // already-migrated users. On `QuotaExceeded` the function throws so
  // the caller can decide (e.g. AppShell shows a recovery toast).
  async migrateLegacyQuotes(email) {
    if (!email) return { migrated: 0, skipped: true };
    if (IS_LOCAL) {
      const flag = `pq_migration_v1_done_${email}`;
      if (localStorage.getItem(flag)) return { migrated: 0, skipped: true };
      const legacy = lsGet('precisionQuote_quotes') || [];
      const mine = legacy.filter((q) => q && q.owner === email);
      const docs = lsGet('precisionQuote_documents:v1') || [];
      const existingIds = new Set(docs.map((d) => d && d.id));
      let migrated = 0;
      for (const q of mine) {
        const newId = `migrate_${q.id}`;
        if (existingIds.has(newId)) continue;
        docs.push({
          ...q,
          id: newId,
          userEmail: email,
          documentType: 'quote',
          data: null,
        });
        migrated += 1;
      }
      // Direct setItem (not lsSet) so QuotaExceeded propagates and the
      // caller can show a recovery toast instead of silently losing data.
      localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(docs));
      localStorage.setItem(flag, '1');
      return { migrated, skipped: false };
    }
    // Production: DB was already migrated in phase 1 (rename
    // `quotes` → `documents`). Just mark flag for consistency.
    try { localStorage.setItem(`pq_migration_v1_done_${email}`, '1'); } catch {}
    return { migrated: 0, skipped: true };
  },

  async deleteDocument(documentId, email) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_documents:v1') || [];
      lsSet('precisionQuote_documents:v1', all.filter(d => d.id !== documentId));
      return { success: true };
    }
    const result = await api('DELETE', `/documents/${documentId}`, { email });
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
  async adminGetUsers(cacheKey = 'admin_users') {
    const cached = getCached(cacheKey);
    if (cached) return cached;
    let result;
    if (IS_LOCAL) {
      const users = (lsGet('registeredUsers') || []).map(({ password, ...user }) => user);
      result = { users };
    } else {
      const res = await api('GET', '/users?adminEmail=admin%40gmail.com');
      result = res.error ? { users: [] } : { users: Array.isArray(res) ? res : [] };
    }
    setCache(cacheKey, result);
    return result;
  },

  // ─── ADMIN: LIST ALL QUOTES ─────────────────────
  async adminGetAllQuotes(page = 1, limit = 100, cacheKey = 'admin_quotes') {
    if (!page || page === 1) {
      const cached = getCached(cacheKey);
      if (cached) return cached;
    }
    let result;
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_quotes') || [];
      const start = (page - 1) * limit;
      result = { quotes: all.slice(start, start + limit), total: all.length, page, limit };
    } else {
      const res = await api('GET', `/quotes/all?page=${page}&limit=${limit}&adminEmail=admin%40gmail.com`);
      result = res.error ? { quotes: [], total: 0, page, limit } : { quotes: Array.isArray(res) ? res : (res.data || []), total: res.total || 0, page, limit };
    }
    if (page === 1) setCache(cacheKey, result);
    return result;
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
    const result = await api('PATCH', '/users/limits', { email, tokenLimit, adminEmail: 'admin@gmail.com' });
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

  // ─── AI STREAM CHAT ──────────────────────────────
  async streamChat(params) {
    if (IS_LOCAL) {
      const key = import.meta.env.VITE_DEEPSEEK_API_KEY || lsGet('deepseekApiKey') || '';
      if (!key) return { error: 'Chiave DeepSeek non configurata.' };
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ ...params, stream: true }),
      });
      return res;
    }
    const res = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  async chatWithAI({ model, messages, response_format, temperature }) {
    if (IS_LOCAL) {
      const key = import.meta.env.VITE_DEEPSEEK_API_KEY || lsGet('deepseekApiKey') || '';
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
    // Production: use Vercel Serverless Function proxy (key stays server-side)
    return await api('POST', '/ai/chat', { model, messages, response_format, temperature }, { timeoutMs: 30000 });
  },

  // ─── TEMPLATES ──────────────────────────────────
  async getTemplates(email) {
    if (IS_LOCAL) {
      const all = lsGet('precisionQuote_quotes') || [];
      return { quotes: all.filter(q => q.isTemplate && (q.isGlobal || q.owner === email)) };
    }
    const result = await api('GET', `/quotes/templates?email=${encodeURIComponent(email)}`);
    if (result.error) return { quotes: [] };
    return { quotes: Array.isArray(result) ? result : [] };
  },

  // ─── USER SETTINGS ──────────────────────────────
  async getUserSettings(email) {
    if (IS_LOCAL) {
      if (email === 'admin@gmail.com') {
        return { userEmail: email, onboardingDone: true };
      }
      return lsGet(`userSettings_${email}`) || { userEmail: email, onboardingDone: false };
    }
    const result = await api('GET', `/user-settings?email=${encodeURIComponent(email)}`);
    if (result.error) return { error: result.error, userEmail: email, onboardingDone: false };
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

  // ─── TIER SYSTEM (phase 5) ─────────────────────
  // Admin has implicit `unlocked` tier — short-circuit before any
  // DB / localStorage access. This mirrors the admin pattern in
  // AGENTS.md "Admin User".

  isAdmin(email) {
    return email === 'admin@gmail.com';
  },

  async getUserTier(email) {
    if (dataService.isAdmin(email)) {
      return { tier: 'unlocked', documentCount: 0, documentLimit: null };
    }
    if (IS_LOCAL) {
      const settings = lsGet(`userSettings_${email}`) || {};
      const tier = settings.tier === 'unlocked' ? 'unlocked' : 'free';
      return {
        tier,
        documentCount: settings.documentCount || 0,
        documentLimit: 3,
      };
    }
    return api('GET', `/users/tier?email=${encodeURIComponent(email)}`);
  },

  async redeemUnlockCode(email, code) {
    if (dataService.isAdmin(email)) {
      return { success: true, tier: 'unlocked' };
    }
    const normalized = String(code || '').trim().toUpperCase();
    if (IS_LOCAL) {
      const codes = lsGet('unlock_codes') || [];
      const found = codes.find(c => String(c.code || '').toUpperCase() === normalized);
      if (!found) {
        if (normalized === 'TEST-UNLOCK') {
          // magic: per spec edge case 3 (locale dev fallback)
          const settings = lsGet(`userSettings_${email}`) || {};
          settings.tier = 'unlocked';
          settings.unlockCode = normalized;
          settings.unlockedAt = new Date().toISOString();
          lsSet(`userSettings_${email}`, settings);
          return { success: true, tier: 'unlocked' };
        }
        return { error: 'Codice non valido' };
      }
      if (found.usedBy) {
        return { error: 'Codice già utilizzato' };
      }
      found.usedBy = email;
      found.usedAt = new Date().toISOString();
      lsSet('unlock_codes', codes);
      const settings = lsGet(`userSettings_${email}`) || {};
      settings.tier = 'unlocked';
      settings.unlockCode = normalized;
      settings.unlockedAt = new Date().toISOString();
      lsSet(`userSettings_${email}`, settings);
      return { success: true, tier: 'unlocked' };
    }
    return api('POST', '/users/redeem-code', { email, code: normalized });
  },

  async incrementDocumentCount(email, delta = 1) {
    if (dataService.isAdmin(email)) return { documentCount: 0 };
    if (IS_LOCAL) {
      const settings = lsGet(`userSettings_${email}`) || {};
      settings.documentCount = (settings.documentCount || 0) + delta;
      lsSet(`userSettings_${email}`, settings);
      return { documentCount: settings.documentCount };
    }
    return api('PATCH', '/users/document-count', { email, delta });
  },

  async adminGenerateUnlockCode(packageName) {
    const code = generateUnlockCode();
    if (IS_LOCAL) {
      const codes = lsGet('unlock_codes') || [];
      codes.push({
        code,
        package: packageName,
        usedBy: null,
        usedAt: null,
        createdBy: 'admin@gmail.com',
        createdAt: new Date().toISOString(),
      });
      lsSet('unlock_codes', codes);
      return { success: true, code };
    }
    return api('POST', '/admin/generate-unlock-code', {
      adminEmail: 'admin@gmail.com',
      package: packageName,
    });
  },

  async adminListUnlockCodes() {
    if (IS_LOCAL) {
      return { codes: lsGet('unlock_codes') || [] };
    }
    return api('GET', '/admin/unlock-codes?adminEmail=admin%40gmail.com');
  },

  async adminUnlockUser(userEmail) {
    if (IS_LOCAL) {
      const settings = lsGet(`userSettings_${userEmail}`) || {};
      settings.tier = 'unlocked';
      settings.unlockedAt = new Date().toISOString();
      lsSet(`userSettings_${userEmail}`, settings);
      return { success: true, tier: 'unlocked' };
    }
    return api('POST', '/admin/unlock-user', { adminEmail: 'admin@gmail.com', userEmail });
  },
};

// ─── HELPERS ─────────────────────────────────────────
function randomHex(n) {
  let s = '';
  const chars = '0123456789ABCDEF';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function generateUnlockCode() {
  return `PQ-${randomHex(8)}-${randomHex(8)}-${randomHex(8)}`;
}

export default dataService;
