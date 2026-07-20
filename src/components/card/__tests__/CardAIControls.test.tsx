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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CardAIControls', () => {
  // TB-023: la sezione "Sfondo AI" è collapsed di default — espando prima.
  function expandCoverSection() {
    fireEvent.click(screen.getByRole('button', { name: /Sfondo AI/i }));
  }

  it('keeps cover buttons disabled when tier is free', () => {
    render(<CardAIControls {...baseProps} tier="free" />);
    expandCoverSection();

    expect(screen.getByRole('button', { name: /sblocca per generare entrambi/i })).toBeDisabled();
  });

  it('enables cover buttons when tier is unlocked', () => {
    render(<CardAIControls {...baseProps} tier="unlocked" />);
    expandCoverSection();

    expect(screen.getByRole('button', { name: /genera entrambi/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /genera fronte/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /genera retro/i })).toBeEnabled();
  });

  it('calls onGenerateCover with both sides when clicking primary button', () => {
    render(<CardAIControls {...baseProps} tier="unlocked" />);
    expandCoverSection();
    fireEvent.click(screen.getByRole('button', { name: /genera entrambi/i }));
    expect(baseProps.onGenerateCover).toHaveBeenCalledWith('both', expect.any(String));
  });

  it('disables cover buttons while isProcessing is true', () => {
    render(<CardAIControls {...baseProps} isProcessing tier="unlocked" />);
    expandCoverSection();
    const genBtns = screen.getAllByRole('button', { name: /generazione…/i });
    genBtns.forEach((btn) => expect(btn).toBeDisabled());
  });
});