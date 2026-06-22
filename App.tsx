import React, { useState } from 'react';
import dataService from './src/utils/dataService';
import { AuthContext, AppContext } from './src/contexts';
import type { AuthUser } from './src/contexts';
import AppShell from './src/components/AppShell';

export { AppContext, AuthContext };
export type { AuthUser };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    const username = localStorage.getItem('username');
    const regDate = localStorage.getItem('dataRegistrazione');
    const role = localStorage.getItem('userRole');
    if (token && email) {
      return { email, token, username: username || email.split('@')[0], dataRegistrazione: regDate || new Date().toLocaleDateString('it-IT'), role: role || 'user' } as AuthUser;
    }
    return null;
  });

  const register = async (email: string, password: string, username: string, gender: string) => {
    const result: any = await dataService.register(email, password, username, gender);
    if (result.success) {
      const uData = result.user || {};
      localStorage.setItem('authToken', btoa(`${email}:${Date.now()}`));
      localStorage.setItem('userEmail', email);
      localStorage.setItem('username', uData.username || username);
      localStorage.setItem('dataRegistrazione', uData.createdAt || new Date().toLocaleDateString('it-IT'));
      localStorage.setItem('userRole', uData.role || 'user');
      setUser({
        email, token: btoa(`${email}:${Date.now()}`), username: uData.username || username,
        gender: uData.gender || gender, role: uData.role || 'user',
        tokensUsed: uData.tokensUsed || 0, tokenLimit: uData.tokenLimit || 1000000,
        dataRegistrazione: uData.createdAt || new Date().toLocaleDateString('it-IT'),
      } as AuthUser);
    }
    return result;
  };

  const login = async (email: string, password: string) => {
    const result: any = await dataService.login(email, password);
    if (result.success) {
      const uData = result.user || {};
      localStorage.setItem('authToken', btoa(`${email}:${Date.now()}`));
      localStorage.setItem('userEmail', email);
      localStorage.setItem('username', uData.username || email.split('@')[0]);
      localStorage.setItem('dataRegistrazione', uData.createdAt || new Date().toLocaleDateString('it-IT'));
      localStorage.setItem('userRole', uData.role || 'user');
      setUser({
        email, token: btoa(`${email}:${Date.now()}`), username: uData.username || email.split('@')[0],
        gender: uData.gender, role: uData.role || 'user',
        tokensUsed: uData.tokensUsed || 0, tokenLimit: uData.tokenLimit || 1000000,
        dataRegistrazione: uData.createdAt || new Date().toLocaleDateString('it-IT'),
      } as AuthUser);
    }
    return result;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('username');
    localStorage.removeItem('dataRegistrazione');
    localStorage.removeItem('userRole');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AppShell;
