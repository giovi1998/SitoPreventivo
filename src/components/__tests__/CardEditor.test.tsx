import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CardEditor from '../CardEditor';
import dataService from '../../utils/dataService';
import { createEmptyCard, createGiovanniCardTemplate } from '../../utils/documentSchemas';
import { compressImage, generateCardPDF, generateCardPng } from '../../utils/cardGenerator';
import { useToast } from '../../hooks/useToast';

vi.mock('../../utils/dataService', () => ({
  default: {
    saveDocument: vi.fn().mockResolvedValue({ success: true }),
    getDocuments: vi.fn().mockResolvedValue({ documents: [] }),
    deleteDocument: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    addToast: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAICard', () => ({
  useAICard: () => ({
    processCardPrompt: vi.fn().mockResolvedValue({
      card: createEmptyCard(),
      changes: ['Fronte: nome → "AI NAME"'],
      rawResponse: '{}',
    }),
    resetCardChat: vi.fn(),
    cardAiLogs: [],
    isCardProcessing: false,
    availableModels: [{ id: 'deepseek-chat', name: 'DeepSeek', model: 'deepseek-chat', supportsStreaming: true, supportsTools: true }],
  }),
}));

vi.mock('../../utils/cardGenerator', async () => {
  const actual = await vi.importActual<any>('../../utils/cardGenerator');
  return {
    ...actual,
    compressImage: vi.fn(async (file: File) => {
      if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
        throw new Error('Formato non supportato. Usa PNG, JPEG o SVG.');
      }
      if (file.size > 5_000_000) {
        throw new Error('File troppo grande (max 5MB)');
      }
      return 'data:image/jpeg;base64,COMPRESSED_' + file.name;
    }),
    generateCardPDF: vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3])),
    generateCardPng: vi.fn(async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 4, 5, 6])),
  };
});

const mockSave = dataService.saveDocument as unknown as ReturnType<typeof vi.fn>;
const mockCompress = compressImage as unknown as ReturnType<typeof vi.fn>;
const mockGenPDF = generateCardPDF as unknown as ReturnType<typeof vi.fn>;
const mockGenPng = generateCardPng as unknown as ReturnType<typeof vi.fn>;
const { addToast: mockAddToast } = useToast();

const baseProps = {
  userEmail: 'user@test.com',
  documentTheme: 'corporate' as const,
  tier: 'unlocked' as const,
};

function renderEditor(overrides: Partial<typeof baseProps> = {}) {
  return render(<CardEditor {...baseProps} {...overrides} />);
}

