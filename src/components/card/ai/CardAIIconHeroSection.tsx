import React from 'react';
import type { BusinessCard } from '../../../utils/documentSchemas';
import { AiSection, AiSelect, AiPromptTextarea, AiPromptLibrary } from '../../ai-ui';
import { AI_IMAGE_MODELS, getAiImageModelDefault, setAiImageModelDefault } from '../../../utils/uiPrefs';
import type { PromptLibraryEntry } from '../../../utils/promptLibrary';
import type { IconBackground } from '../../../hooks/useAIIconHero';

const BACKGROUND_OPTIONS = [
  { value: 'transparent', label: 'Trasparente (Senza sfondo)' },
  { value: 'white', label: 'Bianco solido' },
  { value: 'card', label: 'Colore accento card' },
];

export interface CardAIIconHeroSectionProps {
  card: BusinessCard;
  tier: 'free' | 'unlocked';
  isProcessing: boolean;
  iconPrompt: string;
  onIconPromptChange: (v: string) => void;
  showPromptEditor: boolean;
  onTogglePromptEditor: () => void;
  onGenerateIcon: (opts: { imageModel: string; background: IconBackground }) => void;
  onFillAutoPrompt: () => void;
  library: PromptLibraryEntry[];
  onSavePrompt: () => void;
  onApplyPrompt: (entry: PromptLibraryEntry) => void;
  onDeletePrompt: (id: string) => void;
}

export default function CardAIIconHeroSection({
  tier,
  isProcessing,
  iconPrompt,
  onIconPromptChange,
  showPromptEditor,
  onTogglePromptEditor,
  onGenerateIcon,
  onFillAutoPrompt,
  library,
  onSavePrompt,
  onApplyPrompt,
  onDeletePrompt,
}: CardAIIconHeroSectionProps) {
  const locked = tier !== 'unlocked';
  const [imageModel, setImageModel] = React.useState(getAiImageModelDefault());
  const [background, setBackground] = React.useState<IconBackground>('transparent');

  const handleImageModelChange = (id: string) => {
    setImageModel(id);
    setAiImageModelDefault(id);
  };

  return (
    <AiSection
      title="Icona AI"
      id="card-ai-section-icon"
      hint="Icona stilizzata 2-colori dal ruolo o dai servizi. Sostituisce sempre la foto esistente (logo aziendale preservato)."
      collapsible
      defaultOpen={false}
    >
      <AiSelect
        label="Modello immagine"
        value={imageModel}
        onChange={(e) => handleImageModelChange(e.target.value)}
        options={AI_IMAGE_MODELS.map((m) => ({ value: m.id, label: m.name }))}
        hint={AI_IMAGE_MODELS.find((m) => m.id === imageModel)?.description}
        className="card-ai-image-model-select"
      />
      <AiSelect
        label="Sfondo icona"
        value={background}
        onChange={(e) => setBackground(e.target.value as IconBackground)}
        options={BACKGROUND_OPTIONS}
      />
      <button
        type="button"
        className="card-action-primary"
        onClick={() => onGenerateIcon({ imageModel, background })}
        disabled={isProcessing || locked}
        title={locked ? 'Disponibile nella versione Pro' : 'Genera icona stilizzata 2-colori'}
        data-testid="card-generate-icon-ai"
      >
        {isProcessing ? 'Generazione…' : locked ? 'Icona AI (Pro)' : 'Genera icona AI'}
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
        <div className="card-photo-prompt-editor" data-testid="card-icon-prompt-editor">
          <AiPromptTextarea
            label="Prompt icona AI"
            value={iconPrompt}
            onChange={(e) => onIconPromptChange(e.target.value.slice(0, 1000))}
            rows={3}
            maxLength={1000}
            placeholder="Vuoto = prompt automatico dal ruolo. Es. mela stilizzata per nutrizionista, casa per agente immobiliare…"
            aria-label="Prompt icona AI"
          />
          <button type="button" className="btn-secondary" onClick={onFillAutoPrompt} disabled={isProcessing}>
            Usa prompt automatico
          </button>
          <AiPromptLibrary
            items={library}
            onSave={onSavePrompt}
            onApply={onApplyPrompt}
            onDelete={onDeletePrompt}
            saveDisabled={!iconPrompt.trim()}
            title="I miei prompt icona"
          />
        </div>
      )}
    </AiSection>
  );
}
