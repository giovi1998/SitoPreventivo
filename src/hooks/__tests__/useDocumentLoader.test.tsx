import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import React from 'react';
import { useDocumentLoader } from '../useDocumentLoader';
import dataService from '../../utils/dataService';
import { AuthContext, AppContext } from '../../contexts';
import { TestRouter } from '../../test/TestRouter';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { docId: undefined as string | undefined },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ docId: mocks.params.docId }),
    useLocation: () => {
      const loc = actual.useLocation();
      return loc;
    },
  };
});

vi.mock('../useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

function TestWrapper({ path, ctx, user, children }: { path: string; ctx: any; user?: any; children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: user || { email: 'u@t.com' }, login: vi.fn(), register: vi.fn(), logout: vi.fn() } as any}>
      <AppContext.Provider value={ctx}>
        <TestRouter initialEntries={[path]}>{children}</TestRouter>
      </AppContext.Provider>
    </AuthContext.Provider>
  );
}

function wrapper(path: string, ctx: any, user: any = { email: 'u@t.com' }) {
  return ({ children }: { children: ReactNode }) => <TestWrapper path={path} ctx={ctx} user={user}>{children}</TestWrapper>;
}

describe('useDocumentLoader', () => {
  let getDocumentSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getDocumentSpy = vi.spyOn(dataService, 'getDocument').mockResolvedValue(null);
    mocks.navigate.mockReset();
    mocks.params.docId = undefined;
  });

  afterEach(() => {
    getDocumentSpy.mockRestore();
  });

  it('returns undefined initialDoc on root path (no id)', () => {
    mocks.params.docId = undefined;
    const ctx = { cardDocument: null, setCardDocument: vi.fn() };
    const { result } = renderHook(() => useDocumentLoader({ view: 'card', documentType: 'businessCard', contextField: 'cardDocument' }), { wrapper: wrapper('/app/card', ctx) });
    expect(result.current.docId).toBeUndefined();
    expect(result.current.initialDoc).toBeUndefined();
    expect(getDocumentSpy).not.toHaveBeenCalled();
  });

  it('returns context doc as initialDoc when id matches', () => {
    mocks.params.docId = 'card-1';
    const doc = { id: 'card-1', documentType: 'businessCard' };
    const ctx = { cardDocument: doc, setCardDocument: vi.fn() };
    const { result } = renderHook(() => useDocumentLoader({ view: 'card', documentType: 'businessCard', contextField: 'cardDocument' }), { wrapper: wrapper('/app/card/card-1', ctx) });
    expect(result.current.docId).toBe('card-1');
    expect(result.current.initialDoc).toBe(doc);
    expect(getDocumentSpy).not.toHaveBeenCalled();
  });

  it('fetches document when id does not match context', async () => {
    mocks.params.docId = 'card-1';
    const fetched = { id: 'card-1', documentType: 'businessCard', title: 'Fetched' };
    getDocumentSpy.mockResolvedValueOnce(fetched);
    const setCardDocument = vi.fn();
    const ctx = { cardDocument: { id: 'card-other' }, setCardDocument };
    renderHook(() => useDocumentLoader({ view: 'card', documentType: 'businessCard', contextField: 'cardDocument' }), { wrapper: wrapper('/app/card/card-1', ctx) });
    await waitFor(() => expect(setCardDocument).toHaveBeenCalledWith(fetched));
    expect(getDocumentSpy).toHaveBeenCalledWith('u@t.com', 'card-1', 'businessCard');
  });

  it('navigates back to root when document not found', async () => {
    mocks.params.docId = 'missing';
    getDocumentSpy.mockResolvedValueOnce(null);
    const setCardDocument = vi.fn();
    const ctx = { cardDocument: null, setCardDocument };
    renderHook(() => useDocumentLoader({ view: 'card', documentType: 'businessCard', contextField: 'cardDocument' }), { wrapper: wrapper('/app/card/missing', ctx) });
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/app/card', { replace: true }), { timeout: 2000 });
  });

  it('navigates to id url onSaved when doc id differs', async () => {
    mocks.params.docId = 'old';
    const ctx = { cardDocument: { id: 'old' }, setCardDocument: vi.fn() };
    const { result } = renderHook(() => useDocumentLoader({ view: 'card', documentType: 'businessCard', contextField: 'cardDocument' }), { wrapper: wrapper('/app/card/old', ctx) });
    await act(async () => {
      result.current.onSaved({ id: 'new' });
    });
    expect(mocks.navigate).toHaveBeenCalledWith('/app/card/new', { replace: true });
  });

  it('onReset clears context doc and navigates to root', async () => {
    mocks.params.docId = 'card-1';
    const setCardDocument = vi.fn();
    const ctx = { cardDocument: { id: 'card-1' }, setCardDocument };
    const { result } = renderHook(() => useDocumentLoader({ view: 'card', documentType: 'businessCard', contextField: 'cardDocument' }), { wrapper: wrapper('/app/card/card-1', ctx) });
    await act(async () => {
      result.current.onReset();
    });
    expect(setCardDocument).toHaveBeenCalledWith(null);
    expect(mocks.navigate).toHaveBeenCalledWith('/app/card', { replace: true });
  });
});
