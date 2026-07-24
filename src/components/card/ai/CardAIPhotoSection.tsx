import React from 'react';
import type { BusinessCard } from '../../../utils/documentSchemas';
import { AiSection, AiPromptTextarea, AiPromptLibrary } from '../../ai-ui';
import type { PromptLibraryEntry } from '../../../utils/promptLibrary';

export interface CardAIPhotoSectionProps {
  card: BusinessCard;
  tier: 'free' | 'unlocked';
  isProcessing: boolean;
  prompt: string;
  onPromptChange: (v: string) => void;
  showPromptEditor: boolean;
  onTogglePromptEditor: () => void;
  onGenerate: (imageModel?: string) => void;
  library: PromptLibraryEntry[];
  onSavePrompt: () => void;
  onApplyPrompt: (entry: PromptLibraryEntry) => void;
  onDeletePrompt: (id: string) => void;
  onFillAutoPrompt: () => void;
}

export default function CardAIPhotoSection({
  tier,
  isProcessing,
  prompt,
  onPromptChange,
  showPromptEditor,
  onTogglePromptEditor,
  onGenerate,
  library,
  onSavePrompt,
  onApplyPrompt,
  onDeletePrompt,
  onFillAutoPrompt,
}: CardAIPhotoSectionProps) {
  const photoLocked = tier !== 'unlocked';

  return (
    <AiSection
      title="Foto AI"
      id="card-ai-section-photo"
      hint="Genera un'illustrazione professionale dal ruolo e dai servizi."
      collapsible
      defaultOpen={false}
    >
      <button
        type="button"
        className="card-action-primary"
        onClick={() => onGenerate()}
        disabled={isProcessing || photoLocked}
        title={photoLocked ? 'Disponibile nella versione Pro' : 'Genera illustrazione professionale basata su ruolo e servizi'}
        data-testid="card-generate-photo-ai"
      >
        {isProcessing ? 'Generazione…' : photoLocked ? '🔒 Genera foto AI (Pro)' : '✨ Genera foto AI'}
      </button>

      <button
        type="button"
        className="btn-secondary card-ai-photo-prompt-toggle"
        onClick={onTogglePromptEditor}
        disabled={isProcessing}
        aria-expanded={showPromptEditor}
      >
        {showPromptEditor ? 'Nascondi prompt' : 'Modifica prompt'}
      </button>

      {showPromptEditor && (
        <div className="card-photo-prompt-editor" data-testid="card-photo-prompt-editor">
          <AiPromptTextarea
            label="Prompt foto AI"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value.slice(0, 1000))}
            rows={4}
            maxLength={1000}
            placeholder="Vuoto = prompt automatico da ruolo/servizi. Es. cane stilizzato per dogsitter, verdure per nutrizionista…"
            aria-label="Prompt foto AI"
          />
          <button type="button" className="btn-secondary" onClick={onFillAutoPrompt} disabled={isProcessing}>
            Usa prompt automatico
          </button>
          <AiPromptLibrary
            items={library}
            onSave={onSavePrompt}
            onApply={onApplyPrompt}
            onDelete={onDeletePrompt}
            saveDisabled={!prompt.trim()}
            title="I miei prompt foto"
          />
        </div>
      )}
    </AiSection>
  );
}
