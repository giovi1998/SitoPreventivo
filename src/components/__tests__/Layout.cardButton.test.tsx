import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Layout from '../Layout';

const baseProps = {
  children: <div data-testid="content">content</div>,
  view: 'editor',
  setView: vi.fn(),
  onLogout: vi.fn(),
  onSave: vi.fn(),
  theme: 'light' as const,
  setTheme: vi.fn(),
};

function renderLayout(props: any) {
  return render(<Layout {...baseProps} {...props} />);
}

describe('Layout sidebar Bigliettini button (admin visibility)', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders Bigliettini button for non-admin user', () => {
    renderLayout({ user: { email: 'user@test.com', username: 'tester', role: 'user' } });
    const btn = screen.getByTitle('Bigliettini da visita');
    expect(btn).toBeInTheDocument();
  });

  it('renders Bigliettini button for admin user (regression: admin must see it too)', () => {
    renderLayout({ user: { email: 'admin@gmail.com', username: 'admin', role: 'admin' } });
    const btn = screen.getByTitle('Bigliettini da visita');
    expect(btn).toBeInTheDocument();
  });

  it('marks Bigliettini button as active when view=card', () => {
    renderLayout({ view: 'card', user: { email: 'user@test.com', username: 'tester', role: 'user' } });
    const btn = screen.getByTitle('Bigliettini da visita');
    expect(btn).toHaveClass('active');
  });
});
