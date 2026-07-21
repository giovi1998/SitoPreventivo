import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CardAIFloatingProvider } from '../../../hooks/useCardAIFloating';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CardEditorShell from '../CardEditorShell';
import dataService from '../../../utils/dataService';
import { createEmptyCard, createGiovanniCardTemplate } from '../../../utils/documentSchemas';
import { compressImage, generateCardPDF, generateCardPng } from '../../../utils/cardGenerator';
import { useToast } from '../../../hooks/useToast';

vi.mock('../../../utils/dataService', () => ({
  default: {
    saveDocument: vi.fn().mockResolvedValue({ success: true }),
    getDocuments: vi.fn().mockResolvedValue({ documents: [] }),
    deleteDocument: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    addToast: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

const mockGenerateCover = vi.fn().mockImplementation((_: any, side: 'front' | 'back') => Promise.resolve(`data:image/png;base64,${side.toUpperCase()}`));

vi.mock('../../../hooks/useAICard', () => ({
  useAICard: () => ({
    processCardPrompt: vi.fn().mockResolvedValue({
      card: createEmptyCard(),
      changes: [],
      rawResponse: '{}',
    }),
    generateCover: mockGenerateCover,
    resetCardChat: vi.fn(),
    cardAiLogs: [],
    isCardProcessing: false,
    availableModels: [{ id: 'deepseek-chat', name: 'DeepSeek', model: 'deepseek-chat', supportsStreaming: true, supportsTools: true }],
    totalCostUsd: 0,
    lastCostUsd: 0,
  }),
}));

vi.mock('../../../hooks/useAIIconHero', () => ({
  useAIIconHero: () => ({
    generate: vi.fn().mockResolvedValue('data:image/png;base64,ICON'),
    isProcessing: false,
    logs: [],
  }),
}));

vi.mock('../../../utils/cardGenerator', async () => {
  const actual = await vi.importActual<any>('../../../utils/cardGenerator');
  return {
    ...actual,
    compressImage: vi.fn(async (file: File) => `data:image/jpeg;base64,COMPRESSED_${file.name}`),
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

describe('CardEditorShell', () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockCompress.mockClear();
    mockGenPDF.mockClear();
    mockGenPng.mockClear();
    (mockAddToast as any).mockClear?.();
  });

  it('renders both previews and form controls', () => {
    render(<CardAIFloatingProvider><CardEditorShell {...baseProps} /></CardAIFloatingProvider>);
    expect(screen.getByRole('heading', { level: 1, name: /Bigliettino da visita/i })).toBeInTheDocument();
    expect(screen.getByTestId('card-preview-front')).toBeInTheDocument();
    expect(screen.getByTestId('card-preview-back')).toBeInTheDocument();
  });

  it('updates card state when typing front fields', () => {
    render(<CardAIFloatingProvider><CardEditorShell {...baseProps} /></CardAIFloatingProvider>);
    const nameInput = screen.getByLabelText(/Nome \(fronte\)/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'MARIO ROSSI' } });
    expect(nameInput.value).toBe('MARIO ROSSI');
  });

  it('toggles grid mode and initializes grid from layout', async () => {
    render(<CardAIFloatingProvider><CardEditorShell {...baseProps} initialCard={createGiovanniCardTemplate()} /></CardAIFloatingProvider>);
    // Apply a preset first so grid elements exist, then toggle the master switch.
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    const toggle = screen.getByLabelText(/Mostra griglia/i);
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByLabelText(/Nascondi griglia/i)).toBeInTheDocument());
    expect(screen.getByTestId('card-preview-front').className).toContain('grid-mode');
  });

  it('applies a grid preset and updates preview to grid-mode', async () => {
    render(<CardAIFloatingProvider><CardEditorShell {...baseProps} initialCard={createGiovanniCardTemplate()} /></CardAIFloatingProvider>);
    fireEvent.click(screen.getByLabelText(/Mostra griglia/i));
    await waitFor(() => expect(screen.getByLabelText(/Nascondi griglia/i)).toBeInTheDocument());
    const presetSelect = screen.getByLabelText(/Preset griglia/i) as HTMLSelectElement;
    fireEvent.change(presetSelect, { target: { value: 'centered' } });
    expect(screen.getByTestId('card-preview-front').className).toContain('grid-mode');
  });

  it('calls save via desktop save action (dialog → confirm name)', async () => {
    const filled = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'Mario Rossi' },
    };
    render(<CardAIFloatingProvider><CardEditorShell {...baseProps} initialCard={filled} /></CardAIFloatingProvider>);
    fireEvent.click(screen.getByRole('button', { name: /^Salva$/i }));
    expect(await screen.findByRole('heading', { name: /Salva bigliettino/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Conferma salvataggio/i }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const last = mockSave.mock.calls[mockSave.mock.calls.length - 1];
    expect(last[0]).toBe('user@test.com');
    expect(last[1].documentType).toBe('businessCard');
    expect(last[1].title).toMatch(/Mario|Bigliettino/i);
  });

  it('exports PDF through the export menu', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<CardAIFloatingProvider><CardEditorShell {...baseProps} /></CardAIFloatingProvider>);
      const exportBtn = screen.getByRole('button', { name: /Esporta ▾/i });
      fireEvent.click(exportBtn);
      fireEvent.click(screen.getByRole('menuitem', { name: /PDF 10-up \(tipografia/i }));
      await waitFor(() => expect(mockGenPDF).toHaveBeenCalled());
      expect(createObjectURL).toHaveBeenCalled();
    } finally {
      URL.createObjectURL = originalCreate;
      clickSpy.mockRestore();
    }
  });

  it('resets to empty card when reset button clicked', () => {
    render(<CardAIFloatingProvider><CardEditorShell {...baseProps} initialCard={createGiovanniCardTemplate()} /></CardAIFloatingProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Nuovo \/ reset/i }));
    expect((screen.getByLabelText(/Nome \(fronte\)/i) as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/Usa template personale di Giovanni/i)).toBeInTheDocument();
  });

  it('shows the Giovanni template banner and applies it', () => {
    render(<CardAIFloatingProvider><CardEditorShell {...baseProps} /></CardAIFloatingProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Applica template/i }));
    expect((screen.getByLabelText(/Nome \(fronte\)/i) as HTMLInputElement).value).toBe('GIOVANNI CIDU');
  });

  it('renders AI controls and provider badge', () => {
    render(<CardAIFloatingProvider><CardEditorShell {...baseProps} /></CardAIFloatingProvider>);
    // TB-023: il selettore modello è il badge provider nella console header.
    expect(screen.getByTestId('ai-provider-badge')).toBeInTheDocument();
    expect(screen.getByLabelText(/Prompt AI personalizzato/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Applica prompt$/i })).toBeInTheDocument();
  });

  it('serializes front/back cover generation when both is requested', async () => {
    let frontResolved = false;
    mockGenerateCover.mockImplementation(async (_card: any, side: 'front' | 'back') => {
      if (side === 'front') {
        await Promise.resolve();
        frontResolved = true;
        return 'data:image/png;base64,FRONT';
      }
      expect(frontResolved).toBe(true);
      return 'data:image/png;base64,BACK';
    });

    const { container } = render(<CardAIFloatingProvider><CardEditorShell {...baseProps} /></CardAIFloatingProvider>);
    // TB-023: "Sfondo AI" è collapsed di default — espando prima.
    fireEvent.click(screen.getByRole('button', { name: /Sfondo AI/i }));
    const bothBtn = container.querySelector('.card-ai-both-btn') as HTMLButtonElement;
    expect(bothBtn).not.toBeNull();
    fireEvent.click(bothBtn);

    await waitFor(() => expect(mockGenerateCover).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(mockGenerateCover).toHaveBeenNthCalledWith(1, expect.anything(), 'front', undefined, expect.any(Object));
    expect(mockGenerateCover).toHaveBeenNthCalledWith(2, expect.anything(), 'back', undefined, expect.any(Object));

    await waitFor(() => expect(container.querySelector('img[alt="Cover fronte"]')).toBeInTheDocument(), { timeout: 3000 });
    expect(container.querySelector('img[alt="Cover retro"]')).toBeInTheDocument();
  });
});
