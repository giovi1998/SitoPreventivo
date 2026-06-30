import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
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

describe('CollectionView — filters (phase 6, AC-005/AC-006)', () => {
  it('status filter is only visible on the "Preventivi" tab', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', status: 'BOZZA' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode' }),
    ]);
    await renderCollection();
    // Preventivi active by default? No, "Tutti" is default. Click Preventivi.
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Preventivi/ }));
    await waitFor(() => {
      expect(screen.getByTestId('collection-status')).toBeInTheDocument();
    });
    // Switch to QR Code — status filter disappears
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /QR Code/ }));
    await waitFor(() => {
      expect(screen.queryByTestId('collection-status')).toBeNull();
    });
  });

  it('status filter "ACCETTATO" hides quotes with other statuses (AC-005)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', status: 'BOZZA' }),
      makeDocument({ id: 'q2', documentType: 'quote', status: 'ACCETTATO' }),
      makeDocument({ id: 'q3', documentType: 'quote', status: 'RIFIUTATO' }),
    ]);
    await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Preventivi/ }));
    const statusSel = await screen.findByTestId('collection-status');
    fireEvent.change(statusSel, { target: { value: 'ACCETTATO' } });
    await waitFor(() => {
      expect(screen.getByTestId('card-q2')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('card-q1')).toBeNull();
    expect(screen.queryByTestId('card-q3')).toBeNull();
  });

  it('date filter "week" hides documents older than 7 days', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    seedDocumentsLocalStorage([
      makeDocument({ id: 'r1', documentType: 'quote', createdAt: recent }),
      makeDocument({ id: 'o1', documentType: 'quote', createdAt: old }),
    ]);
    await renderCollection();
    const dateSel = screen.getByTestId('collection-date');
    fireEvent.change(dateSel, { target: { value: 'week' } });
    await waitFor(() => {
      expect(screen.getByTestId('card-r1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('card-o1')).toBeNull();
  });

  it('date filter "month" hides documents older than 30 days', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    seedDocumentsLocalStorage([
      makeDocument({ id: 'r1', documentType: 'quote', createdAt: recent }),
      makeDocument({ id: 'o1', documentType: 'quote', createdAt: old }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-date'), { target: { value: 'month' } });
    await waitFor(() => {
      expect(screen.getByTestId('card-r1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('card-o1')).toBeNull();
  });

  it('date filter "all" shows everything', async () => {
    const now = new Date();
    const veryOld = new Date(now.getTime() - 800 * 24 * 60 * 60 * 1000).toISOString();
    seedDocumentsLocalStorage([
      makeDocument({ id: 'r1', documentType: 'quote', createdAt: now.toISOString() }),
      makeDocument({ id: 'o1', documentType: 'quote', createdAt: veryOld }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-date'), { target: { value: 'all' } });
    expect(screen.getByTestId('card-r1')).toBeInTheDocument();
    expect(screen.getByTestId('card-o1')).toBeInTheDocument();
  });

  it('sort "title" orders A-Z (AC-006)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Zeta' }),
      makeDocument({ id: 'q2', documentType: 'quote', title: 'Alpha' }),
      makeDocument({ id: 'q3', documentType: 'quote', title: 'Mike' }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-sort'), { target: { value: 'title' } });
    await waitFor(() => {
      const cards = Array.from(document.querySelectorAll('.collection-card')) as HTMLElement[];
      const titles = cards.map((c) => c.querySelector('.card-title')?.textContent || '');
      // Strip "…" from end
      const clean = titles.map((t) => t.replace(/…$/, ''));
      expect(clean[0]).toMatch(/^Alpha/);
    });
  });

  it('sort "type" groups by documentType', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode' }),
      makeDocument({ id: 'l1', documentType: 'logo' }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-sort'), { target: { value: 'type' } });
    await waitFor(() => {
      const cards = Array.from(document.querySelectorAll('.collection-card')) as HTMLElement[];
      const types = cards.map((c) => c.getAttribute('data-type'));
      // alphabetical: businessCard < flyer < logo < qrCode < quote
      expect(types).toEqual(['logo', 'qrCode', 'quote']);
    });
  });

  it('sort "created" orders by createdAt desc (newest first)', async () => {
    const old = new Date('2024-01-01').toISOString();
    const mid = new Date('2024-06-01').toISOString();
    const recent = new Date('2024-12-01').toISOString();
    seedDocumentsLocalStorage([
      makeDocument({ id: 'old1', documentType: 'quote', createdAt: old }),
      makeDocument({ id: 'mid1', documentType: 'quote', createdAt: mid }),
      makeDocument({ id: 'recent1', documentType: 'quote', createdAt: recent }),
    ]);
    await renderCollection();
    fireEvent.change(screen.getByTestId('collection-sort'), { target: { value: 'created' } });
    await waitFor(() => {
      const cards = Array.from(document.querySelectorAll('.collection-card')) as HTMLElement[];
      const ids = cards.map((c) => c.getAttribute('data-testid'));
      expect(ids[0]).toBe('card-recent1');
      expect(ids[1]).toBe('card-mid1');
      expect(ids[2]).toBe('card-old1');
    });
  });
});
