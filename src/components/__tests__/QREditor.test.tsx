import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import QREditor from '../QREditor';
import dataService from '../../utils/dataService';
import { createEmptyQrCode, createGiovanniQrTemplate } from '../../utils/documentSchemas';

vi.mock('../../utils/dataService', () => ({
  default: {
    saveDocument: vi.fn().mockResolvedValue({ success: true }),
    getDocuments: vi.fn().mockResolvedValue({ documents: [] }),
    deleteDocument: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const mockSave = dataService.saveDocument as unknown as ReturnType<typeof vi.fn>;
const mockGet = dataService.getDocuments as unknown as ReturnType<typeof vi.fn>;
const mockDelete = dataService.deleteDocument as unknown as ReturnType<typeof vi.fn>;

const URL_RE = /^https?:\/\//;

describe('QREditor', () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockGet.mockClear();
    mockDelete.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders initial empty QR (AC-001)', () => {
    render(<QREditor userEmail="user@test.com" />);
    expect(screen.getByRole('heading', { level: 1, name: /QR Code/i })).toBeInTheDocument();
    const select = screen.getByLabelText(/Tipo payload QR/i) as HTMLSelectElement;
    expect(select.value).toBe('url');
    const titleInput = screen.getByLabelText(/Titolo del QR/i) as HTMLInputElement;
    expect(titleInput.value).toBe('QR Code');
  });

  it('shows Giovanni template banner and applies template (AC-002)', () => {
    render(<QREditor userEmail="user@test.com" />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Giovanni');
    fireEvent.click(screen.getByRole('button', { name: /Applica template/i }));
    const urlInput = screen.getByLabelText(/URL del QR code/i) as HTMLInputElement;
    expect(urlInput.value).toBe('https://webdeveloperca.netlify.app/');
  });

  it('changes type and resets payload (AC-003)', () => {
    render(<QREditor userEmail="user@test.com" initialQr={{ ...createEmptyQrCode(), data: { type: 'url', payload: 'https://example.com' } }} />);
    const typeSelect = screen.getByLabelText(/Tipo payload QR/i) as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'email' } });
    const emailInput = screen.getByLabelText(/Email del QR/i) as HTMLInputElement;
    expect(emailInput.value).toBe('');
  });

  it('validates URL with http/https only (AC-004 edge case 1)', () => {
    render(<QREditor userEmail="user@test.com" initialQr={{ ...createEmptyQrCode(), data: { type: 'url', payload: 'https://ok.com' } }} />);
    const urlInput = screen.getByLabelText(/URL del QR code/i) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: 'example.com' } });
    expect(screen.getByText(/URL non valido/i)).toBeInTheDocument();
    fireEvent.change(urlInput, { target: { value: 'https://valid.com' } });
    expect(screen.queryByText(/URL non valido/i)).not.toBeInTheDocument();
  });

  it('shows WCAG AA warning when contrast is insufficient (AC-005)', () => {
    render(<QREditor userEmail="user@test.com" initialQr={{ ...createEmptyQrCode(), style: { ...createEmptyQrCode().style, fgColor: '#EEEEEE' } }} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Contrasto insufficiente/i);
  });

  it('does NOT show WCAG AA warning with sufficient contrast', () => {
    render(<QREditor userEmail="user@test.com" initialQr={{ ...createEmptyQrCode(), style: { ...createEmptyQrCode().style, fgColor: '#000000', bgColor: '#FFFFFF' } }} />);
    expect(screen.queryByText(/Contrasto insufficiente/i)).not.toBeInTheDocument();
  });

  it('export PNG triggers a download (AC-006)', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<QREditor userEmail="user@test.com" initialQr={{ ...createEmptyQrCode(), data: { type: 'url', payload: 'https://example.com' } }} />);
      const btn = await screen.findByRole('button', { name: /Scarica PNG/i });
      fireEvent.click(btn);
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
      expect(clickSpy).toHaveBeenCalled();
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = revokeObjectURL;
      clickSpy.mockRestore();
    }
  });

  it('export SVG triggers a download (AC-007)', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = createObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<QREditor userEmail="user@test.com" initialQr={{ ...createEmptyQrCode(), data: { type: 'url', payload: 'https://example.com' } }} />);
      const btn = await screen.findByRole('button', { name: /Scarica SVG/i });
      fireEvent.click(btn);
      await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    } finally {
      URL.createObjectURL = originalCreate;
      clickSpy.mockRestore();
    }
  });

  it('rejects unsupported logo MIME with error (AC-013)', () => {
    render(<QREditor userEmail="user@test.com" />);
    const file = new File(['fake'], 'logo.exe', { type: 'application/octet-stream' });
    const input = screen.getByLabelText(/Carica logo overlay/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole('alert').textContent).toMatch(/Formato non supportato/i);
  });

  it('opens SaveDialog when Save clicked with valid payload (AC-009)', async () => {
    render(<QREditor userEmail="user@test.com" initialQr={{ ...createEmptyQrCode(), data: { type: 'url', payload: 'https://example.com' } }} />);
    const saveBtn = screen.getByRole('button', { name: /^Salva$/i });
    fireEvent.click(saveBtn);
    // Phase 7: the dialog now labels the document by type, not hardcoded
    // "preventivo". QREditor passes documentLabel="QR Code".
    const dialogHeading = await screen.findByRole('heading', { name: /Salva QR Code/i });
    expect(dialogHeading).toBeInTheDocument();
  });

  it('does not open SaveDialog if payload is empty', () => {
    render(<QREditor userEmail="user@test.com" initialQr={createEmptyQrCode()} />);
    const saveBtn = screen.getByRole('button', { name: /^Salva$/i });
    fireEvent.click(saveBtn);
    expect(screen.queryByRole('heading', { name: /Salva QR Code/i })).not.toBeInTheDocument();
  });
});
