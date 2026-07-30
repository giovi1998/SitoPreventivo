import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import CustomerDetail from '../crm/CustomerDetail';
import dataService from '../../utils/dataService';
import { TestRouter } from '../../test/TestRouter';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

const autoGenMocks = vi.hoisted(() => ({
  generateAll: vi.fn().mockResolvedValue(undefined),
  generateOne: vi.fn().mockResolvedValue(undefined),
  state: { statuses: {} as Record<string, string>, errors: {} as Record<string, string>, currentStep: null as string | null, running: false },
}));

vi.mock('../../hooks/useAutoBuildGenerate', () => ({
  useAutoBuildGenerate: () => ({
    state: autoGenMocks.state,
    generateAll: autoGenMocks.generateAll,
    generateOne: autoGenMocks.generateOne,
  }),
}));

vi.mock('../../utils/dataService', () => ({
  default: {
    getCustomer: vi.fn(),
    researchCustomer: vi.fn().mockResolvedValue({ data: {} }),
    aiFillCustomer: vi.fn().mockResolvedValue({ data: {} }),
    autoBuildCustomer: vi.fn().mockResolvedValue({ data: {} }),
    updateCustomer: vi.fn().mockResolvedValue({ data: {} }),
    saveDocument: vi.fn().mockResolvedValue({ data: {} }),
    getUserSettings: vi.fn().mockResolvedValue({ userEmail: 'admin@gmail.com' }),
    saveUserSettings: vi.fn().mockResolvedValue({ success: true }),
  },
}));

beforeEach(() => {
  cleanup();
  mocks.navigate.mockReset();
  autoGenMocks.generateAll.mockClear();
  autoGenMocks.generateOne.mockClear();
  autoGenMocks.state.statuses = {};
  autoGenMocks.state.errors = {};
  autoGenMocks.state.currentStep = null;
  autoGenMocks.state.running = false;
  (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockReset();
  (dataService.researchCustomer as unknown as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ data: {} });
  (dataService.aiFillCustomer as unknown as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ data: {} });
  (dataService.autoBuildCustomer as unknown as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ data: {} });
});

function renderDetail() {
  return render(
    <TestRouter initialEntries={['/app/customers/cust_1']}>
      <CustomerDetail customerId="cust_1" onBack={() => {}} onRefresh={() => {}} />
    </TestRouter>
  );
}

const baseCustomer = {
  id: 'cust_1', businessName: 'Bar Da Mario', status: 'new', ownerName: 'Mario',
  sector: 'bar', contacts: { email: 'mario@example.com' }, documents: [],
};

