import React from 'react';
import type { BusinessCard } from '../../../utils/documentSchemas';
import { AiSection, AiPromptTextarea } from '../../ai-ui';

export interface CardAIIconHeroSectionProps {
  card: BusinessCard;
  tier: 'free' | 'unlocked';
  isProcessing: boolean;
  iconPrompt: string;
  onIconPromptChange: (v: string) => void;
  onGenerateIcon: () => void;
}

export default function CardAIIconHeroSection({
  tier,
  isProcessing,
  iconPrompt,
  onIconPromptChange,
  onGenerateIcon,
}: CardAIIconHeroSectionProps) {
  const locked = tier !== 'unlocked';

  return (
    <AiSection
      title="Icona AI"
      id="card-ai-section-icon"
      hint="Genera un'icona stilizzata 2-colori dal settore o dai servizi."
      collapsible
      defaultOpen={false}
    >
      <AiPromptTextarea
        label="Descrizione icona"
        value={iconPrompt}
        onChange={(e) => onIconPromptChange(e.target.value.slice(0, 1000))}
        rows={2}
        maxLength={1000}
        placeholder="Es. mela stilizzata per nutrizionista, casa per agente immobiliare..."
        aria-label="Descrizione icona AI"
      />
      <button
        type="button"
        className="card-action-primary"
        onClick={onGenerateIcon}
        disabled={isProcessing || locked || !iconPrompt.trim()}
        title={locked ? 'Disponibile nella versione Pro' : 'Genera icona stilizzata 2-colori'}
        data-testid="card-generate-icon-ai"
      >
        {isProcessing ? 'Generazione…' : locked ? '🔒 Icona AI (Pro)' : '✨ Genera icona AI'}
      </button>
    </AiSection>
  );
}
