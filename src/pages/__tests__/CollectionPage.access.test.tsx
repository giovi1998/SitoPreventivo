import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext, AppContext } from '../../contexts';
import CollectionPage from '../app/CollectionPage';

// Mock CollectionViewSkeleton (avoid deep render in the lazy suspense fallback)
vi.mock('../../components/CollectionViewSkeleton', () => ({
  default: () => <div data-testid="cv-skeleton" />,
}));

const originalLocation = window.location;

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname: 'localhost' },
    writable: true,
    configurable: true,
  });
  cleanup();
  vi.restoreAllMocks();
});

function buildCtx(): any {
  return {
    user: { email: 'u@test.com' },
    tier: 'free',
    documentsVersion: 0,
    editingQuote: null,
    addToast: vi.fn(),
    openDocument: vi.fn(),
    refreshDocuments: vi.fn(),
    setView: vi.fn(),
  };
}

function renderPage(role: 'user' | 'admin') {
  return render(
    <AuthContext.Provider
      value={{
        user: { email: 'u@test.com', role },
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
      } as any}
    >
      <AppContext.Provider value={buildCtx() as any}>
        <MemoryRouter>
          <CollectionPage />
        </MemoryRouter>
      </AppContext.Provider>
    </AuthContext.Provider>,
  );
}

describe('CollectionPage access (Phase 7 — non-admin must NOT be redirected away)', () => {
  it('admin renders the CollectionView', async () => {
    renderPage('admin');
    // CollectionView renders a tablist with "Tutti" as default
    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: /Tipo documento/i })).toBeInTheDocument();
    });
  });

  it('non-admin user renders the CollectionView (no silent redirect away)', async () => {
    // Regression: CollectionPage used to redirect non-admin to /app/qr
    // via useEffect. The page was visible in the sidebar but the user
    // was kicked back to QR. After Phase 7 the page must render.
    renderPage('user');
    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: /Tipo documento/i })).toBeInTheDocument();
    });
  });

  it('non-admin CollectionView hides the "Preventivi" tab (regression of CollectionView admin tab logic)', async () => {
    renderPage('user');
    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: /Tipo documento/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('tab', { name: /Preventivi/ })).toBeNull();
  });
});