describe('TB-027 CustomerDetail', () => {
  it('render dettaglio cliente con brief', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-detail-title').textContent).toBe('Bar Da Mario');
    });
    expect(screen.getByText('Mario')).toBeTruthy();
  });

  it('mostra azioni research/ai-fill/auto-build/palette', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-research-btn')).toBeTruthy();
      expect(screen.getByTestId('crm-ai-fill-btn')).toBeTruthy();
      expect(screen.getByTestId('crm-auto-build-btn')).toBeTruthy();
      expect(screen.getByTestId('crm-palette-btn')).toBeTruthy();
    });
  });

  it('errore getCustomer mostra messaggio', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'Non trovato' });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Non trovato')).toBeTruthy();
    });
  });

  it('mostra sezione research con status pill', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, researchStatus: { places: 'ok', logo: 'no_logo' } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-research-section')).toBeTruthy();
    });
  });

  it('mostra dati dal sito quando webData popolato', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, webData: { title: 'Bar Da Mario', description: 'Il miglior bar', markdownPreview: 'Via Roma 1' } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-nap-section')).toBeTruthy();
      expect(screen.getByText('Via Roma 1')).toBeTruthy();
    });
  });

  it('click "Apri editor" naviga al documento', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, documents: [{ id: 'logo_1', documentType: 'logo', title: 'Logo Bar' }] },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-open-doc-logo_1')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-open-doc-logo_1'));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/logo/logo_1');
  });

  it('inline edit: click campo → input → blur salva (PATCH)', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Mario')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Mario'));
    const input = await screen.findByTestId('crm-edit-ownerName');
    fireEvent.change(input, { target: { value: 'Mario Rossi' } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(dataService.updateCustomer).toHaveBeenCalledWith('cust_1', { ownerName: 'Mario Rossi' });
    });
  });

  it('log AI panel appare e si popola dopo azione', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-ai-log')).toBeTruthy();
    });
    expect(screen.getByText(/Nessuna operazione/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('crm-research-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Lanciata auto-research/)).toBeTruthy();
    });
  });

  it('mostra provider selector AI generale', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-ai-provider')).toBeTruthy();
    });
    expect(screen.getByText('Provider AI')).toBeTruthy();
  });

  it('AI provider default = MiniMax M3 (registry default), DeepSeek selezionabile', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-ai-provider')).toBeTruthy();
    });
    const select = screen.getByTestId('crm-ai-provider') as HTMLSelectElement;
    expect(select.value).toBe('ollama-minimax-m3');
    const ids = Array.from(select.options).map((o) => o.value);
    expect(ids).toContain('deepseek-chat');
  });

  it('log vuoto → pulsanti Copia/Cancella assenti', async () => {
    sessionStorage.clear();
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-ai-log')).toBeTruthy();
    });
    expect(screen.queryByTestId('crm-log-copy')).toBeNull();
    expect(screen.queryByTestId('crm-log-clear')).toBeNull();
  });

  it('click Copia → clipboard riceve log formattato (ts, icon, msg, detail indentato)', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('pq_crm_log:cust_1', JSON.stringify([
      { ts: '10:00:00', type: 'success', msg: 'Research completata', cost: '$0.01' },
      { ts: '10:01:00', type: 'error', msg: 'Palette fallita', detail: { error: 'boom' } },
    ]));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-log-copy')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-log-copy'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('[10:00:00] ✓ Research completata $0.01');
    expect(text).toContain('[10:01:00] ✗ Palette fallita');
    expect(text).toContain('\n  {\n    "error": "boom"\n  }');
    await waitFor(() => {
      expect(screen.getByTestId('crm-log-copy').textContent).toBe('✓ Copiato');
    });
  });

  it('click Cancella → log svuotato e sessionStorage pulito', async () => {
    sessionStorage.clear();
    sessionStorage.setItem('pq_crm_log:cust_1', JSON.stringify([
      { ts: '10:00:00', type: 'info', msg: 'Research lanciata' },
    ]));
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-log-clear')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-log-clear'));
    await waitFor(() => {
      expect(screen.getByText(/Nessuna operazione/)).toBeTruthy();
    });
    expect(sessionStorage.getItem('pq_crm_log:cust_1')).toBeNull();
    expect(screen.queryByTestId('crm-log-copy')).toBeNull();
    expect(screen.queryByTestId('crm-log-clear')).toBeNull();
  });

  it('logo caricato mostra preview con check verde', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, logoUrl: 'data:image/png;base64,abc' },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-logo-preview')).toBeTruthy();
    });
  });

  it('log persiste in sessionStorage (non si cancella cambiando pagina)', async () => {
    sessionStorage.clear();
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-research-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-research-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Lanciata auto-research/)).toBeTruthy();
    });
    const stored = sessionStorage.getItem('pq_crm_log:cust_1');
    expect(stored).toBeTruthy();
    expect(stored).toContain('Lanciata auto-research');
  });

  it('input Google Maps URL: typing + Enter salva updateCustomer', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Google Maps')).toBeTruthy();
    });
    const field = screen.getByText('Google Maps').closest('.crm-field') as HTMLElement;
    const valueSpan = field.querySelector('.crm-field-value') as HTMLElement;
    fireEvent.click(valueSpan);
    await waitFor(() => {
      expect(field.querySelector('input')).toBeTruthy();
    });
    const input = field.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'https://maps.app.goo.gl/MBHpXhGWnRQac41GA' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(dataService.updateCustomer).toHaveBeenCalledWith('cust_1', expect.objectContaining({ googleMapsUrl: 'https://maps.app.goo.gl/MBHpXhGWnRQac41GA' }));
    });
  });

  it('logo caricato manualmente → timeline mostra "manual"', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, logoUrl: 'data:image/png;base64,abc', researchStatus: { places: 'no_key', logo: 'no_logo' } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-logo-status')).toBeTruthy();
    });
    expect(screen.getByTestId('crm-logo-status').textContent).toBe('manual');
  });

  it('log espandibile: click riga mostra detail JSON', async () => {
    sessionStorage.clear();
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-research-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-research-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Lanciata auto-research/)).toBeTruthy();
    });
    const row = screen.getByText(/Lanciata auto-research/).closest('.crm-ai-log-row');
    if (row) fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByTestId('crm-log-detail')).toBeTruthy();
    });
  });

  it('selector modello image-gen presente e salva in userSettings', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-image-model')).toBeTruthy();
    });
    const select = screen.getByTestId('crm-image-model') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'gemini-3.1-flash-image' } });
    await waitFor(() => {
      expect(dataService.saveUserSettings).toHaveBeenCalledWith('admin@gmail.com', expect.objectContaining({ imageGenModel: 'gemini-3.1-flash-image' }));
    });
  });

  it('upload logo propaga logo ai draft card/logo esistenti', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...baseCustomer,
        documents: [
          { id: 'card_1', documentType: 'businessCard', title: 'Card', data: { front: { logoUrl: null } } },
          { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { builder: { backgroundImage: null }, autoGeneratePending: true } },
        ],
      },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-logo-upload')).toBeTruthy();
    });
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('crm-logo-upload'), { target: { files: [file] } });
    await waitFor(() => {
      expect(dataService.saveDocument).toHaveBeenCalledWith('admin@gmail.com', expect.objectContaining({ id: 'card_1', customerId: 'cust_1', data: expect.objectContaining({ front: expect.objectContaining({ logoUrl: expect.stringContaining('data:image/png;base64,') }) }) }));
    });
    await waitFor(() => {
      expect(dataService.saveDocument).toHaveBeenCalledWith('admin@gmail.com', expect.objectContaining({ id: 'logo_1', customerId: 'cust_1', data: expect.objectContaining({ builder: expect.objectContaining({ backgroundImage: expect.stringContaining('data:image/png;base64,') }) }) }));
    });
  });

  it('auto-build passa autoGenerate: true per marcare i draft pending', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-auto-build-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-auto-build-btn'));
    await waitFor(() => {
      expect(dataService.autoBuildCustomer).toHaveBeenCalledWith('cust_1', true);
    });
  });

  it('pulsante "Genera bozze AI" abilitato con draft pending, click chiama generateAll', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...baseCustomer,
        documents: [
          { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { builder: {}, autoGeneratePending: true } },
        ],
      },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-generate-drafts-btn')).toBeTruthy();
    });
    const btn = screen.getByTestId('crm-generate-drafts-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(autoGenMocks.generateAll).toHaveBeenCalledTimes(1);
    });
    expect(autoGenMocks.generateAll.mock.calls[0][0]).toHaveLength(1);
    expect(autoGenMocks.generateAll.mock.calls[0][2]).toEqual({ providerId: 'ollama-minimax-m3' });
  });

  it('pulsante "Genera bozze AI" disabilitato senza draft pending', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...baseCustomer,
        documents: [
          { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { builder: {}, autoGeneratePending: false } },
        ],
      },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-generate-drafts-btn')).toBeTruthy();
    });
    expect((screen.getByTestId('crm-generate-drafts-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('"Apri editor" disabilitato mentre il doc è in generazione', async () => {
    autoGenMocks.state.statuses = { logo_1: 'running' };
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...baseCustomer,
        documents: [
          { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { builder: {} } },
        ],
      },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-open-doc-logo_1')).toBeTruthy();
    });
    expect((screen.getByTestId('crm-open-doc-logo_1') as HTMLButtonElement).disabled).toBe(true);
  });

  it('badge status per doc e pulsante Rigenera chiama generateOne', async () => {
    autoGenMocks.state.statuses = { card_1: 'done', logo_1: 'error' };
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...baseCustomer,
        documents: [
          { id: 'card_1', documentType: 'businessCard', title: 'Card', data: { front: {} } },
          { id: 'logo_1', documentType: 'logo', title: 'Logo', data: { builder: {} } },
        ],
      },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-doc-gen-card_1').textContent).toContain('✓');
      expect(screen.getByTestId('crm-doc-gen-logo_1').textContent).toContain('✗');
    });
    fireEvent.click(screen.getByTestId('crm-regen-doc-card_1'));
    await waitFor(() => {
      expect(autoGenMocks.generateOne).toHaveBeenCalledTimes(1);
    });
    expect(autoGenMocks.generateOne.mock.calls[0][0].id).toBe('card_1');
    expect(autoGenMocks.generateOne.mock.calls[0][2]).toEqual({ providerId: 'ollama-minimax-m3' });
  });

  it('mostra thumbnail SVG inline per draft logo', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...baseCustomer,
        documents: [
          {
            id: 'logo_1', documentType: 'logo', title: 'Logo',
            data: {
              builder: {
                primaryText: 'Bar', tagline: '', iconType: 'none', iconShape: 'circle', iconGlyph: '',
                primaryColor: '#01696F', secondaryColor: '#1a1a2e', fontFamily: 'Inter', layout: 'horizontal',
                icons: [], backgroundImage: null, backgroundColor: null, gradientFill: false,
                decorativeElements: [], imagePrompt: null, textBackdrop: 'none', textColorMode: 'auto',
                textOffsetX: 0, textOffsetY: 0, textScale: 1, taglineOffsetX: 0, taglineOffsetY: 0, textPosition: 'overlay',
              },
            },
          },
        ],
      },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-doc-preview-logo_1')).toBeTruthy();
    });
    expect(screen.getByTestId('crm-doc-preview-logo_1').innerHTML).toContain('<svg');
  });

  it('log research: detail contiene knowledgeCount, logoStatus, conteggi colori/immagini', async () => {
    sessionStorage.clear();
    (dataService.researchCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        researchStatus: { web: 'ok', logo: 'detected' },
        knowledgeCount: 7,
        webData: { title: 'Bar Da Mario', colors: { primary: '#FF0000' }, images: ['https://x/1.png', 'https://x/2.png'] },
      },
    });
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-research-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-research-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Research completata/)).toBeTruthy();
    });
    const row = screen.getByText(/Research completata/).closest('.crm-ai-log-row');
    if (row) fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByTestId('crm-log-detail')).toBeTruthy();
    });
    const detail = screen.getByTestId('crm-log-detail').textContent || '';
    expect(detail).toContain('"knowledgeCount": 7');
    expect(detail).toContain('"logoStatus": "detected"');
    expect(detail).toContain('"colors": 1');
    expect(detail).toContain('"images": 2');
  });

  it('log research fallita: detail contiene researchStatus ed errore', async () => {
    sessionStorage.clear();
    (dataService.researchCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: 'Firecrawl down',
      data: { researchStatus: { web: 'error', logo: 'no_logo' } },
    });
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-research-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-research-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Research completata fallito/)).toBeTruthy();
    });
    const row = screen.getByText(/Research completata fallito/).closest('.crm-ai-log-row');
    if (row) fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByTestId('crm-log-detail')).toBeTruthy();
    });
    const detail = screen.getByTestId('crm-log-detail').textContent || '';
    expect(detail).toContain('"researchStatus"');
    expect(detail).toContain('"Firecrawl down"');
  });

  it('log logo caricato: base64 troncato a 60 char + (N bytes)', async () => {
    sessionStorage.clear();
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-logo-upload')).toBeTruthy();
    });
    const file = new File(['x'.repeat(300)], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('crm-logo-upload'), { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('Logo caricato')).toBeTruthy();
    });
    const row = screen.getByText('Logo caricato').closest('.crm-ai-log-row');
    if (row) fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByTestId('crm-log-detail')).toBeTruthy();
    });
    const detail = screen.getByTestId('crm-log-detail').textContent || '';
    expect(detail).toContain('…(');
    expect(detail).toContain('bytes)');
    expect(detail.length).toBeLessThan(200);
  });

  it('webData.colors come oggetto → swatch chips con label hex', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, webData: { title: 'Bar', colors: { primary: '#FF0000', secondary: '#00FF00' } } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-webdata-colors')).toBeTruthy();
    });
    expect(screen.getByTestId('crm-color-chip-#FF0000')).toBeTruthy();
    expect(screen.getByTestId('crm-color-chip-#00FF00')).toBeTruthy();
  });

  it('webData.colors come array → swatch chips', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, webData: { title: 'Bar', colors: ['#123456', '#ABCDEF'] } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-webdata-colors')).toBeTruthy();
    });
    expect(screen.getByTestId('crm-color-chip-#123456')).toBeTruthy();
    expect(screen.getByTestId('crm-color-chip-#ABCDEF')).toBeTruthy();
  });

  it('webData.images → griglia thumbnails max 12, lazy, link nuova scheda', async () => {
    const images = Array.from({ length: 14 }, (_, i) => `https://x/${i}.png`);
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, webData: { title: 'Bar', images } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-webdata-images')).toBeTruthy();
    });
    const grid = screen.getByTestId('crm-webdata-images');
    const imgs = grid.querySelectorAll('img');
    expect(imgs.length).toBe(12);
    expect(imgs[0].getAttribute('loading')).toBe('lazy');
    const link = grid.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('href')).toBe('https://x/0.png');
  });

  it('webData.screenshot → immagine visibile', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, webData: { title: 'Bar', screenshot: 'https://x/screenshot.png' } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-webdata-screenshot')).toBeTruthy();
    });
    expect(screen.getByTestId('crm-webdata-screenshot').querySelector('img')?.getAttribute('src')).toBe('https://x/screenshot.png');
  });

  it('webData.json → dati strutturati espandibili', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, webData: { title: 'Bar', json: { company_name: 'Acme' } } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-json-toggle')).toBeTruthy();
    });
    expect(screen.getByTestId('crm-json-full').textContent).toContain('Acme');
  });

  it('webData.links → lista link esterni', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, webData: { title: 'Bar', links: ['https://x/a', 'https://x/b'] } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-webdata-links')).toBeTruthy();
    });
    expect(screen.getByText('https://x/a')).toBeTruthy();
    expect(screen.getByText('https://x/b')).toBeTruthy();
  });

  it('markdownFull presente → toggle "Mostra tutto il markdown" con testo completo', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, webData: { title: 'Bar', markdownPreview: 'preview corta', markdownFull: '# Titolo\n\nTesto lungo del sito' } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-markdown-toggle')).toBeTruthy();
    });
    expect(screen.getByText(/Mostra tutto il markdown/)).toBeTruthy();
    expect(screen.getByTestId('crm-markdown-full').textContent).toContain('Testo lungo del sito');
    expect(screen.queryByTestId('crm-markdown-partial-note')).toBeNull();
  });

  it('markdownFull assente → preview + nota markdown non persistito', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, webData: { title: 'Bar', markdownPreview: 'Anteprima testo' } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-markdown-partial-note')).toBeTruthy();
    });
    expect(screen.getByText('Anteprima testo')).toBeTruthy();
    expect(screen.queryByTestId('crm-markdown-toggle')).toBeNull();
  });

  it('ai-fill con costUsd > 0 → badge sezione mostra costo reale', async () => {
    sessionStorage.clear();
    (dataService.aiFillCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { aiSuggestedFields: { mood: 'moderno' }, costUsd: 0.0123 },
    });
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, aiSuggestedFields: { mood: 'moderno' } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-ai-fields-badge').textContent).toBe('AI · $0');
    });
    fireEvent.click(screen.getByTestId('crm-ai-fill-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('crm-ai-fields-badge').textContent).toBe('AI · $0.0123');
    });
  });

  it('dopo research con logo no_logo ma logoUrl manuale → pill resta manual', async () => {
    sessionStorage.clear();
    (dataService.researchCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { researchStatus: { web: 'ok', logo: 'no_logo' }, knowledgeCount: 3, webData: {} },
    });
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, logoUrl: 'data:image/png;base64,abc', researchStatus: { web: 'ok', logo: 'no_logo' } },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-logo-status')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-research-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Research completata/)).toBeTruthy();
    });
    expect(screen.getByTestId('crm-logo-status').textContent).toBe('manual');
  });

  it('auto-build: log detail con created (tipi doc) e replaced', async () => {
    sessionStorage.clear();
    (dataService.autoBuildCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { customerId: 'cust_1', createdDocuments: ['logo_1', 'card_1'] },
    });
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...baseCustomer,
        documents: [
          { id: 'logo_1', documentType: 'logo', title: 'Logo', data: {} },
          { id: 'card_1', documentType: 'businessCard', title: 'Card', data: {} },
          { id: 'old_1', documentType: 'flyer', title: 'Flyer vecchio', data: {} },
        ],
      },
    });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-auto-build-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('crm-auto-build-btn'));
    await waitFor(() => {
      expect(screen.getByText(/Auto-build: draft creati/)).toBeTruthy();
    });
    const row = screen.getByText(/Auto-build: draft creati/).closest('.crm-ai-log-row');
    if (row) fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByTestId('crm-log-detail')).toBeTruthy();
    });
    const detail = screen.getByTestId('crm-log-detail').textContent || '';
    expect(detail).toContain('"logo"');
    expect(detail).toContain('"businessCard"');
    expect(detail).toContain('"replaced": 1');
  });
});