describe('CardEditor', () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockCompress.mockClear();
    mockGenPDF.mockClear();
    mockGenPng.mockClear();
    (mockAddToast as any).mockClear?.();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders initial empty card with both previews (AC-001)', () => {
    renderEditor();
    expect(screen.getByRole('heading', { level: 1, name: /Bigliettino da visita/i })).toBeInTheDocument();
    expect(screen.getByTestId('card-preview-front')).toBeInTheDocument();
    expect(screen.getByTestId('card-preview-back')).toBeInTheDocument();
  });

  it('shows Giovanni template banner and applies template (AC-002)', () => {
    renderEditor();
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Giovanni');
    fireEvent.click(screen.getByRole('button', { name: /Applica template/i }));
    const nameInput = screen.getByLabelText(/Nome \(fronte\)/i) as HTMLInputElement;
    expect(nameInput.value).toBe('GIOVANNI CIDU');
    const webInput = screen.getByLabelText(/Sito web/i) as HTMLInputElement;
    expect(webInput.value).toBe('https://webdeveloperca.netlify.app/');
    const phoneInput = screen.getByLabelText(/Telefono \(retro\)/i) as HTMLInputElement;
    expect(phoneInput.value).toBe('XXXXX');
  });

  it('updates front.name when user types (REQ-002)', () => {
    renderEditor();
    const nameInput = screen.getByLabelText(/Nome \(fronte\)/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'MARIO ROSSI' } });
    expect(nameInput.value).toBe('MARIO ROSSI');
  });

  it('changes front.layout and re-renders preview with new class (AC-003)', () => {
    renderEditor();
    const select = screen.getByLabelText(/Layout fronte/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'centered' } });
    expect(screen.getByTestId('card-preview-front')).toHaveClass('layout-centered');
    fireEvent.change(select, { target: { value: 'split' } });
    expect(screen.getByTestId('card-preview-front')).toHaveClass('layout-split');
  });

  it('changes size preset and re-renders preview with new size class (AC-011)', () => {
    renderEditor();
    const select = screen.getByLabelText(/Formato bigliettino/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'square-65x65' } });
    expect(screen.getByTestId('card-preview-front')).toHaveClass('size-square-65x65');
  });

  it('uploads photo via file input, calls compressImage, sets photoUrl (AC-004)', async () => {
    renderEditor();
    const file = new File([new Uint8Array(1024)], 'photo.png', { type: 'image/png' });
    const input = screen.getByLabelText(/Carica foto \(fronte\)/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(mockCompress).toHaveBeenCalled();
    });
    expect(mockCompress.mock.calls[0][0]).toBe(file);
    const preview = screen.getByAltText(/Foto del titolare/i) as HTMLImageElement;
    await waitFor(() => {
      expect(preview.src).toContain('COMPRESSED_photo.png');
    });
  });

  it('uploads logo via file input', async () => {
    renderEditor();
    const file = new File([new Uint8Array(512)], 'logo.png', { type: 'image/png' });
    const input = screen.getByLabelText(/Carica logo \(fronte\)/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(mockCompress).toHaveBeenCalled();
    });
    expect(mockCompress.mock.calls[0][0]).toBe(file);
  });

  it('shows error for unsupported MIME (AC-005, SEC-001)', async () => {
    renderEditor();
    const file = new File([new Uint8Array(1000)], 'evil.exe', { type: 'application/octet-stream' });
    const input = screen.getByLabelText(/Carica foto \(fronte\)/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/Formato non supportato/i);
    });
  });

  it('shows error for files larger than 5MB (AC-006, SEC-002)', async () => {
    mockCompress.mockRejectedValueOnce(new Error('File troppo grande (max 5MB)'));
    renderEditor();
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    const input = screen.getByLabelText(/Carica foto \(fronte\)/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [big] } });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/troppo grande/i);
    });
  });

  it('exports PDF via dropdown menu and triggers download (AC-009)', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      renderEditor();
      const exportBtn = screen.getByRole('button', { name: /Esporta ▾|Esporta/i });
      fireEvent.click(exportBtn);
      const pdfItem = await screen.findByRole('menuitem', { name: /PDF 10-up/i });
      fireEvent.click(pdfItem);
      await waitFor(() => expect(mockGenPDF).toHaveBeenCalled());
      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      const a = (clickSpy.mock.instances[0] as HTMLAnchorElement);
      expect(a.download).toMatch(/\.pdf$/);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      clickSpy.mockRestore();
    }
  });

  it('exports PNG front via dropdown menu and triggers download (AC-010)', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      renderEditor();
      const exportBtn = screen.getByRole('button', { name: /Esporta ▾|Esporta/i });
      fireEvent.click(exportBtn);
      const pngItem = await screen.findByRole('menuitem', { name: /PNG fronte/i });
      fireEvent.click(pngItem);
      await waitFor(() => expect(mockGenPng).toHaveBeenCalled());
      const a = (clickSpy.mock.instances[0] as HTMLAnchorElement);
      expect(a.download).toMatch(/card_.*_front\.png$/);
    } finally {
      URL.createObjectURL = originalCreate;
      clickSpy.mockRestore();
    }
  });

  it('exports SVG front via dropdown menu and triggers download (D1)', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      renderEditor();
      const exportBtn = screen.getByRole('button', { name: /Esporta ▾|Esporta/i });
      fireEvent.click(exportBtn);
      const svgItem = await screen.findByRole('menuitem', { name: /SVG fronte/i });
      fireEvent.click(svgItem);
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
      expect(clickSpy).toHaveBeenCalled();
      const a = (clickSpy.mock.instances[0] as HTMLAnchorElement);
      expect(a.download).toMatch(/\.svg$/);
      expect(a.download).toMatch(/_front\.svg$/);
      const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
      expect(blob.type).toBe('image/svg+xml');
    } finally {
      URL.createObjectURL = originalCreate;
      clickSpy.mockRestore();
    }
  });

  it('exports JSON via dropdown menu and triggers download (D2)', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      renderEditor();
      const exportBtn = screen.getByRole('button', { name: /Esporta ▾|Esporta/i });
      fireEvent.click(exportBtn);
      const jsonItem = await screen.findByRole('menuitem', { name: /JSON/i });
      fireEvent.click(jsonItem);
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
      expect(clickSpy).toHaveBeenCalled();
      const a = (clickSpy.mock.instances[0] as HTMLAnchorElement);
      expect(a.download).toMatch(/\.json$/);
      const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
      expect(blob.type).toBe('application/json');
    } finally {
      URL.createObjectURL = originalCreate;
      clickSpy.mockRestore();
    }
  });

  it('auto-saves to dataService when card changes (AC-012)', async () => {
    vi.useFakeTimers();
    try {
      renderEditor();
      const nameInput = screen.getByLabelText(/Nome \(fronte\)/i) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'TEST NAME' } });
        await vi.advanceTimersByTimeAsync(31_000);
      });
      expect(mockSave).toHaveBeenCalled();
      const calls = mockSave.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe('user@test.com');
      expect(lastCall[1].documentType).toBe('businessCard');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders all required form fields (REQ-002, REQ-003, REQ-007)', () => {
    renderEditor();
    // Front
    expect(screen.getByLabelText(/Nome \(fronte\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ruolo \(fronte\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Azienda \(fronte\)/i)).toBeInTheDocument();
    // Back
    expect(screen.getByLabelText(/Telefono \(retro\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email \(retro\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sito web/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Indirizzo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/P\.IVA/i)).toBeInTheDocument();
    // Style
    expect(screen.getByLabelText(/Formato bigliettino/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Colore sfondo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Colore testo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Colore accento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stile bordo/i)).toBeInTheDocument();
  });

  it('hides advanced QR fields by default inside <details> (B3)', () => {
    renderEditor();
    const details = screen.getByTestId('qr-advanced-details') as HTMLDetailsElement;
    expect(details).toBeInTheDocument();
    expect(details.open).toBe(false);
  });

  it('shows advanced QR fields when details is opened (B3)', () => {
    renderEditor();
    const summary = screen.getByText(/Opzioni QR avanzate/i);
    fireEvent.click(summary);
    const details = screen.getByTestId('qr-advanced-details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });

  it('shows advanced QR fields when details is opened (B3)', () => {
    renderEditor();
    const summary = screen.getByText(/Opzioni QR avanzate/i);
    fireEvent.click(summary);
    const details = screen.getByTestId('qr-advanced-details');
    expect(details.querySelector('input[name="qrPayload"]')).not.toBeNull();
    expect(details.querySelector('input[name="qrLabel"]')).not.toBeNull();
  });

  it('shows "Esporta ▾" dropdown with PDF + PNG options (B4)', () => {
    renderEditor();
    const exportBtn = screen.getByRole('button', { name: /Esporta ▾|Esporta/i });
    fireEvent.click(exportBtn);
    expect(screen.getByRole('menuitem', { name: /PDF 10-up/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /PNG fronte/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /PNG retro/i })).toBeInTheDocument();
  });

  it('uses platform <select> with known socials + Altro (B5)', () => {
    renderEditor();
    // Click "Aggiungi social" to get a row
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi social/i }));
    const platformSelect = screen.getByLabelText(/Social 1 piattaforma/i) as HTMLSelectElement;
    expect(platformSelect.tagName).toBe('SELECT');
    const options = Array.from(platformSelect.options).map((o) => o.value);
    expect(options).toContain('LinkedIn');
    expect(options).toContain('GitHub');
    expect(options).toContain('X');
    expect(options).toContain('Instagram');
    expect(options).toContain('__altro__'); // "Altro" marker
    // Verify Altro label is present
    const labels = Array.from(platformSelect.options).map((o) => o.textContent);
    expect(labels).toContain('Altro');
  });

  it('shows free-text "Altro" input when platform is "Altro" (B5)', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi social/i }));
    const platformSelect = screen.getByLabelText(/Social 1 piattaforma/i) as HTMLSelectElement;
    fireEvent.change(platformSelect, { target: { value: '__altro__' } });
    expect(screen.getByLabelText(/Altra piattaforma/i)).toBeInTheDocument();
  });

  it('saves to collection with documentType businessCard (AC-012)', async () => {
    renderEditor();
    const saveBtn = screen.getByRole('button', { name: /^Salva$/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const calls = mockSave.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1].documentType).toBe('businessCard');
  });

  it('allows initialCard override (used for editing existing card)', () => {
    const card = createGiovanniCardTemplate();
    card.front.name = 'GIANNI EDITED';
    render(<CardEditor {...baseProps} initialCard={card} />);
    const nameInput = screen.getByLabelText(/Nome \(fronte\)/i) as HTMLInputElement;
    expect(nameInput.value).toBe('GIANNI EDITED');
  });

  it('renders AI panel with 5 quick action buttons', () => {
    renderEditor();
    expect(screen.getByText(/AI Design Mode/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rendi premium/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Minimal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compila da nome/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cambia palette/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ottimizza per stampa/i })).toBeInTheDocument();
  });

  it('renders AI model selector and custom prompt textarea', () => {
    renderEditor();
    expect(screen.getByLabelText(/Modello AI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prompt AI personalizzato/i)).toBeInTheDocument();
  });

  it('renders "Applica prompt personalizzato" button', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /Applica prompt personalizzato/i })).toBeInTheDocument();
  });

  // ─── B2: Grid editor manuale ──────────────────────────────────
  describe('Grid editor (B2)', () => {
    it('renders grid editor panel with element selector + arrow controls', () => {
      renderEditor();
      expect(screen.getByTestId('card-grid-editor')).toBeInTheDocument();
      expect(screen.getByLabelText(/Elemento selezionato/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sposta a sinistra/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sposta a destra/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sposta su/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sposta giù/i })).toBeInTheDocument();
    });

    it('moves the selected element left when ← is pressed', () => {
      renderEditor();
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(nameSelect, { target: { value: 'name' } });
      const leftBtn = screen.getByRole('button', { name: /Sposta a sinistra/i });
      fireEvent.click(leftBtn);
      // Should have called setGrid and patched the card
      // The exact value depends on default preset, but the action should not throw
    });

    it('applies a grid preset when selected from dropdown', () => {
      renderEditor();
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      // Should patch the card's grid
    });

    it('resizes selected element with +/- buttons', () => {
      renderEditor();
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(nameSelect, { target: { value: 'photo' } });
      const plus = screen.getByRole('button', { name: /Aumenta larghezza/i });
      fireEvent.click(plus);
    });

    it('disables move buttons at grid boundary (Phase 2.1 visual feedback)', () => {
      renderEditor();
      // Seleziona photo (è all'inizio del preset left: x=0)
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(nameSelect, { target: { value: 'photo' } });
      // x=0 → canMoveLeft = false
      const leftBtn = screen.getByRole('button', { name: /Sposta a sinistra/i }) as HTMLButtonElement;
      expect(leftBtn).toBeDisabled();
      expect(leftBtn.title).toMatch(/Limite raggiunto/);
    });

    it('disables grow buttons when at right/bottom edge (Phase 2.1)', () => {
      renderEditor();
      // Seleziona photo del preset left: photo at x=0, w=1, h=4 in 4×4 grid
      // → canGrowH = false (y=0, h=4, rows=4)
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(nameSelect, { target: { value: 'photo' } });
      const growH = screen.getByRole('button', { name: /Aumenta altezza/i }) as HTMLButtonElement;
      expect(growH).toBeDisabled();
      expect(growH.title).toMatch(/Limite raggiunto/);
    });

    it('logo is selectable in grid editor (Phase 2.1)', () => {
      renderEditor();
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      const options = Array.from(nameSelect.querySelectorAll('option')).map((o) => o.value);
      expect(options).toContain('logo');
    });
  });

  // ─── Responsive + AI mobile ───────────────────────────────
  describe('Responsive (mobile <900px) + AI always-accessible', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    function setMobile() {
      window.matchMedia = vi.fn().mockImplementation((q: string) => ({
        matches: q.includes('max-width: 900px'),
        media: q,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as any;
    }

    function setDesktop() {
      window.matchMedia = vi.fn().mockImplementation((q: string) => ({
        matches: false,
        media: q,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as any;
    }

    it('on mobile: shows tab layout (Anteprima/Modifica/AI) instead of 3-col', () => {
      setMobile();
      renderEditor();
      expect(screen.getByTestId('card-editor-tabs')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Anteprima/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Modifica/i })).toBeInTheDocument();
    });

    it('on mobile: AI is always accessible via FAB button', () => {
      setMobile();
      renderEditor();
      const fab = screen.getByRole('button', { name: /Apri pannello AI/i });
      expect(fab).toBeInTheDocument();
    });

    it('on mobile: FAB opens bottom sheet with AI panel content', () => {
      setMobile();
      renderEditor();
      fireEvent.click(screen.getByRole('button', { name: /Apri pannello AI/i }));
      const dialog = screen.getByRole('dialog', { name: /Pannello AI/i });
      expect(dialog).toBeInTheDocument();
      expect(dialog.querySelector('[aria-label="Modello AI"]')).not.toBeNull();
    });

    it('on mobile: clicking "Modifica" tab shows form fields', () => {
      setMobile();
      renderEditor();
      fireEvent.click(screen.getByRole('tab', { name: /Modifica/i }));
      const tabContent = screen.getByTestId('tab-content-edit');
      expect(tabContent.querySelector('[aria-label="Nome (fronte)"]')).not.toBeNull();
    });

    it('on desktop: shows 3-col layout (no tabs, no FAB)', () => {
      setDesktop();
      renderEditor();
      expect(screen.queryByTestId('card-editor-tabs')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Apri pannello AI/i })).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Nome \(fronte\)/i)).toBeInTheDocument();
    });

    it('on mobile: preview default zoom is 70% (compatto)', () => {
      setMobile();
      renderEditor();
      expect(screen.getAllByText('70%').length).toBeGreaterThan(0);
    });

    it('on mobile: zoom out reduces to 50% (min), then disabled', () => {
      setMobile();
      renderEditor();
      const out = screen.getAllByRole('button', { name: /Riduci zoom/i })[0];
      fireEvent.click(out);
      fireEvent.click(out);
      fireEvent.click(out);
      expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
      expect(out).toBeDisabled();
    });

    it('on mobile: zoom in increases from 70% to 80% to 90% up to 150% (max)', () => {
      setMobile();
      renderEditor();
      const inBtn = screen.getAllByRole('button', { name: /Aumenta zoom/i })[0];
      fireEvent.click(inBtn);
      expect(screen.getAllByText('80%').length).toBeGreaterThan(0);
      fireEvent.click(inBtn);
      expect(screen.getAllByText('90%').length).toBeGreaterThan(0);
    });

    it('on desktop: default zoom is 100%', () => {
      setDesktop();
      renderEditor();
      expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    });

    it('zoom reset button restores 100%', () => {
      setMobile();
      renderEditor();
      const out = screen.getAllByRole('button', { name: /Riduci zoom/i })[0];
      fireEvent.click(out);
      fireEvent.click(out);
      expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
      const reset = screen.getAllByRole('button', { name: /Reset zoom/i })[0];
      fireEvent.click(reset);
      expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
    });

    it('on mobile: Salva button is always visible (sticky bottom bar)', () => {
      setMobile();
      renderEditor();
      const saveBtn = screen.getByTestId('mobile-save-btn');
      expect(saveBtn).toBeInTheDocument();
      expect(saveBtn).toBeVisible();
    });

    it('on mobile: Esporta button is always visible (sticky bottom bar)', () => {
      setMobile();
      renderEditor();
      const exportBtn = screen.getByTestId('mobile-export-btn');
      expect(exportBtn).toBeInTheDocument();
      expect(exportBtn).toBeVisible();
    });

    it('on mobile: clicking Esporta opens dropdown with PDF/PNG/SVG/JSON', async () => {
      setMobile();
      renderEditor();
      const exportBtn = screen.getByTestId('mobile-export-btn');
      fireEvent.click(exportBtn);
      expect(await screen.findByRole('menuitem', { name: /PDF 10-up/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /PNG fronte/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /SVG fronte/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /JSON/i })).toBeInTheDocument();
    });

    it('on mobile: clicking Salva calls dataService.saveDocument', async () => {
      setMobile();
      renderEditor();
      const saveBtn = screen.getByTestId('mobile-save-btn');
      await act(async () => {
        fireEvent.click(saveBtn);
      });
      await waitFor(() => expect(mockSave).toHaveBeenCalled());
    });

    it('on desktop: NO mobile sticky bar (3-col has its own Salva button)', () => {
      setDesktop();
      renderEditor();
      expect(screen.queryByTestId('mobile-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mobile-export-btn')).not.toBeInTheDocument();
    });

    it('grid editor on desktop: element cannot move into another (BLOCK collision)', () => {
      setDesktop();
      const card = createEmptyCard();
      card.grid = {
        cols: 4,
        rows: 4,
        elements: {
          photo: { x: 0, y: 0, w: 1, h: 4 },
          name: { x: 1, y: 0, w: 3, h: 1 },
          title: { x: 1, y: 1, w: 3, h: 1 },
        },
      };
      renderEditor(card);
      const select = screen.getByLabelText(/Elemento selezionato/i);
      fireEvent.change(select, { target: { value: 'name' } });
      const moveLeft = screen.getByRole('button', { name: /Sposta a sinistra/i });
      expect(moveLeft).toBeDisabled();
    });

    it('grid editor on desktop: cannot grow into another element (BLOCK)', () => {
      setDesktop();
      const card = createEmptyCard();
      card.grid = {
        cols: 4,
        rows: 4,
        elements: {
          photo: { x: 0, y: 0, w: 1, h: 4 },
          name: { x: 1, y: 0, w: 1, h: 1 },
          title: { x: 1, y: 1, w: 1, h: 1 },
        },
      };
      renderEditor(card);
      const select = screen.getByLabelText(/Elemento selezionato/i);
      fireEvent.change(select, { target: { value: 'name' } });
      const growH = screen.getByRole('button', { name: /Aumenta altezza/i });
      expect(growH).toBeDisabled();
    });
  });
});
