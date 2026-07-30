// Settings utente, tier/unlock codes, admin (users/quotes/limits/tokens/profile).
// `svc` è la facade dataService (riferimenti cross-modulo a call time).
import { IS_LOCAL, lsGet, lsSet, api, getCached, setCache, generateUnlockCode } from './core.js';

export function createSettingsMethods(svc) {
  return {
    // ─── USER SETTINGS ──────────────────────────────
    async getUserSettings(email) {
      if (IS_LOCAL) {
        return lsGet(`userSettings_${email}`) || { userEmail: email, onboardingDone: email === 'admin@gmail.com' };
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
      if (svc.isAdmin(email)) {
        return { tier: 'unlocked', documentCount: 0, documentLimit: null };
      }
      if (IS_LOCAL) {
        const settings = lsGet(`userSettings_${email}`) || {};
        const tier = settings.tier === 'unlocked' ? 'unlocked' : 'free';
        return {
          tier,
          documentCount: settings.documentCount || 0,
          documentLimit: settings.documentLimit ?? 3,
        };
      }
      return api('GET', `/users/tier?email=${encodeURIComponent(email)}`);
    },

    async redeemUnlockCode(email, code) {
      if (svc.isAdmin(email)) {
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
      if (svc.isAdmin(email)) return { documentCount: 0 };
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

    generateUnlockCode,

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
    async trackTokens(email, tokens, costUsd) {
      if (IS_LOCAL) {
        const users = lsGet('registeredUsers') || [];
        const idx = users.findIndex(u => u.email === email);
        if (idx >= 0) {
          users[idx].tokensUsed = (users[idx].tokensUsed || 0) + tokens;
          // TB-023: traccia costo USD (opzionale, backward compatible)
          if (typeof costUsd === 'number' && costUsd > 0) {
            users[idx].tokensCostUsd = (users[idx].tokensCostUsd || 0) + costUsd;
          }
          lsSet('registeredUsers', users);
        }
        return;
      }
      const payload = { email, tokens };
      if (typeof costUsd === 'number' && costUsd > 0) {
        payload.costUsd = costUsd;
      }
      api('POST', '/users/tokens', payload).catch(() => {});
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
  };
}
