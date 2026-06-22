import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Outlet } from 'react-router-dom';
import React from 'react';
import AppShell from '../AppShell';
import { AuthContext } from '../../contexts';

const mocks = vi.hoisted(() => ({
  topbar: vi.fn(),
  layout: vi.fn(),
}));

vi.mock('../Topbar', () => ({
  default: (props: any) => {
    mocks.topbar(props);
    return <div data-testid="topbar" data-view={props.view} />;
  },
}));

vi.mock('../Layout', () => ({
  default: ({ children, view, setView, ...rest }: any) => {
    mocks.layout({ view, setView, hasOnLogout: typeof rest.onLogout === 'function', hasOnSave: typeof rest.onSave === 'function', hasUser: !!rest.user, hasTheme: !!rest.theme, hasSetTheme: !!rest.setTheme });
    return <div data-testid="layout" data-view={view} data-has-save={typeof rest.onSave === 'function' ? '1' : '0'} data-has-setview={typeof setView === 'function' ? '1' : '0'}>{children}</div>;
  },
}));

vi.mock('../GlobalStyles', () => ({ default: () => null }));
vi.mock('../ErrorBoundary', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('../SaveDialog', () => ({ default: () => null }));
vi.mock('../ToastContainer', () => ({ default: () => null }));
vi.mock('../ConfirmModal', () => ({ default: () => null }));
vi.mock('../OnboardingModal', () => ({ default: () => null }));
vi.mock('../PdfImportModal', () => ({ default: () => null }));
vi.mock('../CollectionViewSkeleton', () => ({ default: () => null }));
vi.mock('../../pages/SettingsPage', () => ({ default: () => <div data-testid="settings-page" /> }));

const authValue = (user: any = { email: 'u@t.com', username: 'u', role: 'user' }) => ({
  user,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
});

function renderAppShellAt(initialPath: string, user?: any) {
  cleanup();
  mocks.topbar.mockClear();
  mocks.layout.mockClear();
  return render(
    <AuthContext.Provider value={authValue(user) as any}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<div data-testid="child-default">default</div>} />
            <Route path="editor" element={<div data-testid="child-editor">editor</div>} />
            <Route path="collection" element={<div data-testid="child-collection">collection</div>} />
            <Route path="qr" element={<div data-testid="child-qr">qr</div>} />
            <Route path="card" element={<div data-testid="child-card">card</div>} />
            <Route path="settings" element={<div data-testid="child-settings">settings</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('AppShell routing wiring', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders Outlet for child routes (default /app/editor)', () => {
    renderAppShellAt('/app/editor');
    expect(screen.getByTestId('child-editor')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('passes view="collection" to Layout+Topbar on /app/collection', () => {
    renderAppShellAt('/app/collection');
    expect(screen.getByTestId('layout').getAttribute('data-view')).toBe('collection');
    expect(screen.getByTestId('topbar').getAttribute('data-view')).toBe('collection');
    expect(screen.getByTestId('child-collection')).toBeInTheDocument();
  });

  it('passes view="qr" to Layout+Topbar on /app/qr', () => {
    renderAppShellAt('/app/qr');
    expect(screen.getByTestId('layout').getAttribute('data-view')).toBe('qr');
    expect(screen.getByTestId('topbar').getAttribute('data-view')).toBe('qr');
  });

  it('passes view="card" to Layout+Topbar on /app/card', () => {
    renderAppShellAt('/app/card');
    expect(screen.getByTestId('layout').getAttribute('data-view')).toBe('card');
    expect(screen.getByTestId('topbar').getAttribute('data-view')).toBe('card');
  });

  it('passes view="settings" to Layout+Topbar on /app/settings', () => {
    renderAppShellAt('/app/settings');
    expect(screen.getByTestId('layout').getAttribute('data-view')).toBe('settings');
    expect(screen.getByTestId('topbar').getAttribute('data-view')).toBe('settings');
    expect(screen.getByTestId('child-settings')).toBeInTheDocument();
  });

  it('falls back to view="editor" on /app (index)', () => {
    renderAppShellAt('/app');
    expect(screen.getByTestId('layout').getAttribute('data-view')).toBe('editor');
    expect(screen.getByTestId('topbar').getAttribute('data-view')).toBe('editor');
    expect(screen.getByTestId('child-default')).toBeInTheDocument();
  });

  it('passes setView (function) to Layout so the sidebar can navigate', () => {
    renderAppShellAt('/app/editor');
    expect(screen.getByTestId('layout').getAttribute('data-has-setview')).toBe('1');
  });

  it('Topbar receives a working setTheme prop (theme toggle wiring)', () => {
    renderAppShellAt('/app/editor');
    const lastCall = mocks.topbar.mock.calls[mocks.topbar.mock.calls.length - 1][0];
    expect(typeof lastCall.setTheme).toBe('function');
  });
});
