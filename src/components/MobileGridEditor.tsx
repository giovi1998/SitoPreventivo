import { useState } from 'react';
import type { CardGrid } from '../utils/documentSchemas';
import {
  gridPresetLeft,
  gridPresetCentered,
  gridPresetSplit,
} from '../utils/documentSchemas';

interface MobileGridEditorProps {
  grid: CardGrid;
  onChange: (grid: CardGrid) => void;
}

type ElementKey = keyof CardGrid['elements'];

const ELEMENT_OPTIONS: { value: ElementKey; label: string }[] = [
  { value: 'photo', label: 'Foto' },
  { value: 'name', label: 'Nome' },
  { value: 'title', label: 'Ruolo' },
  { value: 'company', label: 'Azienda' },
  { value: 'contacts', label: 'Contatti' },
  { value: 'qr', label: 'QR' },
  { value: 'socials', label: 'Social' },
];

export default function MobileGridEditor({ grid, onChange }: MobileGridEditorProps) {
  const [selected, setSelected] = useState<ElementKey | ''>('');
  const [preset, setPreset] = useState<'left' | 'centered' | 'split'>('left');
  const [popupOpen, setPopupOpen] = useState(false);

  const applyPreset = (p: 'left' | 'centered' | 'split') => {
    setPreset(p);
    if (p === 'left') onChange(gridPresetLeft());
    else if (p === 'centered') onChange(gridPresetCentered());
    else onChange(gridPresetSplit());
  };

  const move = (dx: number, dy: number) => {
    if (!selected) return;
    const el = grid.elements[selected];
    if (!el) return;
    const newX = Math.max(0, Math.min(grid.cols - el.w, el.x + dx));
    const newY = Math.max(0, Math.min(grid.rows - el.h, el.y + dy));
    onChange({
      ...grid,
      elements: { ...grid.elements, [selected]: { ...el, x: newX, y: newY } },
    });
    setPopupOpen(false);
  };

  return (
    <div className="card-mobile-grid-editor" data-testid="mobile-grid-editor">
      <label className="card-field">
        <span>Elemento</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as ElementKey)}
          aria-label="Elemento"
        >
          <option value="">—</option>
          {ELEMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="card-field">
        <span>Preset</span>
        <select
          value={preset}
          onChange={(e) => applyPreset(e.target.value as 'left' | 'centered' | 'split')}
          aria-label="Preset"
        >
          <option value="left">Sinistra</option>
          <option value="centered">Centrato</option>
          <option value="split">Diviso</option>
        </select>
      </label>
      <button
        type="button"
        className="card-mobile-grid-move-btn"
        onClick={() => setPopupOpen(true)}
        disabled={!selected}
      >
        Sposta elemento
      </button>
      {popupOpen && (
        <div
          className="card-mobile-grid-popup"
          role="dialog"
          aria-modal="true"
          aria-label="Popup sposta elemento"
          data-testid="mobile-grid-popup"
        >
          <div className="card-mobile-grid-popup-content">
            <p>Sposta {selected}</p>
            <div className="card-mobile-grid-popup-arrows">
              <button type="button" onClick={() => move(0, -1)} aria-label="Sposta su">↑</button>
              <button type="button" onClick={() => move(-1, 0)} aria-label="Sposta a sinistra">←</button>
              <button type="button" onClick={() => move(1, 0)} aria-label="Sposta a destra">→</button>
              <button type="button" onClick={() => move(0, 1)} aria-label="Sposta giù">↓</button>
            </div>
            <button type="button" onClick={() => setPopupOpen(false)} className="card-mobile-grid-popup-close">
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
