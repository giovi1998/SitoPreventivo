import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FlyerManualPanel } from '../FlyerManualPanel';
import { createEmptyFlyer, createFlyerTemplate, FLYER_SECTORS } from '../../../utils/documentSchemas';

function baseProps(overrides: Record<string, any> = {}) {
  const flyer = createFlyerTemplate('ristorante', 'classic');
  return {
    flyer,
    showTemplateBanner: false,
    activeSector: 'ristorante' as const,
    heroError: null,
    showCustomFont: false,
    setShowCustomFont: vi.fn(),
    limitReached: false,
    exporting: null as 'pdf' | 'png' | null,
    tier: 'unlocked' as const,
    onCollapse: vi.fn(),
    onTitleChange: vi.fn(),
    onUpdateContent: vi.fn(),
    onUpdateStyle: vi.fn(),
    onUpdateSize: vi.fn(),
    onUpdateOrientation: vi.fn(),
    onUpdateLayout: vi.fn(),
    onApplySector: vi.fn(),
    onApplySectorLayout: vi.fn(),
    onCloseTemplateBanner: vi.fn(),
    onHeroUpload: vi.fn(),
    onRemoveHero: vi.fn(),
    onGenerateHero: vi.fn(),
    onResetHero: vi.fn(),
    isGeneratingHero: false,
    heroPrompt: '',
    setHeroPrompt: vi.fn(),
    heroSector: 'ristorante' as typeof FLYER_SECTORS[number],
    setHeroSector: vi.fn(),
    heroTone: 'formale' as const,
    setHeroTone: vi.fn(),
    showHeroPromptEditor: false,
    setShowHeroPromptEditor: vi.fn(),
    onReset: vi.fn(),
    onSave: vi.fn(),
    onExportPdf: vi.fn(),
    onExportPng: vi.fn(),
    flyerHasContent: () => true,
    ...overrides,
  };
}

function openHeroSection() {
  const head = screen.getByText('Immagine hero').closest('.collapsible-head');
  if (head) fireEvent.click(head);
}

describe('FlyerManualPanel — Hero AI prompt editor (v2.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Genera hero AI button for unlocked tier on non-centered layout', () => {
    render(<FlyerManualPanel {...baseProps()} />);
    openHeroSection();
    expect(screen.getByRole('button', { name: /✨ Genera hero AI/i })).toBeInTheDocument();
  });

  it('renders the Pro-locked button for free tier', () => {
    render(<FlyerManualPanel {...baseProps({ tier: 'free' })} />);
    openHeroSection();
    expect(screen.getByRole('button', { name: /Genera hero AI \(Pro\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^✨ Genera hero AI$/i })).not.toBeInTheDocument();
  });

  it('renders sector and tone selectors for hero AI', () => {
    render(<FlyerManualPanel {...baseProps()} />);
    openHeroSection();
    expect(screen.getByLabelText(/Settore hero AI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tono hero AI/i)).toBeInTheDocument();
  });

  it('renders the Modifica prompt toggle button', () => {
    render(<FlyerManualPanel {...baseProps()} />);
    openHeroSection();
    expect(screen.getByRole('button', { name: /Modifica prompt/i })).toBeInTheDocument();
  });

  it('does NOT render the prompt textarea when showHeroPromptEditor is false', () => {
    render(<FlyerManualPanel {...baseProps({ showHeroPromptEditor: false })} />);
    openHeroSection();
    expect(screen.queryByLabelText(/Prompt hero AI/i)).not.toBeInTheDocument();
  });

  it('renders the prompt textarea when showHeroPromptEditor is true', () => {
    render(<FlyerManualPanel {...baseProps({ showHeroPromptEditor: true, heroPrompt: 'custom prompt here' })} />);
    openHeroSection();
    const ta = screen.getByRole('textbox', { name: 'Prompt hero AI' }) as HTMLTextAreaElement;
    expect(ta.value).toBe('custom prompt here');
  });

  it('changing the prompt textarea calls setHeroPrompt', () => {
    const setHeroPrompt = vi.fn();
    render(<FlyerManualPanel {...baseProps({ showHeroPromptEditor: true, setHeroPrompt })} />);
    openHeroSection();
    const ta = screen.getByRole('textbox', { name: 'Prompt hero AI' }) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'new prompt text' } });
    expect(setHeroPrompt).toHaveBeenCalledWith('new prompt text');
  });

  it('clicking Genera hero AI calls onGenerateHero', () => {
    const onGenerateHero = vi.fn();
    render(<FlyerManualPanel {...baseProps({ onGenerateHero })} />);
    openHeroSection();
    fireEvent.click(screen.getByRole('button', { name: /✨ Genera hero AI/i }));
    expect(onGenerateHero).toHaveBeenCalled();
  });

  it('changing sector selector calls setHeroSector', () => {
    const setHeroSector = vi.fn();
    render(<FlyerManualPanel {...baseProps({ setHeroSector })} />);
    openHeroSection();
    fireEvent.change(screen.getByLabelText(/Settore hero AI/i), { target: { value: 'evento' } });
    expect(setHeroSector).toHaveBeenCalledWith('evento');
  });

  it('changing tone selector calls setHeroTone', () => {
    const setHeroTone = vi.fn();
    render(<FlyerManualPanel {...baseProps({ setHeroTone })} />);
    openHeroSection();
    fireEvent.change(screen.getByLabelText(/Tono hero AI/i), { target: { value: 'giovanile' } });
    expect(setHeroTone).toHaveBeenCalledWith('giovanile');
  });

  it('disables Genera hero AI button while generating', () => {
    render(<FlyerManualPanel {...baseProps({ isGeneratingHero: true })} />);
    openHeroSection();
    // The button shows "Generazione…" while generating, and is disabled.
    const genBtn = screen.getByRole('button', { name: /Generazione/i });
    expect(genBtn).toBeDisabled();
  });

  it('does not render hero AI controls on centered layout', () => {
    const flyer = createFlyerTemplate('ristorante', 'centered');
    render(<FlyerManualPanel {...baseProps({ flyer })} />);
    openHeroSection();
    expect(screen.queryByRole('button', { name: /✨ Genera hero AI/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Settore hero AI/i)).not.toBeInTheDocument();
  });
});