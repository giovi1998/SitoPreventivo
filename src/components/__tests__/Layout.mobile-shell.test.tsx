import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Layout from '../Layout';
import { MQ_WORKSPACE } from '../../hooks/useMediaQuery';

// Breakpoint migration (REQ-006, spec-design-breakpoint-migration):
// sidebar vs mobile-topbar/drawer in conditional render su MQ_WORKSPACE (1023).
const baseLayoutProps = {
  children: <div>content</div>,
  view: 'editor',
  setView: vi.fn(),
  onLogout: vi.fn(),
  onSave: vi.fn(),
  user: { email: 'user@test.com', username: 'tester', role: 'user', dataRegistrazione: '2025-01-15' },
  theme: 'light' as const,
  setTheme: vi.fn(),
};

function mockViewport(isMobileWorkspace: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q === MQ_WORKSPACE ? isMobileWorkspace : false,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any;
}

describe('Layout mobile shell (conditional render a 1023)', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    cleanup();
    localStorage.clear();
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('desktop (no match su 1023): sidebar presente, mobile-topbar assente', () => {
    mockViewport(false);
    const { container } = render(<Layout {...baseLayoutProps} />);
    expect(container.querySelector('.sidebar')).not.toBeNull();
    expect(container.querySelector('.mobile-topbar')).toBeNull();
    expect(container.querySelector('.mobile-drawer')).toBeNull();
  });

  it('mobile workspace (match su 1023): mobile-topbar presente, sidebar assente', () => {
    mockViewport(true);
    const { container } = render(<Layout {...baseLayoutProps} />);
    expect(container.querySelector('.sidebar')).toBeNull();
    expect(container.querySelector('.mobile-topbar')).not.toBeNull();
  });

  it('mobile workspace: il drawer resta chiuso dopo il mount (no flash su resize 1024→800)', () => {
    mockViewport(true);
    const { container } = render(<Layout {...baseLayoutProps} />);
    expect(container.querySelector('.mobile-drawer')).toBeNull();
    expect(container.querySelector('.drawer-overlay')).toBeNull();
  });

  it('mobile workspace: hamburger apre il drawer con la navigazione', () => {
    mockViewport(true);
    const { container } = render(<Layout {...baseLayoutProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Apri menu/i }));
    expect(container.querySelector('.mobile-drawer')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Chiudi menu/i })).toBeInTheDocument();
  });
});
