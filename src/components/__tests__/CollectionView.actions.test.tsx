import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import { TestRouter } from '../../test/TestRouter';
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
        <TestRouter>
          <CollectionViewForTest />
        </TestRouter>
      </AppContext.Provider>
    </AuthContext.Provider>,
  );
  await waitFor(() => {
    expect(screen.queryByText(/Caricamento documenti/i)).toBeNull();
  });
  return ctx;
}

describe('CollectionView, actions (phase 6, AC-007/008/009/010)', () => {
  it('"Elimina" shows confirm modal, then calls deleteDocument and refreshes (AC-010)', async () => {
    // Phase 7: quotes are admin-only, so we use a businessCard as
    // the test document. The action under test (deleteDocument call
    // after confirm) is the same regardless of document type.
    const deleteSpy = vi.spyOn(dataService, 'deleteDocument').mockResolvedValue({ success: true } as any);
    seedDocumentsLocalStorage([
      makeDocument({ id: 'c1', documentType: 'businessCard' }),
      makeDocument({ id: 'c2', documentType: 'businessCard' }),
    ]);
    const ctx = await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Bigliettini/ }));
    await waitFor(() => {
      expect(screen.getByTestId('delete-c1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('delete-c1'));
    // confirm modal appears
    await waitFor(() => {
      expect(screen.getByText(/Stai per eliminare/i)).toBeInTheDocument();
    });
    // click the confirm button INSIDE the modal (.btn-remove)
    const confirmBtn = document.querySelector('.confirm-dialog .btn-remove') as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('c1', 'user@test.com');
    });
    expect(ctx.refreshDocuments).toHaveBeenCalled();
    deleteSpy.mockRestore();
  });

  it('"Elimina" cancel does NOT call deleteDocument', async () => {
    const deleteSpy = vi.spyOn(dataService, 'deleteDocument').mockResolvedValue({ success: true } as any);
    seedDocumentsLocalStorage([
      makeDocument({ id: 'c1', documentType: 'businessCard' }),
    ]);
    const ctx = await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Bigliettini/ }));
    await waitFor(() => {
      expect(screen.getByTestId('delete-c1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('delete-c1'));
    await waitFor(() => {
      expect(screen.getByText(/Stai per eliminare/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Annulla/ }));
    expect(deleteSpy).not.toHaveBeenCalled();
    deleteSpy.mockRestore();
  });
});
