import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import Layout from '../Layout';
import Topbar from '../Topbar';

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

const baseTopbarProps = {
  view: 'editor',
  onSave: vi.fn(),
  onExportPDF: vi.fn(),
  onExportDOCX: vi.fn(),
  onImportPDF: vi.fn(),
  lastSaveTime: null,
  isDirty: false,
  pdfLoading: false,
  docxLoading: false,
  theme: 'light' as const,
  setTheme: vi.fn(),
  documentTheme: 'corporate' as const,
  onDocumentThemeChange: vi.fn(),
};

describe('Layout sidebar collapsed styling', () => {
  beforeEach(() => {
    cleanup();
  });

  it('sidebar-collapse-btn has sidebar-collapsed class on app-shell when collapsed', () => {
    const { container } = render(<Layout {...baseLayoutProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Comprimi sidebar/i }));
    const shell = container.querySelector('.app-shell');
    expect(shell).toHaveClass('sidebar-collapsed');
  });

  it('sidebar-collapse-btn label is hidden via nav-label in collapsed state', () => {
    render(<Layout {...baseLayoutProps} />);
    expect(screen.getByText('Comprimi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Comprimi sidebar/i }));
    expect(screen.queryByText('Comprimi')).not.toBeInTheDocument();
    expect(screen.getByText('Espandi')).toBeInTheDocument();
  });
});

describe('Topbar theme toggle accessibility', () => {
  beforeEach(() => {
    cleanup();
  });

  it('theme-toggle button has aria-label', () => {
    render(<Topbar {...baseTopbarProps} />);
    const btn = screen.getByRole('button', { name: /Passa al tema scuro/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label');
  });

  it('theme-toggle aria-label updates with current theme', () => {
    const { rerender } = render(<Topbar {...baseTopbarProps} theme="light" />);
    expect(screen.getByRole('button', { name: /Passa al tema scuro/i })).toBeInTheDocument();
    rerender(<Topbar {...baseTopbarProps} theme="dark" />);
    expect(screen.getByRole('button', { name: /Passa al tema chiaro/i })).toBeInTheDocument();
  });

  it('theme-toggle calls setTheme on click', () => {
    const setTheme = vi.fn();
    render(<Topbar {...baseTopbarProps} setTheme={setTheme} />);
    fireEvent.click(screen.getByRole('button', { name: /Passa al tema scuro/i }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});

describe('Layout and Topbar CSS regression', () => {
  it('GlobalStyles.tsx declares :root with color-scheme:light dark', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '..', 'GlobalStyles.tsx'),
      'utf-8'
    );
    expect(file).toMatch(/:root\{color-scheme:light dark/);
  });

  it('GlobalStyles.tsx styles .app-shell.sidebar-collapsed .sidebar-collapse-btn centered', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '..', 'GlobalStyles.tsx'),
      'utf-8'
    );
    expect(file).toMatch(/\.app-shell\.sidebar-collapsed\s+\.sidebar-collapse-btn\{justify-content:center;padding:10px\}/);
  });

  it('GlobalStyles.tsx makes .side-card transparent in collapsed state', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '..', 'GlobalStyles.tsx'),
      'utf-8'
    );
    expect(file).toMatch(/\.app-shell\.sidebar-collapsed\s+\.side-card\{background:transparent;border:0;padding:0\}/);
  });

  it('GlobalStyles.tsx removes width:100% from .logout-btn-icon in collapsed state', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '..', 'GlobalStyles.tsx'),
      'utf-8'
    );
    expect(file).toMatch(/\.app-shell\.sidebar-collapsed\s+\.logout-btn-icon\{width:auto;padding:8px\}/);
  });

  it('GlobalStyles.tsx topbar has overflow:hidden to prevent button truncation', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '..', 'GlobalStyles.tsx'),
      'utf-8'
    );
    expect(file).toMatch(/\.topbar\{[^}]*overflow:hidden/);
  });
});
