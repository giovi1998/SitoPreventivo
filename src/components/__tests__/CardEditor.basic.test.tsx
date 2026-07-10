import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  mockSave,
  mockCompress,
  mockGenPDF,
  mockGenPng,
  mockAddToast,
  baseProps,
  renderEditor,
} from './cardEditorTestSetup';
import { createGiovanniCardTemplate, createEmptyCard } from '../../utils/documentSchemas';
import CardEditor from '../CardEditor';

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
    expect(webInput.value).toBe('https://giovannicidu.vercel.app');
    const phoneInput = screen.getByLabelText(/Telefono \(retro\)/i) as HTMLInputElement;
    expect(phoneInput.value).toBe('35180008042');
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

  it('changes front.layout and re-renders preview always in grid-mode (AC-003, grid-only refactor)', () => {
    renderEditor();
    const select = screen.getByLabelText(/Layout fronte/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'centered' } });
    expect(screen.getByTestId('card-preview-front')).toHaveClass('grid-mode');
    fireEvent.change(select, { target: { value: 'split' } });
    expect(screen.getByTestId('card-preview-front')).toHaveClass('grid-mode');
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
    expect(screen.getByLabelText(/Nome \(fronte\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ruolo \(fronte\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Azienda \(fronte\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Telefono \(retro\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email \(retro\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sito web/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Indirizzo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/P\.IVA/i)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi social/i }));
    const platformSelect = screen.getByLabelText(/Social 1 piattaforma/i) as HTMLSelectElement;
    expect(platformSelect.tagName).toBe('SELECT');
    const options = Array.from(platformSelect.options).map((o) => o.value);
    expect(options).toContain('LinkedIn');
    expect(options).toContain('GitHub');
    expect(options).toContain('X');
    expect(options).toContain('Instagram');
    expect(options).toContain('__altro__');
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
    const broken = {
      documentType: 'businessCard' as const,
      id: 'card_partial',
      title: 'Partial',
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
    const almostEmpty = {
      documentType: 'businessCard' as const,
      id: 'card_empty',
    };
    expect(() =>
      render(<CardEditor {...baseProps} initialCard={almostEmpty as any} />)
    ).not.toThrow();
  });

  it('renders AI panel with redesigned quick action chips', () => {
    renderEditor();
    expect(screen.getByText(/AI Assist/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Premium$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pulisci$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Suggerisci$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Palette$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Stampa$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Genera fronte/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Genera retro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrambi i lati/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Applica prompt/i })).toBeInTheDocument();
  });

  it('renders AI model selector and custom prompt textarea', () => {
    renderEditor();
    expect(screen.getByLabelText(/Modello AI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prompt AI personalizzato/i)).toBeInTheDocument();
  });

  it('renders "Applica prompt" button', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /^Applica prompt$/i })).toBeInTheDocument();
  });
});