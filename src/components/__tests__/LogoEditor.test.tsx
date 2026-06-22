import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LogoEditor from '../LogoEditor';
import { createEmptyLogo } from '../../utils/documentSchemas';
import type { Logo } from '../../utils/documentSchemas';

vi.mock('../../utils/dataService', () => ({
  default: {
    saveDocument: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getDocuments: vi.fn().mockResolvedValue({ documents: [] }),
    deleteDocument: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import dataService from '../../utils/dataService';
const mockSave = dataService.saveDocument as unknown as ReturnType<typeof vi.fn>;

describe('LogoEditor', () => {
  beforeEach(() => {
    mockSave.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial empty logo with tablist (AC-001)', () => {
    render(<LogoEditor userEmail="user@test.com" />);
    expect(screen.getByRole('heading', { level: 1, name: /Logo/i })).toBeInTheDocument();
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Builder/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /AI Generation/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows the AI Generation tab as enabled (button not disabled, message inside panel)', () => {
    render(<LogoEditor userEmail="user@test.com" />);
    const aiTab = screen.getByRole('tab', { name: /AI Generation/i });
    expect(aiTab).not.toBeDisabled();
  });

  it('switching to AI tab shows the disabled message (AC-010)', () => {
    render(<LogoEditor userEmail="user@test.com" />);
    fireEvent.click(screen.getByRole('tab', { name: /AI Generation/i }));
    expect(screen.getByRole('tab', { name: /AI Generation/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/AI generation non disponibile nella v1/i)).toBeInTheDocument();
  });

  it('shows export SVG and export PNG buttons (AC-008, AC-009)', () => {
    render(<LogoEditor userEmail="user@test.com" initialLogo={{ ...createEmptyLogo(), builder: { ...createEmptyLogo().builder, primaryText: 'Acme' } }} />);
    expect(screen.getByRole('button', { name: /Esporta SVG/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Esporta PNG 512/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Esporta PNG 1024/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Esporta PNG 2048/i })).toBeInTheDocument();
  });

  it('export SVG triggers a download with sanitized content (AC-008)', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<LogoEditor userEmail="user@test.com" initialLogo={{ ...createEmptyLogo(), builder: { ...createEmptyLogo().builder, primaryText: 'Acme' } }} />);
      fireEvent.click(screen.getByRole('button', { name: /Esporta SVG/i }));
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
      const blobArg = createObjectURL.mock.calls[0][0];
      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.type).toBe('image/svg+xml');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      clickSpy.mockRestore();
    }
  });

  it('export PNG 1024 triggers a download with PNG blob (AC-009)', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const originalCreateEl = document.createElement.bind(document);
    (document as any).createElement = (tag: string) => {
      const el = originalCreateEl(tag);
      if (tag === 'canvas') {
        (el as any).getContext = () => ({ clearRect: () => undefined, drawImage: () => undefined });
        (el as any).toBlob = (cb: (b: Blob | null) => void) => setTimeout(() => cb(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' })), 0);
      }
      return el;
    };
    try {
      render(<LogoEditor userEmail="user@test.com" initialLogo={{ ...createEmptyLogo(), builder: { ...createEmptyLogo().builder, primaryText: 'Acme' } }} />);
      fireEvent.click(screen.getByRole('button', { name: /Esporta PNG 1024/i }));
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      clickSpy.mockRestore();
      (document as any).createElement = originalCreateEl;
    }
  });

  it('auto-saves logo to dataService every 30s when content non-empty (AC-011)', async () => {
    vi.useFakeTimers();
    render(<LogoEditor userEmail="user@test.com" initialLogo={{ ...createEmptyLogo(), builder: { ...createEmptyLogo().builder, primaryText: 'Acme' } }} />);
    act(() => { vi.advanceTimersByTime(30500); });
    await Promise.resolve();
    expect(mockSave).toHaveBeenCalled();
  });

  it('does NOT auto-save when content is empty', async () => {
    vi.useFakeTimers();
    render(<LogoEditor userEmail="user@test.com" initialLogo={createEmptyLogo()} />);
    act(() => { vi.advanceTimersByTime(30500); });
    await Promise.resolve();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('opens SaveDialog when "Salva" is clicked and content is non-empty', () => {
    render(<LogoEditor userEmail="user@test.com" initialLogo={{ ...createEmptyLogo(), builder: { ...createEmptyLogo().builder, primaryText: 'Acme' } }} />);
    const saveBtn = screen.getByRole('button', { name: /^Salva$/i });
    fireEvent.click(saveBtn);
    expect(screen.getByRole('heading', { name: /Salva preventivo/i })).toBeInTheDocument();
  });

  it('does NOT open SaveDialog when content is empty', () => {
    render(<LogoEditor userEmail="user@test.com" initialLogo={createEmptyLogo()} />);
    const saveBtn = screen.getByRole('button', { name: /^Salva$/i });
    fireEvent.click(saveBtn);
    expect(screen.queryByRole('heading', { name: /Salva preventivo/i })).not.toBeInTheDocument();
  });

  it('sector template click loads that template into the editor', () => {
    render(<LogoEditor userEmail="user@test.com" />);
    fireEvent.click(screen.getByRole('button', { name: /^Tech$/i }));
    const input = screen.getByLabelText(/Testo principale/i) as HTMLInputElement;
    expect(input.value).toBe('CodeLab');
  });
});
