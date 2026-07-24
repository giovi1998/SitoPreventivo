import React from 'react';
import type { BusinessCard } from '../../../utils/documentSchemas';
import { AiSection, AiSelect, AiPromptTextarea, AiPromptLibrary } from '../../ai-ui';
import { AI_IMAGE_MODELS, getAiImageModelDefault, setAiImageModelDefault } from '../../../utils/uiPrefs';
import type { PromptLibraryEntry } from '../../../utils/promptLibrary';

interface CoverThumbProps {
  url: string | null;
  alt: string;
  onRemove?: () => void;
  busy?: boolean;
}

function CoverThumb({ url, alt, onRemove, busy }: CoverThumbProps) {
  if (!url) {
    return (
      <div className="card-ai-cover-thumb card-ai-cover-thumb--empty" aria-label={`${alt} (nessuna immagine)`}>
        <span aria-hidden="true">＋</span>
      </div>
    );
  }
  return (
    <div className="card-ai-cover-thumb">
      <img src={url} alt={alt} />
      {onRemove && !busy && (
        <button
          type="button"
          className="card-ai-cover-thumb__remove"
          onClick={onRemove}
          aria-label={`Rimuovi ${alt.toLowerCase()}`}
          title="Rimuovi immagine"
        >
          ×
        </button>
      )}
    </div>
  );
}

export interface CardAICoverSectionProps {
  card: BusinessCard;
  tier: 'free' | 'unlocked';
  isProcessing: boolean;
  onGenerate: (side: 'front' | 'back' | 'both', imageModel?: string, promptOverride?: string) => void;
  onRemove?: (side: 'front' | 'back') => void;
  coverPrompt?: string;
  onCoverPromptChange?: (v: string) => void;
  showPromptEditor?: boolean;
  onTogglePromptEditor?: () => void;
  library?: PromptLibraryEntry[];
  onSavePrompt?: () => void;
  onApplyPrompt?: (entry: PromptLibraryEntry) => void;
  onDeletePrompt?: (id: string) => void;
  onFillAutoPrompt?: () => void;
}

export default function CardAICoverSection({
  card,
  tier,
  isProcessing,
  onGenerate,
  onRemove,
  coverPrompt = '',
  onCoverPromptChange,
  showPromptEditor = false,
  onTogglePromptEditor,
  library = [],
  onSavePrompt,
  onApplyPrompt,
  onDeletePrompt,
  onFillAutoPrompt,
}: CardAICoverSectionProps) {
  const coverLocked = tier !== 'unlocked';
  const hasFrontCover = !!card.front.coverImageUrl;
  const hasBackCover = !!card.back.coverImageUrl;
  const [imageModel, setImageModel] = React.useState(getAiImageModelDefault());

  const imageModelOptions = AI_IMAGE_MODELS.map((m) => ({ value: m.id, label: m.name }));

  const handleImageModelChange = (id: string) => {
    setImageModel(id);
    setAiImageModelDefault(id);
  };

  return (
    <AiSection
      title="Sfondo AI"
      id="card-ai-section-bg"
      hint="Texture con i colori della card. Nessun testo, nessun logo."
      collapsible
      defaultOpen={false}
    >
      <AiSelect
        label="Modello immagine"
        value={imageModel}
        onChange={(e) => handleImageModelChange(e.target.value)}
        options={imageModelOptions}
        className="card-ai-image-model-select"
        hint={AI_IMAGE_MODELS.find((m) => m.id === imageModel)?.description}
      />
      <div className="card-ai-cover-grid">
        <div className="card-ai-cover-item">
          <span className="card-ai-cover-item__label">Fronte</span>
          <CoverThumb
            url={card.front.coverImageUrl ?? null}
            alt="Cover fronte"
            onRemove={hasFrontCover && onRemove ? () => onRemove('front') : undefined}
            busy={isProcessing}
          />
          <button
            type="button"
            className="card-ai-cover-item__btn"
            onClick={() => onGenerate('front', imageModel, coverPrompt.trim() || undefined)}
            disabled={isProcessing || coverLocked}
          >
            {isProcessing ? '⏳ Generazione…' : coverLocked ? '🔒 Sblocca' : 'Genera fronte'}
          </button>
        </div>
        <div className="card-ai-cover-item">
          <span className="card-ai-cover-item__label">Retro</span>
          <CoverThumb
            url={card.back.coverImageUrl ?? null}
            alt="Cover retro"
            onRemove={hasBackCover && onRemove ? () => onRemove('back') : undefined}
            busy={isProcessing}
          />
          <button
            type="button"
            className="card-ai-cover-item__btn"
            onClick={() => onGenerate('back', imageModel, coverPrompt.trim() || undefined)}
            disabled={isProcessing || coverLocked}
          >
            {isProcessing ? '⏳ Generazione…' : coverLocked ? '🔒 Sblocca' : 'Genera retro'}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="card-action-primary card-ai-both-btn"
        onClick={() => onGenerate('both', imageModel, coverPrompt.trim() || undefined)}
        disabled={isProcessing || coverLocked}
        title="Genera sfondo AI per fronte e retro (fronte → retro)"
      >
        {isProcessing ? '⏳ Generazione…' : coverLocked ? '🔒 Sblocca per generare entrambi' : '✨ Genera entrambi i lati'}
      </button>

      {onTogglePromptEditor && onCoverPromptChange && (
        <>
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
            <div className="card-photo-prompt-editor" data-testid="card-cover-prompt-editor">
              <AiPromptTextarea
                label="Prompt sfondo AI"
                value={coverPrompt}
                onChange={(e) => onCoverPromptChange(e.target.value.slice(0, 1000))}
                rows={4}
                maxLength={1000}
                placeholder="Vuoto = prompt automatico dai colori della card. Es. texture geometrica blu, gradiente morbido..."
                aria-label="Prompt sfondo AI"
              />
              {onFillAutoPrompt && (
                <button type="button" className="btn-secondary" onClick={onFillAutoPrompt} disabled={isProcessing}>
                  Usa prompt automatico
                </button>
              )}
              {onSavePrompt && onApplyPrompt && onDeletePrompt && (
                <AiPromptLibrary
                  items={library}
                  onSave={onSavePrompt}
                  onApply={onApplyPrompt}
                  onDelete={onDeletePrompt}
                  saveDisabled={!coverPrompt.trim()}
                  title="I miei prompt sfondo"
                />
              )}
            </div>
          )}
        </>
      )}
    </AiSection>
  );
}
