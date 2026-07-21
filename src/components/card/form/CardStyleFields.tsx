import type { CardSectionProps, BusinessCardBorderStyle, BusinessCardSizePreset } from './types';
import type { BusinessCard } from '../../../utils/documentSchemas';
import {
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
} from '../../../utils/documentSchemas';
import { SIZE_PRESET_LABELS, BORDER_LABELS } from './labels';
import { AiFontPicker } from '../../ai-ui';
import { DECORATIVE_PATTERN_IDS, type DecorativePatternId, defaultDecorativePalette } from '../../../utils/decorations/patterns';

const PATTERN_LABELS: Record<DecorativePatternId, string> = {
  'wave-bottom': 'Onda in basso',
  'wave-split': 'Onda divisa',
  'blob-corner': 'Blob ad angolo',
  'splash-corners': 'Splash agli angoli',
  'full-overlay': 'Overlay pieno',
};

export interface CardStyleFieldsProps extends CardSectionProps {
  onPatchDecorations?: (patch: Partial<BusinessCard['decorations']>) => void;
}

export function CardStyleFields({ card, patchStyle, onPatchDecorations }: CardStyleFieldsProps) {
  const fontScale = Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, card.style.fontScale ?? 1));
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
          <select
            value={pattern ?? ''}
            onChange={(e) => {
              const id = e.target.value as DecorativePatternId | '';
              onPatchDecorations({
                pattern: id || null,
                palette,
              });
            }}
            aria-label="Pattern decorazione"
          >
            <option value="">Nessuno (decorazione classica)</option>
            {DECORATIVE_PATTERN_IDS.map((id) => (
              <option key={id} value={id}>{PATTERN_LABELS[id]}</option>
            ))}
          </select>
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
      <div className="card-field" data-testid="card-font-scale">
        <span>Dimensione testo ({Math.round(fontScale * 100)}%)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="card-preview-zoom-btn"
            onClick={() => patchStyle({ fontScale: Math.max(FONT_SCALE_MIN, Math.round((fontScale - FONT_SCALE_STEP) * 100) / 100) })}
            disabled={fontScale <= FONT_SCALE_MIN}
            aria-label="Diminuisci dimensione testo"
            title="Diminuisci dimensione testo"
          >−</button>
          <input
            type="range"
            min={FONT_SCALE_MIN}
            max={FONT_SCALE_MAX}
            step={FONT_SCALE_STEP}
            value={fontScale}
            onChange={(e) => patchStyle({ fontScale: Number(e.target.value) })}
            aria-label="Dimensione testo"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="card-preview-zoom-btn"
            onClick={() => patchStyle({ fontScale: Math.min(FONT_SCALE_MAX, Math.round((fontScale + FONT_SCALE_STEP) * 100) / 100) })}
            disabled={fontScale >= FONT_SCALE_MAX}
            aria-label="Aumenta dimensione testo"
            title="Aumenta dimensione testo"
          >+</button>
          <button
            type="button"
            onClick={() => patchStyle({ fontScale: 1 })}
            className="card-ai-reset"
            aria-label="Reset dimensione testo"
            title="Reset (100%)"
          >Reset</button>
        </div>
      </div>
    </fieldset>
  );
}
