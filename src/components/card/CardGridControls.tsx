import React, { useEffect, useMemo, useState } from 'react';
import type { BusinessCard, BusinessCardLayout, CardGrid } from '../../utils/documentSchemas';
import { deriveGridFromLayout } from '../../utils/documentSchemas';
import {
  allElementOptionsForSide,
  getAvailableGridElements,
  gridForCollisions,
  type GridSide,
} from '../../utils/card/gridElements';
import {
  canMove as canMoveUtil,
  canResize as canResizeUtil,
  wouldCollideOnMove,
  wouldCollideOnResize,
} from '../../utils/gridUtils';

export type { GridSide };

export interface CardGridControlsProps {
  card: BusinessCard;
  side: GridSide;
  /** Master switch (REQ-E01): quando false, i controlli sono disabilitati. */
  gridEnabled: boolean;
  onSideChange: (s: GridSide) => void;
  onChangeGrid: (grid: CardGrid) => void;
  /** Elemento selezionato (controllato dal parent per persistenza cross-tab). */
  selected: keyof CardGrid['elements'] | '';
  onSelect: (k: keyof CardGrid['elements'] | '') => void;
  /** Phase 2.3: applica un preset di griglia (callback opzionale). */
  onApplyPreset?: (p: BusinessCardLayout) => void;
  /** Restituisce informazioni sulla mossa applicata (per toast feedback in G). */
  onAfterMove?: (info: { element: string; dx: number; dy: number; applied: boolean; reason?: 'collision' | 'border' }) => void;
  onAfterResize?: (info: { element: string; dw: number; dh: number; applied: boolean; reason?: 'collision' | 'border' }) => void;
  onAfterAlign?: (info: { element: string; alignH: 'left' | 'center' | 'right'; alignV: 'top' | 'center' | 'bottom' }) => void;
  /**
   * TB-023: when selected element is `photo`, allow nudging its position
   * and scale inside the cell via the parent grid patch.
   */
  onPatchPhotoPlacement?: (patch: { x?: number; y?: number; scale?: number }) => void;
  /**
   * Modalità presentazione:
   *  - 'inline' (default desktop): mostra frecce + ridimensiona inline
   *  - 'mobile': nasconde le frecce/resize inline; il parent gestisce la
   *    popup separatamente (vedi MobileGridEditor).
   */
  mode?: 'inline' | 'mobile';
}

