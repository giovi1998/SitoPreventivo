import React from 'react';
import { AiSection, AiPromptTextarea, AiGenerateButton } from '../../ai-ui';

export interface CardAIPromptSectionProps {
  aiText: string;
  onTextChange: (t: string) => void;
  isProcessing: boolean;
  tier: 'free' | 'unlocked';
  onRun: () => void;
  onReset: () => void;
  variant: 'desktop' | 'mobile';
}

export default function CardAIPromptSection({
  aiText,
  onTextChange,
  isProcessing,
  tier,
  onRun,
  onReset,
  variant,
}: CardAIPromptSectionProps) {
  const isDesktop = variant === 'desktop';
  return (
    <AiSection
      title="Prompt libero"
      id="card-ai-section-prompt"
      hint='Descrivi cosa vuoi cambiare. Es. "titolo in inglese, accent bordeaux".'
      collapsible
      defaultOpen
    >
      <AiPromptTextarea
        label="Prompt AI personalizzato"
        value={aiText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder='Es. "titolo in inglese, accent bordeaux, niente social"'
        rows={isDesktop ? 2 : 4}
      />
      <div className="card-ai-prompt-row">
        <AiGenerateButton
          isProcessing={isProcessing}
          onClick={onRun}
          disabled={!aiText.trim() || tier === 'free'}
          className="card-action-primary"
        >
          Applica prompt
        </AiGenerateButton>
        <button
          type="button"
          className="card-ai-reset"
          onClick={onReset}
          disabled={isProcessing}
        >
          Nuova conversazione
        </button>
      </div>
    </AiSection>
  );
}
