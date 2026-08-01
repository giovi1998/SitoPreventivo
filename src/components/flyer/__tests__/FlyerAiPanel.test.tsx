import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FlyerAiPanel } from '../FlyerAiPanel';
import { createFlyerTemplate, FLYER_SECTORS } from '../../../utils/documentSchemas';

function baseProps(overrides: Record<string, any> = {}) {
  const flyer = createFlyerTemplate('ristorante', 'classic');
  return {
    aiPrompt: '',
    setAiPrompt: vi.fn(),
    aiModel: 'deepseek-v4-flash',
    setAiModel: vi.fn(),
    aiTone: 'formale' as const,
    setAiTone: vi.fn(),
    ai: { isProcessing: false, logs: [], availableModels: [] } as any,
    flyer,
    debouncedFlyer: flyer,
    hasCopy: true,
    onGenerate: vi.fn(),
    onRefine: vi.fn(),
    onReset: vi.fn(),
    onCollapse: vi.fn(),
    tier: 'unlocked' as const,
    onGenerateHero: vi.fn(),
    onRemoveHero: vi.fn(),
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
    heroLibrary: [],
    onSaveHeroPrompt: vi.fn(),
    onApplyHeroPrompt: vi.fn(),
    onDeleteHeroPrompt: vi.fn(),
    ...overrides,
  };
}

function openHeroSection() {
  const head = screen.getByText('Hero Image').closest('.ai-section-header, .collapsible-head');
  if (head) fireEvent.click(head);
}

describe('FlyerAiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AI Assist kicker', () => {
    render(<FlyerAiPanel {...baseProps()} />);
    expect(screen.getByText('AI Assist')).toBeInTheDocument();
  });

  it('renders Genera hero AI button in Hero Image section for unlocked tier', () => {
    render(<FlyerAiPanel {...baseProps()} />);
    openHeroSection();
    expect(screen.getByRole('button', { name: /Genera hero AI/i })).toBeInTheDocument();
  });

  it('blocks hero AI generation behind AiTierGuard for free tier', () => {
    render(<FlyerAiPanel {...baseProps({ tier: 'free' })} />);
    openHeroSection();
    expect(screen.getByText(/disponibile nel piano Pro/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Genera hero AI/i })).not.toBeInTheDocument();
  });

  it('hides Hero Image section on centered layout', () => {
    const flyer = createFlyerTemplate('ristorante', 'centered');
    render(<FlyerAiPanel {...baseProps({ flyer })} />);
    expect(screen.queryByText('Hero Image')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Genera hero AI/i })).not.toBeInTheDocument();
  });

  it('calls onGenerateHero when button clicked', () => {
    const onGenerateHero = vi.fn();
    render(<FlyerAiPanel {...baseProps({ onGenerateHero })} />);
    openHeroSection();
    fireEvent.click(screen.getByRole('button', { name: /Genera hero AI/i }));
    expect(onGenerateHero).toHaveBeenCalled();
  });

  it('calls onRemoveHero when remove button is present', () => {
    const onRemoveHero = vi.fn();
    const flyer = createFlyerTemplate('ristorante', 'classic');
    flyer.content.heroImage = 'data:image/png;base64,xxx';
    render(<FlyerAiPanel {...baseProps({ flyer, onRemoveHero })} />);
    openHeroSection();
    fireEvent.click(screen.getByRole('button', { name: /Rimuovi immagine/i }));
    expect(onRemoveHero).toHaveBeenCalled();
  });
});
