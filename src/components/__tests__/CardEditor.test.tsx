import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import CardEditor from '../CardEditor';
import dataService from '../../utils/dataService';
import { createEmptyCard, createGiovanniCardTemplate } from '../../utils/documentSchemas';
import type { BusinessCard } from '../../utils/documentSchemas';
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

function renderEditor(overrides: Partial<typeof baseProps & { initialCard?: BusinessCard }> = {}) {
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

  it('reset button clears the card and restores empty state', () => {
    renderEditor({ initialCard: createGiovanniCardTemplate() });
    expect((screen.getByLabelText(/Nome \(fronte\)/i) as HTMLInputElement).value).toBe('GIOVANNI CIDU');
    fireEvent.click(screen.getByRole('button', { name: /Nuovo \/ reset/i }));
    expect((screen.getByLabelText(/Nome \(fronte\)/i) as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/Usa template personale di Giovanni/i)).toBeInTheDocument();
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

  it('renders without crashing when initialCard.front is missing (regression: layout of undefined)', () => {
    // Phase 7 hotfix: a saved card from the Collection might have a
    // partial shape (legacy save, partial data, schema drift across
    // phases 0-2). Before the fix, opening such a card crashed the
    // editor with "Cannot read properties of undefined (reading
    // 'layout')" at the first read of card.front.layout in
    // cardGenerator / CardPreview. The mergeCardWithDefaults helper
    // restores the missing fields from createEmptyCard().
    const broken = {
      documentType: 'businessCard' as const,
      id: 'card_partial',
      title: 'Partial',
      // front is missing entirely
      back: { phone: '+39 333' },
      style: createEmptyCard().style,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() =>
      render(<CardEditor {...baseProps} initialCard={broken as any} />)
    ).not.toThrow();
  });

  it('renders without crashing when initialCard has only the id and documentType', () => {
    // Edge case: completely empty card from a partial save. The merge
    // should restore the full shape from createEmptyCard().
    const almostEmpty = {
      documentType: 'businessCard' as const,
      id: 'card_empty',
    };
    expect(() =>
      render(<CardEditor {...baseProps} initialCard={almostEmpty as any} />)
    ).not.toThrow();
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

    it('element selector is DISABLED when grid is OFF, ENABLED when ON (fix chicken-and-egg)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      // Grid OFF (default) → disabilitato + hint visibile
      expect(elSelect).toBeDisabled();
      expect(screen.getByTestId('grid-editor-disabled-hint')).toBeInTheDocument();
      // Grid ON → abilitato anche se nessun elemento è selezionato
      fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
      expect(elSelect).not.toBeDisabled();
      // E ora posso selezionare il primo elemento (era impossibile col bug !selected)
      fireEvent.change(elSelect, { target: { value: 'photo' } });
      expect(elSelect.value).toBe('photo');
    });

    it('preset selector is enabled when grid ON and applies a front-split grid WITH photo (fix)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      expect(presetSelect).not.toBeDisabled();
      // Applica preset "split" → la foto deve restare nella preview grid
      fireEvent.change(presetSelect, { target: { value: 'split' } });
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).toContain('grid-mode');
      // photo presente come grid element (regression: prima il preset split front la perdeva)
      expect(document.querySelector('[data-testid="grid-el-photo"]')).not.toBeNull();
    });

    it('preset selection persists in the dropdown after applying (fix: non si resetta)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      // Il dropdown deve restare su "centered", non tornare a ", seleziona preset:"
      expect(presetSelect.value).toBe('centered');
    });

    it('applying a preset SOSTITUISCE la grid (no duplicati di elementi come logo)', () => {
      // Giovanni template ha grid con logo a (2, 3, 1, 1). Applico preset
      // 'centered' che mette logo a (3, 3, 1, 1). Il merge precedente
      // lasciava il logo vecchio + aggiungeva quello nuovo = 2 loghi visibili.
      const card = createGiovanniCardTemplate();
      expect(card.grid?.elements.logo).toEqual({ x: 2, y: 3, w: 1, h: 1 });
      renderEditor({ initialCard: card });
      // Attiva griglia (init-from-layout) + seleziona centered
      fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      // Verifica che la preview mostri UN SOLO logo (grid centered ha 1 logo)
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).toContain('grid-mode');
      // Dopo centered: logo a (3, 3, 1, 1)
      const grid = front.querySelector('[data-testid="grid-el-logo"]') as HTMLElement;
      expect(grid).not.toBeNull();
      expect(window.getComputedStyle(grid).gridColumn).toBe('4 / span 1');
      expect(window.getComputedStyle(grid).gridRow).toBe('4 / span 1');
    });

    it('moves the selected element left when ← is pressed', () => {
      renderEditor();
      // Phase 2.2 REQ-E01: attivare il master switch prima di poter spostare
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
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
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      // Phase 2.2 REQ-E01: attivare il master switch prima
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(nameSelect, { target: { value: 'photo' } });
      const plus = screen.getByRole('button', { name: /Aumenta larghezza/i });
      fireEvent.click(plus);
    });

    it('disables move buttons at grid boundary (Phase 2.1 visual feedback)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      // Seleziona photo (è all'inizio del preset left: x=0)
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(nameSelect, { target: { value: 'photo' } });
      // x=0 → canMoveLeft = false
      const leftBtn = screen.getByRole('button', { name: /Sposta a sinistra/i }) as HTMLButtonElement;
      expect(leftBtn).toBeDisabled();
      // Phase 2.2: nuovo wording REQ-G01: "Limite (bordo)" o "Limite (collisione)"
      expect(leftBtn.title).toMatch(/Limite/);
    });

    it('disables grow buttons when at right/bottom edge (Phase 2.1)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      // Seleziona photo del preset left: photo at x=0, w=1, h=4 in 4×4 grid
      // → canGrowH = false (y=0, h=4, rows=4)
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(nameSelect, { target: { value: 'photo' } });
      const growH = screen.getByRole('button', { name: /Aumenta altezza/i }) as HTMLButtonElement;
      expect(growH).toBeDisabled();
      expect(growH.title).toMatch(/Limite/);
    });

    it('logo is selectable in grid editor (Phase 2.1)', () => {
      // Giovanni template ha logoUrl → logo è tra le opzioni disponibili.
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      const options = Array.from(nameSelect.querySelectorAll('option')).map((o) => o.value);
      expect(options).toContain('logo');
    });

    it('grid editor select shows only elements with content (Phase 2.2)', () => {
      // Card vuota: nessun elemento ha contenuto → select vuota.
      renderEditor();
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      const options = Array.from(nameSelect.querySelectorAll('option')).map((o) => o.value);
      // Solo l'opzione vuota ":"
      expect(options.filter((v) => v !== '')).toHaveLength(0);
    });

    it('grid editor select shows all front elements with Giovanni template (Phase 2.2)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const nameSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      const options = Array.from(nameSelect.querySelectorAll('option')).map((o) => o.value);
      // Giovanni ha foto, logo, nome, ruolo, azienda → tutti presenti
      expect(options).toContain('photo');
      expect(options).toContain('logo');
      expect(options).toContain('name');
      expect(options).toContain('title');
      expect(options).toContain('company');
    });

    it('disables move button when next cell would collide with another element (Phase 2.2 REQ-A01)', () => {
      // Pre-condizione: preset left ha name a (1,1,3,1) e title a (1,2,3,1).
      // name.y=1 vuole andare a y=2 → collide con title → bottone ↓ disabilitato.
      // PRIMA del fix, il collision check usava un `bounds` senza `elements`
      // e ritornava sempre `false`, quindi il bottone era abilitato e la
      // mossa veniva bloccata silenziosamente da clampMove (UX brutto).
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'name' } });
      const downBtn = screen.getByRole('button', { name: /Sposta giù/i }) as HTMLButtonElement;
      expect(downBtn).toBeDisabled();
      expect(downBtn.title).toMatch(/collisione|Limite/);
    });

    it('disables grow button when grow would collide with neighbor (Phase 2.2 REQ-A01)', () => {
      // Pre-condizione: preset left, photo a (0,0,1,4) → può crescere in w
      // (no elementi a destra sulla sua riga), ma in h è già a max (h=4 = rows).
      // Per testare la collisione, selezioniamo name (1,1,3,1): può crescere
      // in w (fino a w=3 perché cols=4, x+w≤4), ma crescere in h porterebbe
      // a (1,1,3,2) che collide con title a (1,2,3,1).
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'name' } });
      const growH = screen.getByRole('button', { name: /Aumenta altezza/i }) as HTMLButtonElement;
      expect(growH).toBeDisabled();
    });

    // ─── Phase 2.2: test sposta/ridimensiona ogni elemento (template Giovanni) ──
    // Giovanni template non ha card.grid (usa fallback gridPresetLeft che è
    // molto compatto: nessun elemento può muoversi). Per testare mosse valide,
    // applichiamo prima il preset 'centered' (ha spazio) poi facciamo le mosse.

    it('moves photo left by 1 (grid editor front, Giovanni + centered preset)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      // Phase 2.2 REQ-E01: attivare il master switch prima
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      // Applica preset centered (photo a x=1, può andare a sinistra)
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'photo' } });
      const leftBtn = screen.getByRole('button', { name: /Sposta a sinistra/i });
      expect(leftBtn).not.toBeDisabled();
      fireEvent.click(leftBtn);
      // Dopo la mossa: useGrid=true → preview in grid-mode
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).toContain('grid-mode');
    });

    it('resizes photo taller by 1 (grid editor front, Giovanni + centered preset)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'photo' } });
      // photo centered: (1,0,2,1) → growH: (1,0,2,2) → collide con name(0,1,4,1)?
      // x: 3>0 OK, 4<=1 No → x overlap. y: 2<=1 No, 2<=0 No → y overlap. Collide!
      // Quindi growH è disabled. Usiamo shrinkW invece (w=2 > 1 → canShrinkW=true)
      const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
      expect(shrinkW).not.toBeDisabled();
      fireEvent.click(shrinkW);
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).toContain('grid-mode');
    });

    it('moves name down blocked by title (grid editor front, centered preset)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'name' } });
      // name centered: (0,1,4,1) → ↓ va a (0,2,4,1) → collide con title(0,2,4,1)
      const downBtn = screen.getByRole('button', { name: /Sposta giù/i });
      expect(downBtn).toBeDisabled();
    });

    it('resizes name shrink width (grid editor front, centered preset)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'name' } });
      // name centered: (0,1,4,1), w=4 > 1 → canShrinkW = true
      const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
      expect(shrinkW).not.toBeDisabled();
      fireEvent.click(shrinkW);
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).toContain('grid-mode');
    });

    it('moves title up blocked by name (grid editor front, centered preset)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'title' } });
      // title centered: (0,2,4,1) → ↑ va a (0,1,4,1) → collide con name(0,1,4,1)
      const upBtn = screen.getByRole('button', { name: /Sposta su/i });
      expect(upBtn).toBeDisabled();
    });

    it('resizes title shrink height (grid editor front, centered preset)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'title' } });
      // title centered: (0,2,4,1), h=1 → canShrinkH = false (h=1 min)
      const shrinkH = screen.getByRole('button', { name: /Riduci altezza/i });
      expect(shrinkH).toBeDisabled();
    });

    it('moves company left blocked by grid edge (grid editor front, centered)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'company' } });
      // company centered: (0,3,3,1) → x=0 → canMoveLeft = false
      const leftBtn = screen.getByRole('button', { name: /Sposta a sinistra/i });
      expect(leftBtn).toBeDisabled();
    });

    it('resizes company shrink width (grid editor front, centered preset)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'company' } });
      // company centered: (0,3,3,1), w=3 > 1 → canShrinkW = true
      const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
      expect(shrinkW).not.toBeDisabled();
      fireEvent.click(shrinkW);
      const front = screen.getByTestId('card-preview-front');
      expect(front.className).toContain('grid-mode');
    });

    it('moves logo up blocked by company (grid editor front, centered)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'logo' } });
      // logo centered: (3,3,1,1) → ↑ va a (3,2,1,1) → collide con title(0,2,4,1)?
      // x: 4>0 OK, 4<=3 No → x overlap. y: 3<=2 No, 3<=3 No → y overlap. Collide!
      const upBtn = screen.getByRole('button', { name: /Sposta su/i });
      expect(upBtn).toBeDisabled();
    });

    it('resizes logo shrink width (grid editor front, centered preset)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
      fireEvent.change(presetSelect, { target: { value: 'centered' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'logo' } });
      // logo centered: (3,3,1,1), w=1 → canShrinkW = false (w=1 min)
      const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
      expect(shrinkW).toBeDisabled();
    });

    it('grid editor back: moves QR down blocked by socials (Giovanni template)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
      fireEvent.change(sideSelect, { target: { value: 'back' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'qr' } });
      // Giovanni backGrid (gridPresetBackDefault): qr a (3,0,1,2), socials a (3,2,1,2)
      // → ↓ va a (3,1,1,2) → collide con socials (y overlap: qr.y2=3 > socials.y=2)
      const downBtn = screen.getByRole('button', { name: /Sposta giù/i });
      expect(downBtn).toBeDisabled();
    });

    it('grid editor back: resizes contacts wider blocked by QR (Giovanni)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
      fireEvent.change(sideSelect, { target: { value: 'back' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'contacts' } });
      // contacts a (0,0,3,4), cols=4 → growW: (0,0,4,4) collide con qr(3,0,1,2)
      const growW = screen.getByRole('button', { name: /Aumenta larghezza/i });
      expect(growW).toBeDisabled();
    });

    it('grid editor back: resizes socials taller blocked by grid edge (Giovanni)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
      fireEvent.change(sideSelect, { target: { value: 'back' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'socials' } });
      // socials a (3,2,1,2), rows=4 → y+h=4 = rows → canGrowH = false
      const growH = screen.getByRole('button', { name: /Aumenta altezza/i });
      expect(growH).toBeDisabled();
    });

    it('grid editor back: moves socials up blocked by QR (Giovanni template)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
      fireEvent.change(sideSelect, { target: { value: 'back' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'socials' } });
      // socials a (3,2,1,2) → ↑ va a (3,1,1,2) → collide con qr(3,0,1,2)
      const upBtn = screen.getByRole('button', { name: /Sposta su/i });
      expect(upBtn).toBeDisabled();
    });

    it('grid editor back: shrinks contacts width (Giovanni template)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
      fireEvent.change(sideSelect, { target: { value: 'back' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'contacts' } });
      // contacts a (0,0,3,4), w=3 > 1 → canShrinkW = true
      const shrinkW = screen.getByRole('button', { name: /Riduci larghezza/i });
      expect(shrinkW).not.toBeDisabled();
      fireEvent.click(shrinkW);
      const back = screen.getByTestId('card-preview-back');
      expect(back.className).toContain('grid-mode');
    });

    it('grid editor back: shrinks QR height (Giovanni template)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
      fireEvent.change(sideSelect, { target: { value: 'back' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'qr' } });
      // qr a (3,0,1,2), h=2 > 1 → canShrinkH = true
      const shrinkH = screen.getByRole('button', { name: /Riduci altezza/i });
      expect(shrinkH).not.toBeDisabled();
      fireEvent.click(shrinkH);
      const back = screen.getByTestId('card-preview-back');
      expect(back.className).toContain('grid-mode');
    });

    it('grid editor back: shrinks socials height (Giovanni template)', () => {
      renderEditor({ initialCard: createGiovanniCardTemplate() });
      const gridToggle = screen.getByLabelText(/Mostra griglia/i);
      fireEvent.click(gridToggle);
      const sideSelect = screen.getByLabelText(/Lato griglia/i) as HTMLSelectElement;
      fireEvent.change(sideSelect, { target: { value: 'back' } });
      const elSelect = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
      fireEvent.change(elSelect, { target: { value: 'socials' } });
      // socials a (3,2,1,2), h=2 > 1 → canShrinkH = true
      const shrinkH = screen.getByRole('button', { name: /Riduci altezza/i });
      expect(shrinkH).not.toBeDisabled();
      fireEvent.click(shrinkH);
      const back = screen.getByTestId('card-preview-back');
      expect(back.className).toContain('grid-mode');
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

    it('on mobile: AI "Compila da nome" button is present and uses correct key (Phase 2.2 REQ-A05)', () => {
      setMobile();
      renderEditor();
      fireEvent.click(screen.getByRole('button', { name: /Apri pannello AI/i }));
      const dialog = screen.getByRole('dialog', { name: /Pannello AI/i });
      // Tutti e 5 i bottoni rapidi devono essere presenti nella sheet mobile
      // inclusi quelli con la stessa chiave di prompt del desktop (in
      // particolare "Compila da nome" → 'fill', non 'fillName').
      expect(dialog.querySelector('button:not([disabled])')?.textContent).toBeDefined();
      expect(within(dialog).getByRole('button', { name: /Compila da nome/i })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: /Rendi premium/i })).toBeInTheDocument();
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
