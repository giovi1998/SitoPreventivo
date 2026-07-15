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
    showCustomFont: false,
    setShowCustomFont: vi.fn(),
    limitReached: false,
    exporting: null as 'pdf' | 'png' | null,
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

describe('FlyerManualPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders manual upload in hero section', () => {
    render(<FlyerManualPanel {...baseProps()} />);
    openHeroSection();
    expect(screen.getByText(/Carica un'immagine manuale oppure usa il pannello AI Assist/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Carica immagine hero/i)).toBeInTheDocument();
  });

  it('does NOT render AI generate hero button in manual panel', () => {
    render(<FlyerManualPanel {...baseProps()} />);
    openHeroSection();
    expect(screen.queryByRole('button', { name: /Genera hero AI/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Settore hero AI/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Tono hero AI/i)).not.toBeInTheDocument();
  });

  it('calls onRemoveHero when remove button is present', () => {
    const onRemoveHero = vi.fn();
    const flyer = createFlyerTemplate('ristorante', 'classic');
    flyer.content.heroImage = 'data:image/png;base64,xxx';
    render(<FlyerManualPanel {...baseProps({ flyer, onRemoveHero })} />);
    openHeroSection();
    fireEvent.click(screen.getByRole('button', { name: /Rimuovi immagine/i }));
    expect(onRemoveHero).toHaveBeenCalled();
  });

  it('hides hero upload on centered layout (layout has no hero)', () => {
    const flyer = createFlyerTemplate('ristorante', 'centered');
    render(<FlyerManualPanel {...baseProps({ flyer })} />);
    expect(screen.queryByText('Immagine hero')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Carica immagine hero/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Genera hero AI/i })).not.toBeInTheDocument();
  });
});
