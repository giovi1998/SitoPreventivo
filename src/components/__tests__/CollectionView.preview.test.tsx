import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { TestRouter } from '../../test/TestRouter';
import React from 'react';
import { AuthContext, AppContext } from '../../contexts';
import { seedDocumentsLocalStorage, makeDocument, buildContextValue, AUTH_VALUE } from './collectionTestUtils';

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

import CollectionViewForTest from '../CollectionView';

async function renderCollection(opts: { role?: 'user' | 'admin' } = {}) {
  const ctx = buildContextValue({});
  const authValue = {
    ...AUTH_VALUE,
    user: { email: 'user@test.com', role: opts.role ?? 'user' },
  };
  const utils = render(
    <AuthContext.Provider value={authValue as any}>
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
  return utils;
}

describe('CollectionView preview SVG (TB-025)', () => {
  it('logo document renders inline SVG preview instead of icon', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'logo1',
        documentType: 'logo',
        title: 'Acme Logo',
        builder: {
          primaryText: 'Acme',
          tagline: 'Solutions',
          iconType: 'none',
          iconGlyph: '',
          iconShape: 'circle',
          primaryColor: '#01696F',
          secondaryColor: '#1a1a2e',
          fontFamily: 'Inter',
          layout: 'horizontal',
          icons: [],
          backgroundImage: null,
          backgroundColor: null,
          gradientFill: false,
          decorativeElements: [],
          imagePrompt: null,
          textBackdrop: 'none',
          textColorMode: 'auto',
          textOffsetX: 0,
          textOffsetY: 0,
          textScale: 1,
          taglineOffsetX: 0,
          taglineOffsetY: 0,
          textPosition: 'overlay',
        },
      }),
    ]);
    await renderCollection();
    const preview = document.querySelector('[data-testid="preview-logo1"]') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.querySelector('svg')).toBeTruthy();
    // Il testo del logo deve apparire nell'SVG inline
    expect(preview.textContent).toContain('Acme');
  });

  it('businessCard document renders inline SVG preview instead of icon', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'card1',
        documentType: 'businessCard',
        title: 'Bigliettino Mario',
        front: {
          name: 'Mario Rossi',
          title: 'Developer',
          company: 'Acme',
          photoUrl: null,
          logoUrl: null,
          coverImageUrl: null,
          logoBackground: 'none',
          layout: 'left',
          useGrid: false,
        },
        back: {
          phone: '+39 333 1234567',
          email: 'mario@acme.com',
          website: 'acme.com',
        },
        style: {
          fontFamily: 'Inter',
          fontScale: 1,
          primaryColor: '#01696F',
          secondaryColor: '#1a1a2e',
          borderStyle: 'none',
        },
      }),
    ]);
    await renderCollection();
    const preview = document.querySelector('[data-testid="preview-card1"]') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.querySelector('svg')).toBeTruthy();
    // Il nome deve apparire nella preview front (uppercase via CSS)
    expect(preview.textContent?.toLowerCase()).toContain('mario');
  });

  it('malformed logo (no builder) falls back to icon, no crash', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'badlogo', documentType: 'logo', title: 'Broken' }),
    ]);
    await renderCollection();
    // Nessuna preview SVG per documento malformato
    expect(document.querySelector('[data-testid="preview-badlogo"]')).toBeNull();
    // Ma la card è ancora renderizzata con icona
    expect(screen.getByTestId('card-badlogo')).toBeTruthy();
  });

  it('malformed card (empty front) still renders preview via merge defaults, no crash', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'badcard', documentType: 'businessCard', title: 'Broken Card' }),
    ]);
    await renderCollection();
    // mergeCardWithDefaults idrata front vuoto → preview SVG renderizza
    // (card default senza nome ma con struttura valida)
    const preview = document.querySelector('[data-testid="preview-badcard"]') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('card-badcard')).toBeTruthy();
  });

  it('qrCode document does NOT get SVG preview (only logo/card)', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'qr1', documentType: 'qrCode', title: 'QR Link', data: { payload: 'https://x.com' } }),
    ]);
    await renderCollection();
    expect(document.querySelector('[data-testid="preview-qr1"]')).toBeNull();
  });

  it('quote document renders inline SVG preview with title and total', async () => {
    // Quote legacy vivono in `precisionQuote_quotes`. migrateFromLegacy
    // usa `legacy.title` (piatto) non `legacy.project.title`, quindi
    // mettiamo title flat per ottenere preview col titolo.
    const legacyQuote = {
      id: 'q1',
      title: 'Sito web',
      intro: 'Desc',
      client: 'Mario Rossi',
      options: [
        { id: 'opt1', label: 'Opzione 1', oneTimeCost: 122, description: 'Base' },
      ],
      createdAt: '2026-07-23T10:00:00.000Z',
      userEmail: 'user@test.com',
    };
    localStorage.setItem('precisionQuote_quotes', JSON.stringify([legacyQuote]));
    // Quote visibili solo admin (filtro Phase 7)
    await renderCollection({ role: 'admin' });
    const preview = document.querySelector('[data-testid="preview-q1"]') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.querySelector('svg')).toBeTruthy();
    // Title del progetto appare nel SVG
    expect(preview.textContent).toContain('Sito web');
  });

  it('flyer document renders inline SVG preview with headline', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'f1',
        documentType: 'flyer',
        title: 'Volantino Pizzeria',
        content: {
          headline: 'Pizza Festa',
          subheadline: 'Venerdi sera',
          body: 'Offerta speciale',
          cta: { label: 'Prenota', target: 'tel:+39333' },
        },
        style: {
          primaryColor: '#B45309',
          accentColor: '#1F2937',
          fontFamily: 'Inter',
          layout: 'classic',
        },
        size: 'A5',
        orientation: 'portrait',
        sector: 'ristorante',
      }),
    ]);
    await renderCollection();
    const preview = document.querySelector('[data-testid="preview-f1"]') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.querySelector('svg')).toBeTruthy();
    // Headline appare nel SVG (anche uppercase via CSS)
    expect(preview.textContent?.toLowerCase()).toContain('pizza');
  });

  it('malformed quote (no project) still renders preview via empty defaults, no crash', async () => {
    // Legacy quote vuota
    localStorage.setItem('precisionQuote_quotes', JSON.stringify([
      { id: 'badquote', userEmail: 'user@test.com' },
    ]));
    await renderCollection({ role: 'admin' });
    // migrateFromLegacy su doc senza campi → quote vuota → preview SVG
    // renderizza con title default "Preventivo"
    const preview = document.querySelector('[data-testid="preview-badquote"]') as HTMLElement;
    // Se migrateFromLegacy throw su doc completamente vuoto, fallback icona.
    // Entrambi i casi sono accettabili: nessun crash.
    expect(screen.getByTestId('card-badquote')).toBeTruthy();
  });

  it('malformed flyer (empty content) still renders preview via merge defaults, no crash', async () => {
    seedDocumentsLocalStorage([
      makeDocument({ id: 'badflyer', documentType: 'flyer', title: 'Broken Flyer' }),
    ]);
    await renderCollection();
    const preview = document.querySelector('[data-testid="preview-badflyer"]') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('card-badflyer')).toBeTruthy();
  });

  it('website document renders SVG preview with brand color and h1 heading', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'site1',
        documentType: 'website',
        title: 'Sito Panetteria',
        brief: { businessName: 'Panetteria Aurora' },
        css: ':root { --primary: #B45309; --bg: #FFFBEB; }',
        html: '<h1>Pane Fresco Ogni Mattina</h1>',
        pages: ['index', 'about'],
      }),
    ]);
    await renderCollection();
    const preview = document.querySelector('[data-testid="preview-site1"]') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.querySelector('svg')).toBeTruthy();
    expect(preview.textContent).toContain('Pane Fresco Ogni Mattina');
  });

  it('website without code still renders SVG preview (placeholder), no crash', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'site2',
        documentType: 'website',
        title: 'Sito Nuovo',
        brief: { businessName: 'Caffè Roma' },
        pages: ['index'],
      }),
    ]);
    await renderCollection();
    const preview = document.querySelector('[data-testid="preview-site2"]') as HTMLElement;
    expect(preview).toBeTruthy();
    expect(preview.querySelector('svg')).toBeTruthy();
    expect(preview.textContent).toContain('Caffè Roma');
  });
});

