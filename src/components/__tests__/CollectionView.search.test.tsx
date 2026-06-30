import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext, AppContext } from '../../contexts';
import { seedDocumentsLocalStorage, makeDocument, buildContextValue, AUTH_VALUE } from './collectionTestUtils';
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

describe('CollectionView — search (phase 6, AC-004)', () => {
  it('matches a quote by client.name (cross-tipo via search)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Sito web', client: { name: 'Acme Corp' } }),
      makeDocument({ id: 'q2', documentType: 'quote', title: 'Altro', client: { name: 'Beta' } }),
    ]);
    await renderCollection();
    const input = screen.getByTestId('collection-search');
    fireEvent.change(input, { target: { value: 'Acme' } });
    // wait for debounce 200ms
    await new Promise((r) => setTimeout(r, 250));
    await waitFor(() => {
      expect(screen.getByTestId('card-q1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('card-q2')).toBeNull();
  });

  it('matches a business card by front.name', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'c1', documentType: 'businessCard', title: 'Card 1',
        front: { name: 'Mario Rossi', title: '', company: 'Acme' },
      }),
      makeDocument({
        id: 'c2', documentType: 'businessCard', title: 'Card 2',
        front: { name: 'Luca Bianchi', title: '', company: 'Beta' },
      }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-search'), { target: { value: 'Mario' } });
    await new Promise((r) => setTimeout(r, 250));
    await waitFor(() => {
      expect(screen.getByTestId('card-c1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('card-c2')).toBeNull();
  });

  it('matches a QR code by data.payload', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'qr1', documentType: 'qrCode', title: 'QR uno',
        data: { type: 'url', payload: 'https://acme.example' },
      }),
      makeDocument({
        id: 'qr2', documentType: 'qrCode', title: 'QR due',
        data: { type: 'url', payload: 'https://other.example' },
      }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-search'), { target: { value: 'acme' } });
    await new Promise((r) => setTimeout(r, 250));
    await waitFor(() => {
      expect(screen.getByTestId('card-qr1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('card-qr2')).toBeNull();
  });

  it('matches a logo by builder.primaryText', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'l1', documentType: 'logo', title: 'Logo Acme',
        builder: { primaryText: 'Acme Inc' },
      }),
      makeDocument({
        id: 'l2', documentType: 'logo', title: 'Logo Beta',
        builder: { primaryText: 'Beta LLC' },
      }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-search'), { target: { value: 'Acme' } });
    await new Promise((r) => setTimeout(r, 250));
    await waitFor(() => {
      expect(screen.getByTestId('card-l1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('card-l2')).toBeNull();
  });

  it('matches a quote by title', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Acme Sito Web' }),
      makeDocument({ id: 'q2', documentType: 'quote', title: 'Beta Logo' }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-search'), { target: { value: 'Acme' } });
    await new Promise((r) => setTimeout(r, 250));
    await waitFor(() => {
      expect(screen.getByTestId('card-q1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('card-q2')).toBeNull();
  });

  it('empty search returns all documents (no filter applied)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode' }),
    ]);
    await renderCollection();
    expect(screen.getByTestId('card-q1')).toBeInTheDocument();
    expect(screen.getByTestId('card-qr1')).toBeInTheDocument();
  });

  it('search with no matches shows empty-search state (not error)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Alpha' }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-search'), { target: { value: 'XYZNOMATCH' } });
    await new Promise((r) => setTimeout(r, 250));
    await waitFor(() => {
      expect(screen.getByTestId('empty-search')).toBeInTheDocument();
    });
  });

  it('search is debounced by 200ms (typing fast does not filter mid-stream)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Acme' }),
      makeDocument({ id: 'q2', documentType: 'quote', title: 'Beta' }),
    ]);
    await renderCollection();
    const input = screen.getByTestId('collection-search');
    // type fast — intermediate value shouldn't be applied until 200ms passes
    fireEvent.change(input, { target: { value: 'B' } });
    expect(screen.queryByTestId('card-q1')).toBeInTheDocument();
    // after 250ms, filter applies
    await new Promise((r) => setTimeout(r, 250));
    await waitFor(() => {
      expect(screen.queryByTestId('card-q1')).toBeNull();
    });
    expect(screen.getByTestId('card-q2')).toBeInTheDocument();
  });

  it('search matches across document types in "Tutti" tab', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Acme Sito' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode', title: 'QR Acme', data: { type: 'url', payload: 'https://acme' } }),
      makeDocument({ id: 'l1', documentType: 'logo', title: 'Logo', builder: { primaryText: 'Acme Brand' } }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-search'), { target: { value: 'Acme' } });
    await new Promise((r) => setTimeout(r, 250));
    await waitFor(() => {
      expect(screen.getByTestId('card-q1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('card-qr1')).toBeInTheDocument();
    expect(screen.getByTestId('card-l1')).toBeInTheDocument();
  });
});
