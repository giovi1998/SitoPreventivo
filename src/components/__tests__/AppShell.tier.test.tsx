import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import AppShell from '../AppShell';
import { AuthContext, AppContext } from '../../contexts';
import dataService from '../../utils/dataService';

// Capture the ctxValue via a mock that injects the children inside the Provider
let lastCtxValue: any = null;
vi.mock('../Topbar', () => ({ default: () => <div data-testid="topbar" /> }));
vi.mock('../Layout', () => ({
  default: ({ children }: any) => (
    <div data-testid="layout">
      <CtxProbe />
      {children}
    </div>
  ),
}));
vi.mock('../GlobalStyles', () => ({ default: () => null }));
vi.mock('../ErrorBoundary', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('../SaveDialog', () => ({ default: () => null }));
vi.mock('../ToastContainer', () => ({ default: () => null }));
vi.mock('../ConfirmModal', () => ({ default: () => null }));
vi.mock('../OnboardingModal', () => ({ default: () => null }));
vi.mock('../PdfImportModal', () => ({ default: () => null }));

// CtxProbe must live outside vi.mock to avoid hoisting issues. It's the
// child rendered inside MockLayout (which is a child of AppContext.Provider).
// However, MockLayout is itself inside AppContext.Provider, so CtxProbe
// CAN read the context. We capture the value via a ref into a module-level
// variable.
const ctxRef: { value: any } = { value: null };
function CtxProbe() {
  const ctx = React.useContext(AppContext);
  ctxRef.value = ctx;
  return <div data-testid="ctx-probe" data-tier={ctx?.tier} data-count={ctx?.documentCount} />;
}

const originalLocation = window.location;

const authValue = (user: any = { email: 'u@t.com', username: 'u', role: 'user' }) => ({
  user,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
});

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname: 'localhost' },
    writable: true,
    configurable: true,
  });
  cleanup();
  vi.restoreAllMocks();
});

describe('AppShell, tier integration (Phase 5)', () => {
  it('free user: fetches tier on mount and exposes it in AppContext', async () => {
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'u@t.com' } as any);
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 1, documentLimit: 3 } as any);
    render(
      <AuthContext.Provider value={authValue() as any}>
        <MemoryRouter initialEntries={['/']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(ctxRef.value).toBeTruthy();
    expect(ctxRef.value.tier).toBe('free');
    expect(ctxRef.value.documentCount).toBe(1);
  });

  it('admin user: tier is always "unlocked" without fetching from dataService', async () => {
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'admin@gmail.com' } as any);
    const tierSpy = vi.spyOn(dataService, 'getUserTier');
    render(
      <AuthContext.Provider value={authValue({ email: 'admin@gmail.com', username: 'admin', role: 'admin' }) as any}>
        <MemoryRouter initialEntries={['/']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(ctxRef.value.tier).toBe('unlocked');
    // Admin short-circuits, no getUserTier call needed
    expect(tierSpy).not.toHaveBeenCalled();
  });

  it('unlocked user: tier is "unlocked" in context', async () => {
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'pro@t.com' } as any);
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'unlocked', documentCount: 5, documentLimit: null } as any);
    render(
      <AuthContext.Provider value={authValue({ email: 'pro@t.com', username: 'pro', role: 'user' }) as any}>
        <MemoryRouter initialEntries={['/']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(ctxRef.value.tier).toBe('unlocked');
  });

  it('checkDocumentLimit: free user with count<3 returns true', async () => {
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'u@t.com' } as any);
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 1, documentLimit: 3 } as any);
    render(
      <AuthContext.Provider value={authValue() as any}>
        <MemoryRouter initialEntries={['/']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(ctxRef.value.checkDocumentLimit()).toBe(true);
  });

  it('checkDocumentLimit: free user with count>=3 returns false (modal shown)', async () => {
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'u@t.com' } as any);
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 3, documentLimit: 3 } as any);
    render(
      <AuthContext.Provider value={authValue() as any}>
        <MemoryRouter initialEntries={['/']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    await act(async () => {
      ctxRef.value.checkDocumentLimit();
    });
    expect(screen.getByText(/Limite piano free raggiunto/i)).toBeInTheDocument();
  });

  it('checkDocumentLimit: unlocked user always returns true (no modal)', async () => {
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'pro@t.com' } as any);
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'unlocked', documentCount: 100, documentLimit: null } as any);
    render(
      <AuthContext.Provider value={authValue({ email: 'pro@t.com', username: 'pro', role: 'user' }) as any}>
        <MemoryRouter initialEntries={['/']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(ctxRef.value.checkDocumentLimit()).toBe(true);
    expect(screen.queryByText(/Limite piano free raggiunto/i)).toBeNull();
  });

  it('refreshTier can be called to re-fetch the tier (e.g. after redeem)', async () => {
    const tierSpy = vi.spyOn(dataService, 'getUserTier')
      .mockResolvedValueOnce({ tier: 'free', documentCount: 3, documentLimit: 3 } as any)
      .mockResolvedValueOnce({ tier: 'unlocked', documentCount: 3, documentLimit: null } as any);
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'u@t.com' } as any);
    render(
      <AuthContext.Provider value={authValue() as any}>
        <MemoryRouter initialEntries={['/']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(ctxRef.value.tier).toBe('free');
    await act(async () => {
      await ctxRef.value.refreshTier();
    });
    expect(ctxRef.value.tier).toBe('unlocked');
    expect(tierSpy).toHaveBeenCalledTimes(2);
  });
});
