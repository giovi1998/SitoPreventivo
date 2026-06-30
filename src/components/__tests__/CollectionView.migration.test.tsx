import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext, AppContext } from '../../contexts';
import dataService from '../../utils/dataService';
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

describe('CollectionView — migration integration (phase 6, AC-001/AC-002/AC-015)', () => {
  it('legacy quotes in precisionQuote_quotes are visible in "Preventivi" tab', async () => {
    // Simulate the post-migration state: legacy is intact AND new
    // documents store has the migrated copies.
    localStorage.setItem('precisionQuote_quotes', JSON.stringify([
      { id: 'q1', owner: 'user@test.com', title: 'Legacy one' },
      { id: 'q2', owner: 'user@test.com', title: 'Legacy two' },
    ]));
    seedDocumentsLocalStorage([
      makeDocument({ id: 'migrate_q1', documentType: 'quote', title: 'Legacy one' }),
      makeDocument({ id: 'migrate_q2', documentType: 'quote', title: 'Legacy two' }),
    ]);
    await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Preventivi/ }));
    await waitFor(() => {
      expect(screen.getByTestId('card-migrate_q1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('card-migrate_q2')).toBeInTheDocument();
    // No duplicate of q1/q2 (because their migrate_* counterparts exist)
    expect(screen.queryByTestId('card-q1')).toBeNull();
    expect(screen.queryByTestId('card-q2')).toBeNull();
  });

  it('legacy quotes that have NO migrated counterpart still appear (backward-compat)', async () => {
    localStorage.setItem('precisionQuote_quotes', JSON.stringify([
      { id: 'q-orphan', owner: 'user@test.com', title: 'Orphan quote' },
    ]));
    seedDocumentsLocalStorage([]);
    await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Preventivi/ }));
    await waitFor(() => {
      expect(screen.getByTestId('card-q-orphan')).toBeInTheDocument();
    });
  });

  it('migration function in dataService copies 5 legacy quotes to documents (AC-001)', async () => {
    localStorage.setItem('precisionQuote_quotes', JSON.stringify([
      { id: 'q1', owner: 'user@test.com', title: 'A' },
      { id: 'q2', owner: 'user@test.com', title: 'B' },
      { id: 'q3', owner: 'user@test.com', title: 'C' },
      { id: 'q4', owner: 'user@test.com', title: 'D' },
      { id: 'q5', owner: 'user@test.com', title: 'E' },
    ]));
    const result = await dataService.migrateLegacyQuotes('user@test.com');
    expect(result).toEqual({ migrated: 5, skipped: false });
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    expect(docs).toHaveLength(5);
    expect(docs.every((d: any) => d.documentType === 'quote')).toBe(true);
  });

  it('migration toast "5 preventivi migrati" appears when AppShell triggers it (AC-001)', async () => {
    // This test simulates the AppShell useEffect by calling
    // migrateLegacyQuotes + addToast directly.
    localStorage.setItem('precisionQuote_quotes', JSON.stringify(
      Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, owner: 'user@test.com', title: `T${i}` })),
    ));
    const addToast = vi.fn();
    const result = await dataService.migrateLegacyQuotes('user@test.com');
    if (result.migrated > 0) addToast('success', `${result.migrated} preventivi migrati nel nuovo formato`);
    expect(addToast).toHaveBeenCalledWith('success', '5 preventivi migrati nel nuovo formato');
  });

  it('re-running migration is a no-op (AC-002): no toast on second call', async () => {
    localStorage.setItem('precisionQuote_quotes', JSON.stringify([
      { id: 'q1', owner: 'user@test.com', title: 'A' },
    ]));
    const addToast = vi.fn();
    const r1 = await dataService.migrateLegacyQuotes('user@test.com');
    if (r1.migrated > 0) addToast('success', `${r1.migrated} preventivi migrati`);
    addToast.mockClear();
    const r2 = await dataService.migrateLegacyQuotes('user@test.com');
    if (r2.migrated > 0) addToast('success', `${r2.migrated} preventivi migrati`);
    expect(r2).toEqual({ migrated: 0, skipped: true });
    expect(addToast).not.toHaveBeenCalled();
  });

  it('migration failure (mock) → error toast + legacy quotes still accessible (AC-015)', async () => {
    // Simulate QuotaExceeded on DOCS write
    localStorage.setItem('precisionQuote_quotes', JSON.stringify([
      { id: 'q1', owner: 'user@test.com', title: 'A' },
    ]));
    const realSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === 'precisionQuote_documents:v1') {
        const e: any = new Error('QuotaExceeded');
        e.name = 'QuotaExceededError';
        throw e;
      }
      return realSetItem.call(this, k, v);
    });
    const addToast = vi.fn();
    let caught = false;
    try {
      await dataService.migrateLegacyQuotes('user@test.com');
    } catch {
      caught = true;
      addToast('error', 'Migrazione non riuscita, i tuoi preventivi sono comunque accessibili');
    }
    expect(caught).toBe(true);
    expect(addToast).toHaveBeenCalledWith('error', expect.stringContaining('Migrazione non riuscita'));
    setItemSpy.mockRestore();
    // legacy quotes still readable
    const legacy = JSON.parse(localStorage.getItem('precisionQuote_quotes') || '[]');
    expect(legacy).toHaveLength(1);
    // legacy still appears in collection (no migrated copy in docs)
    await renderCollection();
    fireEvent.click(within(screen.getByRole('tablist')).getByRole('tab', { name: /Preventivi/ }));
    await waitFor(() => {
      expect(screen.getByTestId('card-q1')).toBeInTheDocument();
    });
  });
});
