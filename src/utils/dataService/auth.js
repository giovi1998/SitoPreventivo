// Auth: register/login/change-password (bcrypt, localStorage in locale).
// `svc` è la facade dataService (riferimenti cross-modulo a call time).
import bcrypt from 'bcryptjs';
import { IS_LOCAL, lsGet, lsSet, api } from './core.js';

export function createAuthMethods(svc) {
  return {
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
  };
}
