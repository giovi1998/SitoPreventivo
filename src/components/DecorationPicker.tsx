import React from 'react';
import {
  DECORATIVE_PATTERN_IDS,
  type DecorativePatternId,
  renderDecorativePattern,
  defaultDecorativePalette,
  type DecorativePalette,
} from '../utils/decorations/patterns';
import './DecorationPicker.css';

export const DECORATION_LABELS: Record<DecorativePatternId, string> = {
  'wave-bottom': 'Onda in basso',
  'wave-split': 'Onda divisa',
  'blob-corner': 'Blob ad angolo',
  'splash-corners': 'Splash agli angoli',
  'full-overlay': 'Overlay pieno',
};

export interface DecorationPickerProps {
  value: DecorativePatternId | null;
  palette?: DecorativePalette;
  onChange: (id: DecorativePatternId | null) => void;
  ariaLabel?: string;
}

const THUMB_W = 80;
const THUMB_H = 50;

function thumbSvg(id: DecorativePatternId, palette: DecorativePalette): string {
  const inner = renderDecorativePattern(id, THUMB_W, THUMB_H, {
    palette,
    opacity: 0.6,
  });
  return `<svg viewBox="0 0 ${THUMB_W} ${THUMB_H}" xmlns="http://www.w3.org/2000/svg" class="decoration-picker__thumb-svg">${inner}</svg>`;
}

export function DecorationPicker({
  value,
  palette,
  onChange,
  ariaLabel = 'Selettore decorazione',
}: DecorationPickerProps) {
  const resolvedPalette = palette ?? defaultDecorativePalette('#01696F', '#E11D48');
  return (
    <div className="decoration-picker" role="radiogroup" aria-label={ariaLabel} data-testid="decoration-picker">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        className={`decoration-picker__thumb decoration-picker__thumb--none${value === null ? ' decoration-picker__thumb--active' : ''}`}
        onClick={() => onChange(null)}
        title="Nessuna decorazione"
        data-testid="decoration-thumb-none"
      >
        <span className="decoration-picker__thumb-svg">Nessuno</span>
        <span className="decoration-picker__thumb-label">Nessuno</span>
      </button>
      {DECORATIVE_PATTERN_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={`decoration-picker__thumb${value === id ? ' decoration-picker__thumb--active' : ''}`}
          onClick={() => onChange(id)}
          title={DECORATION_LABELS[id]}
          data-testid={`decoration-thumb-${id}`}
          dangerouslySetInnerHTML={{ __html: `${thumbSvg(id, resolvedPalette)}<span class="decoration-picker__thumb-label">${DECORATION_LABELS[id]}</span>` }}
        />
      ))}
    </div>
  );
}

export default DecorationPicker;