// Phase 2.2 REQ-B02: controlli grid condivisi desktop/mobile. Render inline
// (usato in desktop), il wrapping con popup è responsabilità di MobileGridEditor.
export function CardGridControls({
  card,
  side,
  gridEnabled,
  onSideChange,
  onChangeGrid,
  onApplyPreset,
  selected,
  onSelect,
  onAfterMove,
  onAfterResize,
  onAfterAlign,
  onPatchPhotoPlacement,
  mode = 'inline',
}: CardGridControlsProps) {
  const activeGrid: CardGrid = useMemo(() => {
    if (side === 'back') {
      return card.backGrid ?? deriveGridFromLayout(card, 'back');
    }
    return card.grid ?? deriveGridFromLayout(card, 'front');
  }, [side, card]);

  const availableElements = useMemo(() => getAvailableGridElements(side, card), [side, card]);
  const selectedEl = selected ? activeGrid.elements[selected] : undefined;
  // Collisioni solo vs elementi con contenuto (services vuoto non blocca socials).
  const collisionGrid = useMemo(
    () => gridForCollisions(activeGrid, card, side, selected || undefined),
    [activeGrid, card, side, selected],
  );

  // Fix: il preset selezionato deve restare visibile nel dropdown (prima
  // si resettava subito a ", seleziona preset:"). Stato locale persistente,
  // resettato quando cambia il lato (i preset differiscono fronte/retro).
  const [presetChoice, setPresetChoice] = useState<string>('');
  useEffect(() => { setPresetChoice(''); }, [side]);

  const canMoveLeft  = !!selectedEl && selectedEl.x > 0
    && !wouldCollideOnMove(collisionGrid, selected, -1, 0);
  const canMoveUp    = !!selectedEl && selectedEl.y > 0
    && !wouldCollideOnMove(collisionGrid, selected, 0, -1);
  const canMoveRight = !!selectedEl && selectedEl.x + selectedEl.w < activeGrid.cols
    && !wouldCollideOnMove(collisionGrid, selected, 1, 0);
  const canMoveDown  = !!selectedEl && selectedEl.y + selectedEl.h < activeGrid.rows
    && !wouldCollideOnMove(collisionGrid, selected, 0, 1);
  const canShrinkW = !!selectedEl && selectedEl.w > 1;
  const canGrowW   = !!selectedEl && selectedEl.x + selectedEl.w < activeGrid.cols
    && !wouldCollideOnResize(collisionGrid, selected, 1, 0);
  const canShrinkH = !!selectedEl && selectedEl.h > 1;
  const canGrowH   = !!selectedEl && selectedEl.y + selectedEl.h < activeGrid.rows
    && !wouldCollideOnResize(collisionGrid, selected, 0, 1);

  const isSideDisabled = !gridEnabled;
  const disabledTitle = gridEnabled ? '' : 'Griglia OFF, attivala per spostare elementi';

  const handleMove = (dx: number, dy: number) => {
    if (!selected) return;
    const el = activeGrid.elements[selected];
    if (!el) return;
    const x = el.x + dx, y = el.y + dy;
    if (x < 0 || y < 0 || x + el.w > activeGrid.cols || y + el.h > activeGrid.rows) {
      onAfterMove?.({ element: selected, dx, dy, applied: false, reason: 'border' });
      return;
    }
    if (wouldCollideOnMove(collisionGrid, selected, dx, dy)) {
      onAfterMove?.({ element: selected, dx, dy, applied: false, reason: 'collision' });
      return;
    }
    onChangeGrid(
      { ...activeGrid, elements: { ...activeGrid.elements, [selected]: { ...el, x, y } } },
    );
    onAfterMove?.({ element: selected, dx, dy, applied: true });
  };

  const handleResize = (dw: number, dh: number) => {
    if (!selected) return;
    const el = activeGrid.elements[selected];
    if (!el) return;
    const nw = el.w + dw, nh = el.h + dh;
    if (nw < 1 || nh < 1 || el.x + nw > activeGrid.cols || el.y + nh > activeGrid.rows) {
      onAfterResize?.({ element: selected, dw, dh, applied: false, reason: 'border' });
      return;
    }
    if (wouldCollideOnResize(collisionGrid, selected, dw, dh)) {
      onAfterResize?.({ element: selected, dw, dh, applied: false, reason: 'collision' });
      return;
    }
    onChangeGrid(
      { ...activeGrid, elements: { ...activeGrid.elements, [selected]: { ...el, w: nw, h: nh } } },
    );
    onAfterResize?.({ element: selected, dw, dh, applied: true });
  };

  const handleSetGridSize = (cols: number, rows: number) => {
    if (cols < 2 || cols > 8 || rows < 2 || rows > 8) return;
    onChangeGrid({ ...activeGrid, cols, rows });
  };

  // Atomic: un solo onChangeGrid. Due chiamate separate (alignH poi alignV)
  // si basavano sullo stesso selectedEl e la seconda sovrascriveva la prima
  // → es. click "Centro" applicava solo alignV e il nome restava a destra.
  const handleAlign = (
    alignH: 'left' | 'center' | 'right',
    alignV: 'top' | 'center' | 'bottom',
  ) => {
    if (!selected || !selectedEl) return;
    onChangeGrid({
      ...activeGrid,
      elements: {
        ...activeGrid.elements,
        [selected]: { ...selectedEl, alignH, alignV },
      },
    });
    onAfterAlign?.({ element: selected, alignH, alignV });
  };

  const isPhotoSelected = selected === 'photo';
  const photoPlacement = selectedEl?.photoPlacement ?? { x: 0, y: 0, scale: 1 };

  const handlePatchPhotoPlacement = (patch: { x?: number; y?: number; scale?: number }) => {
    if (!isPhotoSelected || !onPatchPhotoPlacement) return;
    onPatchPhotoPlacement({
      x: patch.x ?? photoPlacement.x,
      y: patch.y ?? photoPlacement.y,
      scale: patch.scale ?? photoPlacement.scale,
    });
  };

  const elementOptions = allElementOptionsForSide(side);

  return (
    <div
      className="card-grid-editor"
      data-testid="card-grid-editor"
      data-disabled={isSideDisabled || undefined}
    >
      <div className="card-grid-editor-title">Sposta elementi sulla griglia</div>
      {isSideDisabled && (
        <p className="card-grid-editor-hint" data-testid="grid-editor-disabled-hint">
          Attiva <strong>“Griglia ON”</strong> in alto a destra per spostare e ridimensionare gli elementi.
        </p>
      )}
      <label className="card-field">
        <span>Lato</span>
        <select
          value={side}
          onChange={(e) => {
            const s = e.target.value as GridSide;
            onSideChange(s);
          }}
          disabled={isSideDisabled}
          aria-label="Lato griglia"
          data-testid="grid-editor-side"
        >
          <option value="front">Fronte</option>
          <option value="back">Retro</option>
        </select>
      </label>
      <label className="card-field">
        <span>Preset griglia</span>
        <select
          value={presetChoice}
          disabled={isSideDisabled}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') { setPresetChoice(''); return; }
            // Persisti la scelta nel dropdown (resta visibile)
            setPresetChoice(v);
            // Delego SEMPRE al parent: il parent conosce `applyGridPreset`
            // che SOSTITUISCE completamente la grid (no merge → no duplicati
            // di elementi come `logo` che cambiavano solo posizione).
            if (typeof onApplyPreset === 'function') {
              onApplyPreset(v as BusinessCardLayout);
              return;
            }
            // Fallback solo se il parent non passa onApplyPreset (es. test).
            const FRONT_PRESETS: Record<BusinessCardLayout, CardGrid> = {
              left: { cols: 4, rows: 4, elements: { photo: { x: 0, y: 0, w: 2, h: 4 }, name: { x: 2, y: 0, w: 2, h: 1 }, title: { x: 2, y: 1, w: 2, h: 1 }, company: { x: 2, y: 2, w: 2, h: 1 }, logo: { x: 0, y: 3, w: 2, h: 1 } } },
              centered: { cols: 4, rows: 4, elements: { photo: { x: 1, y: 0, w: 2, h: 1 }, name: { x: 0, y: 1, w: 4, h: 1 }, title: { x: 0, y: 2, w: 4, h: 1 }, company: { x: 0, y: 3, w: 2, h: 1 }, logo: { x: 2, y: 3, w: 2, h: 1 } } },
              split: { cols: 4, rows: 4, elements: { photo: { x: 0, y: 0, w: 2, h: 4 }, name: { x: 2, y: 0, w: 2, h: 1 }, title: { x: 2, y: 1, w: 2, h: 1 }, company: { x: 2, y: 2, w: 2, h: 1 }, logo: { x: 2, y: 3, w: 2, h: 1 } } },
              right: { cols: 4, rows: 4, elements: { photo: { x: 2, y: 0, w: 2, h: 4 }, name: { x: 0, y: 0, w: 2, h: 1 }, title: { x: 0, y: 1, w: 2, h: 1 }, company: { x: 0, y: 2, w: 2, h: 1 }, logo: { x: 0, y: 3, w: 2, h: 1 } } },
              top: { cols: 4, rows: 4, elements: { photo: { x: 0, y: 0, w: 4, h: 2 }, name: { x: 0, y: 2, w: 4, h: 1 }, title: { x: 0, y: 3, w: 2, h: 1 }, company: { x: 2, y: 3, w: 2, h: 1 }, logo: { x: 1, y: 3, w: 2, h: 1 } } },
              bottom: { cols: 4, rows: 4, elements: { photo: { x: 0, y: 3, w: 4, h: 1 }, name: { x: 0, y: 0, w: 4, h: 1 }, title: { x: 0, y: 1, w: 4, h: 1 }, logo: { x: 0, y: 2, w: 2, h: 1 }, company: { x: 2, y: 2, w: 2, h: 1 } } },
              minimal: { cols: 4, rows: 4, elements: { logo: { x: 1, y: 0, w: 2, h: 1 }, photo: { x: 1, y: 0, w: 2, h: 1 }, name: { x: 0, y: 1, w: 4, h: 1 }, title: { x: 0, y: 2, w: 4, h: 1 }, company: { x: 0, y: 3, w: 4, h: 1 } } },
              'photo-circle': { cols: 4, rows: 4, elements: { photo: { x: 1, y: 0, w: 2, h: 2 }, name: { x: 0, y: 2, w: 4, h: 1 }, title: { x: 0, y: 3, w: 3, h: 1 }, company: { x: 3, y: 3, w: 1, h: 1 }, logo: { x: 3, y: 3, w: 1, h: 1 } } },
              compact: { cols: 4, rows: 4, elements: { photo: { x: 0, y: 0, w: 1, h: 2 }, logo: { x: 0, y: 2, w: 1, h: 2 }, name: { x: 1, y: 0, w: 3, h: 1 }, title: { x: 1, y: 1, w: 3, h: 1 }, company: { x: 1, y: 2, w: 3, h: 1 } } },
            };
            // Must match gridPresetBackDefault() (contacts + services + socials + qr).
            const grid = side === 'back'
              ? {
                cols: 4,
                rows: 4,
                elements: {
                  contacts: { x: 0, y: 0, w: 2, h: 2, alignH: 'left' as const, alignV: 'top' as const },
                  services: { x: 0, y: 2, w: 2, h: 1, alignH: 'left' as const, alignV: 'top' as const },
                  socials: { x: 0, y: 3, w: 2, h: 1, alignH: 'left' as const, alignV: 'top' as const },
                  qr: { x: 2, y: 0, w: 2, h: 4, alignH: 'center' as const, alignV: 'center' as const },
                },
              }
              : FRONT_PRESETS[v as BusinessCardLayout] ?? FRONT_PRESETS.left;
            onChangeGrid(grid);
          }}
          aria-label="Preset griglia"
          data-testid="grid-editor-preset"
        >
          <option value="">Seleziona un preset</option>
          {side === 'front' ? (
            <>
              <option value="left">Sinistra (foto a sx)</option>
              <option value="centered">Centrato</option>
              <option value="split">Diviso (foto a sx)</option>
              <option value="right">Diviso inverso (foto a dx)</option>
              <option value="top">Foto in alto</option>
              <option value="bottom">Foto in basso</option>
              <option value="minimal">Minimal</option>
              <option value="photo-circle">Foto tonda centrata</option>
              <option value="compact">Compatto</option>
            </>
          ) : (
            <option value="split">Default retro (contatti + QR + social)</option>
          )}
        </select>
      </label>
      <label className="card-field">
        <span>Elemento selezionato</span>
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value as keyof CardGrid['elements'] | '')}
          // FIX: il selettore deve essere abilitato quando la griglia è ON,
          // anche se nessun elemento è ancora selezionato (altrimenti è
          // impossibile selezionare il primo, chicken-and-egg).
          disabled={isSideDisabled}
          aria-label="Elemento selezionato"
        >
          <option value="">Nessun elemento selezionato</option>
          {availableElements.map((el) => (
            <option key={el.value} value={el.value}>{el.label}</option>
          ))}
          {availableElements.length === 0 && (
            <option value="" disabled>Nessun elemento con contenuto</option>
          )}
          {availableElements.length > 0 && elementOptions
            .filter((opt) => !availableElements.find((a) => a.value === opt.value))
            .map((opt) => (
              <option key={opt.value} value={opt.value} disabled>{opt.label} (senza contenuto)</option>
            ))}
        </select>
      </label>
      <div className="card-row-2">
        <label className="card-field">
          <span>Colonne ({activeGrid.cols})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => handleSetGridSize(Math.max(2, activeGrid.cols - 1), activeGrid.rows)}
              disabled={isSideDisabled || activeGrid.cols <= 2}
              aria-label="Diminuisci colonne"
              className="card-preview-zoom-btn"
            >−</button>
            <button
              type="button"
              onClick={() => handleSetGridSize(Math.min(8, activeGrid.cols + 1), activeGrid.rows)}
              disabled={isSideDisabled || activeGrid.cols >= 8}
              aria-label="Aumenta colonne"
              className="card-preview-zoom-btn"
            >+</button>
          </div>
        </label>
        <label className="card-field">
          <span>Righe ({activeGrid.rows})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => handleSetGridSize(activeGrid.cols, Math.max(2, activeGrid.rows - 1))}
              disabled={isSideDisabled || activeGrid.rows <= 2}
              aria-label="Diminuisci righe"
              className="card-preview-zoom-btn"
            >−</button>
            <button
              type="button"
              onClick={() => handleSetGridSize(activeGrid.cols, Math.min(8, activeGrid.rows + 1))}
              disabled={isSideDisabled || activeGrid.rows >= 8}
              aria-label="Aumenta righe"
              className="card-preview-zoom-btn"
            >+</button>
          </div>
        </label>
      </div>
      {selectedEl && mode === 'inline' && (
        <div className="card-grid-align" role="group" aria-label="Allineamento elemento">
          <span className="card-grid-align-label">Posizione 3×3</span>
          <div className="card-grid-align-matrix" data-testid="grid-align-matrix">
            {[
              { alignH: 'left', alignV: 'top', label: '↖', title: 'Alto-sinistra' },
              { alignH: 'center', alignV: 'top', label: '↑', title: 'Alto-centro' },
              { alignH: 'right', alignV: 'top', label: '↗', title: 'Alto-destra' },
              { alignH: 'left', alignV: 'center', label: '←', title: 'Centro-sinistra' },
              { alignH: 'center', alignV: 'center', label: '·', title: 'Centro' },
              { alignH: 'right', alignV: 'center', label: '→', title: 'Centro-destra' },
              { alignH: 'left', alignV: 'bottom', label: '↙', title: 'Basso-sinistra' },
              { alignH: 'center', alignV: 'bottom', label: '↓', title: 'Basso-centro' },
              { alignH: 'right', alignV: 'bottom', label: '↘', title: 'Basso-destra' },
            ].map((pos) => {
              const active = (selectedEl.alignH ?? 'center') === pos.alignH && (selectedEl.alignV ?? 'center') === pos.alignV;
              return (
                <button
                  key={`${pos.alignH}-${pos.alignV}`}
                  type="button"
                  className={active ? 'active' : ''}
                  disabled={isSideDisabled}
                  aria-label={pos.title}
                  title={pos.title}
                  onClick={() => {
                    handleAlign(
                      pos.alignH as 'left' | 'center' | 'right',
                      pos.alignV as 'top' | 'center' | 'bottom',
                    );
                  }}
                  data-testid={`grid-align-${pos.alignH}-${pos.alignV}`}
                >
                  {pos.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {mode === 'inline' && (
        <>
          <div className="card-grid-arrows" role="group" aria-label="Sposta elemento">
            <button
              type="button"
              onClick={() => handleMove(-1, 0)}
              disabled={!canMoveLeft}
              aria-label="Sposta a sinistra"
              title={!canMoveLeft ? (selectedEl?.x === 0 ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Sposta a sinistra'}
              data-testid="grid-move-left"
              className={!canMoveLeft ? 'blocked' : ''}
            ><span aria-hidden="true">←</span></button>
            <button
              type="button"
              onClick={() => handleMove(0, -1)}
              disabled={!canMoveUp}
              aria-label="Sposta su"
              title={!canMoveUp ? (selectedEl?.y === 0 ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Sposta su'}
              data-testid="grid-move-up"
              className={!canMoveUp ? 'blocked' : ''}
            ><span aria-hidden="true">↑</span></button>
            <button
              type="button"
              onClick={() => handleMove(0, 1)}
              disabled={!canMoveDown}
              aria-label="Sposta giù"
              title={!canMoveDown ? ((selectedEl?.y ?? 0) + (selectedEl?.h ?? 0) >= activeGrid.rows ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Sposta giù'}
              data-testid="grid-move-down"
              className={!canMoveDown ? 'blocked' : ''}
            ><span aria-hidden="true">↓</span></button>
            <button
              type="button"
              onClick={() => handleMove(1, 0)}
              disabled={!canMoveRight}
              aria-label="Sposta a destra"
              title={!canMoveRight ? ((selectedEl?.x ?? 0) + (selectedEl?.w ?? 0) >= activeGrid.cols ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Sposta a destra'}
              data-testid="grid-move-right"
              className={!canMoveRight ? 'blocked' : ''}
            ><span aria-hidden="true">→</span></button>
          </div>
          <div className="card-grid-resize" role="group" aria-label="Ridimensiona elemento">
            <button
              type="button"
              onClick={() => handleResize(-1, 0)}
              disabled={!canShrinkW}
              aria-label="Riduci larghezza"
              title={!canShrinkW ? 'Larghezza minima 1' : disabledTitle || 'Riduci larghezza'}
              data-testid="grid-resize-w-minus"
              className={!canShrinkW ? 'blocked' : ''}
            ><span aria-hidden="true">−↔</span></button>
            <button
              type="button"
              onClick={() => handleResize(1, 0)}
              disabled={!canGrowW}
              aria-label="Aumenta larghezza"
              title={!canGrowW ? (selectedEl && selectedEl.x + selectedEl.w >= activeGrid.cols ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Aumenta larghezza'}
              data-testid="grid-resize-w-plus"
              className={!canGrowW ? 'blocked' : ''}
            ><span aria-hidden="true">+↔</span></button>
            <button
              type="button"
              onClick={() => handleResize(0, -1)}
              disabled={!canShrinkH}
              aria-label="Riduci altezza"
              title={!canShrinkH ? 'Altezza minima 1' : disabledTitle || 'Riduci altezza'}
              data-testid="grid-resize-h-minus"
              className={!canShrinkH ? 'blocked' : ''}
            ><span aria-hidden="true">−↕</span></button>
            <button
              type="button"
              onClick={() => handleResize(0, 1)}
              disabled={!canGrowH}
              aria-label="Aumenta altezza"
              title={!canGrowH ? (selectedEl && selectedEl.y + selectedEl.h >= activeGrid.rows ? 'Limite (bordo)' : 'Bloccato (collisione)') : disabledTitle || 'Aumenta altezza'}
              data-testid="grid-resize-h-plus"
              className={!canGrowH ? 'blocked' : ''}
            ><span aria-hidden="true">+↕</span></button>
          </div>
          {isPhotoSelected && onPatchPhotoPlacement && (
            <div className="card-photo-placement" role="group" aria-label="Posiziona foto dentro cella" data-testid="grid-photo-placement">
              <span className="card-grid-align-label">Nudge foto</span>
              <div className="card-grid-arrows">
                <button
                  type="button"
                  onClick={() => handlePatchPhotoPlacement({ x: Math.max(-1, photoPlacement.x - 0.05) })}
                  aria-label="Sposta foto sinistra"
                  title="Sposta foto sinistra"
                  disabled={photoPlacement.x <= -1}
                  data-testid="grid-photo-left"
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePatchPhotoPlacement({ y: Math.max(-1, photoPlacement.y - 0.05) })}
                  aria-label="Sposta foto su"
                  title="Sposta foto su"
                  disabled={photoPlacement.y <= -1}
                  data-testid="grid-photo-up"
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePatchPhotoPlacement({ y: Math.min(1, photoPlacement.y + 0.05) })}
                  aria-label="Sposta foto giù"
                  title="Sposta foto giù"
                  disabled={photoPlacement.y >= 1}
                  data-testid="grid-photo-down"
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePatchPhotoPlacement({ x: Math.min(1, photoPlacement.x + 0.05) })}
                  aria-label="Sposta foto destra"
                  title="Sposta foto destra"
                  disabled={photoPlacement.x >= 1}
                  data-testid="grid-photo-right"
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
              <label className="card-field card-field--tight">
                <span>Zoom foto ({(photoPlacement.scale * 100).toFixed(0)}%)</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={photoPlacement.scale}
                  onChange={(e) => handlePatchPhotoPlacement({ scale: Number(e.target.value) })}
                  aria-label="Zoom foto"
                  data-testid="grid-photo-zoom"
                />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}
