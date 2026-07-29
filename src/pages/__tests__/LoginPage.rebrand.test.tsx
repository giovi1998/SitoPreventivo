import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { TestRouter } from '../../test/TestRouter';
import { AuthContext } from '../../contexts';
import LoginPage from '../LoginPage';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({ promise: Promise.resolve({ numPages: 0 }) }),
}));

vi.mock('../../utils/dataService', () => ({
  default: { getConfig: vi.fn().mockResolvedValue({ data: { registrationEnabled: true } }) },
}));

import dataService from '../../utils/dataService';

function renderLogin(registrationEnabled = true) {
  (dataService.getConfig as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { registrationEnabled },
  });
  const auth = {
    user: null,
    login: vi.fn().mockResolvedValue({ success: true }),
    register: vi.fn().mockResolvedValue({ success: true }),
    logout: vi.fn(),
  };
  return render(
    <TestRouter>
      <AuthContext.Provider value={auth as any}>
        <LoginPage />
      </AuthContext.Provider>
    </TestRouter>
  );
}

beforeEach(() => {
  (dataService.getConfig as unknown as ReturnType<typeof vi.fn>).mockReset();
});
afterEach(() => cleanup());

describe('LoginPage, Quickbrand rebrand', () => {
  it('does not contain the legacy brand "PrecisionQuote" anywhere in rendered content', () => {
    const { container } = renderLogin();
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('precisionquote');
  });

  it('shows "Quickbrand" as the brand name in the auth panel', () => {
    renderLogin();
    const matches = screen.getAllByText('Quickbrand');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('TB-027 LoginPage feature flag registrazione', () => {
  it('nasconde toggle "Registrati" quando registrationEnabled=false', async () => {
    renderLogin(false);
    await waitFor(() => {
      expect(screen.queryByText('Registrati')).toBeNull();
    });
    expect(screen.getByText(/CRM admin-only/)).toBeTruthy();
  });

  it('mostra toggle "Registrati" quando registrationEnabled=true', async () => {
    renderLogin(true);
    await waitFor(() => {
      expect(screen.getByText('Registrati')).toBeTruthy();
    });
  });
});
