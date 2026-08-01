import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardAIControls from '../CardAIControls';

const baseProps = {
  aiModel: 'deepseek-v4-flash',
  onModelChange: vi.fn(),
  aiText: '',
  onTextChange: vi.fn(),
  availableModels: [{ id: 'deepseek-v4-flash', name: 'DeepSeek Chat', model: 'deepseek-v4-flash' }],
  isProcessing: false,
  onRun: vi.fn(),
  onReset: vi.fn(),
  logs: [],
  variant: 'desktop' as const,
  onGenerateCover: vi.fn(),
  onRemoveCover: vi.fn(),
  onGeneratePhoto: vi.fn(),
  card: {
    front: { coverImageUrl: null, photoUrl: null, logoUrl: null },
    back: { coverImageUrl: null },
  } as any,
  // Cover AI prompt-library state required by CardAICoverSection v2.9.1.
  coverPrompt: '',
  setCoverPrompt: vi.fn(),
  showCoverPromptEditor: false,
  setShowCoverPromptEditor: vi.fn(),
  coverLibrary: [],
  onSaveCoverPrompt: vi.fn(),
  onApplyCoverPrompt: vi.fn(),
  onDeleteCoverPrompt: vi.fn(),
  onFillAutoCoverPrompt: vi.fn(),
  // Photo AI prompt-library state required by CardAIPhotoSection.
  photoPrompt: '',
  setPhotoPrompt: vi.fn(),
  showPhotoPromptEditor: false,
  setShowPhotoPromptEditor: vi.fn(),
  photoLibrary: [],
  onSavePhotoPrompt: vi.fn(),
  onApplyPhotoPrompt: vi.fn(),
  onDeletePhotoPrompt: vi.fn(),
  onFillAutoPhotoPrompt: vi.fn(),
  // Icon AI prompt-library state required by CardAIIconHeroSection.
  iconPrompt: '',
  setIconPrompt: vi.fn(),
  showIconPromptEditor: false,
  setShowIconPromptEditor: vi.fn(),
  onGenerateIcon: vi.fn(),
  onFillAutoIconPrompt: vi.fn(),
  iconLibrary: [],
  onSaveIconPrompt: vi.fn(),
  onApplyIconPrompt: vi.fn(),
  onDeleteIconPrompt: vi.fn(),
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
    expect(baseProps.onGenerateCover).toHaveBeenCalledWith('both', expect.any(String), expect.toBeOneOf([expect.any(String), undefined]));
  });

  it('disables cover buttons while isProcessing is true', () => {
    render(<CardAIControls {...baseProps} isProcessing tier="unlocked" />);
    expandCoverSection();
    const genBtns = screen.getAllByRole('button', { name: /generazione…/i });
    genBtns.forEach((btn) => expect(btn).toBeDisabled());
  });
});