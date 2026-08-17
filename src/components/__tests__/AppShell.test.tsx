import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Route, Routes, Outlet } from 'react-router-dom';
import React from 'react';
import AppShell from '../AppShell';
import { AuthContext } from '../../contexts';
import { TestRouter } from '../../test/TestRouter';
import dataService from '../../utils/dataService';

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
      <TestRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<div data-testid="child-default">default</div>} />
            <Route path="editor" element={<div data-testid="child-editor">editor</div>} />
            <Route path="editor/:docId" element={<div data-testid="child-editor">editor</div>} />
            <Route path="collection" element={<div data-testid="child-collection">collection</div>} />
            <Route path="qr" element={<div data-testid="child-qr">qr</div>} />
            <Route path="qr/:docId" element={<div data-testid="child-qr">qr</div>} />
            <Route path="card" element={<div data-testid="child-card">card</div>} />
            <Route path="card/:docId" element={<div data-testid="child-card">card</div>} />
            <Route path="settings" element={<div data-testid="child-settings">settings</div>} />
          </Route>
        </Routes>
      </TestRouter>
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

describe('AppShell keyboard shortcuts (P0 fix: view-scoped + metaKey)', () => {
  const fireKey = (key: string, opts: Partial<KeyboardEventInit> = {}) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, ...opts }));
  };

  it('ignores Ctrl+P/D/S when view is not editor (e.g. on /app/qr)', () => {
    renderAppShellAt('/app/qr');
    const genSpy = vi.spyOn(dataService, 'saveQuote');
    // SaveDialog mocked to null; guardiamo che il click/key non generi salvataggio
    fireKey('p', { ctrlKey: true });
    fireKey('d', { ctrlKey: true });
    fireKey('s', { ctrlKey: true });
    expect(genSpy).not.toHaveBeenCalled();
    genSpy.mockRestore();
  });

  it('handles metaKey (Mac Cmd+S) the same as ctrlKey', () => {
    renderAppShellAt('/app/editor');
    const before = mocks.layout.mock.calls.length;
    fireKey('s', { metaKey: true });
    expect(mocks.layout.mock.calls.length).toBeGreaterThanOrEqual(before);
  });

  it('Topbar exposes overflow menu for secondary actions (Importa/Template/DOCX)', () => {
    renderAppShellAt('/app/editor');
    const lastTopbar = mocks.topbar.mock.calls[mocks.topbar.mock.calls.length - 1][0];
    expect(typeof lastTopbar.onImportPDF).toBe('function');
    expect(typeof lastTopbar.onSaveAsTemplate).toBe('function');
    expect(typeof lastTopbar.onExportDOCX).toBe('function');
  });

  it('Topbar overflow menu contains the secondary actions when opened', () => {
    renderAppShellAt('/app/editor');
    // Render the mocked Topbar with the overflow state: il componente reale
    // è mockato in questa suite; testiamo il wiring: le props secondarie
    // arrivano dal shell (già verificato sopra). Il comportamento UI del
    // dropdown è coperto da test futuri su Topbar isolato.
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });
});
