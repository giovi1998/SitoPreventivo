import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SettingsPage from '../SettingsPage';
import { AuthContext } from '../../contexts';

vi.mock('../../utils/dataService', () => ({
  default: {
    changePassword: vi.fn(() => Promise.resolve({ success: true })),
    getUserTier: vi.fn(() => Promise.resolve({ tier: 'free', documentCount: 0, documentLimit: 3 })),
    getUserSettings: vi.fn(() => Promise.resolve({ userEmail: 'user@test.com' })),
    redeemUnlockCode: vi.fn(() => Promise.resolve({ success: true, tier: 'unlocked' })),
  },
}));

const mockUser = {
  email: 'user@test.com',
  username: 'tester',
  role: 'user',
  tokensUsed: 1500,
  tokenLimit: 100000,
  dataRegistrazione: '2025-01-15',
};

function renderSettings() {
  return render(
    <AuthContext.Provider value={{ user: mockUser, login: vi.fn(), register: vi.fn(), logout: vi.fn() }}>
      <SettingsPage />
    </AuthContext.Provider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders header', () => {
    renderSettings();
    expect(screen.getByText('Impostazioni')).toBeInTheDocument();
    expect(screen.getByText(/Gestisci le tue credenziali/i)).toBeInTheDocument();
  });

  it('shows security tab by default', () => {
    renderSettings();
    expect(screen.getByRole('tab', { name: /Sicurezza/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to account tab', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Account/i }));
    expect(screen.getByRole('tab', { name: /Account/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('shows account info in account tab', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: /Account/i }));
    expect(screen.getByText('user@test.com')).toBeInTheDocument();
    expect(screen.getByText('tester')).toBeInTheDocument();
  });

  it('disables submit when fields are empty', () => {
    renderSettings();
    const submit = screen.getByRole('button', { name: /Cambia password/i });
    expect(submit).toBeDisabled();
  });

  it('renders password inputs with toggle', () => {
    renderSettings();
    const oldPwd = screen.getByLabelText('Password attuale') as HTMLInputElement;
    expect(oldPwd.type).toBe('password');
    const toggleBtns = screen.getAllByLabelText('Mostra password');
    expect(toggleBtns.length).toBeGreaterThan(0);
    fireEvent.click(toggleBtns[0]);
    expect((screen.getByLabelText('Password attuale') as HTMLInputElement).type).toBe('text');
  });
});

describe('SettingsPage dark mode styles', () => {
  beforeEach(() => {
    cleanup();
  });

  it('applies dark theme when data-theme is dark', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { container } = renderSettings();
    const settingsPage = container.querySelector('.settings-page');
    expect(settingsPage).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  });
});
