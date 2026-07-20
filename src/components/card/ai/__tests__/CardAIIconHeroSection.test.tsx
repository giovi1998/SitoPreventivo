import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardAIIconHeroSection from '../CardAIIconHeroSection';
import { createEmptyCard } from '../../../../utils/documentSchemas';

describe('CardAIIconHeroSection', () => {
  const card = createEmptyCard();

  function expandSection() {
    fireEvent.click(screen.getByRole('button', { name: /icona ai/i }));
  }

  it('renders disabled when tier is free', () => {
    render(
      <CardAIIconHeroSection
        card={card}
        tier="free"
        isProcessing={false}
        iconPrompt=""
        onIconPromptChange={vi.fn()}
        onGenerateIcon={vi.fn()}
      />,
    );
    expandSection();
    const btn = screen.getByTestId('card-generate-icon-ai');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toContain('🔒');
  });

  it('enables generate button when prompt is non-empty and tier unlocked', () => {
    render(
      <CardAIIconHeroSection
        card={card}
        tier="unlocked"
        isProcessing={false}
        iconPrompt="mela stilizzata"
        onIconPromptChange={vi.fn()}
        onGenerateIcon={vi.fn()}
      />,
    );
    expandSection();
    expect(screen.getByTestId('card-generate-icon-ai')).toBeEnabled();
  });

  it('calls onIconPromptChange when typing', () => {
    const onChange = vi.fn();
    render(
      <CardAIIconHeroSection
        card={card}
        tier="unlocked"
        isProcessing={false}
        iconPrompt=""
        onIconPromptChange={onChange}
        onGenerateIcon={vi.fn()}
      />,
    );
    expandSection();
    fireEvent.change(screen.getByLabelText(/descrizione icona/i), { target: { value: 'casa' } });
    expect(onChange).toHaveBeenCalledWith('casa');
  });

  it('calls onGenerateIcon when clicked', () => {
    const onGenerate = vi.fn();
    render(
      <CardAIIconHeroSection
        card={card}
        tier="unlocked"
        isProcessing={false}
        iconPrompt="casa"
        onIconPromptChange={vi.fn()}
        onGenerateIcon={onGenerate}
      />,
    );
    expandSection();
    fireEvent.click(screen.getByTestId('card-generate-icon-ai'));
    expect(onGenerate).toHaveBeenCalled();
  });
});
