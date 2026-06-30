import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext, AppContext } from '../../contexts';
import { seedDocumentsLocalStorage, buildContextValue, AUTH_VALUE } from './collectionTestUtils';
import CollectionViewForTest from '../CollectionView';

const originalLocation = window.location;

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname: 'localhost' },
    writable: true,
    configurable: true,
  });
  cleanup();
});

async function renderCollection() {
  const ctx = buildContextValue();
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

describe('CollectionView — empty states (phase 6, AC-011)', () => {
  it('empty "Tutti" tab shows "Nessun documento" with CTA (AC-006/AC-011)', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection();
    expect(screen.getByTestId('empty-tab')).toBeInTheDocument();
    expect(screen.getByText(/Nessun documento ancora/i)).toBeInTheDocument();
    // CTA navigates to editor
    const cta = screen.getByRole('button', { name: /Crea un preventivo/i });
    expect(cta).toBeInTheDocument();
  });

  it('empty "Preventivi" tab shows "Nessun preventivo ancora"', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Preventivi/ }));
    expect(await screen.findByText(/Nessun preventivo ancora/i)).toBeInTheDocument();
  });

  it('empty "QR Code" tab shows "Nessun QR Code ancora"', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /QR Code/ }));
    expect(await screen.findByText(/Nessun QR Code ancora/i)).toBeInTheDocument();
  });

  it('empty "Bigliettini" tab shows "Nessun bigliettino ancora"', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Bigliettini/ }));
    expect(await screen.findByText(/Nessun bigliettino ancora/i)).toBeInTheDocument();
  });

  it('empty "Loghi" tab shows "Nessun logo ancora" with CTA (AC-011)', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Loghi/ }));
    expect(await screen.findByText(/Nessun logo ancora/i)).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: /Crea un logo/i });
    expect(cta).toBeInTheDocument();
  });

  it('empty "Volantini" tab shows message but CTA is disabled (fase 3 skipped)', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Volantini/ }));
    expect(await screen.findByText(/Nessun volantino ancora/i)).toBeInTheDocument();
    const cta = screen.getByRole('button', { name: /Volantini non sono ancora disponibili/i });
    expect(cta).toBeDisabled();
  });

  it('search with no match shows "Nessun risultato" (not the empty-tab CTA)', async () => {
    seedDocumentsLocalStorage([
      { id: 'q1', documentType: 'quote', title: 'Foo', userEmail: 'user@test.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-search'), { target: { value: 'NOMATCH' } });
    await new Promise((r) => setTimeout(r, 250));
    expect(await screen.findByTestId('empty-search')).toBeInTheDocument();
    expect(screen.getByText(/Nessun risultato corrisponde/i)).toBeInTheDocument();
  });
});
