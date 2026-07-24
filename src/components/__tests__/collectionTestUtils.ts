import React from 'react';
import { vi } from 'vitest';
import type { DocumentType } from '../../utils/documentSchemas';

export interface SeededDocument {
  id: string;
  documentType: DocumentType;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  userEmail?: string;
  [key: string]: any;
}

export function makeDocument(overrides: Partial<SeededDocument> & { id: string; documentType: DocumentType }): SeededDocument {
  const now = new Date().toISOString();
  return {
    userEmail: 'user@test.com',
    title: `Doc ${overrides.id}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function seedDocumentsLocalStorage(docs: SeededDocument[]) {
  localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(docs));
}

export const TAB_IDS = ['all', 'quote', 'qrCode', 'businessCard', 'flyer', 'logo'] as const;
export type TabId = (typeof TAB_IDS)[number];

export const TAB_LABELS: Record<TabId, string> = {
  all: 'Tutti',
  quote: 'Preventivi',
  qrCode: 'QR Code',
  businessCard: 'Bigliettini',
  flyer: 'Volantini',
  logo: 'Loghi',
};

export function buildContextValue(overrides: Record<string, any> = {}) {
  return {
    user: { email: 'user@test.com' },
    tier: 'unlocked' as 'free' | 'unlocked',
    documentCount: 0,
    refreshTier: vi.fn(),
    checkDocumentLimit: vi.fn(() => true),
    openDocument: vi.fn(),
    setView: vi.fn(),
    refreshDocuments: vi.fn(),
    documentsVersion: 0,
    addToast: vi.fn(),
    setEditingQuote: vi.fn(),
    openQuote: vi.fn(),
    duplicate: vi.fn(),
    removeQuote: vi.fn(),
    onUpdateStatus: vi.fn(),
    onDeleteRequest: vi.fn(),
    createFromTemplate: vi.fn(),
    saveQuote: vi.fn(),
    quotes: [],
    setQrDocument: vi.fn(),
    setCardDocument: vi.fn(),
    setLogoDocument: vi.fn(),
    useToast: () => ({ addToast: vi.fn(), toasts: [], dismissToast: vi.fn() }),
    ...overrides,
  };
}

export const AUTH_VALUE = {
  user: { email: 'user@test.com', role: 'user' },
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};
