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

describe('Layout sidebar QR Code button (admin visibility)', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders QR Code button for non-admin user', () => {
    renderLayout({ user: { email: 'user@test.com', username: 'tester', role: 'user' } });
    const btn = screen.getByTitle('Genera QR Code');
    expect(btn).toBeInTheDocument();
  });

  it('renders QR Code button for admin user (no admin role gate)', () => {
    renderLayout({ user: { email: 'admin@gmail.com', username: 'admin', role: 'admin' } });
    const btn = screen.getByTitle('Genera QR Code');
    expect(btn).toBeInTheDocument();
  });

  it('renders Admin button for admin user', () => {
    renderLayout({ user: { email: 'admin@gmail.com', username: 'admin', role: 'admin' } });
    const btn = screen.getByTitle('Pannello Admin');
    expect(btn).toBeInTheDocument();
  });

  it('does NOT render Admin button for non-admin user (regression)', () => {
    renderLayout({ user: { email: 'user@test.com', username: 'tester', role: 'user' } });
    expect(screen.queryByTitle('Pannello Admin')).toBeNull();
  });

  it('does NOT render Impostazioni button for admin user (existing pattern)', () => {
    renderLayout({ user: { email: 'admin@gmail.com', username: 'admin', role: 'admin' } });
    expect(screen.queryByTitle('Impostazioni')).toBeNull();
  });

  it('marks QR Code button as active when view=qr', () => {
    renderLayout({ view: 'qr', user: { email: 'admin@gmail.com', username: 'admin', role: 'admin' } });
    const btn = screen.getByTitle('Genera QR Code');
    expect(btn).toHaveClass('active');
  });
});