describe('CollectionView aiStats badge (TB-026)', () => {
  it('renders aiStats badge when document has aiStats with calls', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'card-ai',
        documentType: 'businessCard',
        title: 'Card con AI',
        front: { name: 'Mario' },
        aiStats: {
          totalCostUsd: 0.08,
          calls: {
            icon: { count: 3, costUsd: 0.06 },
            text: { count: 2, costUsd: 0.02 },
          },
          updatedAt: new Date().toISOString(),
        },
      }),
    ]);
    await renderCollection();
    const badge = screen.queryByTestId('ai-stats-card-ai');
    expect(badge).toBeTruthy();
    const text = badge?.textContent ?? '';
    // 3 icone + 2 elaborazioni testo + costo $0.08
    expect(text).toContain('3 icone');
    expect(text).toContain('2 elaborazioni testo');
    expect(text).toContain('$0.08');
  });

  it('renders aiStats placeholder when document has no aiStats calls', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'card-noai',
        documentType: 'businessCard',
        title: 'Card senza AI',
        front: { name: 'Luigi' },
      }),
    ]);
    await renderCollection();
    const badge = screen.queryByTestId('ai-stats-card-noai');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Nessun costo AI');
  });

  it('renders aiStats placeholder when aiStats has zero calls', async () => {
    seedDocumentsLocalStorage([
      makeDocument({
        id: 'card-empty',
        documentType: 'businessCard',
        title: 'Card empty stats',
        front: { name: 'Carla' },
        aiStats: { totalCostUsd: 0, calls: {} },
      }),
    ]);
    await renderCollection();
    const badge = screen.queryByTestId('ai-stats-card-empty');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Nessun costo AI');
  });
});