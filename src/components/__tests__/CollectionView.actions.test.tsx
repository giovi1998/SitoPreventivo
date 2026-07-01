import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext, AppContext } from '../../contexts';
import { seedDocumentsLocalStorage, makeDocument, buildContextValue, AUTH_VALUE } from './collectionTestUtils';
import CollectionViewForTest from '../CollectionView';
import dataService from '../../utils/dataService';

const originalLocation = window.location;

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname: 'localhost' },
    writable: true,
    configurable: true,
  });
  cleanup();
  vi.restoreAllMocks();
});

async function renderCollection(ctxOverrides: Record<string, any> = {}) {
  const ctx = buildContextValue(ctxOverrides);
  render(
    <AuthContext.Provider value={AUTH_VALUE as any}>
      <AppContext.Provider value={ctx as any}>
        <MemoryRouter>
          <CollectionViewForTest />
        </MemoryRouter>
      </AppContext.Provider>
    </AuthContext.Provider>,
  );
  await waitFor(() => {
    expect(screen.queryByText(/Caricamento documenti/i)).toBeNull();
  });
  return ctx;
}

describe('CollectionView, actions (phase 6, AC-007/008/009/010)', () => {
  it('"Apri" on a quote calls openDocument (AC-007)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'My quote' }),
    ]);
    const ctx = await renderCollection();
    fireEvent.click(screen.getByTestId('open-q1'));
    await waitFor(() => {
      expect(ctx.openDocument).toHaveBeenCalled();
    });
    const arg = ctx.openDocument.mock.calls[0][0];
    expect(arg.id).toBe('q1');
    expect(arg.documentType).toBe('quote');
  });

  it('"Apri" on a QR code dispatches to qr editor (AC-008)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'qr1', documentType: 'qrCode', title: 'My QR' }),
    ]);
    const ctx = await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /QR Code/ }));
    await waitFor(() => {
      expect(screen.getByTestId('open-qr1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('open-qr1'));
    await waitFor(() => {
      expect(ctx.openDocument).toHaveBeenCalled();
    });
    expect(ctx.openDocument.mock.calls[0][0].documentType).toBe('qrCode');
  });

  it('"Apri" on a business card dispatches to card editor', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'c1', documentType: 'businessCard', title: 'My card' }),
    ]);
    const ctx = await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Bigliettini/ }));
    await waitFor(() => {
      expect(screen.getByTestId('open-c1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('open-c1'));
    await waitFor(() => {
      expect(ctx.openDocument).toHaveBeenCalled();
    });
    expect(ctx.openDocument.mock.calls[0][0].documentType).toBe('businessCard');
  });

  it('"Apri" on a logo dispatches to logo editor', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'l1', documentType: 'logo', title: 'My logo' }),
    ]);
    const ctx = await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Loghi/ }));
    await waitFor(() => {
      expect(screen.getByTestId('open-l1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('open-l1'));
    await waitFor(() => {
      expect(ctx.openDocument).toHaveBeenCalled();
    });
    expect(ctx.openDocument.mock.calls[0][0].documentType).toBe('logo');
  });

  it('"Duplica" creates a new ID + " (copia)" title and opens it (AC-009)', async () => {
    const saveSpy = vi.spyOn(dataService, 'saveDocument').mockResolvedValue({ success: true, data: {} } as any);
    seedDocumentsLocalStorage([
      makeDocument({ id: 'c1', documentType: 'businessCard', title: 'My card' }),
    ]);
    const ctx = await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Bigliettini/ }));
    await waitFor(() => {
      expect(screen.getByTestId('duplicate-c1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('duplicate-c1'));
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalled();
    });
    const saved = saveSpy.mock.calls[0][1];
    expect(saved.id).not.toBe('c1');
    expect(saved.title).toBe('My card (copia)');
    expect(ctx.openDocument).toHaveBeenCalled();
    const opened = ctx.openDocument.mock.calls[0][0];
    expect(opened.id).toBe(saved.id);
    saveSpy.mockRestore();
  });

  it('"Elimina" shows confirm modal, then calls deleteDocument and refreshes (AC-010)', async () => {
    const deleteSpy = vi.spyOn(dataService, 'deleteDocument').mockResolvedValue({ success: true } as any);
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote' }),
      makeDocument({ id: 'q2', documentType: 'quote' }),
    ]);
    const ctx = await renderCollection();
    fireEvent.click(screen.getByTestId('delete-q1'));
    // confirm modal appears
    await waitFor(() => {
      expect(screen.getByText(/Stai per eliminare/i)).toBeInTheDocument();
    });
    // click the confirm button INSIDE the modal (.btn-remove)
    const confirmBtn = document.querySelector('.confirm-dialog .btn-remove') as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('q1', 'user@test.com');
    });
    expect(ctx.refreshDocuments).toHaveBeenCalled();
    deleteSpy.mockRestore();
  });

  it('"Elimina" cancel does NOT call deleteDocument', async () => {
    const deleteSpy = vi.spyOn(dataService, 'deleteDocument').mockResolvedValue({ success: true } as any);
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote' }),
    ]);
    await renderCollection();
    fireEvent.click(screen.getByTestId('delete-q1'));
    await waitFor(() => {
      expect(screen.getByText(/Stai per eliminare/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Annulla/ }));
    expect(deleteSpy).not.toHaveBeenCalled();
    deleteSpy.mockRestore();
  });
});
