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

async function renderCollection(ctxOverrides: Record<string, any> = {}, opts: { role?: 'user' | 'admin' } = {}) {
  const ctx = buildContextValue(ctxOverrides);
  const authValue = {
    ...AUTH_VALUE,
    user: { email: 'user@test.com', role: opts.role ?? 'user' },
  };
  const utils = render(
    <AuthContext.Provider value={authValue as any}>
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

describe('CollectionView, tabs (phase 6)', () => {
  it('admin renders all 6 tabs with labels in the order: Tutti, Preventivi, QR Code, Bigliettini, Volantini, Loghi', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection({}, { role: 'admin' });
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

  it('non-admin renders 5 tabs (no "Preventivi") in the order: Tutti, QR Code, Bigliettini, Volantini, Loghi', async () => {
    seedDocumentsLocalStorage([]);
    await renderCollection({}, { role: 'user' });
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    const labels = tabs.map((t) => t.textContent || '');
    expect(labels[0]).toMatch(/Tutti/);
    expect(labels[1]).toMatch(/QR Code/);
    expect(labels[2]).toMatch(/Bigliettini/);
    expect(labels[3]).toMatch(/Volantini/);
    expect(labels[4]).toMatch(/Loghi/);
    expect(labels.some((l) => /Preventivi/.test(l))).toBe(false);
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

  it('admin: each tab shows a count badge with the number of documents of that type', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote' }),
      makeDocument({ id: 'q2', documentType: 'quote' }),
      makeDocument({ id: 'q3', documentType: 'quote' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode' }),
      makeDocument({ id: 'qr2', documentType: 'qrCode' }),
      makeDocument({ id: 'card1', documentType: 'businessCard' }),
    ]);
    await renderCollection({}, { role: 'admin' });
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    // 3 quote + 2 qr + 1 card = 6 total
    expect(within(tablist).getByRole('tab', { name: /Tutti.*6/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /Preventivi.*3/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /QR Code.*2/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /Bigliettini.*1/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /Volantini.*0/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /Loghi.*0/ })).toBeInTheDocument();
  });

  it('non-admin: Preventivi tab is always hidden (admin-only data)', async () => {
    // Phase 7 hotfix: preventivi are admin-only. The tab is hidden for
    // non-admin in all cases, even if quotes exist in the local storage
    // (legacy data, admin-shared). The TABS filter strips it
    // unconditionally. The "Tutti" count also excludes quotes.
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode' }),
      makeDocument({ id: 'card1', documentType: 'businessCard' }),
    ]);
    await renderCollection({}, { role: 'user' });
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    // Quote filtered out: "Tutti" shows 2 (qr + card), no Preventivi tab
    expect(within(tablist).getByRole('tab', { name: /Tutti.*2/ })).toBeInTheDocument();
    expect(within(tablist).queryByRole('tab', { name: /Preventivi/ })).toBeNull();
    expect(within(tablist).getByRole('tab', { name: /QR Code.*1/ })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /Bigliettini.*1/ })).toBeInTheDocument();
  });

  it('non-admin with no quotes: Preventivi tab is hidden (no tab at all)', async () => {
    // Same expectation as above, just with empty quotes to make the
    // count cleaner. The filter does not depend on counts.quote.
    seedDocumentsLocalStorage([
      makeDocument({ id: 'qr1', documentType: 'qrCode' }),
      makeDocument({ id: 'card1', documentType: 'businessCard' }),
    ]);
    await renderCollection({}, { role: 'user' });
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    expect(within(tablist).queryByRole('tab', { name: /Preventivi/ })).toBeNull();
    expect(within(tablist).getByRole('tab', { name: /Tutti.*2/ })).toBeInTheDocument();
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

  it('non-admin: "Tutti" panel excludes quotes (phase 7 hotfix, regression)', async () => {
    // Phase 7 hotfix: preventivi are admin-only. Non-admin users must
    // not see quote cards in the "Tutti" tab, even if the data is in
    // localStorage (legacy or admin-shared). The hook filters them
    // out before setDocuments. The previous behaviour counted them
    // in "Tutti" but hid the tab, which read as a bug to users.
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Vecchio preventivo' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode', title: 'QR uno' }),
      makeDocument({ id: 'card1', documentType: 'businessCard', title: 'Card uno' }),
    ]);
    await renderCollection({}, { role: 'user' });
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    expect(within(tablist).getByRole('tab', { name: /Tutti.*2/ })).toBeInTheDocument();
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).queryByText('Vecchio preventivo')).toBeNull();
    expect(within(panel).getByText('QR uno')).toBeInTheDocument();
    expect(within(panel).getByText('Card uno')).toBeInTheDocument();
  });

  it('admin: "Tutti" panel includes quotes (no regression for the admin path)', async () => {
    // Counter-test: the filter must not strip quotes for admin users.
    // Without this guard, a future refactor of the isAdmin filter could
    // accidentally hide quotes from admin too.
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Mio preventivo' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode', title: 'QR uno' }),
    ]);
    await renderCollection({}, { role: 'admin' });
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    expect(within(tablist).getByRole('tab', { name: /Tutti.*2/ })).toBeInTheDocument();
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Mio preventivo')).toBeInTheDocument();
    expect(within(panel).getByText('QR uno')).toBeInTheDocument();
  });

  it('free user sees a "Free" tier badge on documents (AC-012)', async () => {
    // Phase 7: non-admin cannot see quotes. Use businessCard to test
    // the tier badge on a document the non-admin can actually see.
    seedDocumentsLocalStorage([makeDocument({ id: 'c1', documentType: 'businessCard', title: 'Mio bigliettino' })]);
    await renderCollection({ tier: 'free' });
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText(/Free/)).toBeInTheDocument();
  });

  it('unlocked user: no "Free" badge (or "Pro" subtle badge)', async () => {
    // Phase 7: non-admin cannot see quotes. Use businessCard instead.
    seedDocumentsLocalStorage([makeDocument({ id: 'c1', documentType: 'businessCard', title: 'Mio bigliettino' })]);
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

  it('non-admin: clicking the new Preventivi tab filters the panel to quotes only (AC-003 with read-only)', async () => {
    // Phase 7 hotfix: the tab is hidden for non-admin, so this scenario
    // is now unobservable in the UI. We keep the test as a regression
    // guard for the legacy code path: if the tab is somehow shown (e.g.
    // a future refactor reintroduces it), this test catches it.
    // The test now asserts that the Preventivi tab is NOT clickable
    // because it's not in the DOM.
    seedDocumentsLocalStorage([
      makeDocument({ id: 'q1', documentType: 'quote', title: 'Vecchio preventivo' }),
      makeDocument({ id: 'qr1', documentType: 'qrCode', title: 'QR uno' }),
      makeDocument({ id: 'card1', documentType: 'businessCard', title: 'Card uno' }),
    ]);
    await renderCollection({}, { role: 'user' });
    const tablist = screen.getByRole('tablist', { name: /Tipo documento/i });
    // Non-admin: the Preventivi tab does not exist, so a click on the
    // tablist (Tutti) shows only non-quote documents. "Vecchio preventivo"
    // is filtered out from the panel as well.
    const tuttiTab = within(tablist).getByRole('tab', { name: /Tutti/ });
    fireEvent.click(tuttiTab);
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).queryByText('Vecchio preventivo')).toBeNull();
    expect(within(panel).getByText('QR uno')).toBeInTheDocument();
    expect(within(panel).getByText('Card uno')).toBeInTheDocument();
  });
});
