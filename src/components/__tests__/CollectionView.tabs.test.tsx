import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthContext, AppContext } from '../../contexts';
import { seedDocumentsLocalStorage, makeDocument, buildContextValue, AUTH_VALUE, TAB_IDS, TAB_LABELS, type TabId } from './collectionTestUtils';

// Mock lazy-loaded QREditor / CardEditor / LogoEditor (the page wrappers handle them).
// We render CollectionView directly here.
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

// Lazy import so the location mock is in place before module init.
import CollectionViewForTest from '../CollectionView';

async function renderCollection(ctxOverrides: Record<string, any> = {}) {
  const ctx = buildContextValue(ctxOverrides);
  const utils = render(
    <AuthContext.Provider value={AUTH_VALUE as any}>
      <AppContext.Provider value={ctx as any}>
        <MemoryRouter>
          <CollectionViewForTest />
        </MemoryRouter>
      </AppContext.Provider>
    </AuthContext.Provider>,
  );
  // Wait for async data load to complete.
  await waitFor(() => {
    expect(screen.queryByText(/Caricamento documenti/i)).toBeNull();
  });
  return { ctx, ...utils };
}

describe('CollectionView — tabs (phase 6)', () => {
  it('renders all 6 tabs with labels in the order: Tutti, Preventivi, QR Code, Bigliettini, Volantini, Loghi', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection();
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    const labels = tabs.map((t) => t.textContent || '');
    expect(labels[0]).toMatch(/Tutti/);
    expect(labels[1]).toMatch(/Preventivi/);
    expect(labels[2]).toMatch(/QR Code/);
    expect(labels[3]).toMatch(/Bigliettini/);
    expect(labels[4]).toMatch(/Volantini/);
    expect(labels[5]).toMatch(/Loghi/);
  });

  it('"Tutti" is the default active tab', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection();
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    const allTab = within(tablist).getByRole('tab', { name: /Tutti/ });
    expect(allTab.getAttribute('aria-selected')).toBe('true');
  });

  it('clicking a tab marks it as selected and updates the active panel', async () => {
    seedDocumentsLocalStorage([makeDocument({ id: 'qr-1', documentType: 'qrCode' })]);
    await renderCollection();
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    const qrTab = within(tablist).getByRole('tab', { name: /QR Code/ });
    fireEvent.click(qrTab);
    expect(qrTab.getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(qrTab.id);
  });

  it('each tab shows a count badge with the number of documents of that type', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote' }),
      makeDocument({ id: 'q2', documentType: 'quote' }),
      makeDocument({ id: 'q3', documentType: 'quote' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode' }),
      makeDocument({ id: 'qr2', documentType: 'qrCode' }),
      makeDocument({ id: 'card1', documentType: 'businessCard' }),
    ]);
    await renderCollection();
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    // 3 quote + 2 qr + 1 card = 6 total
    expect(within(tablist).getByRole('tab', { name: /Tutti.*6/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /Preventivi.*3/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /QR Code.*2/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /Bigliettini.*1/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /Volantini.*0/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /Loghi.*0/ })).toBeInTheDocument();
  });

  it('clicking a per-type tab filters the panel to only that type (AC-003)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Preventivo' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode', title: 'QR uno' }),
      makeDocument({ id: 'card1', documentType: 'businessCard', title: 'Card uno' }),
    ]);
    await renderCollection();
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    fireEvent.click(within(tablist).getByRole('tab', { name: /QR Code/ }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('QR uno')).toBeInTheDocument();
    expect(within(panel).queryByText('Preventivo')).toBeNull();
    expect(within(panel).queryByText('Card uno')).toBeNull();
  });

  it('keyboard: Tab+Enter activates the focused tab (AC-014)', async () => {
    seedDocumentsLocalStorage([makeDocument({ id: 'qr1', documentType: 'qrCode' })]);
    await renderCollection();
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    const qrTab = within(tablist).getByRole('tab', { name: /QR Code/ });
    qrTab.focus();
    fireEvent.keyDown(qrTab, { key: 'Enter', code: 'Enter' });
    expect(qrTab.getAttribute('aria-selected')).toBe('true');
  });

  it('free user sees a "Free" tier badge on documents (AC-012)', async () => {
    seedDocumentsLocalStorage([makeDocument({ id: 'q1', documentType: 'quote', title: 'Mio preventivo' })]);
    await renderCollection({ tier: 'free' });
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText(/Free/)).toBeInTheDocument();
  });

  it('unlocked user: no "Free" badge (or "Pro" subtle badge)', async () => {
    seedDocumentsLocalStorage([makeDocument({ id: 'q1', documentType: 'quote', title: 'Mio preventivo' })]);
    await renderCollection({ tier: 'unlocked' });
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).queryByText(/^Free$/)).toBeNull();
  });

  it('all 6 tabs have proper role="tab" and id (PAT-001)', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection();
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    const tabs = within(tablist).getAllByRole('tab');
    for (const t of tabs) {
      expect(t.id).toMatch(/^tab-/);
      expect(t.getAttribute('aria-controls')).toMatch(/^panel-/);
    }
  });
});
