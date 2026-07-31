import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { renderEditor, mockSave } from './cardEditorTestSetup';
import { createEmptyCard } from '../../utils/documentSchemas';

describe('Responsive (mobile <1024px) + AI always-accessible', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalResizeObserver: typeof globalThis.ResizeObserver | undefined;
  let roCallbacks: Array<(entries: unknown[]) => void>;

  // Mock ResizeObserver (jsdom non lo implementa): cattura le callback per
  // simulare il resize del container e verificare l'auto-fit scale.
  class FakeResizeObserver {
    cb: (entries: unknown[]) => void;
    constructor(cb: (entries: unknown[]) => void) {
      this.cb = cb;
      roCallbacks.push(cb);
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  function triggerResize(width: number) {
    act(() => {
      roCallbacks.forEach((cb) => cb([{ contentRect: { width } }]));
    });
  }

  function getPreviewsEl(): HTMLElement {
    const fit = screen.getAllByTestId('card-preview-fit')[0];
    return fit.querySelector('.card-previews') as HTMLElement;
  }

  function getEffectiveScale(el: HTMLElement): number {
    if (el.style.zoom) return parseFloat(el.style.zoom);
    const m = el.style.transform.match(/scale\(([\d.]+)\)/);
    return m ? parseFloat(m[1]) : NaN;
  }

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalResizeObserver = (globalThis as any).ResizeObserver;
    roCallbacks = [];
    (globalThis as any).ResizeObserver = FakeResizeObserver;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    (globalThis as any).ResizeObserver = originalResizeObserver;
  });

  function setMobile() {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('max-width: 1023px'),
      media: q,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any;
  }

  function setDesktop() {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any;
  }

  it('on mobile: shows tab layout (Anteprima/Modifica/AI) instead of 3-col', () => {
    setMobile();
    renderEditor();
    expect(screen.getByTestId('card-editor-tabs')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Anteprima/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Modifica/i })).toBeInTheDocument();
  });

  it('on mobile: AI is always accessible via FAB button', () => {
    setMobile();
    renderEditor();
    const fab = screen.getByRole('button', { name: /Apri pannello AI/i });
    expect(fab).toBeInTheDocument();
  });

  it('on mobile: FAB opens bottom sheet with AI panel content', () => {
    setMobile();
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Apri pannello AI/i }));
    const dialog = screen.getByRole('dialog', { name: /Pannello AI/i });
    expect(dialog).toBeInTheDocument();
    // Mobile: il bottom sheet espone il badge provider (cambio modello).
    expect(dialog.querySelector('[data-testid="ai-provider-badge"]')).not.toBeNull();
  });

  it('on mobile: AI "Suggerisci" chip is present and uses correct key (Phase 2.2 REQ-A05)', () => {
    setMobile();
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Apri pannello AI/i }));
    const dialog = screen.getByRole('dialog', { name: /Pannello AI/i });
    expect(dialog.querySelector('button:not([disabled])')?.textContent).toBeDefined();
    expect(within(dialog).getByRole('button', { name: /^Suggerisci$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^Premium$/i })).toBeInTheDocument();
  });

  it('on mobile: clicking "Modifica" tab shows form fields', () => {
    setMobile();
    renderEditor();
    fireEvent.click(screen.getByRole('tab', { name: /Modifica/i }));
    const tabContent = screen.getByTestId('tab-content-edit');
    expect(tabContent.querySelector('[aria-label="Nome (fronte)"]')).not.toBeNull();
  });

  it('on desktop: shows 3-col layout (no tabs, no FAB)', () => {
    setDesktop();
    renderEditor();
    expect(screen.queryByTestId('card-editor-tabs')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apri pannello AI/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Nome \(fronte\)/i)).toBeInTheDocument();
  });

  it('on mobile: preview default zoom is 100% (auto-fit scala la card intera)', () => {
    setMobile();
    renderEditor();
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });

  it('auto-fit: la card è renderizzata a 640px logici e scalata intera (proporzioni identiche mobile/desktop)', () => {
    setMobile();
    renderEditor();
    const previews = getPreviewsEl();
    // Width fissa a REF_WIDTH: i font in rem non dipendono più dalla larghezza.
    expect(previews.style.width).toBe('640px');
    // Default (container sconosciuto in jsdom): nessuno scale.
    expect(getEffectiveScale(previews)).toBeCloseTo(1, 5);
    // Container 320px → fitScale = 320/640 = 0.5.
    triggerResize(320);
    expect(getEffectiveScale(getPreviewsEl())).toBeCloseTo(0.5, 5);
    // Container più largo di REF_WIDTH → clamp a 1 (mai ingrandire oltre 100%).
    triggerResize(1280);
    expect(getEffectiveScale(getPreviewsEl())).toBeCloseTo(1, 5);
  });

  it('auto-fit: lo zoom manuale si compone con il fit scale', () => {
    setMobile();
    renderEditor();
    triggerResize(320);
    const out = screen.getAllByRole('button', { name: /Riduci zoom/i })[0];
    fireEvent.click(out); // zoom manuale 100% → 90%
    // effective = 0.5 * 0.9 = 0.45
    expect(getEffectiveScale(getPreviewsEl())).toBeCloseTo(0.45, 5);
  });

  it('on mobile: zoom out reduces to 50% (min), then disabled', () => {
    setMobile();
    renderEditor();
    const out = screen.getAllByRole('button', { name: /Riduci zoom/i })[0];
    for (let i = 0; i < 5; i++) fireEvent.click(out);
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    expect(out).toBeDisabled();
  });

  it('on mobile: zoom in increases from 100% to 110% to 120% up to 150% (max)', () => {
    setMobile();
    renderEditor();
    const inBtn = screen.getAllByRole('button', { name: /Aumenta zoom/i })[0];
    fireEvent.click(inBtn);
    expect(screen.getAllByText('110%').length).toBeGreaterThan(0);
    fireEvent.click(inBtn);
    expect(screen.getAllByText('120%').length).toBeGreaterThan(0);
  });

  it('on desktop: default zoom is 100%', () => {
    setDesktop();
    renderEditor();
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });

  it('zoom reset button restores 100%', () => {
    setMobile();
    renderEditor();
    const out = screen.getAllByRole('button', { name: /Riduci zoom/i })[0];
    fireEvent.click(out);
    fireEvent.click(out);
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0);
    const reset = screen.getAllByRole('button', { name: /Reset zoom/i })[0];
    fireEvent.click(reset);
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });

  it('on mobile: Salva button is always visible (sticky bottom bar)', () => {
    setMobile();
    renderEditor();
    const saveBtn = screen.getByTestId('mobile-save-btn');
    expect(saveBtn).toBeInTheDocument();
    expect(saveBtn).toBeVisible();
  });

  it('on mobile: Esporta button is always visible (sticky bottom bar)', () => {
    setMobile();
    renderEditor();
    const exportBtn = screen.getByTestId('mobile-export-btn');
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).toBeVisible();
  });

  it('on mobile: clicking Esporta opens dropdown with PDF/PNG/SVG/JSON', async () => {
    setMobile();
    renderEditor();
    const exportBtn = screen.getByTestId('mobile-export-btn');
    fireEvent.click(exportBtn);
    expect(await screen.findByRole('menuitem', { name: /PDF 10-up \(tipografia/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /PDF 10-up \(pulito/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /PNG fronte/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /SVG fronte/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /JSON/i })).toBeInTheDocument();
  });

  it('on mobile: clicking Salva calls dataService.saveDocument', async () => {
    setMobile();
    const filled = createEmptyCard();
    filled.front.name = 'Mario';
    renderEditor({ initialCard: filled });
    const saveBtn = screen.getByTestId('mobile-save-btn');
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(await screen.findByRole('heading', { name: /Salva bigliettino/i })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Conferma salvataggio/i }));
    });
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
  });

  it('on desktop: NO mobile sticky bar (3-col has its own Salva button)', () => {
    setDesktop();
    renderEditor();
    expect(screen.queryByTestId('mobile-save-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-export-btn')).not.toBeInTheDocument();
  });

  it('grid editor on desktop: element cannot move into another (BLOCK collision)', () => {
    setDesktop();
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 1, h: 4 },
        name: { x: 1, y: 0, w: 3, h: 1 },
        title: { x: 1, y: 1, w: 3, h: 1 },
      },
    };
    renderEditor(card as any);
    const select = screen.getByLabelText(/Elemento selezionato/i);
    fireEvent.change(select, { target: { value: 'name' } });
    const moveLeft = screen.getByRole('button', { name: /Sposta a sinistra/i });
    expect(moveLeft).toBeDisabled();
  });

  it('grid editor on desktop: cannot grow into another element (BLOCK)', () => {
    setDesktop();
    const card = createEmptyCard();
    card.grid = {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 1, h: 4 },
        name: { x: 1, y: 0, w: 1, h: 1 },
        title: { x: 1, y: 1, w: 1, h: 1 },
      },
    };
    renderEditor(card as any);
    const select = screen.getByLabelText(/Elemento selezionato/i);
    fireEvent.change(select, { target: { value: 'name' } });
    const growH = screen.getByRole('button', { name: /Aumenta altezza/i });
    expect(growH).toBeDisabled();
  });
});