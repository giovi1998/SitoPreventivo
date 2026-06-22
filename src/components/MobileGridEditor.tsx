import { useState } from 'react';
import type { CardGrid } from '../utils/documentSchemas';
import {
  gridPresetLeft,
  gridPresetCentered,
  gridPresetSplit,
  gridPresetBackDefault,
} from '../utils/documentSchemas';
import {
  canMove as canMoveUtil,
  clampMove,
  wouldCollideOnMove,
} from '../utils/gridUtils';

interface MobileGridEditorProps {
  grid: CardGrid;
  onChange: (grid: CardGrid) => void;
  side?: 'front' | 'back';
}

type ElementKey = keyof CardGrid['elements'];

const FRONT_ELEMENTS: { value: ElementKey; label: string }[] = [
  { value: 'photo', label: 'Foto' },
  { value: 'name', label: 'Nome' },
  { value: 'title', label: 'Ruolo' },
  { value: 'company', label: 'Azienda' },
  { value: 'logo', label: 'Logo' },
];

const BACK_ELEMENTS: { value: ElementKey; label: string }[] = [
  { value: 'contacts', label: 'Contatti' },
  { value: 'qr', label: 'QR' },
  { value: 'socials', label: 'Social' },
];

export default function MobileGridEditor({ grid, onChange, side = 'front' }: MobileGridEditorProps) {
  const isFront = side === 'front';
  const elementOptions = isFront ? FRONT_ELEMENTS : BACK_ELEMENTS;
  const presetOptions: Array<{ value: 'left' | 'centered' | 'split'; label: string }> = isFront
    ? [
        { value: 'left', label: 'Sinistra' },
        { value: 'centered', label: 'Centrato' },
        { value: 'split', label: 'Diviso' },
      ]
    : [{ value: 'split', label: 'Default retro' }];
  const [selected, setSelected] = useState<ElementKey | ''>('');
  const [preset, setPreset] = useState<'left' | 'centered' | 'split'>('left');
  const [popupOpen, setPopupOpen] = useState(false);

  const applyPreset = (p: 'left' | 'centered' | 'split') => {
    setPreset(p);
    if (!isFront) {
      onChange(gridPresetBackDefault());
      return;
    }
    if (p === 'left') onChange(gridPresetLeft());
    else if (p === 'centered') onChange(gridPresetCentered());
    else onChange(gridPresetSplit());
  };

  const move = (dx: number, dy: number) => {
    if (!selected) return;
    const el = grid.elements[selected];
    if (!el) return;
    const { x: newX, y: newY } = clampMove(grid, selected, dx, dy);
    if (newX === el.x && newY === el.y) return;
    onChange({
      ...grid,
      elements: { ...grid.elements, [selected]: { ...el, x: newX, y: newY } },
    });
    setPopupOpen(false);
  };

  const canUp = selected ? canMoveUtil(grid, selected, 'up') : false;
  const canDown = selected ? canMoveUtil(grid, selected, 'down') : false;
  const canLeft = selected ? canMoveUtil(grid, selected, 'left') : false;
  const canRight = selected ? canMoveUtil(grid, selected, 'right') : false;
  const selectedEl = selected ? grid.elements[selected] : null;
  const upCollide = selected && selectedEl
    ? wouldCollideOnMove(grid, selected, 0, -1)
    : false;
  const downCollide = selected && selectedEl
    ? wouldCollideOnMove(grid, selected, 0, 1)
    : false;
  const leftCollide = selected && selectedEl
    ? wouldCollideOnMove(grid, selected, -1, 0)
    : false;
  const rightCollide = selected && selectedEl
    ? wouldCollideOnMove(grid, selected, 1, 0)
    : false;

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
          {elementOptions.map((o) => (
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
          {presetOptions.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
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
              <button
                type="button"
                onClick={() => move(0, -1)}
                aria-label="Sposta su"
                disabled={!canUp}
                title={!canUp ? (upCollide ? 'Limite (collisione)' : 'Limite raggiunto') : 'Sposta su'}
              >↑</button>
              <button
                type="button"
                onClick={() => move(-1, 0)}
                aria-label="Sposta a sinistra"
                disabled={!canLeft}
                title={!canLeft ? (leftCollide ? 'Limite (collisione)' : 'Limite raggiunto') : 'Sposta a sinistra'}
              >←</button>
              <button
                type="button"
                onClick={() => move(1, 0)}
                aria-label="Sposta a destra"
                disabled={!canRight}
                title={!canRight ? (rightCollide ? 'Limite (collisione)' : 'Limite raggiunto') : 'Sposta a destra'}
              >→</button>
              <button
                type="button"
                onClick={() => move(0, 1)}
                aria-label="Sposta giù"
                disabled={!canDown}
                title={!canDown ? (downCollide ? 'Limite (collisione)' : 'Limite raggiunto') : 'Sposta giù'}
              >↓</button>
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
