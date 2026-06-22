import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import React from 'react';
import AdminRoute from '../AdminRoute';
import { AuthContext } from '../../contexts';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

const authValue = (user: any) => ({
  user,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
});

function renderAdminRoute(user: any, initialPath: string) {
  return render(
    <AuthContext.Provider value={authValue(user) as any}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app" element={<div data-testid="app-shell"><Outlet /></div>}>
            <Route path="admin" element={<AdminRoute><div data-testid="admin-content">admin-ok</div></AdminRoute>} />
            <Route path="editor" element={<div data-testid="editor-content">editor</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('AdminRoute guard', () => {
  beforeEach(() => {
    cleanup();
    mocks.navigate.mockReset();
  });

  it('renders children when user.role === "admin"', () => {
    renderAdminRoute({ email: 'admin@gmail.com', role: 'admin' }, '/app/admin');
    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('redirects to /app/editor (replace) when user.role !== "admin"', () => {
    renderAdminRoute({ email: 'user@test.com', role: 'user' }, '/app/admin');
    expect(mocks.navigate).toHaveBeenCalledWith('/app/editor', { replace: true });
    expect(screen.queryByTestId('admin-content')).toBeNull();
  });

  it('redirects to /app/editor (replace) when user is null (defensive)', () => {
    renderAdminRoute(null, '/app/admin');
    expect(mocks.navigate).toHaveBeenCalledWith('/app/editor', { replace: true });
  });

  it('redirects to /app/editor (replace) when role is missing (defensive)', () => {
    renderAdminRoute({ email: 'no-role@test.com' }, '/app/admin');
    expect(mocks.navigate).toHaveBeenCalledWith('/app/editor', { replace: true });
  });
});
