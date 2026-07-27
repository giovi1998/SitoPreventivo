import React from 'react';
import type { BusinessCard } from '../../../utils/documentSchemas';
import { AiSection } from '../../ai-ui';
import { DecorationPicker } from '../../DecorationPicker';
import { defaultDecorativePalette } from '../../../utils/decorations/patterns';

export interface CardAIDecorationSectionProps {
  card: BusinessCard;
  isProcessing: boolean;
  onPatchDecorations: (patch: Partial<BusinessCard['decorations']>) => void;
}

export default function CardAIDecorationSection({
  card,
  onPatchDecorations,
}: CardAIDecorationSectionProps) {
  const decorations = card.decorations ?? { pattern: null, opacity: 0.2, palette: defaultDecorativePalette(card.style.accentColor, card.style.textColor) };
  const pattern = decorations.pattern;
  const opacity = decorations.opacity ?? 0.2;
  const palette = decorations.palette || defaultDecorativePalette(card.style.accentColor, card.style.textColor);

  return (
    <AiSection
      title="Decorazione"
      id="card-ai-section-decoration"
      hint="Pattern SVG dietro i contenuti. Sostituisce il decoro di default."
      collapsible
      defaultOpen={false}
    >
      <DecorationPicker
        value={pattern}
        palette={palette}
        onChange={(id) => onPatchDecorations({ pattern: id, palette })}
        ariaLabel="Pattern decorazione AI"
      />
      {pattern && (
        <>
          <div className="card-ai-color-row">
            <label className="card-ai-color-cell">
              <span>Primario</span>
              <input
                type="color"
                value={palette.primary}
                onChange={(e) => onPatchDecorations({ palette: { ...palette, primary: e.target.value } })}
                aria-label="Colore primario decorazione"
              />
            </label>
            <label className="card-ai-color-cell">
              <span>Secondario</span>
              <input
                type="color"
                value={palette.secondary}
                onChange={(e) => onPatchDecorations({ palette: { ...palette, secondary: e.target.value } })}
                aria-label="Colore secondario decorazione"
              />
            </label>
            <label className="card-ai-color-cell">
              <span>Accento</span>
              <input
                type="color"
                value={palette.accent || card.style.accentColor}
                onChange={(e) => onPatchDecorations({ palette: { ...palette, accent: e.target.value } })}
                aria-label="Colore accento decorazione"
              />
            </label>
          </div>
          <div className="card-ai-field">
            <span>Opacità ({Math.round(opacity * 100)}%)</span>
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={opacity}
              onChange={(e) => onPatchDecorations({ opacity: Number(e.target.value) })}
              aria-label="Opacità decorazione"
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}
    </AiSection>
  );
}
