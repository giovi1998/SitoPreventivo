import React from 'react';
import type { Flyer } from '../../utils/documentSchemas';

const FLYER_FONTS = [
  { value: 'Inter, sans-serif', label: 'Inter (sans-serif, moderno)' },
  { value: 'Roboto, sans-serif', label: 'Roboto (sans-serif, Android)' },
  { value: 'Open Sans, sans-serif', label: 'Open Sans (sans-serif, leggibile)' },
  { value: 'Lato, sans-serif', label: 'Lato (sans-serif, elegante)' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat (sans-serif, geometrico)' },
  { value: 'Poppins, sans-serif', label: 'Poppins (sans-serif, arrotondato)' },
  { value: 'Georgia, serif', label: 'Georgia (serif, classico)' },
  { value: 'Times New Roman, serif', label: 'Times New Roman (serif, tradizionale)' },
  { value: 'Courier New, monospace', label: 'Courier New (monospace)' },
];

interface FlyerStyleFieldsProps {
  flyer: Flyer;
  showCustomFont: boolean;
  setShowCustomFont: (v: boolean) => void;
  onUpdateStyle: <K extends keyof Flyer['style']>(key: K, value: Flyer['style'][K]) => void;
}

export function FlyerStyleFields({ flyer, showCustomFont, setShowCustomFont, onUpdateStyle }: FlyerStyleFieldsProps): React.ReactElement {
  const isSelected = FLYER_FONTS.some((f) => f.value === flyer.style.fontFamily);
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
      <label className="flyer-font-label">
        <span className="flyer-field-label">Font</span>
        <select
          value={isSelected ? flyer.style.fontFamily : '__custom__'}
          onChange={(e) => { const v = e.target.value; if (v === '__custom__') { setShowCustomFont(true); } else { setShowCustomFont(false); onUpdateStyle('fontFamily', v); } }}
        >
          {FLYER_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          <option value="__custom__">Personalizzato…</option>
        </select>
      </label>
      {showCustomFont && <label className="flyer-font-custom">Nome font<input value={flyer.style.fontFamily} onChange={(e) => onUpdateStyle('fontFamily', e.target.value)} placeholder="Es. Playfair Display, sans-serif" /></label>}
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
