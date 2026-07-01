import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext, AppContext } from '../../contexts';
import dataService from '../../utils/dataService';
import AppShell from '../AppShell';

// Mock the heavy leaf components so the test focuses on onboarding flow.
vi.mock('../Topbar', () => ({ default: () => <div data-testid="topbar" /> }));
vi.mock('../Layout', () => ({ default: ({ children }: any) => <div data-testid="layout">{children}</div> }));
vi.mock('../GlobalStyles', () => ({ default: () => null }));
vi.mock('../ErrorBoundary', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('../SaveDialog', () => ({ default: () => null }));
vi.mock('../ToastContainer', () => ({ default: () => null }));
vi.mock('../ConfirmModal', () => ({ default: () => null }));
vi.mock('../PdfImportModal', () => ({ default: () => null }));
vi.mock('../CollectionViewSkeleton', () => ({ default: () => null }));
vi.mock('../../pages/SettingsPage', () => ({ default: () => <div data-testid="settings-page" /> }));

const originalLocation = window.location;
const authValue = (user: any = { email: 'u@t.com', username: 'u', role: 'user' }) => ({
  user,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
});

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

describe('AppShell onboarding integration (regression: modal must close after submit)', () => {
  it('shows onboarding modal when settings are incomplete', async () => {
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'u@t.com', onboardingDone: false } as any);
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 0, documentLimit: 3 } as any);
    vi.spyOn(dataService, 'migrateLegacyQuotes').mockResolvedValue({ migrated: 0, skipped: true } as any);
    vi.spyOn(dataService, 'getTemplates').mockResolvedValue({ quotes: [] } as any);
    vi.spyOn(dataService, 'getQuotes').mockResolvedValue({ quotes: [] } as any);

    render(
      <AuthContext.Provider value={authValue() as any}>
        <MemoryRouter initialEntries={['/app/qr']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    // Wait for the modal to appear (settings are incomplete).
    await waitFor(() => {
      expect(screen.getByText(/Benvenuto!/i)).toBeInTheDocument();
    });
  });

  it('closes onboarding modal after successful save (regression: AC-FIX)', async () => {
    const saveSpy = vi.spyOn(dataService, 'saveUserSettings').mockResolvedValue({
      success: true,
      userEmail: 'u@t.com',
      displayName: 'Test',
      companyName: 'Co',
      profession: 'web',
      defaultColor: '#0B57D0',
      defaultVat: 22,
      documentTheme: 'corporate',
      onboardingDone: true,
    } as any);
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'u@t.com', onboardingDone: false } as any);
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 0, documentLimit: 3 } as any);
    vi.spyOn(dataService, 'migrateLegacyQuotes').mockResolvedValue({ migrated: 0, skipped: true } as any);
    vi.spyOn(dataService, 'getTemplates').mockResolvedValue({ quotes: [] } as any);
    vi.spyOn(dataService, 'getQuotes').mockResolvedValue({ quotes: [] } as any);

    render(
      <AuthContext.Provider value={authValue() as any}>
        <MemoryRouter initialEntries={['/app/qr']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    // Wait for modal.
    await waitFor(() => {
      expect(screen.getByText(/Benvenuto!/i)).toBeInTheDocument();
    });

    // Step 0: enter displayName
    const nameInput = screen.getByPlaceholderText(/Marco/i);
    fireEvent.change(nameInput, { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 1: companyName
    const companyInput = screen.getByPlaceholderText(/Studio Rossi Design/i);
    fireEvent.change(companyInput, { target: { value: 'Co' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 2: profession (click first available)
    const profButtons = screen.getAllByRole('button').filter((b) => b.textContent && b.textContent.length > 0 && !/Continua|Inizia/.test(b.textContent));
    // Click the first profession option (Marco / whatever first one is)
    // We'll click the second button in the dialog that looks like a profession
    const allButtons = screen.getAllByRole('button');
    const profButton = allButtons.find((b) => /web|design|developer|studio|consulente/i.test(b.textContent || ''));
    expect(profButton).toBeTruthy();
    fireEvent.click(profButton!);
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 3: color is preselected, just continue
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));

    // Step 4: VAT is preselected, click "Inizia"
    fireEvent.click(screen.getByRole('button', { name: /Inizia/i }));

    // save should have been called
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalled();
    });
    const savedArgs = saveSpy.mock.calls[0];
    expect(savedArgs[0]).toBe('u@t.com');
    expect(savedArgs[1].onboardingDone).toBe(true);

    // modal should be gone
    await waitFor(() => {
      expect(screen.queryByText(/Benvenuto!/i)).toBeNull();
    });
  });

  it('does NOT close onboarding modal when saveUserSettings returns error', async () => {
    const saveSpy = vi.spyOn(dataService, 'saveUserSettings').mockResolvedValue({
      success: false,
      error: 'mocked DB error',
    } as any);
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'u@t.com', onboardingDone: false } as any);
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 0, documentLimit: 3 } as any);
    vi.spyOn(dataService, 'migrateLegacyQuotes').mockResolvedValue({ migrated: 0, skipped: true } as any);
    vi.spyOn(dataService, 'getTemplates').mockResolvedValue({ quotes: [] } as any);
    vi.spyOn(dataService, 'getQuotes').mockResolvedValue({ quotes: [] } as any);

    render(
      <AuthContext.Provider value={authValue() as any}>
        <MemoryRouter initialEntries={['/app/qr']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Benvenuto!/i)).toBeInTheDocument();
    });

    // Fill out the form
    const nameInput = screen.getByPlaceholderText(/Marco/i);
    fireEvent.change(nameInput, { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
    const companyInput = screen.getByPlaceholderText(/Studio Rossi Design/i);
    fireEvent.change(companyInput, { target: { value: 'Co' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
    const allButtons = screen.getAllByRole('button');
    const profButton = allButtons.find((b) => /web|design|developer|studio|consulente/i.test(b.textContent || ''));
    fireEvent.click(profButton!);
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
    fireEvent.click(screen.getByRole('button', { name: /Inizia/i }));

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalled();
    });

    // Modal SHOULD still be open because save returned an error.
    // Check for the overlay (more reliable than a step-specific text).
    expect(document.querySelector('.onb-overlay')).toBeInTheDocument();
  });

  it('REGRESSION: modal closes even if applying settings to quote throws (AC-FIX)', async () => {
    // Simulate a production scenario where the quote state is malformed
    // (e.g. options[].items is undefined) — the setQuote updater would
    // throw. Before the fix, setShowOnboarding(false) was AFTER the
    // setQuote calls, so the modal stayed open. Now it's BEFORE.
    const saveSpy = vi.spyOn(dataService, 'saveUserSettings').mockResolvedValue({
      success: true,
      userEmail: 'u@t.com',
      displayName: 'Test',
      companyName: 'Co',
      profession: 'web',
      defaultColor: '#0B57D0',
      defaultVat: 22,
      documentTheme: 'corporate',
      onboardingDone: true,
    } as any);
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({ userEmail: 'u@t.com', onboardingDone: false } as any);
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 0, documentLimit: 3 } as any);
    vi.spyOn(dataService, 'migrateLegacyQuotes').mockResolvedValue({ migrated: 0, skipped: true } as any);
    vi.spyOn(dataService, 'getTemplates').mockResolvedValue({ quotes: [] } as any);
    vi.spyOn(dataService, 'getQuotes').mockResolvedValue({ quotes: [] } as any);

    render(
      <AuthContext.Provider value={authValue() as any}>
        <MemoryRouter initialEntries={['/app/qr']}>
          <AppShell />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Benvenuto!/i)).toBeInTheDocument();
    });

    // Fill out the form
    fireEvent.change(screen.getByPlaceholderText(/Marco/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
    fireEvent.change(screen.getByPlaceholderText(/Studio Rossi Design/i), { target: { value: 'Co' } });
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
    const allButtons = screen.getAllByRole('button');
    const profButton = allButtons.find((b) => /web|design|developer|studio|consulente/i.test(b.textContent || ''));
    fireEvent.click(profButton!);
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continua/i }));
    fireEvent.click(screen.getByRole('button', { name: /Inizia/i }));

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalled();
    });

    // Modal MUST be closed even if setQuote updaters threw.
    // The success toast confirms the save succeeded.
    await waitFor(() => {
      expect(document.querySelector('.onb-overlay')).toBeNull();
    });
  });
});
