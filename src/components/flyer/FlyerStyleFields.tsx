import React from 'react';
import type { Flyer } from '../../utils/documentSchemas';
import { AiFontPicker } from '../ai-ui';

interface FlyerStyleFieldsProps {
  flyer: Flyer;
  showCustomFont: boolean;
  setShowCustomFont: (v: boolean) => void;
  onUpdateStyle: <K extends keyof Flyer['style']>(key: K, value: Flyer['style'][K]) => void;
}

export function FlyerStyleFields({ flyer, onUpdateStyle }: FlyerStyleFieldsProps): React.ReactElement {
  const currentScale = flyer.style.fontScale ?? 1;
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
    </div>
  );
}

export default FlyerStyleFields;
