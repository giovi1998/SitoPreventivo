import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Topbar from '../Topbar';

const baseProps = {
  view: 'editor',
  onSave: vi.fn(),
  onExportPDF: vi.fn(),
  lastSaveTime: null,
  isDirty: false,
  pdfLoading: false,
  theme: 'dark',
  setTheme: vi.fn(),
  documentTheme: 'corporate' as const,
};

describe('Topbar save-status during AI processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "AI in corso, salvataggio sospeso" with spinner when isProcessing=true (AC-010)', () => {
    render(<Topbar {...baseProps} isProcessing={true} isDirty={true} />);
    expect(screen.getByText('AI in corso, salvataggio sospeso')).toBeInTheDocument();
    expect(screen.queryByText('Non salvato')).not.toBeInTheDocument();
    expect(document.querySelector('.save-status-processing')).not.toBeNull();
    expect(document.querySelector('.spinner-mini')).not.toBeNull();
  });

  it('shows "Non salvato" when isProcessing=false and isDirty=true (Test 9)', () => {
    render(<Topbar {...baseProps} isProcessing={false} isDirty={true} />);
    expect(screen.getByText(/Non salvato/)).toBeInTheDocument();
    expect(screen.queryByText('AI in corso, salvataggio sospeso')).not.toBeInTheDocument();
  });

  it('shows "Salvato HH:MM" when isProcessing=false, isDirty=false, lastSaveTime set (Test 10)', () => {
    const saved = new Date(2026, 5, 21, 14, 30);
    render(<Topbar {...baseProps} isProcessing={false} isDirty={false} lastSaveTime={saved} />);
    expect(screen.getByText(/Salvato 14:30/)).toBeInTheDocument();
  });

  it('isProcessing takes priority over isDirty (AC-010)', () => {
    render(<Topbar {...baseProps} isProcessing={true} isDirty={true} lastSaveTime={new Date()} />);
    expect(screen.getByText('AI in corso, salvataggio sospeso')).toBeInTheDocument();
    expect(screen.queryByText(/Non salvato/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Salvato/)).not.toBeInTheDocument();
  });

  it('shows null when not processing, not dirty, no lastSaveTime', () => {
    render(<Topbar {...baseProps} isProcessing={false} isDirty={false} lastSaveTime={null} />);
    const status = document.querySelector('.save-status');
    expect(status?.textContent?.trim() ?? '').toBe('');
  });

  it('does not render save-status when view is not editor', () => {
    render(<Topbar {...baseProps} view="collection" isProcessing={true} isDirty={true} />);
    expect(screen.queryByText('AI in corso, salvataggio sospeso')).not.toBeInTheDocument();
  });

  it('transition: isProcessing true -> false with isDirty shows "AI in corso" then "Non salvato" (AC-016)', () => {
    const { rerender } = render(<Topbar {...baseProps} isProcessing={true} isDirty={true} />);
    expect(screen.getByText('AI in corso, salvataggio sospeso')).toBeInTheDocument();
    rerender(<Topbar {...baseProps} isProcessing={false} isDirty={true} />);
    expect(screen.queryByText('AI in corso, salvataggio sospeso')).not.toBeInTheDocument();
    expect(screen.getByText(/Non salvato/)).toBeInTheDocument();
  });

  it('omits isProcessing prop -> backward compatible (isDirty wins)', () => {
    render(<Topbar {...baseProps} isDirty={true} />);
    expect(screen.getByText(/Non salvato/)).toBeInTheDocument();
    expect(screen.queryByText('AI in corso, salvataggio sospeso')).not.toBeInTheDocument();
  });
});
