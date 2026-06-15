const API_BASE = '/.netlify/functions/api';
let _apiOnline = null; // null = not checked, true/false = cached

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

// ─── API CALL (with timeout) ──────────────────────────
async function api(method, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return { error: err.error || `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    return { error: err.message };
  }
}

// Quick API health check (fire-and-forget, caches result)
function checkApi() {
  if (_apiOnline !== null) return;
  api('GET', '/ping').then(r => {
    _apiOnline = !r.error;
  }).catch(() => { _apiOnline = false; });
  // Fallback: if no response in 2s, assume offline
  setTimeout(() => { if (_apiOnline === null) _apiOnline = false; }, 2000);
}

// ─── ADMIN USER (localStorage + DB) ───────────────────
function seedAdmin() {
  const users = lsGet('registeredUsers') || [];
  if (!users.find(u => u.email === 'admin@gmail.com')) {
    users.push({
      email: 'admin@gmail.com',
      password: 'admin',
      username: 'admin',
      gender: 'male',
      regDate: new Date().toLocaleDateString('it-IT'),
    });
    lsSet('registeredUsers', users);
  }
  // Also try to seed admin in DB via API (fire-and-forget)
  api('POST', '/users/register', {
    email: 'admin@gmail.com', password: 'admin', username: 'admin', gender: 'male'
  }).catch(() => {});
}

seedAdmin();
checkApi();

// ─── PUBLIC API ──────────────────────────────────────
const dataService = {
  async register(email, password, username, gender) {
    // 1. Save to localStorage first (instant)
    const users = lsGet('registeredUsers') || [];
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'Email già registrata' };
    }
    users.push({ email, password, username, gender, regDate: new Date().toLocaleDateString('it-IT') });
    lsSet('registeredUsers', users);
    // 2. Sync to API (background, non bloccante)
    api('POST', '/users/register', { email, password, username, gender }).catch(() => {});
    return { success: true, user: { email, username, gender, createdAt: new Date().toISOString() } };
  },

  async login(email, password) {
    // Check admin hardcoded (offline guaranteed)
    if (email === 'admin@gmail.com' && password === 'admin') {
      return { success: true, user: { email, username: 'admin', gender: 'male' } };
    }
    // Check localStorage first (fast)
    const users = lsGet('registeredUsers') || [];
    const found = users.find(u => u.email === email && u.password === password);
    if (found) {
      return { success: true, user: { email: found.email, username: found.username, gender: found.gender, createdAt: found.regDate } };
    }
    // Fallback: try API (user might exist only in DB)
    const result = await api('POST', '/users/login', { email, password });
    if (!result.error) {
      return { success: true, user: result.user || { email, username: email.split('@')[0] } };
    }
    return { success: false, error: 'Email o password errati' };
  },

  async getQuotes(email) {
    // Try API first (freshest data from DB)
    const result = await api('GET', `/quotes?email=${encodeURIComponent(email)}`);
    if (!result.error && Array.isArray(result)) {
      // Sync API data back to localStorage as backup
      lsSet('precisionQuote_quotes', result);
      return { quotes: result };
    }
    // Fallback to localStorage
    const all = lsGet('precisionQuote_quotes') || [];
    return { quotes: all.filter(q => q.owner === email) };
  },

  async saveQuote(email, quote) {
    // 1. Always save to localStorage first (instant, works offline)
    const all = lsGet('precisionQuote_quotes') || [];
    const existing = all.findIndex(q => q.id === quote.id);
    if (existing >= 0) {
      all[existing] = { ...all[existing], ...quote };
    } else {
      all.push(quote);
    }
    lsSet('precisionQuote_quotes', all);
    // 2. Sync to API (background, non bloccante)
    api('POST', '/quotes', { email, quote }).catch(() => {});
    return { success: true, ...quote };
  },

  async deleteQuote(quoteId) {
    // 1. Delete from localStorage first
    const all = lsGet('precisionQuote_quotes') || [];
    lsSet('precisionQuote_quotes', all.filter(q => q.id !== quoteId));
    // 2. Sync to API (background)
    api('DELETE', `/quotes/${quoteId}`).catch(() => {});
    return { success: true };
  },
};

export default dataService;
