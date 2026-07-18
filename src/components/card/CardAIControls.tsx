import React from 'react';
import AILogPanel from '../AILogPanel';
import type { AILogEntry } from '../../ai/types';
import type { BusinessCard } from '../../utils/documentSchemas';
import {
  AiSection,
  AiPromptTextarea,
  AiSelect,
  AiGenerateButton,
  AiActionChip,
  AiActionGrid,
} from '../ai-ui';

export interface CardAIModel {
  id: string;
  name: string;
  model: string;
}

export interface CardAIControlsProps {
  aiModel: string;
  onModelChange: (m: string) => void;
  aiText: string;
  onTextChange: (t: string) => void;
  availableModels: CardAIModel[];
  isProcessing: boolean;
  onRun: (mode: string) => void;
  onReset: () => void;
  logs: AILogEntry[];
  variant: 'desktop' | 'mobile';
  tier?: 'free' | 'unlocked';
  /**
   * Phase 14 (REQ-AI-002): dentro la AIConsole rail l'AILogPanel è fornito
   * dalla console — `bare` lo nasconde per evitare duplicati.
   */
  bare?: boolean;
  onGenerateCover?: (side: 'front' | 'back' | 'both') => void;
  onRemoveCover?: (side: 'front' | 'back') => void;
  card?: BusinessCard;
}

const QUICK_GROUP_CLEAN: { mode: string; label: string; title: string }[] = [
  { mode: 'minimal', label: 'Pulisci', title: 'Rimuovi campi vuoti e placeholder, layout essenziale' },
  { mode: 'print', label: 'Stampa', title: 'Verifica contrasto e leggibilità per la stampa fisica' },
];

const QUICK_GROUP_PERSONALIZE: { mode: string; label: string; title: string }[] = [
  { mode: 'premium', label: 'Premium', title: 'Rendi più elegante e professionale' },
  { mode: 'fill', label: 'Suggerisci', title: 'Genera titolo e social plausibili dal nome' },
  { mode: 'palette', label: 'Palette', title: 'Cambia i colori (teal, navy, bordeaux, mono)' },
  { mode: 'moveQr', label: 'Sposta QR', title: 'Sposta il QR a sinistra' },
  { mode: 'growPhoto', label: 'Allarga foto', title: 'Aumenta la larghezza della foto' },
];

function CoverThumb({
  url,
  alt,
  onRemove,
  busy,
}: {
  url: string | null;
  alt: string;
  onRemove?: () => void;
  busy?: boolean;
}) {
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

export default function CardAIControls({
  aiModel,
  onModelChange,
  aiText,
  onTextChange,
  availableModels,
  isProcessing,
  onRun,
  onReset,
  logs,
  variant,
  tier = 'free',
  bare = false,
  onGenerateCover,
  onRemoveCover,
  card,
}: CardAIControlsProps) {
  const isDesktop = variant === 'desktop';
  const coverLocked = tier !== 'unlocked';
  const hasFrontCover = !!card?.front.coverImageUrl;
  const hasBackCover = !!card?.back.coverImageUrl;

  const modelOptions = availableModels.length > 0 
    ? availableModels.map(m => ({ value: m.id, label: `${m.name}, ${m.model}` }))
    : [{ value: 'deepseek-chat', label: 'DeepSeek Chat' }];

  const modelSelect = (
    <AiSelect
      label="Modello AI"
      value={aiModel}
      onChange={(e) => onModelChange(e.target.value)}
      options={modelOptions}
      className="card-ai-model-select"
    />
  );

  const backgroundSection = onGenerateCover ? (
    <AiSection 
      title="Sfondo AI" 
      id="card-ai-section-bg" 
      hint="Texture con i colori della card. Nessun testo, nessun logo."
    >
      <div className="card-ai-cover-grid">
        <div className="card-ai-cover-item">
          <span className="card-ai-cover-item__label">Fronte</span>
          <CoverThumb
            url={card?.front.coverImageUrl ?? null}
            alt="Cover fronte"
            onRemove={hasFrontCover && onRemoveCover ? () => onRemoveCover('front') : undefined}
            busy={isProcessing}
          />
          <button
            type="button"
            className="card-ai-cover-item__btn"
            onClick={() => onGenerateCover('front')}
            disabled={isProcessing || coverLocked}
          >
            {isProcessing ? '⏳ Generazione…' : coverLocked ? '🔒 Sblocca' : 'Genera fronte'}
          </button>
        </div>
        <div className="card-ai-cover-item">
          <span className="card-ai-cover-item__label">Retro</span>
          <CoverThumb
            url={card?.back.coverImageUrl ?? null}
            alt="Cover retro"
            onRemove={hasBackCover && onRemoveCover ? () => onRemoveCover('back') : undefined}
            busy={isProcessing}
          />
          <button
            type="button"
            className="card-ai-cover-item__btn"
            onClick={() => onGenerateCover('back')}
            disabled={isProcessing || coverLocked}
          >
            {isProcessing ? '⏳ Generazione…' : coverLocked ? '🔒 Sblocca' : 'Genera retro'}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="card-action-primary card-ai-both-btn"
        onClick={() => onGenerateCover('both')}
        disabled={isProcessing || coverLocked}
        title="Genera sfondo AI per fronte e retro (fronte → retro)"
      >
        {isProcessing ? '⏳ Generazione…' : coverLocked ? '🔒 Sblocca per generare entrambi' : '✨ Genera entrambi i lati'}
      </button>
    </AiSection>
  ) : null;

  const quickGroup = (items: { mode: string; label: string; title: string }[], label: string) => (
    <AiActionGrid groupLabel={label}>
      {items.map((a) => (
        <AiActionChip
          key={a.mode}
          label={a.label}
          onClick={() => onRun(a.mode)}
          disabled={isProcessing}
          title={a.title}
        />
      ))}
    </AiActionGrid>
  );

  const quickSection = (
    <AiSection 
      title="Stile veloce" 
      id="card-ai-section-style" 
      hint="Modifiche rapide con un click. Cambiano solo i campi della card."
    >
      {quickGroup(QUICK_GROUP_CLEAN, 'Pulisci')}
      {quickGroup(QUICK_GROUP_PERSONALIZE, 'Personalizza')}
    </AiSection>
  );

  const promptSection = (
    <AiSection 
      title="Prompt libero" 
      id="card-ai-section-prompt" 
      hint='Descrivi cosa vuoi cambiare. Es. "titolo in inglese, accent bordeaux".'
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
          onClick={() => onRun('custom')}
          disabled={!aiText.trim()}
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

  return (
    <div className="card-ai-panel" data-testid="card-ai-panel">
      <div className="card-ai-model-row" style={!isDesktop ? { display: 'flex', flexDirection: 'column', gap: '4px' } : undefined}>
        <label className="card-ai-model-label">
          <span>Modello</span>
          {modelSelect}
        </label>
      </div>
      {backgroundSection}
      {quickSection}
      {promptSection}
      {!bare && <AILogPanel logs={logs} isProcessing={isProcessing} />}
    </div>
  );
}
