import { createContext } from 'react';

export interface AuthUser {
  email: string;
  username?: string;
  role?: string;
  token?: string;
  dataRegistrazione?: string;
  tokensUsed?: number;
  tokenLimit?: number;
  [key: string]: unknown;
}

export interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<unknown>;
  register: (email: string, password: string, username: string, gender: string) => Promise<unknown>;
  logout: () => void;
}

const noopAsync = async () => undefined;
const noop = () => undefined;

export const AUTH_DEFAULT: AuthContextValue = {
  user: null,
  login: noopAsync,
  register: noopAsync,
  logout: noop,
};

export const AuthContext = createContext<AuthContextValue>(AUTH_DEFAULT);

export type AppContextValue = {
  editingQuote?: unknown;
  setEditingQuote?: (q: any) => void;
  saveQuote?: () => void;
  quotes?: unknown;
  setView?: (v: string) => void;
  openQuote?: (q: any) => void;
  duplicate?: (q: any) => void;
  removeQuote?: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onDeleteRequest?: (item: any) => void;
  createFromTemplate?: (t: any) => void;
  // Phase 6, unified collection. Each editor receives the document
  // currently being edited; setters live in AppShell state and are
  // exposed here so the CollectionView can dispatch the right editor.
  qrDocument?: unknown;
  setQrDocument?: (d: any) => void;
  cardDocument?: unknown;
  setCardDocument?: (d: any) => void;
  logoDocument?: unknown;
  setLogoDocument?: (d: any) => void;
  openDocument?: (doc: any) => void;
  refreshDocuments?: () => void;
  [key: string]: any;
};

export const APP_DEFAULT: AppContextValue = {};

export const AppContext = createContext<AppContextValue>(APP_DEFAULT);
