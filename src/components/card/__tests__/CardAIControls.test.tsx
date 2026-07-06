import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardAIControls from '../CardAIControls';

const baseProps = {
  aiModel: 'deepseek-chat',
  onModelChange: vi.fn(),
  aiText: '',
  onTextChange: vi.fn(),
  availableModels: [{ id: 'deepseek-chat', name: 'DeepSeek Chat', model: 'deepseek-chat' }],
  isProcessing: false,
  onRun: vi.fn(),
  onReset: vi.fn(),
  logs: [],
  variant: 'desktop' as const,
  onGenerateCover: vi.fn(),
  onRemoveCover: vi.fn(),
  card: {
    front: { coverImageUrl: null },
    back: { coverImageUrl: null },
  } as any,
};

const originalLocation = window.location;

beforeEach(() => {
  vi.stubGlobal('location', { ...originalLocation, hostname: 'localhost' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('CardAIControls', () => {
  it('keeps cover buttons disabled when tier is free in production', () => {
    window.location.hostname = 'quickbrand.vercel.app';
    render(<CardAIControls {...baseProps} tier="free" />);

    expect(screen.getByRole('button', { name: /sblocca per generare entrambi/i })).toBeDisabled();
  });

  it('enables cover buttons in localhost even with tier free', () => {
    render(<CardAIControls {...baseProps} tier="free" />);

    expect(screen.getByRole('button', { name: /genera entrambi/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /genera fronte/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /genera retro/i })).toBeEnabled();
  });

  it('calls onGenerateCover with both sides when clicking primary button', () => {
    render(<CardAIControls {...baseProps} tier="free" />);
    fireEvent.click(screen.getByRole('button', { name: /genera entrambi/i }));
    expect(baseProps.onGenerateCover).toHaveBeenCalledWith('both');
  });

  it('disables cover buttons while isProcessing is true', () => {
    render(<CardAIControls {...baseProps} isProcessing tier="unlocked" />);
    expect(screen.getByRole('button', { name: /generazione…/i })).toBeDisabled();
  });
});
