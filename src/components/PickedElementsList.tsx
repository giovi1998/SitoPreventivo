import React from 'react';
import type { PickedElement } from './ElementPickerPanel';
import './ElementPickerPanel.css';

interface PickedElementsListProps {
  selected: PickedElement[];
  onRemove: (index: number) => void;
  onClear: () => void;
}

/**
 * Lista elementi selezionati (multi-selezione) con rimozione singola/totale.
 * Vive nel panel AI, sotto il picker.
 */
export default function PickedElementsList({ selected, onRemove, onClear }: PickedElementsListProps) {
  if (selected.length === 0) return null;
  return (
    <div className="element-inspector">
      <div className="element-inspector__header">
        <span className="element-inspector__title">🎯 {selected.length} elemento{selected.length > 1 ? 'i' : ''} selezionat{selected.length > 1 ? 'i' : 'o'}</span>
        <button type="button" className="element-inspector__close" onClick={onClear} aria-label="Deseleziona tutti">✕</button>
      </div>
      {selected.map((p, i) => (
        <div key={i} className="element-inspector__item">
          <div className="element-inspector__item-header">
            <span className="element-inspector__page">{p.label}</span>
            {p.details && <span className="element-inspector__details">{p.details}</span>}
            <button type="button" className="element-inspector__close" onClick={() => onRemove(i)} aria-label="Rimuovi elemento">✕</button>
          </div>
          <pre className="element-inspector__code">{p.html.length > 120 ? p.html.slice(0, 120) + '…' : p.html}</pre>
        </div>
      ))}
    </div>
  );
}
