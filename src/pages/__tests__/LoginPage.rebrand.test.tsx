import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts';
import LoginPage from '../LoginPage';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: () => ({ promise: Promise.resolve({ numPages: 0 }) }),
}));

function renderLogin() {
  const auth = {
    user: null,
    login: vi.fn().mockResolvedValue({ success: true }),
    register: vi.fn().mockResolvedValue({ success: true }),
    logout: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={auth as any}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

afterEach(() => cleanup());

describe('LoginPage, Quickbrand rebrand', () => {
  it('does not contain the legacy brand "PrecisionQuote" anywhere in rendered content', () => {
    const { container } = renderLogin();
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('precisionquote');
  });

  it('shows "Quickbrand" as the brand name in the auth panel', () => {
    renderLogin();
    // appears twice (h1 in brand panel + span in mobile logo)
    const matches = screen.getAllByText('Quickbrand');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
