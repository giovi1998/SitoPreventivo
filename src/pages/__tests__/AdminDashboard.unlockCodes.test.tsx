import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext } from '../../contexts';
import AdminDashboard from '../AdminDashboard';
import type { AuthUser } from '../../contexts';
import dataService from '../../utils/dataService';

const ADMIN: AuthUser = {
  email: 'admin@gmail.com',
  token: 'admintok',
  username: 'admin',
  dataRegistrazione: '2026-01-01',
  role: 'admin',
};

const originalLocation = window.location;

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

function renderDashboard() {
  return render(
    <AuthContext.Provider value={{ user: ADMIN, login: async () => ({}), register: async () => ({}), logout: () => {} }}>
      <AdminDashboard />
    </AuthContext.Provider>,
  );
}

describe('AdminDashboard — Codici sblocco tab (Phase 5)', () => {
  it('renders the tab navigation with "Codici sblocco"', async () => {
    vi.spyOn(dataService, 'adminGetUsers').mockResolvedValue({ users: [] } as any);
    vi.spyOn(dataService, 'adminGetAllQuotes').mockResolvedValue({ quotes: [] } as any);
    renderDashboard();
    expect(screen.getByTestId('admin-tab-codes')).toBeInTheDocument();
    expect(screen.getByTestId('admin-tab-codes')).toHaveTextContent(/Codici sblocco/i);
  });

  it('clicking the "Codici sblocco" tab shows the codes panel + form', async () => {
    vi.spyOn(dataService, 'adminGetUsers').mockResolvedValue({ users: [] } as any);
    vi.spyOn(dataService, 'adminGetAllQuotes').mockResolvedValue({ quotes: [] } as any);
    vi.spyOn(dataService, 'adminListUnlockCodes').mockResolvedValue({ codes: [] } as any);
    renderDashboard();
    fireEvent.click(screen.getByTestId('admin-tab-codes'));
    await waitFor(() => {
      expect(screen.getByTestId('admin-codes-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('admin-code-form')).toBeInTheDocument();
    expect(screen.getByTestId('admin-code-generate')).toBeInTheDocument();
  });

  it('submitting the form with "starter" calls adminGenerateUnlockCode and shows result', async () => {
    vi.spyOn(dataService, 'adminGetUsers').mockResolvedValue({ users: [] } as any);
    vi.spyOn(dataService, 'adminGetAllQuotes').mockResolvedValue({ quotes: [] } as any);
    vi.spyOn(dataService, 'adminListUnlockCodes')
      .mockResolvedValueOnce({ codes: [] } as any)
      .mockResolvedValueOnce({ codes: [{ code: 'PQ-NEW-AAAA-BBBB-CCCC', package: 'starter', usedBy: null, usedAt: null, createdAt: '2026-01-01' }] } as any);
    vi.spyOn(dataService, 'adminGenerateUnlockCode').mockResolvedValue({ success: true, code: 'PQ-NEW-AAAA-BBBB-CCCC' } as any);
    renderDashboard();
    fireEvent.click(screen.getByTestId('admin-tab-codes'));
    await waitFor(() => {
      expect(screen.getByTestId('admin-codes-panel')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('admin-code-package'), { target: { value: 'starter' } });
    fireEvent.click(screen.getByTestId('admin-code-generate'));
    await waitFor(() => {
      expect(dataService.adminGenerateUnlockCode).toHaveBeenCalledWith('starter');
    });
    await waitFor(() => {
      expect(screen.getByTestId('admin-code-result')).toHaveTextContent(/PQ-NEW-AAAA-BBBB-CCCC/i);
    });
  });

  it('shows the table of existing codes', async () => {
    vi.spyOn(dataService, 'adminGetUsers').mockResolvedValue({ users: [] } as any);
    vi.spyOn(dataService, 'adminGetAllQuotes').mockResolvedValue({ quotes: [] } as any);
    vi.spyOn(dataService, 'adminListUnlockCodes').mockResolvedValue({
      codes: [
        { code: 'PQ-EXISTING-AAAA-BBBB-CCCC', package: 'starter', usedBy: null, usedAt: null, createdAt: '2026-01-01' },
        { code: 'PQ-USED-CCCCC-DDDDD-EEEEE', package: 'apertura', usedBy: 'client@test.com', usedAt: '2026-02-01', createdAt: '2026-01-15' },
      ],
    } as any);
    renderDashboard();
    fireEvent.click(screen.getByTestId('admin-tab-codes'));
    await waitFor(() => {
      expect(screen.getAllByTestId('admin-code-row')).toHaveLength(2);
    });
    expect(screen.getByText(/client@test.com/i)).toBeInTheDocument();
  });

  it('empty state shows a message when no codes exist', async () => {
    vi.spyOn(dataService, 'adminGetUsers').mockResolvedValue({ users: [] } as any);
    vi.spyOn(dataService, 'adminGetAllQuotes').mockResolvedValue({ quotes: [] } as any);
    vi.spyOn(dataService, 'adminListUnlockCodes').mockResolvedValue({ codes: [] } as any);
    renderDashboard();
    fireEvent.click(screen.getByTestId('admin-tab-codes'));
    await waitFor(() => {
      expect(screen.getByText(/Nessun codice generato/i)).toBeInTheDocument();
    });
  });

  it('adminGenerateUnlockCode error is shown in the codes panel', async () => {
    vi.spyOn(dataService, 'adminGetUsers').mockResolvedValue({ users: [] } as any);
    vi.spyOn(dataService, 'adminGetAllQuotes').mockResolvedValue({ quotes: [] } as any);
    vi.spyOn(dataService, 'adminListUnlockCodes').mockResolvedValue({ codes: [] } as any);
    vi.spyOn(dataService, 'adminGenerateUnlockCode').mockResolvedValue({ error: 'Package non valido' } as any);
    renderDashboard();
    fireEvent.click(screen.getByTestId('admin-tab-codes'));
    await waitFor(() => {
      expect(screen.getByTestId('admin-codes-panel')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('admin-code-generate'));
    await waitFor(() => {
      expect(screen.getByTestId('admin-codes-error')).toHaveTextContent(/Package non valido/i);
    });
  });
});
