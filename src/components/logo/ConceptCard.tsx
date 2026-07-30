import React, { useState, useMemo } from 'react';
import type { LogoBuilder } from '../../utils/documentSchemas';
import { builderToSvg, sanitizeSvg } from '../../utils/logoGenerator';

interface ConceptCardProps {
  concept: LogoBuilder;
  index: number;
  selected: boolean;
  applied: boolean;
  bgImage: string | null;
  bgError: string | null;
  bgLoading: boolean;
  onSelect: () => void;
  onRegenerate: (promptText: string) => void;
  regenerating: boolean;
}

export function ConceptCard({
  concept,
  index,
  selected,
  applied,
  bgImage,
  bgError,
  bgLoading,
  onSelect,
  onRegenerate,
  regenerating,
}: ConceptCardProps): React.ReactElement {
  const [promptDraft, setPromptDraft] = useState(concept.imagePrompt || '');

  const previewSvg = useMemo(() => {
    try {
      const withBg = bgImage ? { ...concept, backgroundImage: bgImage } : concept;
      return sanitizeSvg(builderToSvg(withBg));
    } catch {
      return '';
    }
  }, [concept, bgImage]);

  return (
    <div className={`logo-ai-concept${selected ? ' is-selected' : ''}${applied ? ' is-applied' : ''}`}>
      <button
        type="button"
        className="logo-ai-concept-select"
        onClick={onSelect}
        disabled={bgLoading}
        aria-pressed={selected}
        aria-busy={bgLoading}
      >
        <div className="logo-ai-concept-preview">
          <div className="logo-ai-concept-preview-inner" dangerouslySetInnerHTML={{ __html: previewSvg }} />
          {bgLoading && (
            <div className="logo-ai-concept-loading" role="status" aria-live="polite">
              <span className="logo-ai-concept-spinner" aria-hidden="true" />
              <span className="logo-ai-concept-loading-text">Generazione sfondo…</span>
            </div>
          )}
        </div>
        <div className="logo-ai-concept-meta">
          <strong>Concept {index + 1}</strong>
          <span>{concept.primaryText}</span>
          <span>{concept.tagline}</span>
          <span className="logo-ai-concept-tags">
            {concept.iconType} · {concept.layout}
            {concept.decorativeElements?.length ? ` · ${concept.decorativeElements.join(', ')}` : ''}
            {concept.gradientFill ? ' · gradient' : ''}
          </span>
          {bgImage && <span className="logo-ai-concept-ai-badge">AI bg ✓</span>}
          {bgError && <span className="logo-ai-concept-ai-err">AI bg: {bgError}</span>}
        </div>
        {applied && <span className="logo-ai-concept-badge">Applicato</span>}
        {!selected && !applied && <span className="logo-ai-concept-cta">Seleziona</span>}
      </button>

      {concept.imagePrompt && (
        <details className="logo-ai-concept-advanced">
          <summary>Prompt avanzato</summary>
          <textarea
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value.slice(0, 600))}
            rows={4}
            aria-label={`Prompt immagine concept ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => onRegenerate(promptDraft)}
            disabled={regenerating || !promptDraft.trim()}
          >
            {regenerating ? 'Rigenerando…' : 'Rigenera immagine'}
          </button>
        </details>
      )}
    </div>
  );
}

export default ConceptCard;
