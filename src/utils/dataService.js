const API_BASE = '/.netlify/functions/api';
let _apiChecked = false;
let _apiOffline = false;

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

// ─── API CALL (with timeout + offline detection + caching) ─────
async function api(method, path, body) {
  if (_apiChecked && _apiOffline) return { _offline: true };
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
      _apiChecked = true;
      _apiOffline = true;
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return { _offline: true, error: err.error || `HTTP ${res.status}` };
    }
    _apiChecked = true;
    _apiOffline = false;
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    _apiChecked = true;
    _apiOffline = true;
    return { _offline: true, error: err.message };
  }
}

// ─── ADMIN USER ──────────────────────────────────────
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
}

// Initialize admin on first import
seedAdmin();

// ─── PUBLIC API ──────────────────────────────────────
const dataService = {
  async register(email, password, username, gender) {
    // Try API first
    const result = await api('POST', '/users/register', { email, password, username, gender });
    if (!result._offline) return result;
    // Fallback to localStorage
    const users = lsGet('registeredUsers') || [];
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'Email già registrata' };
    }
    users.push({ email, password, username, gender, regDate: new Date().toLocaleDateString('it-IT') });
    lsSet('registeredUsers', users);
    return { success: true, user: { email, username, gender, createdAt: new Date().toISOString() } };
  },

  async login(email, password) {
    // Check admin offline first (hardcoded for guaranteed access)
    if (email === 'admin@gmail.com' && password === 'admin') {
      return { success: true, user: { email, username: 'admin', gender: 'male' } };
    }
    // Try API
    const result = await api('POST', '/users/login', { email, password });
    if (!result._offline) return result;
    // Fallback to localStorage
    const users = lsGet('registeredUsers') || [];
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) return { success: false, error: 'Email o password errati' };
    return { success: true, user: { email: found.email, username: found.username, gender: found.gender, createdAt: found.regDate } };
  },

  async getQuotes(email) {
    const result = await api('GET', `/quotes?email=${encodeURIComponent(email)}`);
    if (!result._offline) return { quotes: Array.isArray(result) ? result : [] };
    const all = lsGet('precisionQuote_quotes') || [];
    return { quotes: all.filter(q => q.owner === email) };
  },

  async saveQuote(email, quote) {
    const result = await api('POST', '/quotes', { email, quote });
    if (!result._offline) return result;
    const all = lsGet('precisionQuote_quotes') || [];
    const existing = all.findIndex(q => q.id === quote.id);
    if (existing >= 0) {
      all[existing] = { ...all[existing], ...quote };
    } else {
      all.push(quote);
    }
    lsSet('precisionQuote_quotes', all);
    return { success: true, ...quote };
  },

  async deleteQuote(quoteId) {
    const result = await api('DELETE', `/quotes/${quoteId}`);
    if (!result._offline) return result;
    const all = lsGet('precisionQuote_quotes') || [];
    lsSet('precisionQuote_quotes', all.filter(q => q.id !== quoteId));
    return { success: true };
  },
};

export default dataService;
