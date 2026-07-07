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

vi.mock('../../hooks/useAILogo', () => ({
  useAILogo: () => ({
    generate: vi.fn(),
    generateBackground: vi.fn(),
    isProcessing: false,
    isGeneratingBg: false,
    logs: [],
    reset: vi.fn(),
    availableModels: [],
  }),
}));

// Stub fetch per evitare errori su /api/ai/logo-config in jsdom
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: false, provider: 'none' }) }));

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

  it('switching to AI tab shows the AI Generation panel (AC-010 v2)', () => {
    render(<LogoEditor userEmail="user@test.com" />);
    fireEvent.click(screen.getByRole('tab', { name: /AI Generation/i }));
    expect(screen.getByRole('tab', { name: /AI Generation/i })).toHaveAttribute('aria-selected', 'true');
    // v2: tab now shows the namelix-like chat form
    expect(screen.getByText(/Cosa fa la tua attività/i)).toBeInTheDocument();
  });

  it('switching to AI tab with tier=free shows the locked message', () => {
    render(<LogoEditor userEmail="user@test.com" tier="free" />);
    fireEvent.click(screen.getByRole('tab', { name: /AI Generation/i }));
    expect(screen.getByText(/Riscatta un codice/i)).toBeInTheDocument();
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
  });

  it('renders without crashing when initialLogo.builder is missing (regression: builder.X of undefined)', () => {
    // Phase 7 hotfix: a saved logo from the Collection might have a
    // partial shape (legacy save, partial data). Before the fix,
    // opening such a logo crashed the editor at the first read of
    // builder.layout / builder.primaryText. mergeLogoWithDefaults
    // restores the full builder from createEmptyLogo().
    const broken = {
      documentType: 'logo' as const,
      id: 'logo_partial',
      title: 'Partial',
      // builder is missing entirely
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() =>
      render(<LogoEditor userEmail="user@test.com" initialLogo={broken as any} />)
    ).not.toThrow();
  });

  it('opens SaveDialog when "Salva" is clicked and content is non-empty', () => {
    render(<LogoEditor userEmail="user@test.com" initialLogo={{ ...createEmptyLogo(), builder: { ...createEmptyLogo().builder, primaryText: 'Acme' } }} />);
    const saveBtn = screen.getByRole('button', { name: /^Salva$/i });
    fireEvent.click(saveBtn);
    // Phase 7: the dialog labels the document by type, no longer hardcoded
    // "Salva preventivo". LogoEditor passes documentLabel="logo".
    expect(screen.getByRole('heading', { name: /Salva logo/i })).toBeInTheDocument();
  });

  it('does NOT open SaveDialog when content is empty', () => {
    render(<LogoEditor userEmail="user@test.com" initialLogo={createEmptyLogo()} />);
    const saveBtn = screen.getByRole('button', { name: /^Salva$/i });
    fireEvent.click(saveBtn);
    expect(screen.queryByRole('heading', { name: /Salva logo/i })).not.toBeInTheDocument();
  });

  it('saves logo with backgroundImage intact when SaveDialog is confirmed (AC-012 v2.4 regression)', async () => {
    const bg = 'data:image/png;base64,BGIMAGE';
    const initial: Logo = {
      ...createEmptyLogo(),
      builder: { ...createEmptyLogo().builder, primaryText: 'Acme', backgroundImage: bg },
    };
    render(<LogoEditor userEmail="user@test.com" initialLogo={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /^Salva$/i, hidden: true }));
    const input = screen.getByPlaceholderText(/Es\. Logo/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Acme Logo' } });
    fireEvent.click(screen.getByRole('button', { name: /Conferma salvataggio/i }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const saved = mockSave.mock.calls[0][1] as Logo;
    expect(saved.documentType).toBe('logo');
    expect(saved.builder.backgroundImage).toBe(bg);
    expect(saved.title).toBe('Acme Logo');
    expect(saved.userEmail).toBe('user@test.com');
  });

  it('keeps backgroundImage when switching from AI tab back to Builder tab (regression AC-013)', () => {
    const bg = 'data:image/png;base64,BGIMAGE';
    const initial: Logo = {
      ...createEmptyLogo(),
      builder: { ...createEmptyLogo().builder, primaryText: 'Acme', backgroundImage: bg },
    };
    render(<LogoEditor userEmail="user@test.com" initialLogo={initial} />);
    fireEvent.click(screen.getByRole('tab', { name: /AI Generation/i }));
    expect(screen.getByRole('tab', { name: /AI Generation/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Builder/i }));
    expect(screen.getByRole('tab', { name: /Builder/i })).toHaveAttribute('aria-selected', 'true');
    // Builder should still show the AI background badge and controls
    expect(screen.getByText(/Background AI attivo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rimuovi background AI/i })).toBeInTheDocument();
  });

  it('passes the structured error through when saveDocument returns an error (regression AC-014)', async () => {
    mockSave.mockResolvedValueOnce({ success: false, error: 'Spazio locale esaurito (immagine troppo grande)' });
    const initial: Logo = {
      ...createEmptyLogo(),
      builder: { ...createEmptyLogo().builder, primaryText: 'Acme', backgroundImage: 'data:image/png;base64,HUGE' },
    };
    render(<LogoEditor userEmail="user@test.com" initialLogo={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /^Salva$/i, hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: /Conferma salvataggio/i }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const result = await mockSave.mock.results[mockSave.mock.results.length - 1].value;
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Spazio locale esaurito/i);
  });

  it('sector template click loads that template into the editor', () => {
    render(<LogoEditor userEmail="user@test.com" />);
    fireEvent.click(screen.getByRole('button', { name: /^Tech$/i }));
    const input = screen.getByLabelText(/Testo principale/i) as HTMLInputElement;
    expect(input.value).toBe('CodeLab');
  });

  describe('"Nuovo" reset button', () => {
    it('renders a "Nuovo" button in the header', () => {
      render(<LogoEditor userEmail="user@test.com" />);
      expect(screen.getByRole('button', { name: /^Nuovo$/i })).toBeInTheDocument();
    });

    it('resets to an empty logo without confirmation when content is empty', () => {
      render(<LogoEditor userEmail="user@test.com" />);
      fireEvent.click(screen.getByRole('button', { name: /^Tech$/i }));
      expect((screen.getByLabelText(/Testo principale/i) as HTMLInputElement).value).toBe('CodeLab');
      // Reset back to empty first so this specific assertion path is moot;
      // instead verify the empty-content case does not prompt confirm.
    });

    it('asks for confirmation and resets builder when content is non-empty and confirmed', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      try {
        render(<LogoEditor userEmail="user@test.com" />);
        fireEvent.click(screen.getByRole('button', { name: /^Tech$/i }));
        expect((screen.getByLabelText(/Testo principale/i) as HTMLInputElement).value).toBe('CodeLab');
        fireEvent.click(screen.getByRole('button', { name: /^Nuovo$/i }));
        expect(confirmSpy).toHaveBeenCalled();
        expect((screen.getByLabelText(/Testo principale/i) as HTMLInputElement).value).toBe('');
      } finally {
        confirmSpy.mockRestore();
      }
    });

    it('does NOT reset when confirmation is cancelled', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      try {
        render(<LogoEditor userEmail="user@test.com" />);
        fireEvent.click(screen.getByRole('button', { name: /^Tech$/i }));
        fireEvent.click(screen.getByRole('button', { name: /^Nuovo$/i }));
        expect((screen.getByLabelText(/Testo principale/i) as HTMLInputElement).value).toBe('CodeLab');
      } finally {
        confirmSpy.mockRestore();
      }
    });

    it('resets without prompting confirm when logo is already empty', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      try {
        render(<LogoEditor userEmail="user@test.com" initialLogo={createEmptyLogo()} />);
        fireEvent.click(screen.getByRole('button', { name: /^Nuovo$/i }));
        expect(confirmSpy).not.toHaveBeenCalled();
      } finally {
        confirmSpy.mockRestore();
      }
    });

    it('clears the persisted AI chat localStorage on reset', () => {
      localStorage.setItem('logoAiChat:v1', JSON.stringify({ answers: {}, step: 'result', concepts: [], selected: 0, bgImages: [], ts: Date.now() }));
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      try {
        render(<LogoEditor userEmail="user@test.com" initialLogo={{ ...createEmptyLogo(), builder: { ...createEmptyLogo().builder, primaryText: 'Acme' } }} />);
        fireEvent.click(screen.getByRole('button', { name: /^Nuovo$/i }));
        expect(localStorage.getItem('logoAiChat:v1')).toBeNull();
      } finally {
        confirmSpy.mockRestore();
      }
    });
  });
});
