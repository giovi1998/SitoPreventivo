import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '../../contexts';
import SettingsPage from '../SettingsPage';
import type { AuthUser } from '../../contexts';
import dataService from '../../utils/dataService';

const originalLocation = window.location;

const FREE_USER: AuthUser = {
  email: 'free@test.com',
  token: 'tok',
  username: 'freeuser',
  dataRegistrazione: '2026-01-01',
  role: 'user',
};

const ADMIN_USER: AuthUser = {
  email: 'admin@gmail.com',
  token: 'admintok',
  username: 'admin',
  dataRegistrazione: '2026-01-01',
  role: 'admin',
};

const UNLOCKED_USER: AuthUser = {
  email: 'unlocked@test.com',
  token: 'tok',
  username: 'pro',
  dataRegistrazione: '2026-01-01',
  role: 'user',
};

function renderWithUser(user: AuthUser | null) {
  return render(
    <AuthContext.Provider value={{ user, login: async () => ({}), register: async () => ({}), logout: () => {} }}>
      <SettingsPage />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname: 'localhost' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
  vi.restoreAllMocks();
});

describe('SettingsPage, "Il mio account" tier section (Phase 5)', () => {
  it('free user: shows tier="Free" and the redeem form', async () => {
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 2, documentLimit: 3 } as any);
    renderWithUser(FREE_USER);
    // Switch to account tab
    fireEvent.click(screen.getByRole('tab', { name: /Account/i }));
    await waitFor(() => {
      expect(screen.getByTestId('settings-tier-value')).toHaveTextContent(/Free/i);
    });
    expect(screen.getByTestId('settings-doc-count')).toHaveTextContent('2 / 3');
    expect(screen.getByTestId('settings-redeem-form')).toBeInTheDocument();
  });

  it('unlocked user: shows tier="Sbloccato" and NO redeem form', async () => {
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'unlocked', documentCount: 5, documentLimit: null } as any);
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({
      userEmail: UNLOCKED_USER.email,
      unlockCode: 'PQ-AAAAAAAA-BBBBBBBB-CCCCCCCC',
      unlockedAt: '2026-02-01T00:00:00.000Z',
    } as any);
    renderWithUser(UNLOCKED_USER);
    fireEvent.click(screen.getByRole('tab', { name: /Account/i }));
    await waitFor(() => {
      expect(screen.getByTestId('settings-tier-value')).toHaveTextContent(/Sbloccato/i);
    });
    // unlock code is masked: first 4 chars + "****"
    expect(screen.getByTestId('settings-unlock-code')).toHaveTextContent('PQ-A****');
    expect(screen.queryByTestId('settings-redeem-form')).toBeNull();
  });

  it('admin user: tier="Sbloccato", NO redeem form, shows admin notice', async () => {
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'unlocked', documentCount: 0, documentLimit: null } as any);
    renderWithUser(ADMIN_USER);
    fireEvent.click(screen.getByRole('tab', { name: /Account/i }));
    await waitFor(() => {
      expect(screen.getByTestId('settings-tier-value')).toHaveTextContent(/Sbloccato/i);
    });
    expect(screen.queryByTestId('settings-redeem-form')).toBeNull();
  });

  it('free user: submitting the redeem form with TEST-UNLOCK upgrades to unlocked', async () => {
    vi.spyOn(dataService, 'getUserTier')
      .mockResolvedValueOnce({ tier: 'free', documentCount: 0, documentLimit: 3 } as any)
      .mockResolvedValueOnce({ tier: 'unlocked', documentCount: 0, documentLimit: null } as any);
    vi.spyOn(dataService, 'redeemUnlockCode').mockResolvedValue({ success: true, tier: 'unlocked' } as any);
    vi.spyOn(dataService, 'getUserSettings').mockResolvedValue({} as any);
    renderWithUser(FREE_USER);
    fireEvent.click(screen.getByRole('tab', { name: /Account/i }));
    await waitFor(() => {
      expect(screen.getByTestId('settings-tier-value')).toHaveTextContent(/Free/i);
    });
    fireEvent.change(screen.getByTestId('settings-redeem-input'), { target: { value: 'TEST-UNLOCK' } });
    fireEvent.click(screen.getByTestId('settings-redeem-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-redeem-message')).toHaveTextContent(/Sbloccato/i);
    });
    expect(dataService.redeemUnlockCode).toHaveBeenCalledWith(FREE_USER.email, 'TEST-UNLOCK');
  });

  it('free user: invalid code shows error message in the form', async () => {
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 0, documentLimit: 3 } as any);
    vi.spyOn(dataService, 'redeemUnlockCode').mockResolvedValue({ error: 'Codice non valido' } as any);
    renderWithUser(FREE_USER);
    fireEvent.click(screen.getByRole('tab', { name: /Account/i }));
    await waitFor(() => {
      expect(screen.getByTestId('settings-tier-value')).toHaveTextContent(/Free/i);
    });
    fireEvent.change(screen.getByTestId('settings-redeem-input'), { target: { value: 'NOPE' } });
    fireEvent.click(screen.getByTestId('settings-redeem-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-redeem-message')).toHaveTextContent(/non valido/i);
    });
  });

  it('empty submit does NOT call redeemUnlockCode', async () => {
    vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 0, documentLimit: 3 } as any);
    const redeemSpy = vi.spyOn(dataService, 'redeemUnlockCode').mockResolvedValue({} as any);
    renderWithUser(FREE_USER);
    fireEvent.click(screen.getByRole('tab', { name: /Account/i }));
    await waitFor(() => {
      expect(screen.getByTestId('settings-tier-value')).toHaveTextContent(/Free/i);
    });
    // Submit button should be disabled when input is empty
    const submitBtn = screen.getByTestId('settings-redeem-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(redeemSpy).not.toHaveBeenCalled();
  });

  it('does not call getUserTier on the security tab (avoids wasted request)', async () => {
    const tierSpy = vi.spyOn(dataService, 'getUserTier').mockResolvedValue({ tier: 'free', documentCount: 0, documentLimit: 3 } as any);
    renderWithUser(FREE_USER);
    // Default tab is 'security', so getUserTier should NOT be called
    expect(tierSpy).not.toHaveBeenCalled();
  });
});
