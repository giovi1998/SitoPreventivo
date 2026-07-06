import React from 'react';
import AILogPanel from '../AILogPanel';
import type { AILogEntry } from '../../ai/types';
import type { BusinessCard } from '../../utils/documentSchemas';

// Phase 2.2 refactor: pannello AI condiviso del bigliettino.
// v2.4 redesign: pannello diviso in sezioni con gerarchia visiva chiara
// (Sfondo AI / Stile veloce / Prompt libero), CTA primari distinti, e
// microcopy che spiega ogni azione. Le azioni esistenti (onRun per le
// quick action, onGenerateCover per la cover AI) restano identiche.

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
  /** 'desktop' = colonna 3. 'mobile' = tab/bottom-sheet. */
  variant: 'desktop' | 'mobile';
  /** Spec v2.4: tier guard for cover image generation. */
  tier?: 'free' | 'unlocked';
  /** Spec v2.4: callback for "Genera cover AI" button. */
  onGenerateCover?: (side: 'front' | 'back' | 'both') => void;
  /** v2.4: callback to remove a generated cover image. */
  onRemoveCover?: (side: 'front' | 'back') => void;
  /** v2.4: card snapshot, used to show cover thumbnails in the AI panel. */
  card?: BusinessCard;
}

/** Quick actions split into two semantic groups. */
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
  onGenerateCover,
  onRemoveCover,
  card,
}: CardAIControlsProps) {
  const isDesktop = variant === 'desktop';
  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const coverLocked = tier !== 'unlocked' && !isLocal;
  const hasFrontCover = !!card?.front.coverImageUrl;
  const hasBackCover = !!card?.back.coverImageUrl;

  const modelSelect = (
    <select
      value={aiModel}
      onChange={(e) => onModelChange(e.target.value)}
      aria-label="Modello AI"
      className="card-ai-model-select"
    >
      {availableModels.length > 0 ? (
        availableModels.map((m) => (
          <option key={m.id} value={m.id}>{m.name}, {m.model}</option>
        ))
      ) : (
        <option value="deepseek-chat">DeepSeek Chat</option>
      )}
    </select>
  );

  const backgroundSection = onGenerateCover ? (
    <section className="card-ai-section" aria-labelledby="card-ai-section-bg">
      <header className="card-ai-section__head">
        <h3 id="card-ai-section-bg" className="card-ai-section__title">
          Sfondo AI
        </h3>
        <p className="card-ai-section__hint">
          Texture con i colori della card. Nessun testo, nessun logo.
        </p>
      </header>
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
            {coverLocked ? '🔒 Sblocca' : 'Genera fronte'}
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
            {coverLocked ? '🔒 Sblocca' : 'Genera retro'}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="card-action-primary card-ai-both-btn"
        onClick={() => onGenerateCover('both')}
        disabled={isProcessing || coverLocked}
        title="Genera sfondo AI per fronte e retro in parallelo"
      >
        {isProcessing ? '⏳ Generazione…' : coverLocked ? '🔒 Sblocca per generare entrambi' : '✨ Genera entrambi i lati'}
      </button>
    </section>
  ) : null;

  const quickGroup = (items: { mode: string; label: string; title: string }[]) => (
    <div className="card-ai-chip-row">
      {items.map((a) => (
        <button
          key={a.mode}
          type="button"
          className="card-ai-chip"
          onClick={() => onRun(a.mode)}
          disabled={isProcessing}
          title={a.title}
        >
          {a.label}
        </button>
      ))}
    </div>
  );

  const quickSection = (
    <section className="card-ai-section" aria-labelledby="card-ai-section-style">
      <header className="card-ai-section__head">
        <h3 id="card-ai-section-style" className="card-ai-section__title">
          Stile veloce
        </h3>
        <p className="card-ai-section__hint">
          Modifiche rapide con un click. Cambiano solo i campi della card.
        </p>
      </header>
      <div className="card-ai-quick-group">
        <span className="card-ai-quick-group__label">Pulisci</span>
        {quickGroup(QUICK_GROUP_CLEAN)}
      </div>
      <div className="card-ai-quick-group">
        <span className="card-ai-quick-group__label">Personalizza</span>
        {quickGroup(QUICK_GROUP_PERSONALIZE)}
      </div>
    </section>
  );

  const promptSection = (
    <section className="card-ai-section" aria-labelledby="card-ai-section-prompt">
      <header className="card-ai-section__head">
        <h3 id="card-ai-section-prompt" className="card-ai-section__title">
          Prompt libero
        </h3>
        <p className="card-ai-section__hint">
          Descrivi cosa vuoi cambiare. Es. "titolo in inglese, accent bordeaux".
        </p>
      </header>
      {isDesktop ? (
        <textarea
          className="card-ai-textarea"
          value={aiText}
          onChange={(e) => onTextChange(e.target.value)}
          aria-label="Prompt AI personalizzato"
          placeholder='Es. "titolo in inglese, accent bordeaux, niente social"'
          rows={2}
        />
      ) : (
        <textarea
          className="card-ai-textarea"
          value={aiText}
          onChange={(e) => onTextChange(e.target.value)}
          aria-label="Prompt AI personalizzato"
          placeholder='Es. "titolo in inglese, accent bordeaux, niente social"'
          rows={4}
        />
      )}
      <div className="card-ai-prompt-row">
        <button
          type="button"
          className="card-action-primary"
          onClick={() => onRun('custom')}
          disabled={isProcessing || !aiText.trim()}
        >
          {isProcessing ? 'Elaborazione…' : 'Applica prompt'}
        </button>
        <button
          type="button"
          className="card-ai-reset"
          onClick={onReset}
          disabled={isProcessing}
        >
          Nuova conversazione
        </button>
      </div>
    </section>
  );

  if (isDesktop) {
    return (
      <div className="card-ai-panel" data-testid="card-ai-panel">
        <div className="card-ai-model-row">
          <label className="card-ai-model-label">
            <span>Modello</span>
            {modelSelect}
          </label>
        </div>
        {backgroundSection}
        {quickSection}
        {promptSection}
        <AILogPanel logs={logs} isProcessing={isProcessing} />
      </div>
    );
  }
  // mobile (tab + bottom sheet)
  return (
    <div className="card-ai-panel" data-testid="card-ai-panel">
      <label className="card-ai-model-label">
        <span>Modello</span>
        {modelSelect}
      </label>
      {backgroundSection}
      {quickSection}
      {promptSection}
      <AILogPanel logs={logs} isProcessing={isProcessing} />
    </div>
  );
}
