import { useState } from 'react';
import type { BusinessCardLayout, CardGrid } from '../utils/documentSchemas';
import { CardGridControls, type GridSide } from './card/CardGridControls';
import { getAvailableGridElements, gridForCollisions } from '../utils/card/gridElements';
import { clampMove, wouldCollideOnMove } from '../utils/gridUtils';

interface MobileGridEditorProps {
  card: import('../utils/documentSchemas').BusinessCard;
  side: GridSide;
  /** Master switch (REQ-E01): quando false, il grid editor è disabilitato. */
  gridEnabled: boolean;
  selected: keyof CardGrid['elements'] | '';
  onSelect: (k: keyof CardGrid['elements'] | '') => void;
  onChangeSide: (s: GridSide) => void;
  onChangeGrid: (grid: CardGrid) => void;
  /** Applica un preset di griglia (come il desktop via applyGridPreset). */
  onApplyPreset?: (p: BusinessCardLayout) => void;
  /** Restituisce informazioni sulla mossa (per toast feedback in G). */
  onAfterMove?: (info: { element: string; dx: number; dy: number; applied: boolean; reason?: 'collision' | 'border' }) => void;
  onAfterResize?: (info: { element: string; dw: number; dh: number; applied: boolean; reason?: 'collision' | 'border' }) => void;
  onAfterAlign?: (info: { element: string; alignH: 'left' | 'center' | 'right'; alignV: 'top' | 'center' | 'bottom' }) => void;
  onPatchPlacement?: (element: keyof CardGrid['elements'], patch: { x?: number; y?: number; scale?: number }) => void;
}

// Phase 2.2 REQ-B02: MobileGridEditor condivide la logica con
// CardGridControls (selezione lato, filtro per contenuto, master switch
// gating, cols/rows) ma presenta l'interazione move come popup 3×3
// (più comodo su touch di 4 frecce inline).

/**
 * Motivo reale di una mossa bloccata (parità col desktop in
 * CardGridControls.handleMove): fuori dai bordi → 'border', altrimenti il
 * blocco viene da una collisione con un altro elemento → 'collision'.
 * Esportata per i test: i bottoni del popup sono `disabled` quando la mossa
 * è bloccata, quindi il ramo non è raggiungibile via click in jsdom.
 */
export function blockedMoveReason(
  el: { x: number; y: number; w: number; h: number },
  grid: CardGrid,
  dx: number,
  dy: number,
): 'collision' | 'border' {
  const nx = el.x + dx;
  const ny = el.y + dy;
  const outOfBounds = nx < 0 || ny < 0 || nx + el.w > grid.cols || ny + el.h > grid.rows;
  return outOfBounds ? 'border' : 'collision';
}

export default function MobileGridEditor({
  card,
  side,
  gridEnabled,
  selected,
  onSelect,
  onChangeSide,
  onChangeGrid,
  onApplyPreset,
  onAfterMove,
  onAfterResize,
  onAfterAlign,
  onPatchPlacement,
}: MobileGridEditorProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const activeGrid: CardGrid = side === 'back'
    ? (card.backGrid ?? { cols: 4, rows: 4, elements: {} })
    : (card.grid ?? { cols: 4, rows: 4, elements: {} });
  const available = getAvailableGridElements(side, card);
  const selectedEl = selected ? activeGrid.elements[selected] : null;
  const collisionGrid = gridForCollisions(activeGrid, card, side, selected || undefined);

  // canMove helpers (riuso clampMove/wouldCollideOnMove per il popup mobile).
  const canUp = !!selectedEl && (() => {
    const r = clampMove(collisionGrid, selected, 0, -1);
    return r.y !== selectedEl.y;
  })();
  const canDown = !!selectedEl && (() => {
    const r = clampMove(collisionGrid, selected, 0, 1);
    return r.y !== selectedEl.y;
  })();
  const canLeft = !!selectedEl && (() => {
    const r = clampMove(collisionGrid, selected, -1, 0);
    return r.x !== selectedEl.x;
  })();
  const canRight = !!selectedEl && (() => {
    const r = clampMove(collisionGrid, selected, 1, 0);
    return r.x !== selectedEl.x;
  })();
  const upCollide = selected && selectedEl ? wouldCollideOnMove(collisionGrid, selected, 0, -1) : false;
  const downCollide = selected && selectedEl ? wouldCollideOnMove(collisionGrid, selected, 0, 1) : false;
  const leftCollide = selected && selectedEl ? wouldCollideOnMove(collisionGrid, selected, -1, 0) : false;
  const rightCollide = selected && selectedEl ? wouldCollideOnMove(collisionGrid, selected, 1, 0) : false;

  const move = (dx: number, dy: number) => {
    if (!selected || !selectedEl) return;
    const r = clampMove(collisionGrid, selected, dx, dy);
    if (r.x === selectedEl.x && r.y === selectedEl.y) {
      onAfterMove?.({ element: selected, dx, dy, applied: false, reason: blockedMoveReason(selectedEl, activeGrid, dx, dy) });
      return;
    }
    onChangeGrid(
      { ...activeGrid, elements: { ...activeGrid.elements, [selected]: { ...selectedEl, x: r.x, y: r.y } } },
    );
    onAfterMove?.({ element: selected, dx, dy, applied: true });
    setPopupOpen(false);
  };

  return (
    <div className="card-mobile-grid-editor" data-testid="mobile-grid-editor">
      <CardGridControls
        card={card}
        side={side}
        gridEnabled={gridEnabled}
        onSideChange={(s) => { onChangeSide(s); onSelect(''); }}
        onChangeGrid={onChangeGrid}
        onApplyPreset={onApplyPreset}
        selected={selected}
        onSelect={onSelect}
        onAfterMove={onAfterMove}
        onAfterResize={onAfterResize}
        onAfterAlign={onAfterAlign}
        onPatchPlacement={onPatchPlacement}
        mode="mobile"
      />
      <button
        type="button"
        className="card-mobile-grid-move-btn"
        onClick={() => setPopupOpen(true)}
        disabled={!gridEnabled || !selected || available.length === 0}
        data-testid="mobile-grid-move-btn"
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
