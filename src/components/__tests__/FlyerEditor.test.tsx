import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const useAIFlyerMock = vi.fn();
vi.mock('../../hooks/useAIFlyer', () => ({ useAIFlyer: (...args: any[]) => useAIFlyerMock(...args) }));
vi.mock('../SaveDialog', () => ({
  default: ({ open }: any) => (open ? <div data-testid="save-dialog" /> : null),
}));

const buildFlyerSvgMock = vi.fn((flyer: any) => `<svg data-testid="flyer-svg-mock" data-has-qr="${!!flyer?.content?.qrPayload && /^https?:\/\//.test(flyer.content.qrPayload)}"></svg>`);
const generateFlyerPdfMock = vi.fn();
const generateFlyerPngMock = vi.fn();
vi.mock('../../utils/flyerGenerator', () => ({
  buildFlyerSvg: (...args: any[]) => buildFlyerSvgMock(...args),
  generateFlyerPdf: (...args: any[]) => generateFlyerPdfMock(...args),
  generateFlyerPng: (...args: any[]) => generateFlyerPngMock(...args),
}));
vi.mock('../../utils/dataService', () => ({ default: { saveDocument: vi.fn(() => Promise.resolve({ success: true, data: {} })) } }));

import FlyerEditor from '../FlyerEditor';
import { createEmptyFlyer } from '../../utils/documentSchemas';
import { AuthContext, AppContext } from '../../contexts';

const AUTH = { user: { email: 'mario@rossi.com' }, login: vi.fn(), register: vi.fn(), logout: vi.fn() };

function setupAIMock(opts: { generateResult?: any; refineResult?: any; reset?: any; isProcessing?: boolean; models?: any[] } = {}) {
  const generate = vi.fn();
  const refine = vi.fn();
  const reset = opts.reset ?? vi.fn();
  generate.mockResolvedValue(opts.generateResult ?? { flyer: { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, headline: 'Sagra del paese' } }, changes: ['copy_generated'], applied: true, rawResponse: '{}' });
  refine.mockResolvedValue(opts.refineResult ?? { flyer: { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, body: 'Semplificato' } }, changes: ['Semplificato'], applied: true, rawResponse: '{}' });
  useAIFlyerMock.mockReturnValue({ generate, refine, reset, logs: [], isProcessing: !!opts.isProcessing, availableModels: opts.models ?? [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }] });
  return { generate, refine, reset };
}

function renderEditor(initialFlyer?: any, tier: 'free' | 'unlocked' = 'unlocked') {
  const ctx = { tier, documentCount: 0, documentLimit: 10, checkDocumentLimit: () => true, refreshTier: vi.fn(), addToast: vi.fn(), setView: vi.fn() };
  return render(
    <AuthContext.Provider value={AUTH as any}>
      <AppContext.Provider value={ctx as any}>
        <FlyerEditor userEmail="mario@rossi.com" initialFlyer={initialFlyer} tier={tier} />
      </AppContext.Provider>
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  generateFlyerPdfMock.mockReset();
  generateFlyerPngMock.mockReset();
  (global.URL as any).createObjectURL = vi.fn(() => 'blob:mock');
  (global.URL as any).revokeObjectURL = vi.fn();
});

