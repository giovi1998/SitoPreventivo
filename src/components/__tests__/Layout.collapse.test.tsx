import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Layout from '../Layout';

const baseProps = {
  children: <div data-testid="content">content</div>,
  view: 'editor',
  setView: vi.fn(),
  onLogout: vi.fn(),
  onSave: vi.fn(),
  user: { email: 'user@test.com', username: 'tester', role: 'user', dataRegistrazione: '2025-01-15' },
  theme: 'light' as const,
  setTheme: vi.fn(),
};

function renderLayout(props = {}) {
  return render(<Layout {...baseProps} {...props} />);
}

describe('Layout sidebar collapse button', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders sidebar collapse button with label "Comprimi" by default', () => {
    renderLayout();
    const btn = screen.getByRole('button', { name: /Comprimi sidebar/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Comprimi');
  });

  it('has aria-label that updates with state', () => {
    renderLayout();
    const btn = screen.getByRole('button', { name: /Comprimi sidebar/i });
    expect(btn).toHaveAttribute('aria-label', 'Comprimi sidebar');
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /Espandi sidebar/i })).toHaveAttribute('aria-label', 'Espandi sidebar');
  });

  it('toggles sidebar collapsed state and shows app-shell class', () => {
    const { container } = renderLayout();
    const shell = container.querySelector('.app-shell');
    expect(shell).not.toHaveClass('sidebar-collapsed');
    const btn = screen.getByRole('button', { name: /Comprimi sidebar/i });
    fireEvent.click(btn);
    expect(container.querySelector('.app-shell')).toHaveClass('sidebar-collapsed');
  });

  it('hides nav-label text in collapsed state via CSS (class only — visual test)', () => {
    const { container } = renderLayout();
    const btn = screen.getByRole('button', { name: /Comprimi sidebar/i });
    fireEvent.click(btn);
    expect(container.querySelector('.app-shell')).toHaveClass('sidebar-collapsed');
  });

  it('button has icon with aria-hidden', () => {
    renderLayout();
    const btn = screen.getByRole('button', { name: /Comprimi sidebar/i });
    const svg = btn.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('button is keyboard accessible (real <button>)', () => {
    renderLayout();
    const btn = screen.getByRole('button', { name: /Comprimi sidebar/i });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).not.toBeDisabled();
  });

  it('icon rotates direction based on collapsed state (chevron right when expanded, left when collapsed)', () => {
    const { container } = renderLayout();
    let btn = screen.getByRole('button', { name: /Comprimi sidebar/i });
    let polyline = btn.querySelector('polyline');
    expect(polyline?.getAttribute('points')).toBe('15 18 9 12 15 6');
    fireEvent.click(btn);
    btn = screen.getByRole('button', { name: /Espandi sidebar/i });
    polyline = btn.querySelector('polyline');
    expect(polyline?.getAttribute('points')).toBe('9 18 15 12 9 6');
  });
});

describe('Layout sidebar collapse button regression', () => {
  beforeEach(() => {
    cleanup();
  });

  it('does not use deprecated class sidebar-collapse-toggle', () => {
    renderLayout();
    const old = document.querySelector('.sidebar-collapse-toggle');
    expect(old).toBeNull();
  });

  it('uses new class sidebar-collapse-btn', () => {
    renderLayout();
    const btn = document.querySelector('.sidebar-collapse-btn');
    expect(btn).toBeInTheDocument();
  });
});
