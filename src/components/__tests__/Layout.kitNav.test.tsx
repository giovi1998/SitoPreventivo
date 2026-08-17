import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

describe('Layout P1 fix (impeccable): tagline completa + Editor preventivo in Crea', () => {
  beforeEach(() => { cleanup(); });

  it('sidebar brand tagline is the full kit (North Star "Il Kit")', () => {
    renderLayout({ user: { email: 'admin@gmail.com', username: 'admin', role: 'admin' } });
    expect(screen.getByText(/Preventivi · Logo · Card · Flyer · Social · Web/)).toBeInTheDocument();
  });

  it('Editor preventivo is the FIRST button in the Crea group for admin', () => {
    renderLayout({ user: { email: 'admin@gmail.com', username: 'admin', role: 'admin' } });
    const creaLabel = screen.getByText('Crea');
    let n = creaLabel.nextElementSibling;
    let labels: string[] = [];
    while (n && !n.classList.contains('nav-group-label')) {
      if (n.tagName === 'BUTTON') labels.push(n.querySelector('.nav-label')?.textContent ?? '');
      n = n.nextElementSibling;
    }
    expect(labels[0]).toBe('Editor preventivo');
  });

  it('Editor preventivo is NOT after the Sistema label', () => {
    renderLayout({ user: { email: 'admin@gmail.com', username: 'admin', role: 'admin' } });
    const sistemaLabel = screen.getByText('Sistema');
    let n = sistemaLabel.nextElementSibling;
    let labels: string[] = [];
    while (n) {
      if (n.tagName === 'BUTTON') labels.push(n.querySelector('.nav-label')?.textContent ?? '');
      n = n.nextElementSibling;
    }
    expect(labels).not.toContain('Editor preventivo');
  });

  it('Editor preventivo uses aria-current when active', () => {
    renderLayout({ view: 'editor', user: { email: 'admin@gmail.com', username: 'admin', role: 'admin' } });
    const btn = screen.getByTitle('Nuovo preventivo');
    expect(btn).toHaveAttribute('aria-current', 'page');
  });
});
