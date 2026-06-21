import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import AdminDashboard from '../AdminDashboard';
import { AuthContext } from '../../contexts';

const mockUsers = [
  { email: 'a@test.com', username: 'Alice', role: 'user', regDate: '2025-01-15', tokensUsed: 1000, tokenLimit: 1000000 },
  { email: 'b@test.com', username: 'Bob', role: 'user', regDate: '2025-02-01', tokensUsed: 500, tokenLimit: 500000 },
  { email: 'admin@gmail.com', username: 'admin', role: 'admin', regDate: '2025-01-01', tokensUsed: 0, tokenLimit: 999999999 },
];

const mockQuotesLegacy = [
  { id: 'q-1', title: 'Sito web', client: { name: 'Mario Rossi', contactPerson: 'Mario' }, owner: 'a@test.com', status: 'BOZZA', date: '2025-03-01', options: [{}, {}] },
  { id: 'q-2', title: 'App mobile', client: 'Tech SRL', owner: 'b@test.com', status: 'INVIATO', date: '2025-03-05', options: [{}, {}, {}] },
  { id: 'q-3', title: 'Consulenza', client: 'Foo', owner: 'a@test.com', status: 'ACCETTATO', date: '2025-03-10', options: [] },
];

let mockUsersResult: { users: any[] } = { users: mockUsers };
let mockQuotesResult: { quotes: any[] } = { quotes: mockQuotesLegacy };

vi.mock('../../utils/dataService', () => ({
  default: {
    adminGetUsers: vi.fn(() => Promise.resolve(mockUsersResult)),
    adminGetAllQuotes: vi.fn(() => Promise.resolve(mockQuotesResult)),
    checkDeepSeekStatus: vi.fn(() => Promise.resolve({ configured: true })),
    changePassword: vi.fn(() => Promise.resolve({ success: true })),
    adminUpdateLimits: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

const mockAdmin = {
  email: 'admin@gmail.com',
  username: 'admin',
  role: 'admin',
  token: 'mock',
  dataRegistrazione: '2025-01-01',
};

const mockNonAdmin = {
  email: 'user@test.com',
  username: 'tester',
  role: 'user',
  token: 'mock',
};

function renderWithUser(user: any) {
  return render(
    <AuthContext.Provider value={{ user, login: vi.fn(), register: vi.fn(), logout: vi.fn() }}>
      <AdminDashboard />
    </AuthContext.Provider>
  );
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    cleanup();
    mockUsersResult = { users: mockUsers };
    mockQuotesResult = { quotes: mockQuotesLegacy };
  });

  it('shows access denied for non-admin', () => {
    renderWithUser(mockNonAdmin);
    expect(screen.getByText(/Accesso negato/i)).toBeInTheDocument();
  });

  it('shows dashboard for admin', async () => {
    renderWithUser(mockAdmin);
    await waitFor(() => {
      expect(screen.getByText('Dashboard Amministratore')).toBeInTheDocument();
    });
  });

  it('renders users with safe string handling', async () => {
    renderWithUser(mockAdmin);
    await waitFor(() => {
      expect(screen.getByText('Utenti (3)')).toBeInTheDocument();
    });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('handles legacy quote with client as object (does not crash)', async () => {
    renderWithUser(mockAdmin);
    await waitFor(() => {
      expect(screen.getByText('Mario Rossi')).toBeInTheDocument();
      expect(screen.getByText('Tech SRL')).toBeInTheDocument();
      expect(screen.getByText('Foo')).toBeInTheDocument();
    });
  });

  it('shows stats counters', async () => {
    renderWithUser(mockAdmin);
    await waitFor(() => {
      expect(screen.getByText('Preventivi totali')).toBeInTheDocument();
    });
  });

  it('handles empty data gracefully', async () => {
    mockUsersResult = { users: [] };
    mockQuotesResult = { quotes: [] };
    renderWithUser(mockAdmin);
    await waitFor(() => {
      expect(screen.getByText(/Nessun utente registrato/i)).toBeInTheDocument();
      expect(screen.getByText(/Nessun preventivo salvato/i)).toBeInTheDocument();
    });
  });
});
