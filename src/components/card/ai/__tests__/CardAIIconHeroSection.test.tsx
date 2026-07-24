import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardAIIconHeroSection from '../CardAIIconHeroSection';
import { createEmptyCard } from '../../../../utils/documentSchemas';

describe('CardAIIconHeroSection', () => {
  const card = createEmptyCard();

  function baseProps(overrides: Record<string, unknown> = {}) {
    return {
      card,
      tier: 'unlocked' as const,
      isProcessing: false,
      iconPrompt: '',
      onIconPromptChange: vi.fn(),
      showPromptEditor: false,
      onTogglePromptEditor: vi.fn(),
      onGenerateIcon: vi.fn(),
      onFillAutoPrompt: vi.fn(),
      library: [],
      onSavePrompt: vi.fn(),
      onApplyPrompt: vi.fn(),
      onDeletePrompt: vi.fn(),
      ...overrides,
    };
  }

  function expandSection() {
    fireEvent.click(screen.getByRole('button', { name: /icona ai/i }));
  }

  it('renders disabled when tier is free', () => {
    render(<CardAIIconHeroSection {...baseProps({ tier: 'free' })} />);
    expandSection();
    const btn = screen.getByTestId('card-generate-icon-ai');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toContain('(Pro)');
  });

  it('enables generate button when tier is unlocked (auto prompt allowed)', () => {
    render(<CardAIIconHeroSection {...baseProps()} />);
    expandSection();
    expect(screen.getByTestId('card-generate-icon-ai')).toBeEnabled();
  });

  it('passes image model and background to onGenerateIcon', () => {
    const onGenerate = vi.fn();
    render(<CardAIIconHeroSection {...baseProps({ onGenerateIcon: onGenerate })} />);
    expandSection();
    fireEvent.change(screen.getByLabelText(/Modello immagine/i), { target: { value: 'gemini-3.1-flash-image' } });
    fireEvent.change(screen.getByLabelText(/Sfondo icona/i), { target: { value: 'card' } });
    fireEvent.click(screen.getByTestId('card-generate-icon-ai'));
    expect(onGenerate).toHaveBeenCalledWith({ imageModel: 'gemini-3.1-flash-image', background: 'card' });
  });

  it('shows prompt editor only after "Modifica prompt" toggle', () => {
    const onToggle = vi.fn();
    render(<CardAIIconHeroSection {...baseProps({ onTogglePromptEditor: onToggle })} />);
    expandSection();
    expect(screen.queryByTestId('card-icon-prompt-editor')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Modifica prompt/i }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders prompt editor with library when open', () => {
    render(
      <CardAIIconHeroSection
        {...baseProps({
          showPromptEditor: true,
          iconPrompt: 'mela stilizzata',
          library: [{ id: 'p1', label: 'Mela', prompt: 'mela stilizzata', createdAt: '2026-01-01' }],
        })}
      />,
    );
    expandSection();
    expect(screen.getByTestId('card-icon-prompt-editor')).toBeInTheDocument();
    expect(screen.getByLabelText(/Prompt icona AI/i)).toHaveValue('mela stilizzata');
    expect(screen.getByText('Mela')).toBeInTheDocument();
  });

  it('calls onIconPromptChange when typing in the editor', () => {
    const onChange = vi.fn();
    render(<CardAIIconHeroSection {...baseProps({ showPromptEditor: true, onIconPromptChange: onChange })} />);
    expandSection();
    fireEvent.change(screen.getByLabelText(/Prompt icona AI/i), { target: { value: 'casa' } });
    expect(onChange).toHaveBeenCalledWith('casa');
  });

  it('calls onFillAutoPrompt from the editor', () => {
    const onFill = vi.fn();
    render(<CardAIIconHeroSection {...baseProps({ showPromptEditor: true, onFillAutoPrompt: onFill })} />);
    expandSection();
    fireEvent.click(screen.getByRole('button', { name: /Usa prompt automatico/i }));
    expect(onFill).toHaveBeenCalled();
  });
});
