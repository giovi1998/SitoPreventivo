import type { CardSectionProps, BusinessCardBorderStyle, BusinessCardSizePreset } from './types';
import type { BusinessCard } from '../../../utils/documentSchemas';
import { SIZE_PRESET_LABELS, BORDER_LABELS } from './labels';
import { AiFontPicker } from '../../ai-ui';
import { DecorationPicker } from '../../DecorationPicker';
import { type DecorativePatternId, defaultDecorativePalette } from '../../../utils/decorations/patterns';

export interface CardStyleFieldsProps extends CardSectionProps {
  onPatchDecorations?: (patch: Partial<BusinessCard['decorations']>) => void;
}

export function CardStyleFields({ card, patchStyle, onPatchDecorations }: CardStyleFieldsProps) {
  const decorations = card.decorations ?? { pattern: null, opacity: 0.2, palette: defaultDecorativePalette(card.style.accentColor, card.style.textColor) };
  const pattern = decorations.pattern ?? null;
  const opacity = decorations.opacity ?? 0.2;
  const palette = decorations.palette || defaultDecorativePalette(card.style.accentColor, card.style.textColor);
  return (
    <fieldset className="card-fieldset">
      <legend>Stile</legend>
      <div className="card-row-2">
        <label className="card-field">
          <span>Formato bigliettino</span>
          <select
            value={card.style.sizePreset}
            onChange={(e) => patchStyle({ sizePreset: e.target.value as BusinessCardSizePreset })}
            aria-label="Formato bigliettino"
          >
            {Object.entries(SIZE_PRESET_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="card-field">
          <span>Stile bordo</span>
          <select
            value={card.style.borderStyle}
            onChange={(e) => patchStyle({ borderStyle: e.target.value as BusinessCardBorderStyle })}
            aria-label="Stile bordo"
          >
            {Object.entries(BORDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="card-color-row">
        <label className="card-color-cell">
          <span>Sfondo</span>
          <div className="card-color-pill">
            <input
              type="color"
              value={card.style.bgColor}
              onChange={(e) => patchStyle({ bgColor: e.target.value })}
              aria-label="Colore sfondo"
            />
            <code>{card.style.bgColor.toUpperCase()}</code>
          </div>
        </label>
        <label className="card-color-cell">
          <span>Testo</span>
          <div className="card-color-pill">
            <input
              type="color"
              value={card.style.textColor}
              onChange={(e) => patchStyle({ textColor: e.target.value })}
              aria-label="Colore testo"
            />
            <code>{card.style.textColor.toUpperCase()}</code>
          </div>
        </label>
        <label className="card-color-cell">
          <span>Accento</span>
          <div className="card-color-pill">
            <input
              type="color"
              value={card.style.accentColor}
              onChange={(e) => patchStyle({ accentColor: e.target.value })}
              aria-label="Colore accento"
            />
            <code>{card.style.accentColor.toUpperCase()}</code>
          </div>
        </label>
      </div>
      <AiFontPicker
        label="Font del bigliettino"
        value={card.style.fontFamily}
        onChange={(font) => patchStyle({ fontFamily: font })}
        aria-label="Font del bigliettino"
        data-testid="card-font-family"
      />
      {onPatchDecorations && (
        <div className="card-field" data-testid="card-decoration-field">
          <span>Decorazione</span>
          <DecorationPicker
            value={pattern}
            palette={palette}
            onChange={(id) => onPatchDecorations({ pattern: id, palette })}
            ariaLabel="Pattern decorazione bigliettino"
          />
          {pattern && (
            <>
              <div className="card-color-row" style={{ marginTop: 6 }}>
                <label className="card-color-cell">
                  <span>Primario</span>
                  <div className="card-color-pill">
                    <input
                      type="color"
                      value={palette.primary}
                      onChange={(e) => onPatchDecorations({ palette: { ...palette, primary: e.target.value } })}
                      aria-label="Colore primario decorazione"
                    />
                    <code>{palette.primary.toUpperCase()}</code>
                  </div>
                </label>
                <label className="card-color-cell">
                  <span>Secondario</span>
                  <div className="card-color-pill">
                    <input
                      type="color"
                      value={palette.secondary}
                      onChange={(e) => onPatchDecorations({ palette: { ...palette, secondary: e.target.value } })}
                      aria-label="Colore secondario decorazione"
                    />
                    <code>{palette.secondary.toUpperCase()}</code>
                  </div>
                </label>
                <label className="card-color-cell">
                  <span>Accento</span>
                  <div className="card-color-pill">
                    <input
                      type="color"
                      value={palette.accent || card.style.accentColor}
                      onChange={(e) => onPatchDecorations({ palette: { ...palette, accent: e.target.value } })}
                      aria-label="Colore accento decorazione"
                    />
                    <code>{(palette.accent || card.style.accentColor).toUpperCase()}</code>
                  </div>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted, #647086)' }}>
                  Opacità ({Math.round(opacity * 100)}%)
                </span>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => onPatchDecorations({ opacity: Number(e.target.value) })}
                  aria-label="Opacità decorazione"
                  style={{ flex: 1 }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}
