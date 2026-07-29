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

vi.mock('../../utils/dataService', () => ({
  default: {
    getCustomer: vi.fn(),
    researchCustomer: vi.fn().mockResolvedValue({ data: {} }),
    aiFillCustomer: vi.fn().mockResolvedValue({ data: {} }),
    autoBuildCustomer: vi.fn().mockResolvedValue({ data: {} }),
    updateCustomer: vi.fn().mockResolvedValue({ data: {} }),
    saveDocument: vi.fn().mockResolvedValue({ data: {} }),
    getUserSettings: vi.fn().mockResolvedValue({ userEmail: 'admin@gmail.com', placesApiKey: '' }),
    saveUserSettings: vi.fn().mockResolvedValue({ success: true }),
  },
}));

beforeEach(() => {
  cleanup();
  mocks.navigate.mockReset();
  (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockReset();
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

  it('mostra NAP quando placeData popolato', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { ...baseCustomer, placeData: { name: 'Bar Da Mario', formatted_address: 'Via Roma 1', rating: 4.5 } },
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

  it('mostra provider selector per palette AI', async () => {
    (dataService.getCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: baseCustomer });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('crm-palette-provider')).toBeTruthy();
    });
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
    fireEvent.change(select, { target: { value: 'gemini-2.0-flash-preview-image-generation' } });
    await waitFor(() => {
      expect(dataService.saveUserSettings).toHaveBeenCalledWith('admin@gmail.com', expect.objectContaining({ imageGenModel: 'gemini-2.0-flash-preview-image-generation' }));
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
      expect(dataService.saveDocument).toHaveBeenCalledWith('admin@gmail.com', expect.objectContaining({ id: 'card_1', data: expect.objectContaining({ front: expect.objectContaining({ logoUrl: expect.stringContaining('data:image/png;base64,') }) }) }));
    });
    await waitFor(() => {
      expect(dataService.saveDocument).toHaveBeenCalledWith('admin@gmail.com', expect.objectContaining({ id: 'logo_1', data: expect.objectContaining({ builder: expect.objectContaining({ backgroundImage: expect.stringContaining('data:image/png;base64,') }) }) }));
    });
  });
});