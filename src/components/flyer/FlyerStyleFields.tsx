import React from 'react';
import type { Flyer } from '../../utils/documentSchemas';
import { AiFontPicker } from '../ai-ui';
import { DecorationPicker } from '../DecorationPicker';
import { defaultDecorativePalette, type DecorativePatternId } from '../../utils/decorations/patterns';

interface FlyerStyleFieldsProps {
  flyer: Flyer;
  showCustomFont: boolean;
  setShowCustomFont: (v: boolean) => void;
  onUpdateStyle: <K extends keyof Flyer['style']>(key: K, value: Flyer['style'][K]) => void;
  onUpdateDecorations?: (patch: Partial<Flyer['decorations']>) => void;
}

export function FlyerStyleFields({ flyer, onUpdateStyle, onUpdateDecorations }: FlyerStyleFieldsProps): React.ReactElement {
  const currentScale = flyer.style.fontScale ?? 1;
  const decorations = flyer.decorations ?? { pattern: null, opacity: 0.2, palette: defaultDecorativePalette(flyer.style.accentColor, flyer.style.textColor), userLocked: false };
  const pattern = decorations.pattern;
  const opacity = decorations.opacity ?? 0.2;
  const palette = decorations.palette || defaultDecorativePalette(flyer.style.accentColor, flyer.style.textColor);
  return (
    <div className="stack flyer-style-fields">
      <div className="swatches">
        {['#FFFFFF', '#FFFBF2', '#FFF1F2', '#0F172A', '#1a1a2e'].map((c) => (
          <button
            key={c}
            className={flyer.style.bgColor === c ? 'selected' : ''}
            style={{ background: c }}
            onClick={() => onUpdateStyle('bgColor', c)}
            aria-label={c}
            title={c}
          />
        ))}
      </div>
      <div className="form-grid">
        <label>Testo<input type="color" value={flyer.style.textColor} onChange={(e) => onUpdateStyle('textColor', e.target.value)} /></label>
        <label>Accento<input type="color" value={flyer.style.accentColor} onChange={(e) => onUpdateStyle('accentColor', e.target.value)} /></label>
      </div>
      <AiFontPicker
        label="Font"
        value={flyer.style.fontFamily.split(',')[0]?.trim() || flyer.style.fontFamily}
        onChange={(font) => onUpdateStyle('fontFamily', font)}
        aria-label="Font volantino"
      />
      <div className="flyer-scale-row">
        <label className="flyer-scale-label" htmlFor="flyer-font-scale">Dimensione font</label>
        <div className="flyer-scale-control">
          <input
            id="flyer-font-scale"
            type="range"
            min={0.7}
            max={1.3}
            step={0.05}
            value={currentScale}
            onChange={(e) => onUpdateStyle('fontScale', parseFloat(e.target.value))}
          />
          <span className="flyer-scale-value">{(currentScale * 100).toFixed(0)}%</span>
        </div>
      </div>
      {onUpdateDecorations && (
        <div className="flyer-decorations" data-testid="flyer-decoration-field">
          <span className="flyer-scale-label">Decorazione</span>
          <DecorationPicker
            value={pattern}
            palette={palette}
            onChange={(id: DecorativePatternId | null) => onUpdateDecorations({ pattern: id, palette })}
            ariaLabel="Pattern decorazione volantino"
          />
          {pattern && (
            <>
              <div className="form-grid" style={{ marginTop: 6 }}>
                <label>Primario<input type="color" value={palette.primary} onChange={(e) => onUpdateDecorations({ palette: { ...palette, primary: e.target.value } })} aria-label="Colore primario decorazione volantino" /></label>
                <label>Secondario<input type="color" value={palette.secondary} onChange={(e) => onUpdateDecorations({ palette: { ...palette, secondary: e.target.value } })} aria-label="Colore secondario decorazione volantino" /></label>
              </div>
              <div className="flyer-scale-row" style={{ marginTop: 6 }}>
                <label className="flyer-scale-label" htmlFor="flyer-decoration-opacity">Opacità</label>
                <div className="flyer-scale-control">
                  <input
                    id="flyer-decoration-opacity"
                    type="range"
                    min={0.05}
                    max={0.8}
                    step={0.05}
                    value={opacity}
                    onChange={(e) => onUpdateDecorations({ opacity: Number(e.target.value) })}
                    aria-label="Opacità decorazione volantino"
                  />
                  <span className="flyer-scale-value">{Math.round(opacity * 100)}%</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default FlyerStyleFields;