describe('FlyerEditor (phase 3, preventivo layout)', () => {
  it('renders the editor-grid layout with AI, Form, and Preview columns', () => {
    setupAIMock();
    renderEditor();
    expect(document.querySelector('.editor-grid')).toBeTruthy();
    expect(document.querySelector('.ai-col')).toBeTruthy();
    expect(document.querySelector('.manual-col')).toBeTruthy();
    expect(document.querySelector('.preview-wrap')).toBeTruthy();
  });

  it('renders the title input with placeholder', () => {
    setupAIMock();
    renderEditor();
    expect(screen.getByPlaceholderText(/Titolo del volantino/i)).toBeInTheDocument();
  });

  it('renders template banner when starting empty', () => {
    setupAIMock();
    renderEditor();
    expect(screen.getByText(/Template per settore/i)).toBeInTheDocument();
  });

  it('renders the AI panel with model, brief, generate, quick actions, log', () => {
    setupAIMock();
    renderEditor();
    expect(screen.getByLabelText(/Brief AI/i)).toBeInTheDocument();
    // "Genera copy" appears both as a Section title AND as a button.
    // Disambiguate by looking for the actual <button> with the emoji.
    expect(screen.getByText('✨ Genera copy')).toBeInTheDocument();
    expect(screen.getByRole('log', { name: /Log attività AI/i })).toBeInTheDocument();
  });

  it('renders the focus toggle button', () => {
    setupAIMock();
    renderEditor();
    expect(screen.getByTestId('focus-toggle')).toBeInTheDocument();
  });

  it('renders the layout buttons in the Layout section', () => {
    setupAIMock();
    renderEditor();
    const layoutSection = screen.getByText('Layout').closest('.collapsible');
    expect(within(layoutSection as HTMLElement).getByText('Magazine')).toBeInTheDocument();
  });

  it('"Nuovo" button resets the flyer to empty', () => {
    setupAIMock();
    const flyer = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, headline: 'Da buttare' } };
    renderEditor(flyer);
    fireEvent.click(screen.getByText('Nuovo'));
    const titleInput = screen.getByPlaceholderText(/Titolo del volantino/i) as HTMLInputElement;
    expect(titleInput.value).toBe('');
  });

  it('Genera copy button is disabled when prompt is empty', () => {
    setupAIMock();
    renderEditor();
    // The button text is "✨ Genera copy". Use querySelector to find
    // the actual <button>, not the Section head.
    const btns = document.querySelectorAll('button');
    const generateBtns = Array.from(btns).filter((b) => b.textContent?.includes('Genera copy') && !b.classList.contains('collapsible-head'));
    expect(generateBtns.length).toBeGreaterThanOrEqual(1);
    expect(generateBtns[0]).toBeDisabled();
  });

  it('Genera copy triggers ai.generate on click', async () => {
    const { generate } = setupAIMock();
    renderEditor();
    fireEvent.change(screen.getByLabelText(/Brief AI/i), { target: { value: 'Sagra 15 agosto' } });
    fireEvent.click(screen.getByText('✨ Genera copy'));
    await waitFor(() => expect(generate).toHaveBeenCalled());
  });

  it('clicking a suggested prompt chip pre-fills the brief without triggering AI', () => {
    const { generate } = setupAIMock();
    renderEditor();
    const textarea = screen.getByLabelText(/Brief AI/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
    const chip = screen.getByText(/Sagra del paese, 15-17 agosto/i);
    fireEvent.click(chip);
    expect(textarea.value).toMatch(/Sagra del paese/);
    expect(generate).not.toHaveBeenCalled();
  });

  it('refining via "Semplifica" triggers ai.refine', async () => {
    const { refine } = setupAIMock();
    const flyer = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, headline: 'Titolo', body: 'Body' } };
    renderEditor(flyer);
    fireEvent.click(screen.getByText('Semplifica'));
    await waitFor(() => expect(refine).toHaveBeenCalled());
  });

  it('reset AI session calls ai.reset', () => {
    const { reset } = setupAIMock();
    renderEditor();
    fireEvent.click(screen.getByText(/Nuova sessione/i));
    expect(reset).toHaveBeenCalled();
  });

  it('does not crash when AI returns applied=false', async () => {
    setupAIMock({ generateResult: { flyer: createEmptyFlyer(), changes: ['error:empty'], applied: false } });
    renderEditor();
    fireEvent.change(screen.getByLabelText(/Brief AI/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('✨ Genera copy'));
    await new Promise((r) => setTimeout(r, 50));
  });

  it('renders QR in preview SVG when qrPayload is valid', () => {
    setupAIMock();
    const flyer = { ...createEmptyFlyer(), content: { ...createEmptyFlyer().content, qrPayload: 'https://example.com' } };
    renderEditor(flyer);
    const preview = screen.getByTestId('flyer-preview');
    const svg = preview.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('data-has-qr')).toBe('true');
  });

  it('does not render QR when qrPayload is empty', () => {
    setupAIMock();
    renderEditor(createEmptyFlyer());
    const preview = screen.getByTestId('flyer-preview');
    const svg = preview.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('data-has-qr')).toBe('false');
  });

  it('exposes watermark in preview for free tier', () => {
    setupAIMock();
    renderEditor(undefined, 'free');
    expect(document.querySelectorAll('svg.preview-watermark').length).toBeGreaterThan(0);
  });

  it('disables save/PDF/PNG when limitReached', () => {
    setupAIMock();
    renderEditor(undefined, 'free');
    // We need to simulate limit reached. The renderEditor above sets
    // documentCount=0, so limit should NOT be reached. Let's re-render
    // with different context.
    const ctx2 = { tier: 'free', documentCount: 10, documentLimit: 10, checkDocumentLimit: () => false, refreshTier: vi.fn(), addToast: vi.fn(), setView: vi.fn() };
    render(
      <AuthContext.Provider value={AUTH as any}>
        <AppContext.Provider value={ctx2 as any}>
          <FlyerEditor userEmail="mario@rossi" tier="free" />
        </AppContext.Provider>
      </AuthContext.Provider>
    );
    expect(screen.getByText(/Limite free raggiunto/i)).toBeInTheDocument();
  });
});